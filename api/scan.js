import scanMarket from '../scanner.js';

export default async function handler(req, res) {
  // Only allow POST requests (optional security)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    console.log('🔄 Manual scan triggered...');
    const gainers = await scanMarket();
    
    return res.status(200).json({
      success: true,
      message: 'Scan completed successfully',
      gainers: gainers
    });
  } catch (error) {
    console.error('Error during scan:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
