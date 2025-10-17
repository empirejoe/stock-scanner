import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import fs from 'fs/promises';
import scanMarket from './scanner.js';
import saveSignup from './signupHandler.js';

const app = express();
const PORT = 3001;
const DATA_FILE = './data/topGainers.json';

app.use(cors());
app.use(express.json());

// Endpoint to get top gainers
app.get('/api/top-gainers', async (req, res) => {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: 'No data available yet' });
  }
});

// Endpoint to handle signups
app.post('/api/signup', async (req, res) => {
  const { email, phone, interest, source } = req.body;
  
  // Validate input
  if (!email || !phone || !interest) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required fields' 
    });
  }
  
  const finalSource = source || 'StockMarketToday.com';
  console.log(`📝 NEW SIGNUP:`);
  console.log(`   Email: ${email}`);
  console.log(`   Phone: ${phone}`);
  console.log(`   Interest: ${interest}`);
  console.log(`   Source: ${finalSource}`);
  
  // Save to Google Sheets
  const result = await saveSignup(email, phone, interest, finalSource);
  
  res.json(result);
});

// Schedule scans during market hours
cron.schedule('45 9 * * 1-5', () => {
  console.log('⏰ Morning scan at 9:45 AM ET...');
  scanMarket();
}, {
  timezone: "America/New_York"
});

cron.schedule('0 12 * * 1-5', () => {
  console.log('⏰ Midday scan at 12:00 PM ET...');
  scanMarket();
}, {
  timezone: "America/New_York"
});

cron.schedule('30 16 * * 1-5', () => {
  console.log('⏰ End of day scan at 4:30 PM ET...');
  scanMarket();
}, {
  timezone: "America/New_York"
});

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log('🚀 Stock Market Today API is RUNNING!');
  console.log('🚀 ========================================');
  console.log('');
  console.log(`📊 API running at: http://localhost:${PORT}`);
  console.log(`📈 Get data at: http://localhost:${PORT}/api/top-gainers`);
  console.log(`💾 Signup endpoint: http://localhost:${PORT}/api/signup`);
  console.log('');
  console.log('⏰ Auto-scan schedule (Monday-Friday, ET):');
  console.log('   - 9:45 AM  - Morning scan (15 min after open)');
  console.log('   - 12:00 PM - Midday scan');
  console.log('   - 4:30 PM  - End of day scan (after close)');
  console.log('');
  console.log('💡 Press Ctrl+C to stop the server');
  console.log('');
});