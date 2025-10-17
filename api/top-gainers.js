import fs from 'fs/promises';

let cachedData = null;

export default async function handler(req, res) {
  try {
    // Try to read from file first
    const data = await fs.readFile('./data/topGainers.json', 'utf-8');
    const jsonData = JSON.parse(data);
    return res.json(jsonData);
  } catch (error) {
    // If file doesn't exist, return cached data or error
    if (cachedData) {
      return res.json(cachedData);
    }
    return res.status(500).json({ error: 'No data available yet' });
  }
}
