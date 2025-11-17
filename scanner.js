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
              <a href="{{unsubscribe}}" style="color: #6B7280; text
