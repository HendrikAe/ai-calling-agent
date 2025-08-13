const VoiceResponse = require('twilio').twiml.VoiceResponse;
const businessSupportService = require('../services/businessSupportService');
const logger = require('../utils/logger');

class OptimizedBusinessCallController {
  // Step 1: Incoming call - Ask "What happened?" (faster greeting)
  async handleIncomingCall(req, res) {
    const twiml = new VoiceResponse();
    const callSid = req.body.CallSid;
    const from = req.body.From;

    logger.info(`Call: ${callSid} from ${from}`);

    try {
      // Shorter, faster greeting
      twiml.say({
        voice: 'alice',
        rate: '1.0' // Slightly faster speech
      }, 'Business support. What happened? How can I help?');

      // Optimized gather settings
      const gather = twiml.gather({
        input: 'speech',
        timeout: 15, // Reduced timeout
        speechTimeout: 3, // Faster speech detection
        action: '/webhook/gather',
        method: 'POST'
      });

      twiml.say('Please call back with your issue.');
      twiml.hangup();

      res.type('text/xml');
      res.send(twiml.toString());

    } catch (error) {
      logger.error('Error in handleIncomingCall:', error);
      handleError(res);
    }
  }

  // Optimized gather handler with better error handling
  async handleGatherInput(req, res) {
    const twiml = new VoiceResponse();
    const speechResult = req.body.SpeechResult || '';
    const callSid = req.body.CallSid;
    const confidence = req.body.Confidence || 0;

    logger.info(`Speech: "${speechResult}" (conf: ${confidence})`);

    try {
      // Enhanced confidence filtering
      if (confidence < 0.4 || !speechResult || speechResult.trim().length < 3) {
        twiml.say({
          voice: 'alice',
          rate: '1.0'
        }, 'I didn\'t catch that clearly. Please describe your issue in a few words.');
        
        const gather = twiml.gather({
          input: 'speech',
          timeout: 12,
          speechTimeout: 3,
          action: '/webhook/gather',
          method: 'POST'
        });

        twiml.say('Thank you for calling.');
        twiml.hangup();
        res.type('text/xml');
        res.send(twiml.toString());
        return;
      }

      const currentStage = businessSupportService.getCallStage(callSid);
      
      // Fast stage routing
      switch (currentStage) {
        case 'initial':
          await handleInitialIssue(twiml, speechResult, callSid);
          break;
        case 'urgent_details':
          await handleUrgentDetailsCollection(twiml, speechResult, callSid);
          break;
        case 'collect_address':
          await handleAddressCollection(twiml, speechResult, callSid);
          break;
        case 'non_urgent_callback':
          await handleNonUrgentSetup(twiml, speechResult, callSid);
          break;
        case 'schedule_callback':
          await handleCallbackScheduling(twiml, speechResult, callSid);
          break;
        default:
          twiml.say('Thank you for calling business support.');
          twiml.hangup();
      }

      res.type('text/xml');
      res.send(twiml.toString());

    } catch (error) {
      logger.error('Error in handleGatherInput:', error);
      handleError(res);
    }
  }

  // Fast call status handling
  async handleCallStatus(req, res) {
    const callSid = req.body.CallSid;
    const callStatus = req.body.CallStatus;
    
    if (callStatus === 'completed') {
      businessSupportService.cleanup();
    }
    
    res.status(200).send('OK');
  }

  // Admin endpoints with caching
  async getUrgentCases(req, res) {
    try {
      const urgentCases = businessSupportService.getUrgentCases();
      res.json({
        success: true,
        urgentCases: urgentCases,
        count: urgentCases.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get urgent cases' });
    }
  }

  async getScheduledCallbacks(req, res) {
    try {
      const callbacks = businessSupportService.getScheduledCallbacks();
      res.json({
        success: true,
        scheduledCallbacks: callbacks,
        count: callbacks.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get callbacks' });
    }
  }
}

// Optimized stage handlers - faster responses

async function handleInitialIssue(twiml, speechResult, callSid) {
  try {
    // Fast analysis with timeout protection
    const analysisPromise = businessSupportService.analyzeIssue(speechResult, callSid);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Analysis timeout')), 8000)
    );
    
    const analysis = await Promise.race([analysisPromise, timeoutPromise]);
    
    // Faster speech rate for efficiency
    twiml.say({
      voice: 'alice',
      rate: '1.0'
    }, analysis.suggestedResponse);

    if (analysis.urgency === 'urgent') {
      // URGENT PATH - Will lead to address collection
      twiml.say('This sounds urgent. Please give me all the details so I can dispatch immediate support.');
      
      const gather = twiml.gather({
        input: 'speech',
        timeout: 25,
        speechTimeout: 4,
        action: '/webhook/gather',
        method: 'POST'
      });

      twiml.say('I will get you immediate help.');
      twiml.hangup();

    } else {
      // NON-URGENT PATH - Will lead to callback scheduling
      twiml.say('Our specialized team will reach out to help you with this.');
      
      const gather = twiml.gather({
        input: 'speech',
        timeout: 15,
        speechTimeout: 3,
        action: '/webhook/gather',
        method: 'POST'
      });

      twiml.say('Thank you for calling.');
      twiml.hangup();
    }
    
  } catch (error) {
    logger.error('Analysis failed, using fallback:', error);
    // Fast fallback without AI
    twiml.say('I understand you have an issue. Let me get the details to help you immediately.');
    
    const gather = twiml.gather({
      input: 'speech',
      timeout: 20,
      speechTimeout: 4,
      action: '/webhook/gather',
      method: 'POST'
    });
    
    twiml.say('Your issue will be addressed.');
    twiml.hangup();
  }
}

async function handleUrgentDetailsCollection(twiml, speechResult, callSid) {
  const response = await businessSupportService.handleUrgentDetails(speechResult, callSid);
  
  twiml.say({
    voice: 'alice',
    rate: '1.0'
  }, response.response);

  // CRITICAL: Ask for business address for urgent cases
  twiml.say('For immediate on-site support, I need your business address including street, city, and state.');

  const gather = twiml.gather({
    input: 'speech',
    timeout: 25,
    speechTimeout: 5,
    action: '/webhook/gather',
    method: 'POST'
  });

  twiml.say('I need your complete business address.');
  twiml.hangup();
}

async function handleAddressCollection(twiml, speechResult, callSid) {
  const response = await businessSupportService.collectAddress(speechResult, callSid);
  
  twiml.say({
    voice: 'alice',
    rate: '1.0'
  }, response.response);

  // URGENT CASE COMPLETE - End call
  twiml.hangup();
}

async function handleNonUrgentSetup(twiml, speechResult, callSid) {
  const response = await businessSupportService.handleNonUrgentCallback(speechResult, callSid);
  
  twiml.say({
    voice: 'alice',
    rate: '1.0'
  }, response.response);

  const gather = twiml.gather({
    input: 'speech',
    timeout: 15,
    speechTimeout: 3,
    action: '/webhook/gather',
    method: 'POST'
  });

  twiml.say('Thank you for calling.');
  twiml.hangup();
}

async function handleCallbackScheduling(twiml, speechResult, callSid) {
  const response = await businessSupportService.scheduleCallback(speechResult, callSid);
  
  twiml.say({
    voice: 'alice',
    rate: '1.0'
  }, response.response);

  // CALLBACK SCHEDULED - End call
  twiml.say('Have a great day!');
  twiml.hangup();
}

function handleError(res) {
  const twiml = new VoiceResponse();
  twiml.say('Technical difficulties. Please call back in a moment.');
  twiml.hangup();
  
  res.type('text/xml');
  res.send(twiml.toString());
}

module.exports = new OptimizedBusinessCallController();