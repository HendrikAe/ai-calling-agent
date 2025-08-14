require('dotenv').config();

module.exports = {
  // Existing Twilio Configuration
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  
  // Existing OpenAI Configuration
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  
  // NEW: ElevenLabs Configuration
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  
  // NEW: Google Sheets Configuration
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
  
  // Existing Application Configuration
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  WEBHOOK_BASE_URL: process.env.WEBHOOK_BASE_URL || 'http://localhost:3000',
  
  // NEW: Optional AWS Configuration (for ElevenLabs audio storage in production)
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
  AWS_REGION: process.env.AWS_REGION || 'us-east-1'
};