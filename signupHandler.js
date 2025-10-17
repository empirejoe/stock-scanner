import { google } from 'googleapis';

const SHEET_ID = '16DKI_uUTjy5mGzP7XgSnfoLqqlrOZXBJ9ezhaQ6DNV8';

async function saveSignup(email, phone, interest, source = 'StockMarketToday.com') {
  try {
    // Read credentials from environment variable
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    
    // Authenticate
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Prepare the data
    const timestamp = new Date().toLocaleString();
    
    const values = [[timestamp, email, phone, interest, source]];
    
    // Append to sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:E',
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });
    
    console.log(`✅ Signup saved! ${response.data.updates.updatedRows} row added.`);
    return { success: true, message: 'Signup saved successfully' };
    
  } catch (error) {
    console.error('❌ Error saving signup:', error.message);
    return { success: false, message: 'Error saving signup' };
  }
}

export default saveSignup;
