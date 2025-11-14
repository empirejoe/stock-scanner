const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const ALPHA_VANTAGE_KEY = 'PXHA4QFY5C2PEB4N';
const FINNHUB_API_KEY = 'd3n5abhr01qk6515r7fgd3n5abhr01qk6515r7g0';

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

async function fetchMarketMovers() {
  try {
    console.log('🔍 Fetching from Alpha Vantage...');
    const url = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${ALPHA_VANTAGE_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.Note) {
      console.error('⚠️ API LIMIT:', data.Note);
      return null;
    }
    
    if (data['Error Message']) {
      console.error('❌ ERROR:', data['Error Message']);
      return null;
    }
    
    if (data.top_gainers && data.top_losers) {
      const gainers = data.top_gainers.slice(0, 20).map(stock => ({
        ticker: stock.ticker,
        name: stock.ticker,
        price: parseFloat(stock.price),
        change: parseFloat(stock.change_percentage.replace('%', '')),
        chartData: generateChartData(parseFloat(stock.change_percentage.replace('%', '')))
      }));

      const losers = data.top_losers.slice(0, 20).map(stock => ({
        ticker: stock.ticker,
        name: stock.ticker,
        price: parseFloat(stock.price),
        change: parseFloat(stock.change_percentage.replace('%', '')),
        chartData: generateChartData(parseFloat(stock.change_percentage.replace('%', '')))
      }));

      console.log(`✅ Top Gainer: ${gainers[0]?.ticker} +${gainers[0]?.change}%`);
      console.log(`❄️ Top Loser: ${losers[0]?.ticker} ${losers[0]?.change}%`);

      return { gainers, losers };
    }
    
    return null;
  } catch (error) {
    console.error('💥 Error:', error);
    return null;
  }
}

app.get('/api/top-gainers', async (req, res) => {
  try {
    const now = Date.now();
    
    if (cachedMarketData.lastUpdated && (now - cachedMarketData.lastUpdated) < 5 * 60 * 1000) {
      return res.json({
        gainers: cachedMarketData.gainers,
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
        gainers: marketData.gainers,
        lastUpdated: new Date(now).toISOString(),
        source: 'alpha_vantage'
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
    
    if (cachedMarketData.lastUpdated && (now - cachedMarketData.lastUpdated) < 5 * 60 * 1000) {
      return res.json({
        losers: cachedMarketData.losers,
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
        losers: marketData.losers,
        lastUpdated: new Date(now).toISOString(),
        source: 'alpha_vantage'
      });
    }

    res.status(503).json({ error: 'Market data unavailable' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch losers' });
  }
});

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

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    cacheStatus: cachedMarketData.lastUpdated ? 'Active' : 'Empty'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Stock Market API v2.0',
    endpoints: {
      health: '/health',
      topGainers: '/api/top-gainers',
      topLosers: '/api/top-losers',
      marketSentiment: '/api/market-sentiment'
    }
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('🚀 Stock Market API Started!');
  console.log(`📡 Port: ${PORT}`);
});

module.exports = app;
```

### **4. Scroll down and click "Commit changes"**
- Add commit message: "Add Alpha Vantage API for real market data"
- Click green "Commit changes" button

### **5. Render Will Auto-Deploy**
- Go to https://dashboard.render.com
- Watch your service deploy (takes 2-3 minutes)
- Look for "Live" status

### **6. Test Again**
Open in browser:
```
https://stock-scanner-za3b.onrender.com/health