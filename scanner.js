const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const Anthropic = require('@anthropic-ai/sdk');
const mongoose = require('mongoose');
const cheerio = require('cheerio');
const sgMail = require('@sendgrid/mail');

const app = express();
app.use(cors());
app.use(express.json());

const POLYGON_API_KEY = 't_RrZpaMlwv9kmfeYM0I0x71Wn_DmlOH';
const FINNHUB_API_KEY = 'd3n5abhr01qk6515r7fgd3n5abhr01qk6515r7g0';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'alerts@stockmarkettoday.com';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
sgMail.setApiKey(SENDGRID_API_KEY);

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

const subscriberSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  phone: String,
  interest: String,
  source: { type: String, default: 'StockMarketToday.com' },
  subscribed: { type: Boolean, default: true },
  subscribedAt: { type: Date, default: Date.now },
  unsubscribedAt: Date,
  lastEmailSent: Date
});

const Article = mongoose.model('Article', articleSchema);
const Subscriber = mongoose.model('Subscriber', subscriberSchema);

let cachedMarketData = { gainers: [], losers: [], lastUpdated: null };
let recentlyMentionedStocks = [];

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
    
    const gainersUrl = 'https://finviz.com/screener.ashx?v=111&f=sh_curvol_o500&ft=4&o=-change';
    console.log('🔍 Fetching gainers from Finviz...');
    const gainersResponse = await fetch(gainersUrl, { headers });
    const gainersHtml = await gainersResponse.text();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const losersUrl = 'https://finviz.com/screener.ashx?v=111&f=sh_curvol_o500&ft=4&o=change';
    console.log('🔍 Fetching losers from Finviz...');
    const losersResponse = await fetch(losersUrl, { headers });
    const losersHtml = await losersResponse.text();
    
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

function extractStockTickers(text) {
  const tickerRegex = /\$([A-Z]{2,5})\b/g;
  const matches = text.match(tickerRegex) || [];
  return [...new Set(matches.map(m => m.replace('$', '')))];
}

// EMAIL TEMPLATE
function createDailyEmailTemplate(data) {
  const { gainers, losers, sentiment, articles } = data;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stock Market Today - Daily Recap</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #1E2A38;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1E2A38;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #0F1419; border-radius: 16px; overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF8C00 0%, #FF6B00 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; font-size: 32px; font-weight: 900; margin: 0 0 10px 0;">📈 STOCK MARKET TODAY</h1>
              <p style="color: #ffffff; font-size: 16px; margin: 0; opacity: 0.9;">Your Daily Market Recap</p>
            </td>
          </tr>

          <!-- Market Sentiment -->
          <tr>
            <td style="padding: 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background: ${sentiment.color === 'green' ? 'rgba(16, 185, 129, 0.1)' : sentiment.color === 'red' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(251, 146, 60, 0.1)'}; border: 2px solid ${sentiment.color === 'green' ? 'rgba(16, 185, 129, 0.3)' : sentiment.color === 'red' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(251, 146, 60, 0.3)'}; border-radius: 12px; padding: 20px; text-align: center;">
                    <p style="color: #9CA3AF; font-size: 14px; margin: 0 0 5px 0; text-transform: uppercase; font-weight: 700;">Market Sentiment</p>
                    <h2 style="color: ${sentiment.color === 'green' ? '#10B981' : sentiment.color === 'red' ? '#EF4444' : '#FB923C'}; font-size: 36px; font-weight: 900; margin: 0 0 5px 0;">${sentiment.text}</h2>
                    <p style="color: #9CA3AF; font-size: 14px; margin: 0;">SPY: ${sentiment.spyChange > 0 ? '+' : ''}${sentiment.spyChange}%</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Top Gainers -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h3 style="color: #10B981; font-size: 20px; font-weight: 900; margin: 0 0 15px 0;">🚀 TOP GAINERS</h3>
              ${gainers.slice(0, 3).map(stock => `
                <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(17, 24, 39, 0.5); border: 2px solid rgba(55, 65, 81, 1); border-radius: 12px; margin-bottom: 12px; padding: 15px;">
                  <tr>
                    <td>
                      <p style="color: #ffffff; font-size: 18px; font-weight: 900; margin: 0 0 5px 0;">$${stock.ticker}</p>
                      <p style="color: #9CA3AF; font-size: 14px; margin: 0;">${stock.name}</p>
                    </td>
                    <td align="right">
                      <p style="color: #10B981; font-size: 24px; font-weight: 900; margin: 0;">+${stock.change.toFixed(2)}%</p>
                      <p style="color: #9CA3AF; font-size: 14px; margin: 0;">$${stock.price.toFixed(2)}</p>
                    </td>
                  </tr>
                </table>
              `).join('')}
            </td>
          </tr>

          <!-- Top Losers -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h3 style="color: #EF4444; font-size: 20px; font-weight: 900; margin: 0 0 15px 0;">📉 TOP LOSERS</h3>
              ${losers.slice(0, 3).map(stock => `
                <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(17, 24, 39, 0.5); border: 2px solid rgba(55, 65, 81, 1); border-radius: 12px; margin-bottom: 12px; padding: 15px;">
                  <tr>
                    <td>
                      <p style="color: #ffffff; font-size: 18px; font-weight: 900; margin: 0 0 5px 0;">$${stock.ticker}</p>
                      <p style="color: #9CA3AF; font-size: 14px; margin: 0;">${stock.name}</p>
                    </td>
                    <td align="right">
                      <p style="color: #EF4444; font-size: 24px; font-weight: 900; margin: 0;">${stock.change.toFixed(2)}%</p>
                      <p style="color: #9CA3AF; font-size: 14px; margin: 0;">$${stock.price.toFixed(2)}</p>
                    </td>
                  </tr>
                </table>
              `).join('')}
            </td>
          </tr>

          <!-- Latest Articles -->
          ${articles && articles.length > 0 ? `
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h3 style="color: #FF8C00; font-size: 20px; font-weight: 900; margin: 0 0 15px 0;">📰 LATEST ARTICLES</h3>
              ${articles.slice(0, 2).map(article => `
                <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(17, 24, 39, 0.5); border: 2px solid rgba(55, 65, 81, 1); border-radius: 12px; margin-bottom: 12px; padding: 15px;">
                  <tr>
                    <td>
                      <p style="color: #ffffff; font-size: 16px; font-weight: 700; margin: 0 0 8px 0;">${article.title}</p>
                      <p style="color: #9CA3AF; font-size: 14px; margin: 0 0 12px 0;">${article.excerpt.substring(0, 100)}...</p>
                      <a href="https://stockmarkettoday.com/blog/${article.slug}" style="display: inline-block; background: #FF8C00; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 14px;">Read More →</a>
                    </td>
                  </tr>
                </table>
              `).join('')}
            </td>
          </tr>
          ` : ''}

          <!-- CTA -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #FF8C00 0%, #FF6B00 100%); border-radius: 12px; padding: 25px; text-align: center;">
                <tr>
                  <td>
                    <p style="color: #ffffff; font-size: 20px; font-weight: 900; margin: 0 0 10px 0;">Never Miss a Big Move!</p>
                    <p style="color: #ffffff; font-size: 14px; margin: 0 0 20px 0; opacity: 0.9;">Get instant SMS alerts when stocks explode</p>
                    <a href="https://stockmarkettoday.com/sign-up" style="display: inline-block; background: #ffffff; color: #FF8C00; text-decoration: none; padding: 14px 30px; border-radius: 10px; font-weight: 900; font-size: 16px;">Get Free Alerts →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px; text-align: center; border-top: 1px solid rgba(55, 65, 81, 1);">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0 0 10px 0;">
                © 2025 StockMarketToday.com | Market Intelligence Platform
              </p>
              <p style="color: #6B7280; font-size: 11px; margin: 0 0 15px 0;">
                This is not financial advice. Trade at your own risk.
              </p>
              <a href="https://stockmarkettoday.com" style="color: #FF8C00; text-decoration: none; font-size: 12px; margin-right: 15px;">Visit Website</a>
              <a href="{{unsubscribe}}" style="color: #6B7280; text-decoration: none; font-size: 12px;">Unsubscribe</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// SEND DAILY EMAIL TO ALL SUBSCRIBERS
async function sendDailyEmails() {
  try {
    console.log('📧 Sending daily emails to subscribers...');
    
    const subscribers = await Subscriber.find({ subscribed: true });
    
    if (subscribers.length === 0) {
      console.log('⚠️ No active subscribers to email');
      return;
    }

    const marketData = await fetchMarketMovers();
    if (!marketData || marketData.gainers.length === 0) {
      console.log('⚠️ No market data available for email');
      return;
    }

    const spyResponse = await fetch(`https://finnhub.io/api/v1/quote?symbol=SPY&token=${FINNHUB_API_KEY}`);
    const spyData = await spyResponse.json();
    const spyChange = spyData.dp || 0;
    let sentiment = {
      text: spyChange > 1 ? 'Bullish' : spyChange < -1 ? 'Bearish' : 'Mixed',
      color: spyChange > 1 ? 'green' : spyChange < -1 ? 'red' : 'orange',
      spyChange: spyChange.toFixed(2)
    };

    const articles = await Article.find().sort({ publishedAt: -1 }).limit(2);

    const emailHtml = createDailyEmailTemplate({
      gainers: marketData.gainers,
      losers: marketData.losers,
      sentiment,
      articles
    });

    const batchSize = 100;
    let sentCount = 0;
    
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      
      const messages = batch.map(sub => ({
        to: sub.email,
        from: {
          email: SENDGRID_FROM_EMAIL,
          name: 'Stock Market Today'
        },
        subject: `📈 Market Recap: ${sentiment.text} Day | Top Movers Inside`,
        html: emailHtml,
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true }
        },
        asm: {
          groupId: 21234
        }
      }));

      try {
        await sgMail.send(messages);
        sentCount += batch.length;
        console.log(`✅ Sent ${batch.length} emails (${sentCount}/${subscribers.length})`);
        
        await Subscriber.updateMany(
          { _id: { $in: batch.map(s => s._id) } },
          { lastEmailSent: new Date() }
        );
        
        if (i + batchSize < subscribers.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error('Error sending email batch:', error);
      }
    }

    console.log(`✅ Daily emails sent to ${sentCount} subscribers`);
    
  } catch (error) {
    console.error('Error in sendDailyEmails:', error);
  }
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

    const article1 = await generateDailyArticle({ 
      ...baseData, 
      angle: 'opening',
      avoidStocks: [...recentlyMentionedStocks]
    });
    
    if (article1) {
      await saveArticle(article1);
      const stocksMentioned = extractStockTickers(article1.title + ' ' + article1.content);
      recentlyMentionedStocks.push(...stocksMentioned);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    const article2 = await generateDailyArticle({ 
      ...baseData, 
      angle: 'trends',
      avoidStocks: [...recentlyMentionedStocks]
    });
    
    if (article2) {
      await saveArticle(article2);
      const stocksMentioned = extractStockTickers(article2.title + ' ' + article2.content);
      recentlyMentionedStocks.push(...stocksMentioned);
    }
    
    if (recentlyMentionedStocks.length > 20) {
      recentlyMentionedStocks = recentlyMentionedStocks.slice(-20);
    }
    
    console.log('✅ Daily articles generation complete');
    console.log(`📝 Recently mentioned stocks: ${recentlyMentionedStocks.join(', ')}`);
  } catch (error) {
    console.error('Error generating daily articles:', error);
  }
}

async function generateDailyArticle(marketData) {
  try {
    const { gainers, losers, sentiment, angle, avoidStocks = [] } = marketData;
    
    let articleFocus = '';
    
    if (angle === 'opening') {
      articleFocus = `Focus this article on TODAY'S OVERALL MARKET ACTION and what's driving the biggest moves. Take a comprehensive "market open" perspective that covers:
- Overall market sentiment (SPY ${sentiment.spyChange}%)
- Top 3-5 biggest gainers and what's driving them
- Top 3-5 biggest losers and what's causing the declines
- Sector trends and rotation patterns
- Key market catalysts and news driving today's action

${avoidStocks.length > 0 ? `**CRITICAL: Avoid focusing on these stocks (already covered recently): ${avoidStocks.join(', ')}. Choose DIFFERENT stocks from the data provided.**` : ''}`;
    } else {
      articleFocus = `Focus this article on SECTOR TRENDS and TRADING OPPORTUNITIES in today's market. Take an analytical perspective that covers:
- Which sectors are leading/lagging today
- Common themes among top movers (biotech, tech, energy, etc.)
- Volume patterns and market breadth
- Trading strategies for volatile markets like today
- What traders should watch for the rest of the session

${avoidStocks.length > 0 ? `**CRITICAL: Avoid focusing on these stocks (already covered recently): ${avoidStocks.join(', ')}. Choose DIFFERENT stocks from the data provided.**` : ''}`;
    }

    const prompt = `You are a professional financial journalist writing for StockMarketToday.com, optimizing for the search term "Stock Market Today."

Write a comprehensive market overview article using this REAL data:

**Market Sentiment:** ${sentiment.text} (SPY: ${sentiment.spyChange}%)

**Top 5 Gainers Today:**
${gainers.map((s, i) => `${i + 1}. ${s.ticker}: +${s.change.toFixed(2)}% at $${s.price.toFixed(2)}`).join('\n')}

**Top 5 Losers Today:**
${losers.map((s, i) => `${i + 1}. ${s.ticker}: ${s.change.toFixed(2)}% at $${s.price.toFixed(2)}`).join('\n')}

${articleFocus}

**AGGRESSIVE SEO COPYWRITING REQUIREMENTS (800-1000 words):**

1. **Headline Formula:** Use power words and numbers
   - Include "Stock Market Today" at the start
   - Add urgency: "Breaking", "Alert", "Surge", "Crash", "Rally", "Soars", "Plunges"
   - Use numbers: "5 Stocks", "Top Movers", "3 Sectors"
   - Make it click-worthy but accurate

2. **Opening Paragraph (Hook):**
   - Start with the most dramatic market move
   - Use active voice and present tense
   - Include specific numbers and percentages
   - Create urgency and relevance
   - Make readers feel they need to keep reading

3. **SEO Keyword Density:**
   - Primary: "stock market today" (use 3-5 times naturally)
   - Secondary: "top gainers", "biggest movers", "market news", "stock trading"
   - Long-tail: "stocks to watch", "market analysis today", "best performing stocks"
   - Use variations naturally throughout

4. **Content Structure for SEO:**
   - Use H2 tags with keyword-rich headings
   - Short paragraphs (2-3 sentences max)
   - Bullet points for scannability
   - Bold key statistics and stock tickers
   - Answer "what, why, and what's next" clearly

5. **Engagement Tactics:**
   - Ask rhetorical questions to readers
   - Use "you" language to address traders directly
   - Create FOMO with phrases like "traders are watching", "institutional buying", "smart money"
   - Include specific price targets and levels
   - Make readers feel informed and ahead of the curve

6. **Call-to-Action Elements:**
   - Naturally mention "keep tracking" or "stay updated"
   - Reference "today's session" and "upcoming trading days"
   - Create anticipation for tomorrow
   - End with forward-looking statement

7. **Writing Style:**
   - Professional but conversational
   - Use strong action verbs: "surged", "plummeted", "rallied", "tanked", "soared", "crushed"
   - No fluff - every sentence adds value
   - Write for an 8th-grade reading level (wide audience)
   - Make complex concepts accessible

8. **Data-Driven Authority:**
   - Cite specific percentage moves
   - Reference volume data when significant
   - Mention sector performance
   - Compare to broader market (SPY, QQQ)
   - Use precise numbers to build credibility

9. **CRITICAL: Format ALL ticker symbols as cashtags** (e.g., $AAPL, $SPY, $NVDA)

10. **Meta Elements:**
    - Title should be 50-60 characters
    - Meta description should create urgency and include main keyword
    - Keywords should target trader intent and search behavior

Format as JSON:
{
  "title": "Stock Market Today: [Power Word] [Number] [Urgency Element] - [Main Move]",
  "excerpt": "Lead with the biggest market move. Create urgency. Use specific numbers. Make readers want more.",
  "content": "Full HTML article with SEO-optimized <h2>, <h3>, <p>, <strong> tags. Use $TICKER format throughout. Max engagement, max value.",
  "category": "Market Analysis",
  "keywords": ["stock market today", "top gainers today", "biggest movers", "market news", "stock trading"],
  "metaDescription": "Stock Market Today: [Main move] - [Key stat]. Discover which stocks are surging/crashing and what traders need to know NOW."
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
  let lastEmailSent = null;
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
    
    if (hour === 17 && minute === 0) {
      const today = now.toDateString();
      if (lastEmailSent !== today) {
        console.log(`⏰ Scheduled daily email at 5:00 PM`);
        sendDailyEmails();
        lastEmailSent = today;
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

// ROUTES

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

app.post('/api/send-daily-emails', async (req, res) => {
  try {
    await sendDailyEmails();
    res.json({ success: true, message: 'Daily emails sent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send emails' });
  }
});

// Sync subscriber to SendGrid Contacts
async function syncToSendGridContacts(subscriber) {
  try {
    const contactData = {
      contacts: [
        {
          email: subscriber.email,
          phone_number: subscriber.phone || '',
          custom_fields: {
            w1_T: subscriber.interest || 'General', // Interest
            w2_T: subscriber.source || 'StockMarketToday.com', // Source
            w3_D: subscriber.subscribedAt || new Date() // Subscribed Date
          }
        }
      ]
    };

    const response = await fetch('https://api.sendgrid.com/v3/marketing/contacts', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactData)
    });

    if (response.ok) {
      console.log(`📬 Synced to SendGrid Contacts: ${subscriber.email}`);
    } else {
      const error = await response.text();
      console.error(`⚠️ SendGrid sync failed: ${error}`);
    }
  } catch (error) {
    console.error('SendGrid contact sync error:', error);
  }
}

app.post('/api/signup', async (req, res) => {
  try {
    const { email, phone, interest, source } = req.body;
    
    let subscriber = await Subscriber.findOne({ email });
    
    if (subscriber) {
      if (!subscriber.subscribed) {
        subscriber.subscribed = true;
        subscriber.subscribedAt = new Date();
        await subscriber.save();
        
        // Sync to SendGrid
        syncToSendGridContacts(subscriber);
        
        return res.json({ success: true, message: 'Re-subscribed successfully' });
      }
      return res.json({ success: true, message: 'Already subscribed' });
    }
    
    subscriber = new Subscriber({
      email,
      phone,
      interest,
      source: source || 'StockMarketToday.com'
    });
    
    await subscriber.save();
    console.log(`✅ New subscriber: ${email}`);
    
    // Sync to SendGrid Contacts (non-blocking)
    syncToSendGridContacts(subscriber);
    
    res.json({ success: true, message: 'Subscribed successfully' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: 'Error saving signup' });
  }
});

app.post('/api/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body;
    
    const subscriber = await Subscriber.findOne({ email });
    if (subscriber) {
      subscriber.subscribed = false;
      subscriber.unsubscribedAt = new Date();
      await subscriber.save();
      console.log(`❌ Unsubscribed: ${email}`);
    }
    
    res.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error unsubscribing' });
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
    marketStatus: isMarketOpen() ? 'Open' : 'Closed',
    recentStocks: recentlyMentionedStocks.join(', ') || 'None',
    sendgrid: SENDGRID_API_KEY ? 'Configured' : 'Not configured'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Stock Market API v6.0 - Email Automation Enabled',
    endpoints: {
      health: '/health',
      topGainers: '/api/top-gainers',
      topLosers: '/api/top-losers',
      marketSentiment: '/api/market-sentiment',
      blogArticles: '/api/blog-articles',
      singleArticle: '/api/blog-articles/:slug',
      signup: 'POST /api/signup',
      unsubscribe: 'POST /api/unsubscribe',
      generateArticles: 'POST /api/generate-articles',
      sendDailyEmails: 'POST /api/send-daily-emails'
    }
  });
});

setTimeout(async () => {
  const articleCount = await Article.countDocuments();
  const subscriberCount = await Subscriber.countDocuments({ subscribed: true });
  
  console.log(`📚 Found ${articleCount} existing articles`);
  console.log(`📧 Found ${subscriberCount} active subscribers`);
  
  if (articleCount === 0) {
    console.log('🚀 Generating initial content...');
    await generateDailyArticles();
    await generateEvergreenContent();
  }
}, 10000);

scheduleArticleGeneration();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Stock Market API v6.0 - EMAIL AUTOMATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Port: ${PORT}`);
  console.log('📊 Data: Finviz scraping (Top 5 each, 500k+ vol)');
  console.log('🤖 AI Blog: AGGRESSIVE SEO + Duplicate Prevention');
  console.log('📧 Daily Emails: 5 PM ET (after market close)');
  console.log('📝 Daily articles: 2x daily (10AM, 2PM)');
  console.log('🔄 Data Updates: Every 12 minutes');
  console.log(`📅 Market Status: ${isMarketOpen() ? 'OPEN' : 'CLOSED'}`);
  console.log(`📬 SendGrid: ${SENDGRID_API_KEY ? 'CONFIGURED ✅' : 'NOT CONFIGURED ❌'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

module.exports = app;
