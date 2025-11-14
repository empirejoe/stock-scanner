const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

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

// Popular US stocks to scan
const STOCK_UNIVERSE = [
  // Mega Cap Tech
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'INTC', 'NFLX',
  // Large Cap Tech
  'CRM', 'ORCL', 'CSCO', 'ADBE', 'AVGO', 'TXN', 'QCOM', 'NOW', 'INTU', 'SNOW',
  // Meme/Retail Favorites
  'GME', 'AMC', 'PLTR', 'SOFI', 'RIVN', 'LCID', 'NIO', 'BBBY', 'HOOD', 'COIN',
  // EV & Auto
  'F', 'GM', 'STLA', 'XPEV', 'LI', 'FSR',
  // Fintech
  'PYPL', 'SQ', 'AFRM', 'UPST', 'V', 'MA',
  // Biotech/Pharma
  'MRNA', 'BNTX', 'PFE', 'JNJ', 'ABBV', 'GILD', 'REGN',
  // Energy
  'XOM', 'CVX', 'COP', 'SLB', 'EOG',
  // Crypto Related
  'MSTR', 'MARA', 'RIOT', 'CLSK',
  // Other Popular
  'DIS', 'BA', 'UBER', 'ABNB', 'DASH', 'SHOP', 'SPOT', 'ROKU', 'SNAP', 'PINS',
  'JPM', 'BAC', 'WFC', 'GS', 'C', 'WMT', 'TGT', 'COST', 'HD', 'LOW',
  // Small/Mid Cap Movers (commonly move big %)
  'PLUG', 'BLNK', 'CHPT', 'QS', 'GOEV', 'WKHS', 'RIDE', 'NKLA', 'HYLN', 'SPCE'
];

async function fetchStockQuote(ticker) {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`
    );
    const data = await response.json();
    
    if (data.c && data.dp !== null && data.c > 0) {
      return {
        ticker,
        name: ticker,
        price: data.c,
        change: data.dp,
        chartData: generateChartData(data.dp)
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching ${ticker}:`, error.message);
    return null;
  }
}

async function scanMarket() {
  console.log(`Scanning ${STOCK_UNIVERSE.length} stocks...`);
  
  const batchSize = 10;
  const allResults = [];
  
  for (let i = 0; i < STOCK_UNIVERSE.length; i += batchSize) {
    const batch = STOCK_UNIVERSE.slice(i, i + batchSize);
    const promises = batch.map(ticker => fetchStockQuote(ticker));
    const results = await Promise.all(promises);
    allResults.push(...results.filter(r => r !== null));
    
    // Small delay between batches to respect rate limits
    if (i + batchSize < STOCK_UNIVERSE.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`Successfully fetched ${allResults.length} stocks`);
  return allResults;
}

app.get('/api/top-gainers', async (req, res) => {
  try {
    const now = Date.now();
    
    if (cachedMarketData.lastUpdated && (now - cachedMarketData.lastUpdated) < 5 * 60 * 1000) {
      return res.json({
        gainers: cachedMarketData.gainers.slice(0, 10),
        lastUpdated: new Date(cachedMarketData.lastUpdated).toISOString(),
        source: 'cache'
      });
    }

    console.log('Fetching fresh market data...');
    const allStocks = await scanMarket();
    
    const gainers = allStocks
      .filter(stock => stock.change > 0)
      .sort((a, b) => b.change - a.change)
      .slice(0, 20);
      
    const losers = allStocks
      .filter(stock => stock.change < 0)
      .sort((a, b) => a.change - b.change)
      .slice(0, 20);

    cachedMarketData = { gainers, losers, lastUpdated: now };

    console.log(`Top Gainer: ${gainers[0]?.ticker} +${gainers[0]?.change.toFixed(2)}%`);
    console.log(`Top Loser: ${losers[0]?.ticker} ${losers[0]?.change.toFixed(2)}%`);

    return res.json({
      gainers: gainers.slice(0, 10),
      lastUpdated: new Date(now).toISOString(),
      source: 'finnhub'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch gainers' });
  }
});

app.get('/api/top-losers', async (req, res) => {
  try {
    const now = Date.now();
    
    if (cachedMarketData.lastUpdated && (now - cachedMarketData.lastUpdated) < 5 * 60 * 1000) {
      return res.json({
        losers: cachedMarketData.losers.slice(0, 10),
        lastUpdated: new Date(cachedMarketData.lastUpdated).toISOString(),
        source: 'cache'
      });
    }

    console.log('Fetching fresh market data...');
    const allStocks = await scanMarket();
    
    const gainers = allStocks
      .filter(stock => stock.change > 0)
      .sort((a, b) => b.change - a.change)
      .slice(0, 20);
      
    const losers = allStocks
      .filter(stock => stock.change < 0)
      .sort((a, b) => a.change - b.change)
      .slice(0, 20);

    cachedMarketData = { gainers, losers, lastUpdated: now };

    return res.json({
      losers: losers.slice(0, 10),
      lastUpdated: new Date(now).toISOString(),
      source: 'finnhub'
    });
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
    cacheStatus: cachedMarketData.lastUpdated ? 'Active' : 'Empty'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Stock Market API v2.0 - Finnhub',
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
  console.log('Stock Market API Started on port', PORT);
  console.log('Using Finnhub API for market data');
});

module.exports = app;
