import fetch from 'node-fetch';
import fs from 'fs/promises';

const DATA_FILE = './data/topGainers.json';

async function generateMockChartData(changePercent) {
  const points = 7;
  const data = [10];
  
  for (let i = 1; i < points; i++) {
    const progress = i / (points - 1);
    const volatility = Math.random() * 5 - 2.5;
    const value = 10 + (changePercent * progress) + volatility;
    data.push(Math.max(5, value));
  }
  
  data[data.length - 1] = 10 + changePercent;
  
  return data.map(v => Math.round(v * 10) / 10);
}

async function scanMarket() {
  console.log('🔍 Fetching top gainers from Yahoo Finance...');
  
  try {
    // Yahoo Finance API endpoint for day gainers
    const url = 'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=true&lang=en-US&region=US&scrIds=day_gainers&count=100';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const data = await response.json();
    
    if (!data.finance || !data.finance.result || !data.finance.result[0]) {
      console.log('❌ No data returned from Yahoo Finance');
      return saveFallbackData();
    }
    
    const quotes = data.finance.result[0].quotes;
    
    if (!quotes || quotes.length === 0) {
      console.log('❌ No stocks found in response');
      return saveFallbackData();
    }
    
    console.log(`✅ Found ${quotes.length} gainers from Yahoo Finance`);
    
    // Filter and format the top gainers
    const topGainers = quotes
      .filter(stock => {
        const change = stock.regularMarketChangePercent?.raw || 0;
        // Filter for stocks with big moves (10%+)
        return change >= 10;
      })
      .map(stock => ({
        ticker: stock.symbol,
        name: stock.shortName || stock.longName || stock.symbol,
        change: parseFloat((stock.regularMarketChangePercent?.raw || 0).toFixed(1)),
        price: stock.regularMarketPrice?.raw || 0
      }))
      .sort((a, b) => b.change - a.change)
      .slice(0, 3); // Top 3
    
    console.log(`✅ Filtered to ${topGainers.length} stocks with 10%+ gains`);
    
    if (topGainers.length === 0) {
      console.log('⚠️ No stocks found with 10%+ gains today');
      return saveFallbackData();
    }
    
    // Add chart data to each stock
    const enrichedGainers = await Promise.all(
      topGainers.map(async (stock) => ({
        ...stock,
        chartData: await generateMockChartData(stock.change)
      }))
    );
    
    // Save to file
    const saveData = {
      lastUpdated: new Date().toISOString(),
      gainers: enrichedGainers
    };
    
    await fs.mkdir('./data', { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(saveData, null, 2));
    
    console.log('✅ Top 3 gainers saved:');
    enrichedGainers.forEach((stock, i) => {
      console.log(`   ${i + 1}. ${stock.ticker} (+${stock.change}%) - ${stock.name}`);
    });
    
    return enrichedGainers;
    
  } catch (error) {
    console.error('❌ Error fetching from Yahoo Finance:', error.message);
    return saveFallbackData();
  }
}

async function saveFallbackData() {
  console.log('⚠️ Using fallback demo data');
  
  const fallbackData = {
    lastUpdated: new Date().toISOString(),
    gainers: [
      { ticker: 'DEMO', name: 'Demo Stock', change: 87.3, chartData: [10, 12, 15, 28, 45, 67, 87] },
      { ticker: 'TEST', name: 'Test Stock', change: 64.2, chartData: [10, 11, 13, 22, 38, 54, 64] },
      { ticker: 'EXPL', name: 'Example Corp', change: 52.1, chartData: [10, 12, 14, 20, 32, 44, 52] }
    ]
  };
  
  await fs.mkdir('./data', { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(fallbackData, null, 2));
  
  return fallbackData.gainers;
}

// Run immediately
scanMarket();

export default scanMarket;