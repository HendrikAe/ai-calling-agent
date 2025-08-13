const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const businessCallController = require('./controllers/businessCallController');
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

// Admin API routes
app.get('/admin/urgent-cases', businessCallController.getUrgentCases);
app.get('/admin/scheduled-callbacks', businessCallController.getScheduledCallbacks);

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
    service: 'Business Support AI Agent with Address Collection'
  });
});

// Root endpoint with full system information
app.get('/', (req, res) => {
  res.json({
    message: 'Business Support AI Agent is running!',
    description: 'Smart business support with urgent vs non-urgent handling',
    
    callFlow: {
      step1: 'Customer calls → "What happened? How can I help you today?"',
      step2: 'AI analyzes → URGENT or NOT URGENT',
      step3a_urgent: 'If URGENT → Take detailed message',
      step4a_urgent: 'If URGENT → Ask for business address (REQUIRED)',
      step5a_urgent: 'If URGENT → Provide reference number + immediate escalation',
      step3b_nonUrgent: 'If NOT URGENT → "Our team will reach out"',
      step4b_nonUrgent: 'If NOT URGENT → Ask when to call back (NO ADDRESS)',
      step5b_nonUrgent: 'If NOT URGENT → Schedule callback + reference number'
    },

    urgentExamples: [
      'Website completely down',
      'Cannot process payments', 
      'Data loss or corruption',
      'Security breach',
      'System crash affecting customers'
    ],

    nonUrgentExamples: [
      'Feature questions',
      'Training requests',
      'Account settings help', 
      'General inquiries',
      'Planning discussions'
    ],

    adminDashboard: {
      url: '/admin/dashboard',
      alternativeUrl: '/admin',
      description: 'Manage urgent cases and scheduled callbacks',
      features: [
        'Real-time case monitoring',
        'Mark cases as resolved',
        'Export data to CSV',
        'Auto-refresh every 30 seconds',
        'Mobile responsive design'
      ]
    },

    endpoints: {
      health: '/health',
      voice: '/webhook/voice',
      gather: '/webhook/gather',
      status: '/webhook/status',
      urgentCases: '/admin/urgent-cases',
      scheduledCallbacks: '/admin/scheduled-callbacks',
      adminDashboard: '/admin/dashboard',
      adminShortcut: '/admin'
    },

    quickTest: {
      healthCheck: 'GET /health',
      adminDashboard: 'GET /admin/dashboard',
      urgentCasesAPI: 'GET /admin/urgent-cases',
      callbacksAPI: 'GET /admin/scheduled-callbacks'
    }
  });
});

// Test route for debugging
app.get('/test', (req, res) => {
  res.json({
    message: 'Test endpoint working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: config.PORT
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
      '/webhook/voice (POST)',
      '/webhook/gather (POST)',
      '/webhook/status (POST)'
    ]
  });
});

const PORT = config.PORT || 3000;

app.listen(PORT, () => {
  logger.info('🏢 Business Support AI Agent (with Address Collection) running on port ' + PORT);
  logger.info('📞 Voice webhook: ' + (config.WEBHOOK_BASE_URL || 'http://localhost:' + PORT) + '/webhook/voice');
  logger.info('🚨 Urgent cases API: http://localhost:' + PORT + '/admin/urgent-cases');
  logger.info('📞 Callbacks API: http://localhost:' + PORT + '/admin/scheduled-callbacks');
  logger.info('🖥️  Admin Dashboard: http://localhost:' + PORT + '/admin/dashboard');
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