const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const Anthropic = require('@anthropic-ai/sdk');
const mongoose = require('mongoose');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

const POLYGON_API_KEY = 't_RrZpaMlwv9kmfeYM0I0x71Wn_DmlOH';
const FINNHUB_API_KEY = 'd3n5abhr01qk6515r7fgd3n5abhr01qk6515r7g0';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// 100+ US Stock Market Images - Diverse & Professional
const STOCK_MARKET_IMAGES = [
  'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1535320903710-d993d3d77d29?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1560221328-12fe60f83ab8?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1543286386-713bdd548da4?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1565514020179-026b92b84bb6?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1535378620166-273708d44e4c?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1560472355-536de3962603?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1642790551116-18e150f248e8?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1605792657660-596af9009e82?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1579532536935-619928decd08?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1624996379697-f01d168b1a52?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1200&h=630&fit=crop'
];

// US Stock Market Holidays 2025 (NYSE/NASDAQ closed)
const MARKET_HOLIDAYS_2025 = [
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-04-18', '2025-05-26',
  '2025-06-19', '2025-07-04', '2025-09-01', '2025-11-27', '2025-12-25'
];

function getRandomStockImage() {
  return STOCK_MARKET_IMAGES[Math.floor(Math.random() * STOCK_MARKET_IMAGES.length)];
}

function isMarketOpen() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const dateString = now.toISOString().split('T')[0];
  
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  if (MARKET_HOLIDAYS_2025.includes(dateString)) return false;
  
  return true;
}

mongoose.connect(MONGODB_URI)
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

const articleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  excerpt: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: String, default: 'Stock Market Today Editorial Team' },
  category: { type: String, required: true },
  articleType: { type: String, enum: ['daily', 'evergreen'], required: true },
  image: { type: String, required: true },
  readTime: { type: String, default: '5 min read' },
  keywords: [String],
  metaDescription: String,
  publishedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Article = mongoose.model('Article', articleSchema);

let cachedMarketData = { gainers: [], losers: [], lastUpdated: null };

function generateChartData(changePercent) {
  const points = 7;
  const data = [];
  const startValue = 10;
  const endValue = startValue + (startValue * changePercent / 100);
  
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    const value = startValue + (endValue - startValue) * progress * (0.8 + Math.random() * 0.4);
    data.push(Math.max(value, 1));
  }
  
  return data;
}

// Fetch market movers from Finviz (scraping)
async function fetchMarketMovers() {
  try {
    console.log('📊 Scraping Finviz for real-time top movers...');
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    
    // Fetch top gainers (DESCENDING order - highest % first)
    const gainersUrl = 'https://finviz.com/screener.ashx?v=111&f=sh_curvol_o500&ft=4&o=-change';
    console.log('🔍 Fetching gainers from Finviz...');
    const gainersResponse = await fetch(gainersUrl, { headers });
    const gainersHtml = await gainersResponse.text();
    
    // Delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Fetch top losers (ASCENDING order - most negative % first)
    const losersUrl = 'https://finviz.com/screener.ashx?v=111&f=sh_curvol_o500&ft=4&o=change';
    console.log('🔍 Fetching losers from Finviz...');
    const losersResponse = await fetch(losersUrl, { headers });
    const losersHtml = await losersResponse.text();
    
    // Parse gainers
    const $gainers = cheerio.load(gainersHtml);
    const gainers = [];
    
    $gainers('table tr').each((i, row) => {
      const cols = $gainers(row).find('td');
      
      if (cols.length >= 11 && i > 0) {
        const ticker = $gainers(cols[1]).text().trim();
        const priceText = $gainers(cols[8]).text().trim();
        const changeText = $gainers(cols[9]).text().trim();
        const volumeText = $gainers(cols[10]).text().trim();
        
        if (ticker && ticker.length <= 5) {
          const price = parseFloat(priceText);
          const change = parseFloat(changeText.replace('%', '').replace('+', ''));
          const volume = parseInt(volumeText.replace(/,/g, ''));
          
          if (!isNaN(price) && !isNaN(change) && !isNaN(volume)) {
            gainers.push({
              ticker,
              name: ticker,
              price,
              change: Math.abs(change),
              volume,
              chartData: generateChartData(Math.abs(change))
            });
          }
        }
      }
    });
    
    // Parse losers
    const $losers = cheerio.load(losersHtml);
    const losers = [];
    
    $losers('table tr').each((i, row) => {
      const cols = $losers(row).find('td');
      
      if (cols.length >= 11 && i > 0) {
        const ticker = $losers(cols[1]).text().trim();
        const priceText = $losers(cols[8]).text().trim();
        const changeText = $losers(cols[9]).text().trim();
        const volumeText = $losers(cols[10]).text().trim();
        
        if (ticker && ticker.length <= 5) {
          const price = parseFloat(priceText);
          let change = parseFloat(changeText.replace('%', '').replace('+', ''));
          const volume = parseInt(volumeText.replace(/,/g, ''));
          
          if (!isNaN(price) && !isNaN(change) && !isNaN(volume)) {
            if (change > 0) change = -change;
            losers.push({
              ticker,
              name: ticker,
              price,
              change: change,
              volume,
              chartData: generateChartData(change)
            });
          }
        }
      }
    });
    
    // Take top 5 from each
    const topGainers = gainers.slice(0, 5);
    const topLosers = losers.slice(0, 5);
    
    console.log(`🚀 Scraped ${topGainers.length} top gainers from Finviz`);
    console.log(`📉 Scraped ${topLosers.length} top losers from Finviz`);
    
    if (topGainers.length > 0) {
      console.log(`   #1 Gainer: ${topGainers[0].ticker} +${topGainers[0].change.toFixed(2)}%`);
    }
    if (topLosers.length > 0) {
      console.log(`   #1 Loser: ${topLosers[0].ticker} ${topLosers[0].change.toFixed(2)}%`);
    }
    
    return { 
      gainers: topGainers, 
      losers: topLosers 
    };
    
  } catch (error) {
    console.error('💥 Error scraping Finviz:', error.message);
    return { gainers: [], losers: [] };
  }
}

function createSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function generateDailyArticles() {
  try {
    console.log('🤖 Generating daily market articles...');
    
    const marketData = await fetchMarketMovers();
    if (!marketData || marketData.gainers.length === 0) {
      console.error('No market data available');
      return;
    }

    const spyResponse = await fetch(`https://finnhub.io/api/v1/quote?symbol=SPY&token=${FINNHUB_API_KEY}`);
    const spyData = await spyResponse.json();
    
    const spyChange = spyData.dp || 0;
    let sentiment = spyChange > 1 ? 'Bullish' : spyChange < -1 ? 'Bearish' : 'Mixed';

    const baseData = {
      gainers: marketData.gainers,
      losers: marketData.losers,
      sentiment: { text: sentiment, spyChange: spyChange.toFixed(2) }
    };

    // Article 1: Opening bell perspective / morning analysis
    const article1 = await generateDailyArticle({ ...baseData, angle: 'opening' });
    if (article1) {
      await saveArticle(article1);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Article 2: Market trends / sector rotation perspective
    const article2 = await generateDailyArticle({ ...baseData, angle: 'trends' });
    if (article2) {
      await saveArticle(article2);
    }
    
    console.log('✅ Daily articles generation complete');
  } catch (error) {
    console.error('Error generating daily articles:', error);
  }
}

async function generateDailyArticle(marketData) {
  try {
    const { gainers, losers, sentiment, angle } = marketData;
    
    let articleFocus = '';
    
    if (angle === 'opening') {
      articleFocus = `Focus this article on TODAY'S OVERALL MARKET ACTION and what's driving the biggest moves. Take a comprehensive "market open" perspective that covers:
- Overall market sentiment (SPY ${sentiment.spyChange}%)
- Top 3-5 biggest gainers and what's driving them
- Top 3-5 biggest losers and what's causing the declines
- Sector trends and rotation patterns
- Key market catalysts and news driving today's action`;
    } else {
      articleFocus = `Focus this article on SECTOR TRENDS and TRADING OPPORTUNITIES in today's market. Take an analytical perspective that covers:
- Which sectors are leading/lagging today
- Common themes among top movers (biotech, tech, energy, etc.)
- Volume patterns and market breadth
- Trading strategies for volatile markets like today
- What traders should watch for the rest of the session`;
    }

    const prompt = `You are a professional financial journalist writing for StockMarketToday.com, optimizing for the search term "Stock Market Today."

Write a comprehensive market overview article using this REAL data:

**Market Sentiment:** ${sentiment.text} (SPY: ${sentiment.spyChange}%)

**Top 5 Gainers Today:**
${gainers.map((s, i) => `${i + 1}. ${s.ticker}: +${s.change.toFixed(2)}% at $${s.price.toFixed(2)}`).join('\n')}

**Top 5 Losers Today:**
${losers.map((s, i) => `${i + 1}. ${s.ticker}: ${s.change.toFixed(2)}% at $${s.price.toFixed(2)}`).join('\n')}

${articleFocus}

Article Requirements (800-1000 words):
1. **SEO-optimized headline** starting with "Stock Market Today:" 
2. **Strong opening paragraph** summarizing today's market action
3. **Cover multiple top movers** (don't focus on just one stock)
4. **Discuss broader market trends** and what's driving today's volatility
5. **Include sector analysis** - which sectors are hot/cold
6. **Add market context** - mention relevant news, Fed policy, economic data, or major catalysts
7. **Provide actionable insights** for retail investors and traders
8. **Use natural, engaging language** that appeals to both beginners and experienced traders
9. **CRITICAL: Format ALL ticker symbols as cashtags** (e.g., $AAPL, $SPY, $NVDA)

Format as JSON:
{
  "title": "Stock Market Today: [compelling headline about today's market action]",
  "excerpt": "3-sentence summary covering overall market performance and key movers",
  "content": "Full HTML article with <h2>, <h3>, <p>, <strong> tags. Use $TICKER format throughout.",
  "category": "Market Analysis",
  "keywords": ["stock market today", "market movers", "top gainers", "top losers", "stock trading"],
  "metaDescription": "155-character description starting with 'Stock Market Today:'"
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    let responseText = message.content[0].text;
    if (responseText.includes('```json')) {
      responseText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      responseText = responseText.split('```')[1].split('```')[0].trim();
    }
    const articleData = JSON.parse(responseText);
    
    return {
      ...articleData,
      slug: createSlug(articleData.title),
      author: 'Stock Market Today Editorial Team',
      articleType: 'daily',
      image: getRandomStockImage(),
      readTime: '8 min read',
      publishedAt: new Date()
    };
  } catch (error) {
    console.error('Error generating daily article:', error);
    return null;
  }
}

async function generateEvergreenArticle() {
  try {
    const evergreenTopics = [
      'Complete Guide to Understanding Stock Market Indicators for Beginners',
      'How to Build a Diversified Investment Portfolio: Step-by-Step Strategy',
      'Technical Analysis 101: Essential Chart Patterns Every Trader Should Know',
      'Value Investing vs Growth Investing: Which Strategy is Right for You?',
      'Understanding Market Volatility: How to Protect Your Portfolio'
    ];

    const topic = evergreenTopics[Math.floor(Math.random() * evergreenTopics.length)];
    
    const prompt = `Write an in-depth, SEO-optimized educational article about: "${topic}"

Requirements:
1. Write 1000-1500 words
2. Structure with clear H2 and H3 headings
3. Include specific examples and actionable advice
4. **IMPORTANT: Format any stock ticker symbols as cashtags (e.g., $SPY, $QQQ, $AAPL)**

Format as JSON:
{
  "title": "SEO-optimized title",
  "excerpt": "Compelling 3-sentence summary",
  "content": "Full HTML article with <h2>, <h3>, <p>, <ul>, <li>, <strong> tags. Use $TICKER format.",
  "category": "Educational",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "metaDescription": "155-character SEO description"
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    let responseText = message.content[0].text;
    if (responseText.includes('```json')) {
      responseText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      responseText = responseText.split('```')[1].split('```')[0].trim();
    }
    const articleData = JSON.parse(responseText);
    
    return {
      ...articleData,
      slug: createSlug(articleData.title),
      author: 'Stock Market Today Editorial Team',
      articleType: 'evergreen',
      image: getRandomStockImage(),
      readTime: '10 min read',
      publishedAt: new Date()
    };
  } catch (error) {
    console.error('Error generating evergreen article:', error);
    return null;
  }
}

async function saveArticle(articleData) {
  try {
    const article = new Article(articleData);
    await article.save();
    console.log(`✅ Saved article: "${articleData.title}"`);
    return article;
  } catch (error) {
    if (error.code === 11000) {
      console.log(`⚠️ Article already exists`);
    } else {
      console.error('Error saving article:', error);
    }
    return null;
  }
}

async function generateEvergreenContent() {
  try {
    console.log('📚 Generating evergreen article...');
    const article = await generateEvergreenArticle();
    if (article) {
      await saveArticle(article);
      console.log('✅ Evergreen article generated');
    }
  } catch (error) {
    console.error('Error generating evergreen article:', error);
  }
}

function scheduleArticleGeneration() {
  let lastDailyGeneration = null;
  let evergreenCount = 0;
  
  setInterval(() => {
    if (!isMarketOpen()) return;
    
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const dayOfWeek = now.getDay();
    
    const dailyTimes = [10, 14];
    if (dailyTimes.includes(hour) && minute === 0) {
      const today = now.toDateString();
      if (lastDailyGeneration !== today + hour) {
        console.log(`⏰ Scheduled daily generation at ${hour}:00`);
        generateDailyArticles();
        lastDailyGeneration = today + hour;
      }
    }
    
    if ((dayOfWeek === 1 || dayOfWeek === 4) && hour === 9 && minute === 0) {
      const weekKey = `${now.getFullYear()}-W${Math.ceil(now.getDate() / 7)}-${dayOfWeek}`;
      if (evergreenCount !== weekKey) {
        console.log(`⏰ Scheduled evergreen generation`);
        generateEvergreenContent();
        evergreenCount = weekKey;
      }
    }
  }, 60000);
}

app.get('/api/blog-articles', async (req, res) => {
  try {
    const articles = await Article.find().sort({ publishedAt: -1 }).limit(50).select('-content');
    res.json({
      articles: articles.map(a => ({
        id: a._id,
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
        author: a.author,
        category: a.category,
        articleType: a.articleType,
        image: a.image,
        readTime: a.readTime,
        publishedAt: a.publishedAt
      })),
      count: articles.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

app.get('/api/blog-articles/:slug', async (req, res) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

app.post('/api/generate-articles', async (req, res) => {
  try {
    const { type } = req.body;
    if (type === 'evergreen') {
      await generateEvergreenContent();
      res.json({ success: true, message: 'Evergreen article generated' });
    } else {
      await generateDailyArticles();
      res.json({ success: true, message: 'Daily articles generated' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate articles' });
  }
});

app.get('/api/top-gainers', async (req, res) => {
  try {
    const now = Date.now();
    
    if (cachedMarketData.lastUpdated && (now - cachedMarketData.lastUpdated) < 12 * 60 * 1000) {
      console.log('📦 Returning cached gainers data');
      return res.json({
        gainers: cachedMarketData.gainers,
        lastUpdated: new Date(cachedMarketData.lastUpdated).toISOString(),
        source: 'cache'
      });
    }

    console.log('🔄 Fetching fresh gainers data...');
    const marketData = await fetchMarketMovers();
    
    if (marketData && marketData.gainers.length > 0) {
      cachedMarketData = {
        gainers: marketData.gainers,
        losers: marketData.losers,
        lastUpdated: now
      };

      return res.json({
        gainers: marketData.gainers,
        lastUpdated: new Date(now).toISOString(),
        source: 'live'
      });
    }

    res.status(503).json({ error: 'Market data unavailable' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch gainers' });
  }
});

app.get('/api/top-losers', async (req, res) => {
  try {
    const now = Date.now();
    
    if (cachedMarketData.lastUpdated && (now - cachedMarketData.lastUpdated) < 12 * 60 * 1000) {
      console.log('📦 Returning cached losers data');
      return res.json({
        losers: cachedMarketData.losers,
        lastUpdated: new Date(cachedMarketData.lastUpdated).toISOString(),
        source: 'cache'
      });
    }

    console.log('🔄 Fetching fresh losers data...');
    const marketData = await fetchMarketMovers();
    
    if (marketData && marketData.losers.length > 0) {
      cachedMarketData = {
        gainers: marketData.gainers,
        losers: marketData.losers,
        lastUpdated: now
      };

      return res.json({
        losers: marketData.losers,
        lastUpdated: new Date(now).toISOString(),
        source: 'live'
      });
    }

    res.status(503).json({ error: 'Market data unavailable' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch losers' });
  }
});

app.get('/api/market-sentiment', async (req, res) => {
  try {
    const spyResponse = await fetch(`https://finnhub.io/api/v1/quote?symbol=SPY&token=${FINNHUB_API_KEY}`);
    const spyData = await spyResponse.json();

    if (spyData && spyData.dp !== undefined) {
      const spyChange = spyData.dp;
      let sentiment, color;
      if (spyChange > 1) {
        sentiment = 'Bullish';
        color = 'green';
      } else if (spyChange < -1) {
        sentiment = 'Bearish';
        color = 'red';
      } else {
        sentiment = 'Mixed';
        color = 'orange';
      }

      return res.json({ sentiment, color, spyChange: spyChange.toFixed(2), spyPrice: spyData.c });
    }

    res.status(500).json({ error: 'Unable to fetch SPY' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sentiment' });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    cacheStatus: cachedMarketData.lastUpdated ? 'Active' : 'Empty',
    marketStatus: isMarketOpen() ? 'Open' : 'Closed'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Stock Market API v5.1 - Real-Time Market Movers',
    endpoints: {
      health: '/health',
      topGainers: '/api/top-gainers',
      topLosers: '/api/top-losers',
      marketSentiment: '/api/market-sentiment',
      blogArticles: '/api/blog-articles',
      singleArticle: '/api/blog-articles/:slug',
      generateArticles: 'POST /api/generate-articles'
    }
  });
});

setTimeout(async () => {
  const articleCount = await Article.countDocuments();
  if (articleCount === 0) {
    console.log('🚀 Generating initial content...');
    await generateDailyArticles();
    await generateEvergreenContent();
  } else {
    console.log(`📚 Found ${articleCount} existing articles`);
  }
}, 10000);

scheduleArticleGeneration();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Stock Market API v5.1 - REAL-TIME MOVERS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Port: ${PORT}`);
  console.log('📊 Data Source: Finviz (Top 5 gainers/losers, 500k+ volume)');
  console.log('🤖 AI Blog: "Stock Market Today" focused articles');
  console.log('📝 Daily articles: 2x daily (10AM, 2PM) - Market Days Only');
  console.log('📚 Evergreen articles: 2x weekly (Mon & Thu, 9AM)');
  console.log('🔄 Data Updates: Every 12 minutes');
  console.log(`📅 Market Status: ${isMarketOpen() ? 'OPEN' : 'CLOSED'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

module.exports = app;