const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const businessCallController = require('./controllers/businessCallController');
const googleSheetsService = require('./services/googleSheetsService'); // NEW: Add this import
const config = require('../config/config');
const logger = require('./utils/logger');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

// Serve static files from public directory
app.use('/public', express.static(path.join(__dirname, '../public')));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Business Support Twilio webhook routes
app.post('/webhook/voice', businessCallController.handleIncomingCall);
app.post('/webhook/gather', businessCallController.handleGatherInput);
app.post('/webhook/status', businessCallController.handleCallStatus);

// Existing admin API routes
app.get('/admin/urgent-cases', businessCallController.getUrgentCases);
app.get('/admin/scheduled-callbacks', businessCallController.getScheduledCallbacks);

// NEW: Enhanced admin routes with Google Sheets and statistics
app.get('/admin/statistics', businessCallController.getStatistics);
app.post('/admin/update-case', businessCallController.updateCaseStatus);

// NEW: Google Sheets integration routes
app.get('/admin/sheets/urgent', async (req, res) => {
  try {
    const cases = await googleSheetsService.getUrgentCases();
    res.json({ 
      success: true, 
      cases: cases,
      count: cases.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting urgent cases from sheets:', error);
    res.status(500).json({ error: 'Failed to get urgent cases from Google Sheets' });
  }
});

app.get('/admin/sheets/callbacks', async (req, res) => {
  try {
    const callbacks = await googleSheetsService.getCallbackRequests();
    res.json({ 
      success: true, 
      callbacks: callbacks,
      count: callbacks.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting callbacks from sheets:', error);
    res.status(500).json({ error: 'Failed to get callbacks from Google Sheets' });
  }
});

// NEW: Update case status in Google Sheets
app.post('/admin/sheets/update-case', async (req, res) => {
  try {
    const { referenceNumber, status, notes } = req.body;
    const result = await googleSheetsService.updateCaseStatus(referenceNumber, status, notes);
    res.json(result);
  } catch (error) {
    logger.error('Error updating case status:', error);
    res.status(500).json({ error: 'Failed to update case status' });
  }
});

// NEW: Update callback status in Google Sheets
app.post('/admin/sheets/update-callback', async (req, res) => {
  try {
    const { referenceNumber, status, notes } = req.body;
    const result = await googleSheetsService.updateCallbackStatus(referenceNumber, status, notes);
    res.json(result);
  } catch (error) {
    logger.error('Error updating callback status:', error);
    res.status(500).json({ error: 'Failed to update callback status' });
  }
});

// Admin Dashboard HTML route
app.get('/admin/dashboard', (req, res) => {
  const dashboardPath = path.join(__dirname, '../public/admin-dashboard.html');
  res.sendFile(dashboardPath, (err) => {
    if (err) {
      logger.error('Dashboard file not found:', err);
      res.status(404).json({ 
        error: 'Admin dashboard not found',
        message: 'Please ensure admin-dashboard.html exists in the public folder'
      });
    }
  });
});

// Alternative admin route (serves the same dashboard)
app.get('/admin', (req, res) => {
  res.redirect('/admin/dashboard');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Enhanced Swiss German Business Support AI Agent'
  });
});

// Root endpoint with full system information
app.get('/', (req, res) => {
  res.json({
    message: 'Enhanced Swiss German Business Support AI Agent is running!',
    description: 'AI agent with ElevenLabs voice and Google Sheets integration',
    
    callFlow: {
      step1: 'Customer calls → "Grüezi! Was isch passiert? Wie chan ich euch hälfe?"',
      step2: 'AI analyzes → URGENT or NOT URGENT',
      step3a_urgent: 'If URGENT → Take detailed message',
      step4a_urgent: 'If URGENT → Ask for business address (REQUIRED)',
      step5a_urgent: 'If URGENT → Provide reference number + save to Google Sheets',
      step3b_nonUrgent: 'If NOT URGENT → "Öis Team wird sich mälde"',
      step4b_nonUrgent: 'If NOT URGENT → Ask when to call back (NO ADDRESS)',
      step5b_nonUrgent: 'If NOT URGENT → Schedule callback + save to Google Sheets'
    },

    newFeatures: {
      elevenLabs: 'Natural Swiss German voice synthesis',
      googleSheets: 'Automatic data storage and team collaboration',
      enhancedAdmin: 'Real-time statistics and case management',
      voiceCloning: 'Custom Swiss German voice options'
    },

    urgentExamples: [
      'Öisi Websiite isch komplett kaputt',
      'Mir chönd kei Zahlige verarbeite', 
      'Date sind verlore',
      'Sicherheitsproblem/Hack',
      'System-Absturz'
    ],

    nonUrgentExamples: [
      'Ich ha e Frag über Features',
      'Chönd der mir hälfe mit Iistellige?',
      'Schuligs-Aafrag',
      'Allgemeni Informatione'
    ],

    adminDashboard: {
      url: '/admin/dashboard',
      alternativeUrl: '/admin',
      description: 'Enhanced dashboard with Google Sheets integration',
      features: [
        'Real-time case monitoring from Google Sheets',
        'Update case status directly',
        'Export data to CSV',
        'Auto-refresh every 30 seconds',
        'Call transcription logs',
        'Voice quality analytics'
      ]
    },

    endpoints: {
      health: '/health',
      voice: '/webhook/voice',
      gather: '/webhook/gather',
      status: '/webhook/status',
      
      // Memory-based endpoints
      urgentCases: '/admin/urgent-cases',
      scheduledCallbacks: '/admin/scheduled-callbacks',
      
      // Google Sheets endpoints
      sheetsUrgent: '/admin/sheets/urgent',
      sheetsCallbacks: '/admin/sheets/callbacks',
      updateCase: '/admin/sheets/update-case',
      updateCallback: '/admin/sheets/update-callback',
      
      // Dashboard
      adminDashboard: '/admin/dashboard',
      adminShortcut: '/admin',
      statistics: '/admin/statistics'
    },

    integrations: {
      twilio: 'Voice calls and SMS',
      openai: 'AI conversation analysis',
      elevenLabs: 'Natural voice synthesis',
      googleSheets: 'Data storage and collaboration'
    }
  });
});

// Test route for debugging
app.get('/test', (req, res) => {
  res.json({
    message: 'Enhanced AI Agent test endpoint working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: config.PORT,
    features: {
      elevenLabs: !!config.ELEVENLABS_API_KEY,
      googleSheets: !!config.GOOGLE_SHEET_ID,
      twilio: !!config.TWILIO_ACCOUNT_SID,
      openai: !!config.OPENAI_API_KEY
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler - this should be LAST
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    requestedPath: req.path,
    availableEndpoints: [
      '/',
      '/health', 
      '/test',
      '/admin',
      '/admin/dashboard',
      '/admin/urgent-cases',
      '/admin/scheduled-callbacks',
      '/admin/statistics',
      '/admin/sheets/urgent',
      '/admin/sheets/callbacks',
      '/webhook/voice (POST)',
      '/webhook/gather (POST)',
      '/webhook/status (POST)'
    ]
  });
});

const PORT = config.PORT || 3000;

app.listen(PORT, () => {
  logger.info('🏢 Enhanced Swiss German Business Support AI Agent running on port ' + PORT);
  logger.info('📞 Voice webhook: ' + (config.WEBHOOK_BASE_URL || 'http://localhost:' + PORT) + '/webhook/voice');
  logger.info('🎙️  ElevenLabs: ' + (config.ELEVENLABS_API_KEY ? 'Enabled' : 'Disabled'));
  logger.info('📊 Google Sheets: ' + (config.GOOGLE_SHEET_ID ? 'Enabled' : 'Disabled'));
  logger.info('🚨 Urgent cases API: http://localhost:' + PORT + '/admin/urgent-cases');
  logger.info('📞 Callbacks API: http://localhost:' + PORT + '/admin/scheduled-callbacks');
  logger.info('📊 Sheets urgent: http://localhost:' + PORT + '/admin/sheets/urgent');
  logger.info('📊 Sheets callbacks: http://localhost:' + PORT + '/admin/sheets/callbacks');
  logger.info('🖥️  Admin Dashboard: http://localhost:' + PORT + '/admin/dashboard');
  logger.info('📈 Statistics: http://localhost:' + PORT + '/admin/statistics');
  logger.info('🏥 Health check: http://localhost:' + PORT + '/health');
  logger.info('🔍 Test endpoint: http://localhost:' + PORT + '/test');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;