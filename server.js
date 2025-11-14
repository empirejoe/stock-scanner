const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const POLYGON_API_KEY = 't_RrZpaMlwv9kmfeYM0I0x71Wn_DmlOH';
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
    console.log(`Total stocks scanned: ${stocks.length}`);
    
    return { gainers, losers };
  } catch (error) {
    console.error('Error fetching from Polygon:', error);
    return null;
  }
}

app.get('/api/top-gainers', async (req, res) => {
  try {
    const now = Date.now();
    
    if (cachedMarketData.lastUpdated && (now - cachedMarketData.lastUpdated) < 12 * 60 * 1000) {
      console.log('Returning cached gainers');
      return res.json({
        gainers: cachedMarketData.gainers.slice(0, 10),
        lastUpdated: new Date(cachedMarketData.lastUpdated).toISOString(),
        source: 'cache'
      });
    }

    console.log('Cache expired, fetching fresh data...');
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
        source: 'polygon',
        marketCoverage: 'All NYSE/NASDAQ stocks'
      });
    }

    res.status(503).json({ error: 'Market data unavailable' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch gainers' });
  }
});

app.get('/api/top-losers', async (req, res) => {
  try {
    const now = Date.now();
    
    if (cachedMarketData.lastUpdated && (now - cachedMarketData.lastUpdated) < 12 * 60 * 1000) {
      console.log('Returning cached losers');
      return res.json({
        losers: cachedMarketData.losers.slice(0, 10),
        lastUpdated: new Date(cachedMarketData.lastUpdated).toISOString(),
        source: 'cache'
      });
    }

    console.log('Cache expired, fetching fresh data...');
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
        source: 'polygon',
        marketCoverage: 'All NYSE/NASDAQ stocks'
      });
    }

    res.status(503).json({ error: 'Market data unavailable' });
  } catch (error) {
    console.error('Error:', error);
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
    cacheStatus: cachedMarketData.lastUpdated ? 'Active' : 'Empty',
    updateInterval: '12 minutes',
    marketCoverage: 'All NYSE/NASDAQ stocks'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Stock Market API v3.0',
    endpoints: {
      health: '/health',
      topGainers: '/api/top-gainers',
      topLosers: '/api/top-losers',
      marketSentiment: '/api/market-sentiment'
    },
    features: {
      marketCoverage: 'All NYSE/NASDAQ stocks',
      updateInterval: '12 minutes',
      dataSource: 'Polygon.io + Finnhub'
    }
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('Stock Market API Started on port', PORT);
  console.log('Market Coverage: ALL NYSE/NASDAQ stocks');
  console.log('Update Interval: 12 minutes');
});

module.exports = app;
