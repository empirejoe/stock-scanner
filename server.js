const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const Anthropic = require('@anthropic-ai/sdk');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

const POLYGON_API_KEY = 't_RrZpaMlwv9kmfeYM0I0x71Wn_DmlOH';
const FINNHUB_API_KEY = 'd3n5abhr01qk6515r7fgd3n5abhr01qk6515r7g0';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Article Schema
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

// Generate chart data
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

// Fetch market movers from Polygon
async function fetchMarketMovers() {
  try {
    console.log('Fetching ALL NYSE/NASDAQ stocks from Polygon...');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    const url = `https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${dateStr}?adjusted=true&apiKey=${POLYGON_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.results) {
      console.error('Polygon API error:', data);
      return null;
    }
    
    console.log(`Received ${data.results.length} stocks from Polygon`);
    
    const stocks = data.results
      .filter(stock => stock.o > 0 && stock.c > 0 && stock.v > 100000)
      .map(stock => {
        const changePercent = ((stock.c - stock.o) / stock.o) * 100;
        return {
          ticker: stock.T,
          name: stock.T,
          price: stock.c,
          change: changePercent,
          volume: stock.v,
          chartData: generateChartData(changePercent)
        };
      });
    
    const gainers = stocks
      .filter(s => s.change > 0)
      .sort((a, b) => b.change - a.change)
      .slice(0, 20);
    
    const losers = stocks
      .filter(s => s.change < 0)
      .sort((a, b) => a.change - b.change)
      .slice(0, 20);
    
    console.log(`Top Gainer: ${gainers[0]?.ticker} +${gainers[0]?.change.toFixed(2)}%`);
    console.log(`Top Loser: ${losers[0]?.ticker} ${losers[0]?.change.toFixed(2)}%`);
    
    return { gainers, losers };
  } catch (error) {
    console.error('Error fetching from Polygon:', error);
    return null;
  }
}

// Create URL-friendly slug
function createSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Generate DAILY market article
async function generateDailyArticle(marketData) {
  try {
    const { gainers, losers, sentiment } = marketData;
    
    const topGainer = gainers[0];
    const topLoser = losers[0];
    
    const prompt = `You are a professional financial journalist writing for StockMarketToday.com, creating content that will be indexed by search engines and LLMs.

Write an SEO-optimized, comprehensive blog article about today's stock market performance using this REAL market data:

**Market Sentiment:** ${sentiment.text} (SPY: ${sentiment.spyChange}%)
**Top Gainer:** ${topGainer.ticker} +${topGainer.change.toFixed(2)}% at $${topGainer.price.toFixed(2)}
**Top Loser:** ${topLoser.ticker} ${topLoser.change.toFixed(2)}% at $${topLoser.price.toFixed(2)}

**Additional Movers:**
${gainers.slice(1, 5).map(s => `- ${s.ticker}: +${s.change.toFixed(2)}%`).join('\n')}
${losers.slice(1, 3).map(s => `- ${s.ticker}: ${s.change.toFixed(2)}%`).join('\n')}

Write a detailed article (600-800 words) that:
1. Has a compelling, SEO-friendly headline (use keywords: stock market, stocks, trading, ${topGainer.ticker})
2. Opens with a strong summary paragraph
3. Analyzes what's driving these movements with specific data
4. Provides actionable insights for retail investors
5. Discusses sector trends and broader market context
6. Includes a forward-looking conclusion
7. Uses natural language optimized for both humans and AI indexing
8. **CRITICAL: Format ALL ticker symbols as cashtags with dollar signs (e.g., $NVDA, $TSLA, $AAPL, $SPY) throughout the entire article - this makes them clickable for readers**

Format as JSON:
{
  "title": "SEO headline with keywords",
  "excerpt": "Compelling 2-3 sentence summary with key stats",
  "content": "Full HTML article with <h2>, <h3>, <p>, <strong> tags for structure. Use $TICKER format for ALL stock symbols.",
  "category": "Market Analysis",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "metaDescription": "155-character SEO meta description with keywords"
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    });

    // Extract JSON from markdown code blocks if present
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
      image: `https://picsum.photos/seed/${Date.now()}/1200/630`,
      readTime: '6 min read',
      publishedAt: new Date()
    };
  } catch (error) {
    console.error('Error generating daily article:', error);
    return null;
  }
}

// Generate EVERGREEN article
async function generateEvergreenArticle() {
  try {
    const evergreenTopics = [
      'Complete Guide to Understanding Stock Market Indicators for Beginners',
      'How to Build a Diversified Investment Portfolio: Step-by-Step Strategy',
      'Technical Analysis 101: Essential Chart Patterns Every Trader Should Know',
      'Value Investing vs Growth Investing: Which Strategy is Right for You?',
      'Understanding Market Volatility: How to Protect Your Portfolio',
      'The Psychology of Trading: Overcoming Emotional Decision Making',
      'Dividend Investing Strategies: Building Passive Income Through Stocks',
      'How to Read Financial Statements: A Comprehensive Guide',
      'Options Trading Basics: Calls, Puts, and Strategic Applications',
      'Risk Management in Stock Trading: Essential Rules and Techniques',
      'Index Funds vs Individual Stocks: Pros and Cons for Long-Term Investors',
      'Market Timing vs Time in Market: What Research Actually Shows',
      'Understanding P/E Ratios and Other Valuation Metrics',
      'How Economic Indicators Affect Stock Prices: A Deep Dive',
      'Tax-Efficient Investing: Strategies to Maximize After-Tax Returns'
    ];

    const topic = evergreenTopics[Math.floor(Math.random() * evergreenTopics.length)];
    
    const prompt = `You are a professional financial educator writing comprehensive evergreen content for StockMarketToday.com that will be valuable for years and indexed by search engines and LLMs.

Write an in-depth, SEO-optimized educational article about: "${topic}"

Requirements:
1. Write 1000-1500 words of high-quality, comprehensive content
2. Structure with clear H2 and H3 headings
3. Include specific examples, data, and actionable advice
4. Explain concepts clearly for beginners while adding value for experienced investors
5. Use natural, engaging language optimized for both human readers and AI indexing
6. Include practical takeaways and next steps
7. Focus on timeless principles, not current events
8. **IMPORTANT: Format any stock ticker symbols mentioned as cashtags (e.g., $SPY, $QQQ, $AAPL, $VOO) to make them clickable**

Format as JSON:
{
  "title": "SEO-optimized title based on the topic",
  "excerpt": "Compelling 3-sentence summary that explains the value",
  "content": "Full HTML article with proper <h2>, <h3>, <p>, <ul>, <li>, <strong> tags. Use $TICKER format for any stock symbols.",
  "category": "Choose: Educational, Trading Strategies, or Investment Guide",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "metaDescription": "155-character SEO description"
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    // Extract JSON from markdown code blocks if present
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
      image: `https://picsum.photos/seed/invest${Date.now()}/1200/630`,
      readTime: '10 min read',
      publishedAt: new Date()
    };
  } catch (error) {
    console.error('Error generating evergreen article:', error);
    return null;
  }
}

// Save article to MongoDB
async function saveArticle(articleData) {
  try {
    const article = new Article(articleData);
    await article.save();
    console.log(`✅ Saved article: "${articleData.title}"`);
    return article;
  } catch (error) {
    if (error.code === 11000) {
      console.log(`⚠️ Article already exists: "${articleData.title}"`);
    } else {
      console.error('Error saving article:', error);
    }
    return null;
  }
}

// Generate daily articles (3 per day)
async function generateDailyArticles() {
  try {
    console.log('🤖 Generating daily market articles...');
    
    const marketData = await fetchMarketMovers();
    if (!marketData) {
      console.error('No market data available');
      return;
    }

    const spyResponse = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=SPY&token=${FINNHUB_API_KEY}`
    );
    const spyData = await spyResponse.json();
    
    const spyChange = spyData.dp || 0;
    let sentiment = spyChange > 1 ? 'Bullish' : spyChange < -1 ? 'Bearish' : 'Mixed';

    const fullMarketData = {
      gainers: marketData.gainers,
      losers: marketData.losers,
      sentiment: { text: sentiment, spyChange: spyChange.toFixed(2) }
    };

    // Generate 3 daily articles
    for (let i = 0; i < 3; i++) {
      const article = await generateDailyArticle(fullMarketData);
      if (article) {
        await saveArticle(article);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log('✅ Daily articles generation complete');
  } catch (error) {
    console.error('Error generating daily articles:', error);
  }
}

// Generate evergreen article
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

// Schedule article generation
function scheduleArticleGeneration() {
  let lastDailyGeneration = null;
  let evergreenCount = 0;
  
  setInterval(() => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const dayOfWeek = now.getDay();
    
    // Generate daily articles at 6 AM, 10 AM, 2 PM, 6 PM
    const dailyTimes = [6, 10, 14, 18];
    if (dailyTimes.includes(hour) && minute === 0) {
      const today = now.toDateString();
      if (lastDailyGeneration !== today + hour) {
        console.log(`⏰ Scheduled daily generation at ${hour}:00`);
        generateDailyArticles();
        lastDailyGeneration = today + hour;
      }
    }
    
    // Generate evergreen articles on Monday and Thursday at 9 AM
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

// API Endpoints

// Get all blog articles
app.get('/api/blog-articles', async (req, res) => {
  try {
    const articles = await Article.find()
      .sort({ publishedAt: -1 })
      .limit(50)
      .select('-content');
    
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
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// Get single article by slug
app.get('/api/blog-articles/:slug', async (req, res) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug });
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    res.json({
      id: article._id,
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      content: article.content,
      author: article.author,
      category: article.category,
      articleType: article.articleType,
      image: article.image,
      readTime: article.readTime,
      keywords: article.keywords,
      metaDescription: article.metaDescription,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt
    });
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// Manual trigger for article generation
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

// Top Gainers endpoint
app.get('/api/top-gainers', async (req, res) => {
  try {
    const now = Date.now();
    
    if (cachedMarketData.lastUpdated && (now - cachedMarketData.lastUpdated) < 12 * 60 * 1000) {
      return res.json({
        gainers: cachedMarketData.gainers.slice(0, 10),
        lastUpdated: new Date(cachedMarketData.lastUpdated).toISOString(),
        source: 'cache'
      });
    }

    const marketData = await fetchMarketMovers();
    
    if (marketData && marketData.gainers.length > 0) {
      cachedMarketData = {
        gainers: marketData.gainers,
        losers: marketData.losers,
        lastUpdated: now
      };

      return res.json({
        gainers: marketData.gainers.slice(0, 10),
        lastUpdated: new Date(now).toISOString(),
        source: 'polygon'
      });
    }

    res.status(503).json({ error: 'Market data unavailable' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch gainers' });
  }
});

// Top Losers endpoint
app.get('/api/top-losers', async (req, res) => {
  try {
    const now = Date.now();
    
    if (cachedMarketData.lastUpdated && (now - cachedMarketData.lastUpdated) < 12 * 60 * 1000) {
      return res.json({
        losers: cachedMarketData.losers.slice(0, 10),
        lastUpdated: new Date(cachedMarketData.lastUpdated).toISOString(),
        source: 'cache'
      });
    }

    const marketData = await fetchMarketMovers();
    
    if (marketData && marketData.losers.length > 0) {
      cachedMarketData = {
        gainers: marketData.gainers,
        losers: marketData.losers,
        lastUpdated: now
      };

      return res.json({
        losers: marketData.losers.slice(0, 10),
        lastUpdated: new Date(now).toISOString(),
        source: 'polygon'
      });
    }

    res.status(503).json({ error: 'Market data unavailable' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch losers' });
  }
});

// Market Sentiment endpoint
app.get('/api/market-sentiment', async (req, res) => {
  try {
    const spyResponse = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=SPY&token=${FINNHUB_API_KEY}`
    );
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

      return res.json({
        sentiment,
        color,
        spyChange: spyChange.toFixed(2),
        spyPrice: spyData.c
      });
    }

    res.status(500).json({ error: 'Unable to fetch SPY' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sentiment' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    cacheStatus: cachedMarketData.lastUpdated ? 'Active' : 'Empty'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Stock Market API v5.0 - AI Blog Generation',
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

// Generate initial articles on startup
setTimeout(async () => {
  const articleCount = await Article.countDocuments();
  if (articleCount === 0) {
    console.log('🚀 No articles found - generating initial content...');
    await generateDailyArticles();
    await generateEvergreenContent();
  } else {
    console.log(`📚 Found ${articleCount} existing articles in database`);
  }
}, 10000);

// Start scheduler
scheduleArticleGeneration();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Stock Market API v5.0 - AI BLOG EDITION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Port: ${PORT}`);
  console.log('📊 Market Coverage: ALL NYSE/NASDAQ stocks');
  console.log('🤖 AI Blog Generation: ENABLED');
  console.log('📝 Daily articles: 4x daily (6AM, 10AM, 2PM, 6PM)');
  console.log('📚 Evergreen articles: 2x weekly (Mon & Thu, 9AM)');
  console.log('💾 Storage: MongoDB (permanent)');
  console.log('🔍 SEO: Optimized for search + LLM indexing');
  console.log('💰 Cashtags: $TICKER format for clickable stocks');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

module.exports = app;