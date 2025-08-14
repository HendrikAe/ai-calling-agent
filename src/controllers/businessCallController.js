const VoiceResponse = require('twilio').twiml.VoiceResponse;
const businessSupportService = require('../services/businessSupportService');
const elevenLabsService = require('../services/elevenLabsService');
const googleSheetsService = require('../services/googleSheetsService');
const logger = require('../utils/logger');

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
  async handleIncomingCall(req, res) {
    const twiml = new VoiceResponse();
    const callSid = req.body.CallSid;
    const from = req.body.From;

    logger.info(`Call: ${callSid} from ${from}`);

    try {
      const greetingText = 'Grüezi! Das isch Business Support. Was isch passiert? Wie chan ich euch hälfe?';

      // Try to use ElevenLabs for more natural voice
      try {
        const audioUrl = await elevenLabsService.generateTwilioAudio(greetingText);
        if (audioUrl) {
          twiml.play(audioUrl);
        } else {
          throw new Error('ElevenLabs audio generation failed');
        }
      } catch (elevenLabsError) {
        // Fallback to Twilio voice
        logger.warn('ElevenLabs fallback:', elevenLabsError.message);
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
        language: 'de-CH'
      });

      // Fallback message
      const fallbackText = 'Bitte rüefed zrug mit eurem Problem.';
      try {
        const fallbackAudio = await elevenLabsService.generateTwilioAudio(fallbackText);
        if (fallbackAudio) {
          twiml.play(fallbackAudio);
        } else {
          throw new Error('ElevenLabs audio generation failed');
        }
      } catch (elevenLabsError) {
        twiml.say({
          voice: 'alice',
          language: 'de-DE'
        }, fallbackText);
      }
      
      twiml.hangup();

      // Log call start to Google Sheets
      try {
        await googleSheetsService.logCall({
          callSid: callSid,
          from: from,
          type: 'Incoming',
          status: 'Started'
        });
      } catch (sheetsError) {
        logger.warn('Google Sheets logging failed:', sheetsError.message);
      }

      res.type('text/xml');
      res.send(twiml.toString());

    } catch (error) {
      logger.error('Error in handleIncomingCall:', error);
      handleError(res);
    }
  }

  // Enhanced gather handler with data logging
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
        const clarificationText = 'Ich han das nöd guet verstande. Bitte beschribed eui Problem i es paar Wörter.';
        
        try {
          const audioUrl = await elevenLabsService.generateTwilioAudio(clarificationText);
          if (audioUrl) {
            twiml.play(audioUrl);
          } else {
            throw new Error('ElevenLabs audio generation failed');
          }
        } catch (elevenLabsError) {
          twiml.say({
            voice: 'alice',
            rate: '0.9',
            language: 'de-DE'
          }, clarificationText);
        }
        
        const gather = twiml.gather({
          input: 'speech',
          timeout: 12,
          speechTimeout: 3,
          action: '/webhook/gather',
          method: 'POST',
          language: 'de-CH'
        });

        const endText = 'Merci fürs aalüte.';
        try {
          const endAudio = await elevenLabsService.generateTwilioAudio(endText);
          if (endAudio) {
            twiml.play(endAudio);
          } else {
            throw new Error('ElevenLabs audio generation failed');
          }
        } catch (elevenLabsError) {
          twiml.say({
            voice: 'alice',
            language: 'de-DE'
          }, endText);
        }
        
        twiml.hangup();
        res.type('text/xml');
        res.send(twiml.toString());
        return;
      }

      const currentStage = businessSupportService.getCallStage(callSid);
      
      // Log transcription to Google Sheets
      try {
        await googleSheetsService.logCall({
          callSid: callSid,
          from: from,
          confidence: confidence,
          transcription: speechResult,
          status: 'In Progress'
        });
      } catch (sheetsError) {
        logger.warn('Google Sheets logging failed:', sheetsError.message);
      }

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
          const endText = 'Merci fürs aalüte bi Business Support.';
          try {
            const endAudio = await elevenLabsService.generateTwilioAudio(endText);
            if (endAudio) {
              twiml.play(endAudio);
            } else {
              throw new Error('ElevenLabs audio generation failed');
            }
          } catch (elevenLabsError) {
            twiml.say({
              voice: 'alice',
              language: 'de-DE'
            }, endText);
          }
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
      try {
        await googleSheetsService.logCall({
          callSid: callSid,
          from: from,
          duration: duration,
          status: 'Completed'
        });
      } catch (sheetsError) {
        logger.warn('Google Sheets logging failed:', sheetsError.message);
      }
      
      businessSupportService.cleanup();
    }
    
    res.status(200).send('OK');
  }

  // Enhanced admin endpoints with Google Sheets data
  async getUrgentCases(req, res) {
    try {
      // Get data from both memory and Google Sheets
      const memoryCases = businessSupportService.getUrgentCases();
      let sheetsCases = [];
      
      try {
        sheetsCases = await googleSheetsService.getUrgentCases();
      } catch (sheetsError) {
        logger.warn('Google Sheets not available:', sheetsError.message);
      }
      
      res.json({
        success: true,
        memoryCases: memoryCases,
        sheetsCases: sheetsCases,
        totalMemory: memoryCases.length,
        totalSheets: sheetsCases.length,
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
      let sheetsCallbacks = [];
      
      try {
        sheetsCallbacks = await googleSheetsService.getCallbackRequests();
      } catch (sheetsError) {
        logger.warn('Google Sheets not available:', sheetsError.message);
      }
      
      res.json({
        success: true,
        memoryCallbacks: memoryCallbacks,
        sheetsCallbacks: sheetsCallbacks,
        totalMemory: memoryCallbacks.length,
        totalSheets: sheetsCallbacks.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Fähler bim Lade vo Rückrüef' });
    }
  }

  // New endpoint for Google Sheets statistics
  async getStatistics(req, res) {
    try {
      let stats = null;
      
      try {
        stats = await googleSheetsService.getStatistics();
      } catch (sheetsError) {
        logger.warn('Google Sheets statistics not available:', sheetsError.message);
        stats = {
          totalUrgentCases: 0,
          todayUrgentCases: 0,
          resolvedUrgentCases: 0,
          totalCallbacks: 0,
          todayCallbacks: 0,
          completedCallbacks: 0,
          lastUpdated: new Date().toISOString(),
          googleSheetsStatus: 'Disconnected'
        };
      }
      
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
      let result = { success: false, error: 'Google Sheets not available' };
      
      try {
        result = await googleSheetsService.updateCaseStatus(referenceNumber, status, notes);
      } catch (sheetsError) {
        logger.warn('Google Sheets update failed:', sheetsError.message);
      }
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Fähler bim Update vo Fall-Status' });
    }
  }
}

// Enhanced handlers with ElevenLabs voice and Google Sheets integration

async function handleInitialIssueWithVoice(twiml, speechResult, callSid, from) {
  try {
    const analysisPromise = businessSupportService.analyzeIssue(speechResult, callSid);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Analysis timeout')), 8000)
    );
    
    const analysis = await Promise.race([analysisPromise, timeoutPromise]);
    
    // Generate natural Swiss German response with ElevenLabs
    try {
      const audioUrl = await elevenLabsService.generateTwilioAudio(analysis.suggestedResponse);
      if (audioUrl) {
        twiml.play(audioUrl);
      } else {
        throw new Error('ElevenLabs audio generation failed');
      }
    } catch (elevenLabsError) {
      twiml.say({
        voice: 'alice',
        rate: '0.9',
        language: 'de-DE'
      }, analysis.suggestedResponse);
    }

    if (analysis.urgency === 'urgent') {
      const urgentText = 'Das tönt dringend. Bitte gäbed mer alli Details, demit ich sofort Hilf cha schicke.';
      try {
        const urgentAudio = await elevenLabsService.generateTwilioAudio(urgentText);
        if (urgentAudio) {
          twiml.play(urgentAudio);
        } else {
          throw new Error('ElevenLabs audio generation failed');
        }
      } catch (elevenLabsError) {
        twiml.say({
          voice: 'alice',
          rate: '0.9',
          language: 'de-DE'
        }, urgentText);
      }
      
      const gather = twiml.gather({
        input: 'speech',
        timeout: 25,
        speechTimeout: 4,
        action: '/webhook/gather',
        method: 'POST',
        language: 'de-CH'
      });

      const helpText = 'Ich wird euch soforti Hilf bringe.';
      try {
        const helpAudio = await elevenLabsService.generateTwilioAudio(helpText);
        if (helpAudio) {
          twiml.play(helpAudio);
        } else {
          throw new Error('ElevenLabs audio generation failed');
        }
      } catch (elevenLabsError) {
        twiml.say({
          voice: 'alice',
          language: 'de-DE'
        }, helpText);
      }
      twiml.hangup();

    } else {
      // NON-URGENT PATH
      const teamText = 'Öis spezialisiert Team wird sich mälde zum euch bi däm hälfe.';
      try {
        const teamAudio = await elevenLabsService.generateTwilioAudio(teamText);
        if (teamAudio) {
          twiml.play(teamAudio);
        } else {
          throw new Error('ElevenLabs audio generation failed');
        }
      } catch (elevenLabsError) {
        twiml.say({
          voice: 'alice',
          rate: '0.9',
          language: 'de-DE'
        }, teamText);
      }
      
      const gather = twiml.gather({
        input: 'speech',
        timeout: 15,
        speechTimeout: 3,
        action: '/webhook/gather',
        method: 'POST',
        language: 'de-CH'
      });

      const thanksText = 'Merci fürs aalüte.';
      try {
        const thanksAudio = await elevenLabsService.generateTwilioAudio(thanksText);
        if (thanksAudio) {
          twiml.play(thanksAudio);
        } else {
          throw new Error('ElevenLabs audio generation failed');
        }
      } catch (elevenLabsError) {
        twiml.say({
          voice: 'alice',
          language: 'de-DE'
        }, thanksText);
      }
      twiml.hangup();
    }
    
  } catch (error) {
    logger.error('Analysis failed, using fallback:', error);
    // Fallback without AI
    const fallbackText = 'Ich verstaa, der händ es Problem. Gäbed mer d Details, demit ich euch sofort cha hälfe.';
    try {
      const fallbackAudio = await elevenLabsService.generateTwilioAudio(fallbackText);
      if (fallbackAudio) {
        twiml.play(fallbackAudio);
      } else {
        throw new Error('ElevenLabs audio generation failed');
      }
    } catch (elevenLabsError) {
      twiml.say({
        voice: 'alice',
        rate: '0.9',
        language: 'de-DE'
      }, fallbackText);
    }
    
    const gather = twiml.gather({
      input: 'speech',
      timeout: 20,
      speechTimeout: 4,
      action: '/webhook/gather',
      method: 'POST',
      language: 'de-CH'
    });
    
    const processText = 'Eui Problem wird behandlet.';
    try {
      const processAudio = await elevenLabsService.generateTwilioAudio(processText);
      if (processAudio) {
        twiml.play(processAudio);
      } else {
        throw new Error('ElevenLabs audio generation failed');
      }
    } catch (elevenLabsError) {
      twiml.say({
        voice: 'alice',
        language: 'de-DE'
      }, processText);
    }
    twiml.hangup();
  }
}

async function handleUrgentDetailsWithVoice(twiml, speechResult, callSid, from) {
  const response = await businessSupportService.handleUrgentDetails(speechResult, callSid);
  
  // Generate ElevenLabs audio for response
  try {
    const responseAudio = await elevenLabsService.generateTwilioAudio(response.response);
    if (responseAudio) {
      twiml.play(responseAudio);
    } else {
      throw new Error('ElevenLabs audio generation failed');
    }
  } catch (elevenLabsError) {
    twiml.say({
      voice: 'alice',
      rate: '0.9',
      language: 'de-DE'
    }, response.response);
  }

  // Ask for address with natural voice
  const addressText = 'Für soforti Hilf vor Ort bruche ich eui Geschäfts-Adrässe mit Strass, Stadt und Kanton.';
  try {
    const addressAudio = await elevenLabsService.generateTwilioAudio(addressText);
    if (addressAudio) {
      twiml.play(addressAudio);
    } else {
      throw new Error('ElevenLabs audio generation failed');
    }
  } catch (elevenLabsError) {
    twiml.say({
      voice: 'alice',
      rate: '0.9',
      language: 'de-DE'
    }, addressText);
  }

  const gather = twiml.gather({
    input: 'speech',
    timeout: 25,
    speechTimeout: 5,
    action: '/webhook/gather',
    method: 'POST',
    language: 'de-CH'
  });

  const needText = 'Ich bruche eui vollständigi Geschäfts-Adrässe.';
  try {
    const needAudio = await elevenLabsService.generateTwilioAudio(needText);
    if (needAudio) {
      twiml.play(needAudio);
    } else {
      throw new Error('ElevenLabs audio generation failed');
    }
  } catch (elevenLabsError) {
    twiml.say({
      voice: 'alice',
      language: 'de-DE'
    }, needText);
  }
  twiml.hangup();
}

async function handleAddressCollectionWithVoice(twiml, speechResult, callSid, from) {
  const response = await businessSupportService.collectAddress(speechResult, callSid);
  
  // Generate ElevenLabs audio for confirmation
  try {
    const confirmAudio = await elevenLabsService.generateTwilioAudio(response.response);
    if (confirmAudio) {
      twiml.play(confirmAudio);
    } else {
      throw new Error('ElevenLabs audio generation failed');
    }
  } catch (elevenLabsError) {
    twiml.say({
      voice: 'alice',
      rate: '0.9',
      language: 'de-DE'
    }, response.response);
  }

  // Save urgent case to Google Sheets
  if (response.caseComplete) {
    try {
      const caseData = businessSupportService.collectedData?.get(callSid) || {};
      await googleSheetsService.saveUrgentCase({
        ...caseData,
        phoneNumber: from,
        referenceNumber: response.referenceNumber,
        businessAddress: speechResult
      });
    } catch (sheetsError) {
      logger.warn('Google Sheets save failed:', sheetsError.message);
    }
  }

  twiml.hangup();
}

async function handleNonUrgentSetupWithVoice(twiml, speechResult, callSid, from) {
  const response = await businessSupportService.handleNonUrgentCallback(speechResult, callSid);
  
  // Generate ElevenLabs audio for response
  try {
    const responseAudio = await elevenLabsService.generateTwilioAudio(response.response);
    if (responseAudio) {
      twiml.play(responseAudio);
    } else {
      throw new Error('ElevenLabs audio generation failed');
    }
  } catch (elevenLabsError) {
    twiml.say({
      voice: 'alice',
      rate: '0.9',
      language: 'de-DE'
    }, response.response);
  }

  const gather = twiml.gather({
    input: 'speech',
    timeout: 15,
    speechTimeout: 3,
    action: '/webhook/gather',
    method: 'POST',
    language: 'de-CH'
  });

  const thanksText = 'Merci fürs aalüte.';
  try {
    const thanksAudio = await elevenLabsService.generateTwilioAudio(thanksText);
    if (thanksAudio) {
      twiml.play(thanksAudio);
    } else {
      throw new Error('ElevenLabs audio generation failed');
    }
  } catch (elevenLabsError) {
    twiml.say({
      voice: 'alice',
      language: 'de-DE'
    }, thanksText);
  }
  twiml.hangup();
}

async function handleCallbackSchedulingWithVoice(twiml, speechResult, callSid, from) {
  const response = await businessSupportService.scheduleCallback(speechResult, callSid);
  
  // Generate ElevenLabs audio for confirmation
  try {
    const confirmAudio = await elevenLabsService.generateTwilioAudio(response.response);
    if (confirmAudio) {
      twiml.play(confirmAudio);
    } else {
      throw new Error('ElevenLabs audio generation failed');
    }
  } catch (elevenLabsError) {
    twiml.say({
      voice: 'alice',
      rate: '0.9',
      language: 'de-DE'
    }, response.response);
  }

  // Save callback to Google Sheets
  if (response.callbackScheduled) {
    try {
      const callbackData = businessSupportService.collectedData?.get(callSid) || {};
      await googleSheetsService.saveCallbackRequest({
        ...callbackData,
        phoneNumber: from,
        referenceNumber: response.referenceNumber,
        callbackTime: speechResult,
        inquiry: 'Allgemeni Aafrag'
      });
    } catch (sheetsError) {
      logger.warn('Google Sheets save failed:', sheetsError.message);
    }
  }

  const goodbyeText = 'Händ en schöne Tag!';
  try {
    const goodbyeAudio = await elevenLabsService.generateTwilioAudio(goodbyeText);
    if (goodbyeAudio) {
      twiml.play(goodbyeAudio);
    } else {
      throw new Error('ElevenLabs audio generation failed');
    }
  } catch (elevenLabsError) {
    twiml.say({
      voice: 'alice',
      language: 'de-DE'
    }, goodbyeText);
  }
  twiml.hangup();
}

async function handleError(res) {
  const twiml = new VoiceResponse();
  const errorText = 'Technischi Schwierigkeite. Bitte rüefed i es paar Minute zrug.';
  
  try {
    const errorAudio = await elevenLabsService.generateTwilioAudio(errorText);
    if (errorAudio) {
      twiml.play(errorAudio);
    } else {
      throw new Error('ElevenLabs audio generation failed');
    }
  } catch (elevenLabsError) {
    twiml.say({
      voice: 'alice',
      language: 'de-DE'
    }, errorText);
  }
  twiml.hangup();
  
  res.type('text/xml');
  res.send(twiml.toString());
}

module.exports = new EnhancedSwissGermanCallController();