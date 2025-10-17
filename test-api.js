import fetch from 'node-fetch';

const API_KEY = 'd3n5abhr01qk6515r7fgd3n5abhr01qk6515r7g0';

async function testAPI() {
  console.log('');
  console.log('🔌 Testing Finnhub API connection...');
  console.log('');
  
  const url = `https://finnhub.io/api/v1/quote?symbol=TSLA&token=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.c && data.pc) {
      const change = ((data.c - data.pc) / data.pc * 100).toFixed(2);
      console.log('✅ ========================================');
      console.log('✅ API CONNECTION SUCCESSFUL!');
      console.log('✅ ========================================');
      console.log('');
      console.log(`📊 TSLA Current Price: $${data.c}`);
      console.log(`📈 Today's Change: ${change}%`);
      console.log('');
      console.log('🎉 You\'re ready to run the scanner!');
      console.log('');
    } else {
      console.log('❌ API returned unexpected data:', data);
    }
  } catch (error) {
    console.log('❌ Error connecting to API:', error.message);
  }
}

testAPI();