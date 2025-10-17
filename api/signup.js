import saveSignup from '../signupHandler.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
}
