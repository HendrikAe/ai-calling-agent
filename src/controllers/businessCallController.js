const VoiceResponse = require('twilio').twiml.VoiceResponse;
const businessSupportService = require('../services/businessSupportService');
const elevenLabsService = require('../services/elevenLabsService');
const googleSheetsService = require('../services/googleSheetsService');
const logger = require('../utils/logger');

<<<<<<< HEAD
class EnhancedSwissGermanCallController {
  constructor() {
    // Initialize Google Sheets on startup
    this.initializeServices();
  }

  async initializeServices() {
    try {
      await googleSheetsService.initialize();
      logger.info('Services initialized successfully');
    } catch (error) {
      logger.error('Error initializing services:', error);
    }
  }

  // Step 1: Incoming call with ElevenLabs voice
=======
class SwissGermanBusinessCallController {
  // Step 1: Incoming call - Ask "What happened?" in Swiss German
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
  async handleIncomingCall(req, res) {
    const twiml = new VoiceResponse();
    const callSid = req.body.CallSid;
    const from = req.body.From;

    logger.info(`Call: ${callSid} from ${from}`);

    try {
<<<<<<< HEAD
      const greetingText = 'Grüezi! Das isch Business Support. Was isch passiert? Wie chan ich euch hälfe?';
=======
      // Swiss German greeting
      twiml.say({
        voice: 'alice',
        rate: '0.9',
        language: 'de-DE' // German voice
      }, 'Grüezi! Das isch Business Support. Was isch passiert? Wie chan ich euch hälfe?');
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7

      // Try to use ElevenLabs for more natural voice
      const audioUrl = await elevenLabsService.generateTwilioAudio(greetingText);
      
      if (audioUrl) {
        // Use ElevenLabs generated audio
        twiml.play(audioUrl);
      } else {
        // Fallback to Twilio voice
        twiml.say({
          voice: 'alice',
          rate: '0.9',
          language: 'de-DE'
        }, greetingText);
      }

      // Gather response with Swiss German speech recognition
      const gather = twiml.gather({
        input: 'speech',
        timeout: 15,
        speechTimeout: 3,
        action: '/webhook/gather',
        method: 'POST',
<<<<<<< HEAD
        language: 'de-CH'
      });

      // Fallback message
      const fallbackText = 'Bitte rüefed zrug mit eurem Problem.';
      const fallbackAudio = await elevenLabsService.generateTwilioAudio(fallbackText);
      
      if (fallbackAudio) {
        twiml.play(fallbackAudio);
      } else {
        twiml.say({
          voice: 'alice',
          language: 'de-DE'
        }, fallbackText);
      }
      
=======
        language: 'de-CH' // Swiss German speech recognition
      });

      twiml.say({
        voice: 'alice',
        language: 'de-DE'
      }, 'Bitte rüefed zrug mit eurem Problem.');
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
      twiml.hangup();

      // Log call start to Google Sheets
      await googleSheetsService.logCall({
        callSid: callSid,
        from: from,
        type: 'Incoming',
        status: 'Started'
      });

      res.type('text/xml');
      res.send(twiml.toString());

    } catch (error) {
      logger.error('Error in handleIncomingCall:', error);
      handleError(res);
    }
  }

<<<<<<< HEAD
  // Enhanced gather handler with data logging
=======
  // Optimized gather handler with Swiss German responses
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
  async handleGatherInput(req, res) {
    const twiml = new VoiceResponse();
    const speechResult = req.body.SpeechResult || '';
    const callSid = req.body.CallSid;
    const confidence = req.body.Confidence || 0;
    const from = req.body.From;

    logger.info(`Speech: "${speechResult}" (conf: ${confidence})`);

    try {
      // Enhanced confidence filtering
      if (confidence < 0.4 || !speechResult || speechResult.trim().length < 3) {
<<<<<<< HEAD
        const clarificationText = 'Ich han das nöd guet verstande. Bitte beschribed eui Problem i es paar Wörter.';
        
        const audioUrl = await elevenLabsService.generateTwilioAudio(clarificationText);
        if (audioUrl) {
          twiml.play(audioUrl);
        } else {
          twiml.say({
            voice: 'alice',
            rate: '0.9',
            language: 'de-DE'
          }, clarificationText);
        }
=======
        twiml.say({
          voice: 'alice',
          rate: '0.9',
          language: 'de-DE'
        }, 'Ich han das nöd guet verstande. Bitte beschribed eui Problem i es paar Wörter.');
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
        
        const gather = twiml.gather({
          input: 'speech',
          timeout: 12,
          speechTimeout: 3,
          action: '/webhook/gather',
          method: 'POST',
          language: 'de-CH'
        });

<<<<<<< HEAD
        const endText = 'Merci fürs aalüte.';
        const endAudio = await elevenLabsService.generateTwilioAudio(endText);
        if (endAudio) {
          twiml.play(endAudio);
        } else {
          twiml.say({
            voice: 'alice',
            language: 'de-DE'
          }, endText);
        }
        
=======
        twiml.say({
          voice: 'alice',
          language: 'de-DE'
        }, 'Merci fürs aalüte.');
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
        twiml.hangup();
        res.type('text/xml');
        res.send(twiml.toString());
        return;
      }

      const currentStage = businessSupportService.getCallStage(callSid);
      
      // Log transcription to Google Sheets
      await googleSheetsService.logCall({
        callSid: callSid,
        from: from,
        confidence: confidence,
        transcription: speechResult,
        status: 'In Progress'
      });

      // Route to appropriate handler
      switch (currentStage) {
        case 'initial':
          await handleInitialIssueWithVoice(twiml, speechResult, callSid, from);
          break;
        case 'urgent_details':
          await handleUrgentDetailsWithVoice(twiml, speechResult, callSid, from);
          break;
        case 'collect_address':
          await handleAddressCollectionWithVoice(twiml, speechResult, callSid, from);
          break;
        case 'non_urgent_callback':
          await handleNonUrgentSetupWithVoice(twiml, speechResult, callSid, from);
          break;
        case 'schedule_callback':
          await handleCallbackSchedulingWithVoice(twiml, speechResult, callSid, from);
          break;
        default:
<<<<<<< HEAD
          const endText = 'Merci fürs aalüte bi Business Support.';
          const endAudio = await elevenLabsService.generateTwilioAudio(endText);
          if (endAudio) {
            twiml.play(endAudio);
          } else {
            twiml.say({
              voice: 'alice',
              language: 'de-DE'
            }, endText);
          }
=======
          twiml.say({
            voice: 'alice',
            language: 'de-DE'
          }, 'Merci fürs aalüte bi Business Support.');
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
          twiml.hangup();
      }

      res.type('text/xml');
      res.send(twiml.toString());

    } catch (error) {
      logger.error('Error in handleGatherInput:', error);
      handleError(res);
    }
  }

  // Enhanced call status with Google Sheets logging
  async handleCallStatus(req, res) {
    const callSid = req.body.CallSid;
    const callStatus = req.body.CallStatus;
    const duration = req.body.CallDuration;
    const from = req.body.From;
    
    logger.info(`Call ${callSid} status: ${callStatus}${duration ? ` (${duration}s)` : ''}`);
    
    // Log call completion to Google Sheets
    if (callStatus === 'completed') {
      await googleSheetsService.logCall({
        callSid: callSid,
        from: from,
        duration: duration,
        status: 'Completed'
      });
      
      businessSupportService.cleanup();
    }
    
    res.status(200).send('OK');
  }

<<<<<<< HEAD
  // Enhanced admin endpoints with Google Sheets data
=======
  // Admin endpoints with Swiss German labels
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
  async getUrgentCases(req, res) {
    try {
      // Get data from both memory and Google Sheets
      const memoryCases = businessSupportService.getUrgentCases();
      const sheetsCases = await googleSheetsService.getUrgentCases();
      
      res.json({
        success: true,
<<<<<<< HEAD
        memoryCases: memoryCases,
        sheetsCases: sheetsCases,
        totalMemory: memoryCases.length,
        totalSheets: sheetsCases.length,
=======
        dringendiFäll: urgentCases,
        anzahl: urgentCases.length,
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Fähler bim Lade vo dringendeFäll' });
    }
  }

  async getScheduledCallbacks(req, res) {
    try {
      // Get data from both memory and Google Sheets
      const memoryCallbacks = businessSupportService.getScheduledCallbacks();
      const sheetsCallbacks = await googleSheetsService.getCallbackRequests();
      
      res.json({
        success: true,
<<<<<<< HEAD
        memoryCallbacks: memoryCallbacks,
        sheetsCallbacks: sheetsCallbacks,
        totalMemory: memoryCallbacks.length,
        totalSheets: sheetsCallbacks.length,
=======
        plantiRückrüef: callbacks,
        anzahl: callbacks.length,
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Fähler bim Lade vo Rückrüef' });
<<<<<<< HEAD
    }
  }

  // New endpoint for Google Sheets statistics
  async getStatistics(req, res) {
    try {
      const stats = await googleSheetsService.getStatistics();
      res.json({
        success: true,
        statistics: stats
      });
    } catch (error) {
      res.status(500).json({ error: 'Fähler bim Lade vo Statistike' });
    }
  }

  // New endpoint to update case status
  async updateCaseStatus(req, res) {
    try {
      const { referenceNumber, status, notes } = req.body;
      const result = await googleSheetsService.updateCaseStatus(referenceNumber, status, notes);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Fähler bim Update vo Fall-Status' });
=======
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
    }
  }
}

<<<<<<< HEAD
// Enhanced handlers with ElevenLabs voice and Google Sheets integration
=======
// Optimized stage handlers with Swiss German responses
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7

async function handleInitialIssueWithVoice(twiml, speechResult, callSid, from) {
  try {
    const analysisPromise = businessSupportService.analyzeIssue(speechResult, callSid);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Analysis timeout')), 8000)
    );
    
    const analysis = await Promise.race([analysisPromise, timeoutPromise]);
    
<<<<<<< HEAD
    // Generate natural Swiss German response with ElevenLabs
    const audioUrl = await elevenLabsService.generateTwilioAudio(analysis.suggestedResponse);
    if (audioUrl) {
      twiml.play(audioUrl);
    } else {
      twiml.say({
        voice: 'alice',
        rate: '0.9',
        language: 'de-DE'
      }, analysis.suggestedResponse);
    }

    if (analysis.urgency === 'urgent') {
      const urgentText = 'Das tönt dringend. Bitte gäbed mer alli Details, demit ich sofort Hilf cha schicke.';
      const urgentAudio = await elevenLabsService.generateTwilioAudio(urgentText);
      if (urgentAudio) {
        twiml.play(urgentAudio);
      } else {
        twiml.say({
          voice: 'alice',
          rate: '0.9',
          language: 'de-DE'
        }, urgentText);
      }
=======
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
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
      
      const gather = twiml.gather({
        input: 'speech',
        timeout: 25,
        speechTimeout: 4,
        action: '/webhook/gather',
        method: 'POST',
        language: 'de-CH'
      });

<<<<<<< HEAD
      const helpText = 'Ich wird euch soforti Hilf bringe.';
      const helpAudio = await elevenLabsService.generateTwilioAudio(helpText);
      if (helpAudio) {
        twiml.play(helpAudio);
      } else {
        twiml.say({
          voice: 'alice',
          language: 'de-DE'
        }, helpText);
      }
      twiml.hangup();

    } else {
      // NON-URGENT PATH
      const teamText = 'Öis spezialisiert Team wird sich mälde zum euch bi däm hälfe.';
      const teamAudio = await elevenLabsService.generateTwilioAudio(teamText);
      if (teamAudio) {
        twiml.play(teamAudio);
      } else {
        twiml.say({
          voice: 'alice',
          rate: '0.9',
          language: 'de-DE'
        }, teamText);
      }
=======
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
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
      
      const gather = twiml.gather({
        input: 'speech',
        timeout: 15,
        speechTimeout: 3,
        action: '/webhook/gather',
        method: 'POST',
        language: 'de-CH'
      });

<<<<<<< HEAD
      const thanksText = 'Merci fürs aalüte.';
      const thanksAudio = await elevenLabsService.generateTwilioAudio(thanksText);
      if (thanksAudio) {
        twiml.play(thanksAudio);
      } else {
        twiml.say({
          voice: 'alice',
          language: 'de-DE'
        }, thanksText);
      }
=======
      twiml.say({
        voice: 'alice',
        language: 'de-DE'
      }, 'Merci fürs aalüte.');
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
      twiml.hangup();
    }
    
  } catch (error) {
    logger.error('Analysis failed, using fallback:', error);
<<<<<<< HEAD
    // Fallback without AI
    const fallbackText = 'Ich verstaa, der händ es Problem. Gäbed mer d Details, demit ich euch sofort cha hälfe.';
    const fallbackAudio = await elevenLabsService.generateTwilioAudio(fallbackText);
    if (fallbackAudio) {
      twiml.play(fallbackAudio);
    } else {
      twiml.say({
        voice: 'alice',
        rate: '0.9',
        language: 'de-DE'
      }, fallbackText);
    }
=======
    // Fast fallback without AI
    twiml.say({
      voice: 'alice',
      rate: '0.9',
      language: 'de-DE'
    }, 'Ich verstaa, der händ es Problem. Gäbed mer d Details, demit ich euch sofort cha hälfe.');
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
    
    const gather = twiml.gather({
      input: 'speech',
      timeout: 20,
      speechTimeout: 4,
      action: '/webhook/gather',
      method: 'POST',
      language: 'de-CH'
    });
    
<<<<<<< HEAD
    const processText = 'Eui Problem wird behandlet.';
    const processAudio = await elevenLabsService.generateTwilioAudio(processText);
    if (processAudio) {
      twiml.play(processAudio);
    } else {
      twiml.say({
        voice: 'alice',
        language: 'de-DE'
      }, processText);
    }
=======
    twiml.say({
      voice: 'alice',
      language: 'de-DE'
    }, 'Eui Problem wird behandlet.');
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
    twiml.hangup();
  }
}

async function handleUrgentDetailsWithVoice(twiml, speechResult, callSid, from) {
  const response = await businessSupportService.handleUrgentDetails(speechResult, callSid);
  
<<<<<<< HEAD
  // Generate ElevenLabs audio for response
  const responseAudio = await elevenLabsService.generateTwilioAudio(response.response);
  if (responseAudio) {
    twiml.play(responseAudio);
  } else {
    twiml.say({
      voice: 'alice',
      rate: '0.9',
      language: 'de-DE'
    }, response.response);
  }

  // Ask for address with natural voice
  const addressText = 'Für soforti Hilf vor Ort bruche ich eui Geschäfts-Adrässe mit Strass, Stadt und Kanton.';
  const addressAudio = await elevenLabsService.generateTwilioAudio(addressText);
  if (addressAudio) {
    twiml.play(addressAudio);
  } else {
    twiml.say({
      voice: 'alice',
      rate: '0.9',
      language: 'de-DE'
    }, addressText);
  }
=======
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
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7

  const gather = twiml.gather({
    input: 'speech',
    timeout: 25,
    speechTimeout: 5,
    action: '/webhook/gather',
    method: 'POST',
    language: 'de-CH'
  });

<<<<<<< HEAD
  const needText = 'Ich bruche eui vollständigi Geschäfts-Adrässe.';
  const needAudio = await elevenLabsService.generateTwilioAudio(needText);
  if (needAudio) {
    twiml.play(needAudio);
  } else {
    twiml.say({
      voice: 'alice',
      language: 'de-DE'
    }, needText);
  }
=======
  twiml.say({
    voice: 'alice',
    language: 'de-DE'
  }, 'Ich bruche eui vollständigi Geschäfts-Adrässe.');
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
  twiml.hangup();
}

async function handleAddressCollectionWithVoice(twiml, speechResult, callSid, from) {
  const response = await businessSupportService.collectAddress(speechResult, callSid);
  
<<<<<<< HEAD
  // Generate ElevenLabs audio for confirmation
  const confirmAudio = await elevenLabsService.generateTwilioAudio(response.response);
  if (confirmAudio) {
    twiml.play(confirmAudio);
  } else {
    twiml.say({
      voice: 'alice',
      rate: '0.9',
      language: 'de-DE'
    }, response.response);
  }

  // Save urgent case to Google Sheets
  if (response.caseComplete) {
    const caseData = businessSupportService.collectedData?.get(callSid) || {};
    await googleSheetsService.saveUrgentCase({
      ...caseData,
      phoneNumber: from,
      referenceNumber: response.referenceNumber,
      businessAddress: speechResult
    });
  }
=======
  twiml.say({
    voice: 'alice',
    rate: '0.9',
    language: 'de-DE'
  }, response.response);
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7

  twiml.hangup();
}

async function handleNonUrgentSetupWithVoice(twiml, speechResult, callSid, from) {
  const response = await businessSupportService.handleNonUrgentCallback(speechResult, callSid);
  
<<<<<<< HEAD
  // Generate ElevenLabs audio for response
  const responseAudio = await elevenLabsService.generateTwilioAudio(response.response);
  if (responseAudio) {
    twiml.play(responseAudio);
  } else {
    twiml.say({
      voice: 'alice',
      rate: '0.9',
      language: 'de-DE'
    }, response.response);
  }
=======
  twiml.say({
    voice: 'alice',
    rate: '0.9',
    language: 'de-DE'
  }, response.response);
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7

  const gather = twiml.gather({
    input: 'speech',
    timeout: 15,
    speechTimeout: 3,
    action: '/webhook/gather',
    method: 'POST',
    language: 'de-CH'
  });

<<<<<<< HEAD
  const thanksText = 'Merci fürs aalüte.';
  const thanksAudio = await elevenLabsService.generateTwilioAudio(thanksText);
  if (thanksAudio) {
    twiml.play(thanksAudio);
  } else {
    twiml.say({
      voice: 'alice',
      language: 'de-DE'
    }, thanksText);
  }
=======
  twiml.say({
    voice: 'alice',
    language: 'de-DE'
  }, 'Merci fürs aalüte.');
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
  twiml.hangup();
}

async function handleCallbackSchedulingWithVoice(twiml, speechResult, callSid, from) {
  const response = await businessSupportService.scheduleCallback(speechResult, callSid);
  
<<<<<<< HEAD
  // Generate ElevenLabs audio for confirmation
  const confirmAudio = await elevenLabsService.generateTwilioAudio(response.response);
  if (confirmAudio) {
    twiml.play(confirmAudio);
  } else {
    twiml.say({
      voice: 'alice',
      rate: '0.9',
      language: 'de-DE'
    }, response.response);
  }

  // Save callback to Google Sheets
  if (response.callbackScheduled) {
    const callbackData = businessSupportService.collectedData?.get(callSid) || {};
    await googleSheetsService.saveCallbackRequest({
      ...callbackData,
      phoneNumber: from,
      referenceNumber: response.referenceNumber,
      callbackTime: speechResult,
      inquiry: 'Allgemeni Aafrag' // Could be enhanced based on conversation
    });
  }

  const goodbyeText = 'Händ en schöne Tag!';
  const goodbyeAudio = await elevenLabsService.generateTwilioAudio(goodbyeText);
  if (goodbyeAudio) {
    twiml.play(goodbyeAudio);
  } else {
    twiml.say({
      voice: 'alice',
      language: 'de-DE'
    }, goodbyeText);
  }
=======
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
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
  twiml.hangup();
}

async function handleError(res) {
  const twiml = new VoiceResponse();
<<<<<<< HEAD
  const errorText = 'Technischi Schwierigkeite. Bitte rüefed i es paar Minute zrug.';
  
  const errorAudio = await elevenLabsService.generateTwilioAudio(errorText);
  if (errorAudio) {
    twiml.play(errorAudio);
  } else {
    twiml.say({
      voice: 'alice',
      language: 'de-DE'
    }, errorText);
  }
=======
  twiml.say({
    voice: 'alice',
    language: 'de-DE'
  }, 'Technischi Schwierigkeite. Bitte rüefed i es paar Minute zrug.');
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
  twiml.hangup();
  
  res.type('text/xml');
  res.send(twiml.toString());
}

<<<<<<< HEAD
module.exports = new EnhancedSwissGermanCallController();
=======
module.exports = new SwissGermanBusinessCallController();
>>>>>>> 9eab4bc9301537f07dbc3e02e00bc2546fad74f7
