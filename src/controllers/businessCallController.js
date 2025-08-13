const VoiceResponse = require('twilio').twiml.VoiceResponse;
const businessSupportService = require('../services/businessSupportService');
const logger = require('../utils/logger');

class SwissGermanBusinessCallController {
  // Step 1: Incoming call - Ask "What happened?" in Swiss German
  async handleIncomingCall(req, res) {
    const twiml = new VoiceResponse();
    const callSid = req.body.CallSid;
    const from = req.body.From;

    logger.info(`Call: ${callSid} from ${from}`);

    try {
      // Swiss German greeting
      twiml.say({
        voice: 'alice',
        rate: '0.9',
        language: 'de-DE' // German voice
      }, 'Grüezi! Das isch Business Support. Was isch passiert? Wie chan ich euch hälfe?');

      // Optimized gather settings
      const gather = twiml.gather({
        input: 'speech',
        timeout: 15,
        speechTimeout: 3,
        action: '/webhook/gather',
        method: 'POST',
        language: 'de-CH' // Swiss German speech recognition
      });

      twiml.say({
        voice: 'alice',
        language: 'de-DE'
      }, 'Bitte rüefed zrug mit eurem Problem.');
      twiml.hangup();

      res.type('text/xml');
      res.send(twiml.toString());

    } catch (error) {
      logger.error('Error in handleIncomingCall:', error);
      handleError(res);
    }
  }

  // Optimized gather handler with Swiss German responses
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
          rate: '0.9',
          language: 'de-DE'
        }, 'Ich han das nöd guet verstande. Bitte beschribed eui Problem i es paar Wörter.');
        
        const gather = twiml.gather({
          input: 'speech',
          timeout: 12,
          speechTimeout: 3,
          action: '/webhook/gather',
          method: 'POST',
          language: 'de-CH'
        });

        twiml.say({
          voice: 'alice',
          language: 'de-DE'
        }, 'Merci fürs aalüte.');
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
          twiml.say({
            voice: 'alice',
            language: 'de-DE'
          }, 'Merci fürs aalüte bi Business Support.');
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

  // Admin endpoints with Swiss German labels
  async getUrgentCases(req, res) {
    try {
      const urgentCases = businessSupportService.getUrgentCases();
      res.json({
        success: true,
        dringendiFäll: urgentCases,
        anzahl: urgentCases.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Fähler bim Lade vo dringendeFäll' });
    }
  }

  async getScheduledCallbacks(req, res) {
    try {
      const callbacks = businessSupportService.getScheduledCallbacks();
      res.json({
        success: true,
        plantiRückrüef: callbacks,
        anzahl: callbacks.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Fähler bim Lade vo Rückrüef' });
    }
  }
}

// Optimized stage handlers with Swiss German responses

async function handleInitialIssue(twiml, speechResult, callSid) {
  try {
    // Fast analysis with timeout protection
    const analysisPromise = businessSupportService.analyzeIssue(speechResult, callSid);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Analysis timeout')), 8000)
    );
    
    const analysis = await Promise.race([analysisPromise, timeoutPromise]);
    
    // Swiss German response
    twiml.say({
      voice: 'alice',
      rate: '0.9',
      language: 'de-DE'
    }, analysis.suggestedResponse);

    if (analysis.urgency === 'urgent') {
      // URGENT PATH - Will lead to address collection
      twiml.say({
        voice: 'alice',
        rate: '0.9',
        language: 'de-DE'
      }, 'Das tönt dringend. Bitte gäbed mer alli Details, demit ich sofort Hilf cha schicke.');
      
      const gather = twiml.gather({
        input: 'speech',
        timeout: 25,
        speechTimeout: 4,
        action: '/webhook/gather',
        method: 'POST',
        language: 'de-CH'
      });

      twiml.say({
        voice: 'alice',
        language: 'de-DE'
      }, 'Ich wird euch soforti Hilf bringe.');
      twiml.hangup();

    } else {
      // NON-URGENT PATH - Will lead to callback scheduling
      twiml.say({
        voice: 'alice',
        rate: '0.9',
        language: 'de-DE'
      }, 'Öis spezialisiert Team wird sich mälde zum euch bi däm hälfe.');
      
      const gather = twiml.gather({
        input: 'speech',
        timeout: 15,
        speechTimeout: 3,
        action: '/webhook/gather',
        method: 'POST',
        language: 'de-CH'
      });

      twiml.say({
        voice: 'alice',
        language: 'de-DE'
      }, 'Merci fürs aalüte.');
      twiml.hangup();
    }
    
  } catch (error) {
    logger.error('Analysis failed, using fallback:', error);
    // Fast fallback without AI
    twiml.say({
      voice: 'alice',
      rate: '0.9',
      language: 'de-DE'
    }, 'Ich verstaa, der händ es Problem. Gäbed mer d Details, demit ich euch sofort cha hälfe.');
    
    const gather = twiml.gather({
      input: 'speech',
      timeout: 20,
      speechTimeout: 4,
      action: '/webhook/gather',
      method: 'POST',
      language: 'de-CH'
    });
    
    twiml.say({
      voice: 'alice',
      language: 'de-DE'
    }, 'Eui Problem wird behandlet.');
    twiml.hangup();
  }
}

async function handleUrgentDetailsCollection(twiml, speechResult, callSid) {
  const response = await businessSupportService.handleUrgentDetails(speechResult, callSid);
  
  twiml.say({
    voice: 'alice',
    rate: '0.9',
    language: 'de-DE'
  }, response.response);

  // CRITICAL: Ask for business address for urgent cases in Swiss German
  twiml.say({
    voice: 'alice',
    rate: '0.9',
    language: 'de-DE'
  }, 'Für soforti Hilf vor Ort bruche ich eui Geschäfts-Adrässe mit Strass, Stadt und Kanton.');

  const gather = twiml.gather({
    input: 'speech',
    timeout: 25,
    speechTimeout: 5,
    action: '/webhook/gather',
    method: 'POST',
    language: 'de-CH'
  });

  twiml.say({
    voice: 'alice',
    language: 'de-DE'
  }, 'Ich bruche eui vollständigi Geschäfts-Adrässe.');
  twiml.hangup();
}

async function handleAddressCollection(twiml, speechResult, callSid) {
  const response = await businessSupportService.collectAddress(speechResult, callSid);
  
  twiml.say({
    voice: 'alice',
    rate: '0.9',
    language: 'de-DE'
  }, response.response);

  // URGENT CASE COMPLETE - End call
  twiml.hangup();
}

async function handleNonUrgentSetup(twiml, speechResult, callSid) {
  const response = await businessSupportService.handleNonUrgentCallback(speechResult, callSid);
  
  twiml.say({
    voice: 'alice',
    rate: '0.9',
    language: 'de-DE'
  }, response.response);

  const gather = twiml.gather({
    input: 'speech',
    timeout: 15,
    speechTimeout: 3,
    action: '/webhook/gather',
    method: 'POST',
    language: 'de-CH'
  });

  twiml.say({
    voice: 'alice',
    language: 'de-DE'
  }, 'Merci fürs aalüte.');
  twiml.hangup();
}

async function handleCallbackScheduling(twiml, speechResult, callSid) {
  const response = await businessSupportService.scheduleCallback(speechResult, callSid);
  
  twiml.say({
    voice: 'alice',
    rate: '0.9',
    language: 'de-DE'
  }, response.response);

  // CALLBACK SCHEDULED - End call
  twiml.say({
    voice: 'alice',
    language: 'de-DE'
  }, 'Händ en schöne Tag!');
  twiml.hangup();
}

function handleError(res) {
  const twiml = new VoiceResponse();
  twiml.say({
    voice: 'alice',
    language: 'de-DE'
  }, 'Technischi Schwierigkeite. Bitte rüefed i es paar Minute zrug.');
  twiml.hangup();
  
  res.type('text/xml');
  res.send(twiml.toString());
}

module.exports = new SwissGermanBusinessCallController();
