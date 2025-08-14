const OpenAI = require('openai');
const config = require('../../config/config');
const logger = require('../utils/logger');

class SwissGermanBusinessSupportService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY
    });
    
    // Store conversation contexts and data collection
    this.conversations = new Map();
    this.urgentCases = new Map();
    this.callStages = new Map();
    this.collectedData = new Map();
    
    // Pre-defined filters for faster classification (Swiss German keywords)
    this.urgentKeywords = [
      'kaputt', 'funktioniert nöd', 'geit nöd', 'abgsturzt', 'faled', 'error', 'problem',
      'chan nöd zuegreife', 'date verlore', 'sicherheitsproblem', 'hack', 'zahlig',
      'rechnig', 'server', 'datenbank', 'system', 'websiite', 'sofort', 'dringend',
      'schnäll', 'jetzt', 'hiuf', 'notfall'
    ];
    
    this.nonUrgentKeywords = [
      'frag', 'wie', 'chönd', 'schulig', 'lerne', 'feature', 'aafrag',
      'iistellige', 'konto', 'plan', 'upgrade', 'termin', 'meetig',
      'informatione', 'dokumentation', 'aaleitig', 'tutorial'
    ];
  }

  // Fast pre-filter before AI analysis
  quickClassify(text) {
    const lowerText = text.toLowerCase();
    
    // Check for urgent keywords
    const urgentScore = this.urgentKeywords.reduce((score, keyword) => {
      return score + (lowerText.includes(keyword) ? 1 : 0);
    }, 0);
    
    // Check for non-urgent keywords
    const nonUrgentScore = this.nonUrgentKeywords.reduce((score, keyword) => {
      return score + (lowerText.includes(keyword) ? 1 : 0);
    }, 0);
    
    // Quick decision based on keyword analysis
    if (urgentScore > nonUrgentScore && urgentScore > 0) {
      return 'urgent';
    } else if (nonUrgentScore > urgentScore && nonUrgentScore > 0) {
      return 'not_urgent';
    }
    
    return 'analyze_needed'; // Need AI analysis
  }

  // Input validation and filtering
  validateInput(speechText) {
    if (!speechText || speechText.trim().length < 3) {
      return { valid: false, reason: 'Z churz' };
    }
    
    if (speechText.length > 500) {
      return { valid: false, reason: 'Z lang' };
    }
    
    // Filter out noise words/phrases in Swiss German
    const noisePatterns = [
      /^(äh|öh|em|ja)+$/i,
      /^(hoi|grüezi|tschau)+$/i,
      /^(ja|nei|okay|ok)+$/i
    ];
    
    for (const pattern of noisePatterns) {
      if (pattern.test(speechText.trim())) {
        return { valid: false, reason: 'Noise input' };
      }
    }
    
    return { valid: true };
  }

  // Optimized issue analysis with Swiss German prompts
  async analyzeIssue(speechText, callSid) {
    try {
      // Step 1: Validate input
      const validation = this.validateInput(speechText);
      if (!validation.valid) {
        logger.info(`Invalid input: ${validation.reason}`);
        return this.getFallbackResponse('unclear');
      }

      // Step 2: Quick classification
      const quickResult = this.quickClassify(speechText);
      
      if (quickResult !== 'analyze_needed') {
        // Fast response without AI call
        logger.info(`Quick classification: ${quickResult}`);
        return this.getQuickResponse(quickResult, speechText, callSid);
      }

      // Step 3: AI analysis with Swiss German prompt
      let context = this.conversations.get(callSid) || [];
      context.push({ role: 'user', content: speechText });

      const systemPrompt = `Du bisch e AI für Business Support uf Schwiizerdütsch. Klassifizier das Business Support Problem schnäll und genau.

DRINGEND (System gheit nöd, Business isch gstoppt):
- System/Websiite isch komplett kaputt
- Chönd kei Zahlige verarbeite/Bestellige
- Date verlore oder korrupt
- Sicherheitsproblem/Hack
- Kritischi System-Fähler

NÖD DRINGEND (Frage, Aafrage):
- Wie-Frage über Features
- Feature-Aafrage
- Schuligs-Aafrag
- Konto-Iistellige
- Allgemeni Frage

Input: "${speechText}"

Antworte NUR i däm JSON Format:
{
  "urgency": "urgent|not_urgent",
  "confidence": 0.9,
  "response": "Churzi Bestätigung uf Schwiizerdütsch"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: speechText }
        ],
        temperature: 0.1,
        max_tokens: 150,
        timeout: 5000
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      
      // Set call stage and store context
      this.callStages.set(callSid, analysis.urgency === 'urgent' ? 'urgent_details' : 'non_urgent_callback');
      context.push({ role: 'assistant', content: analysis.response });
      this.conversations.set(callSid, context);
      
      logger.info(`AI Analysis (${analysis.confidence}): ${analysis.urgency}`);
      return this.formatAnalysisResponse(analysis, callSid);

    } catch (error) {
      logger.error('AI Analysis failed:', error);
      // Fast fallback without AI
      const quickResult = this.quickClassify(speechText);
      return this.getQuickResponse(quickResult !== 'analyze_needed' ? quickResult : 'urgent', speechText, callSid);
    }
  }

  // Quick response without AI for common cases (Swiss German)
  getQuickResponse(urgency, speechText, callSid) {
    this.callStages.set(callSid, urgency === 'urgent' ? 'urgent_details' : 'non_urgent_callback');
    
    if (urgency === 'urgent') {
      return {
        urgency: 'urgent',
        confidence: 0.8,
        suggestedResponse: 'Ich verstaa, das isch dringend. Gäbed mer alli Details, demit ich euch sofort cha hälfe.',
        requiresAddress: true
      };
    } else {
      return {
        urgency: 'not_urgent',
        confidence: 0.8,
        suggestedResponse: 'Ich verstaa euri Aafrag. Öises Team wird sich bi euch mälde für di bescht Hilf.',
        requiresAddress: false
      };
    }
  }

  // Fallback responses for invalid input (Swiss German)
  getFallbackResponse(type) {
    if (type === 'unclear') {
      return {
        urgency: 'not_urgent',
        confidence: 0.3,
        suggestedResponse: 'Ich wott sicher si, dass ich eui Problem richtig verstaa. Chönd der mir das Problem i es paar Wörter erkläre?',
        requiresAddress: false
      };
    }
    
    return this.getQuickResponse('urgent', '', '');
  }

  // Format AI response consistently
  formatAnalysisResponse(analysis, callSid) {
    return {
      urgency: analysis.urgency,
      confidence: analysis.confidence || 0.8,
      suggestedResponse: analysis.response || (analysis.urgency === 'urgent' ? 
        'Ich verstaa, das isch dringend. Gäbed mer di Details.' : 
        'Öises Team wird sich mälde.'),
      requiresAddress: analysis.urgency === 'urgent'
    };
  }

  // Optimized urgent details collection (Swiss German)
  async handleUrgentDetails(speechText, callSid) {
    try {
      const validation = this.validateInput(speechText);
      if (!validation.valid) {
        return {
          response: 'Ich bruche meh Details über das dringend Problem. Chönd der mir erkläre was genau nöd funktioniert?',
          nextStage: 'urgent_details'
        };
      }

      // Store details quickly without AI processing
      const currentData = this.collectedData.get(callSid) || {};
      currentData.detailedMessage = speechText;
      currentData.timestamp = new Date().toISOString();
      this.collectedData.set(callSid, currentData);
      this.callStages.set(callSid, 'collect_address');

      return {
        response: 'Ich han alli Details über eui dringend Problem. Jetzt bruche ich eui Geschäfts-Adrässe, demit öis Team euch sofort cha hälfe.',
        nextStage: 'collect_address'
      };

    } catch (error) {
      logger.error('Error in urgent details:', error);
      return {
        response: 'Ich han eui dringend Problem notiert. Bitte gäbed mer eui Geschäfts-Adrässe für soforti Hilf.',
        nextStage: 'collect_address'
      };
    }
  }

  // Fast address collection (Swiss German)
  async collectAddress(speechText, callSid) {
    try {
      const validation = this.validateInput(speechText);
      if (!validation.valid) {
        return {
          response: 'Ich bruche e vollständigi Geschäfts-Adrässe. Bitte gäbed mer Strass, Stadt und Kanton.',
          addressReceived: false
        };
      }

      // Generate reference number quickly
      const referenceNumber = 'UBG-' + Math.floor(100000 + Math.random() * 900000);
      
      const currentData = this.collectedData.get(callSid) || {};
      currentData.businessAddress = speechText;
      currentData.referenceNumber = referenceNumber;
      currentData.status = 'urgent_escalated';
      currentData.estimatedResponse = 'innerhalb 30 Minute';
      
      this.collectedData.set(callSid, currentData);
      this.urgentCases.set(callSid, currentData);
      this.callStages.set(callSid, 'urgent_complete');

      logger.info(`URGENT CASE: ${referenceNumber}`);

      return {
        response: `Perfekt! Eui dringend Fall ${referenceNumber} isch eskaliert. Öis technisch Team wird euch innerhalb 30 Minute bi dere Adrässe kontaktiere.`,
        referenceNumber: referenceNumber,
        addressReceived: true,
        caseComplete: true
      };

    } catch (error) {
      logger.error('Error collecting address:', error);
      const referenceNumber = 'UBG-' + Math.floor(100000 + Math.random() * 900000);
      return {
        response: `Eui dringend Fall ${referenceNumber} isch eskaliert. Öis Team wird euch innerhalb 30 Minute kontaktiere.`,
        referenceNumber: referenceNumber,
        addressReceived: true,
        caseComplete: true
      };
    }
  }

  // Fast non-urgent handling (Swiss German)
  async handleNonUrgentCallback(speechText, callSid) {
    try {
      this.callStages.set(callSid, 'schedule_callback');
      
      return {
        response: 'Ich verstaa eui Aafrag. Öis spezialisiert Team wird sich mälde zum hälfe. Wele Ziit wär am beschte für euch für e Rückruf?',
        needsCallbackTime: true
      };

    } catch (error) {
      return {
        response: 'Öis Team wird euch zrugglüte. Weli Ziit passt am beschte?',
        needsCallbackTime: true
      };
    }
  }

  // Fast callback scheduling (Swiss German)
  async scheduleCallback(speechText, callSid) {
    try {
      const referenceNumber = 'CBK-' + Math.floor(100000 + Math.random() * 900000);
      
      const currentData = this.collectedData.get(callSid) || {};
      currentData.callbackTime = speechText;
      currentData.referenceNumber = referenceNumber;
      currentData.status = 'callback_scheduled';
      currentData.timestamp = new Date().toISOString();
      
      this.collectedData.set(callSid, currentData);
      this.callStages.set(callSid, 'callback_complete');

      logger.info(`CALLBACK SCHEDULED: ${referenceNumber}`);

      return {
        response: `Perfekt! Öis Team wird euch bi ${speechText} zrugglüte. Eui Referenz-Nummer isch ${referenceNumber}.`,
        referenceNumber: referenceNumber,
        callbackScheduled: true
      };

    } catch (error) {
      const referenceNumber = 'CBK-' + Math.floor(100000 + Math.random() * 900000);
      return {
        response: `Öis Team wird euch zrugglüte. Eui Referenz-Nummer isch ${referenceNumber}.`,
        referenceNumber: referenceNumber,
        callbackScheduled: true
      };
    }
  }

  // Utility methods
  getCallStage(callSid) {
    return this.callStages.get(callSid) || 'initial';
  }

  getUrgentCases() {
    return Array.from(this.urgentCases.values());
  }

  getScheduledCallbacks() {
    const allData = Array.from(this.collectedData.values());
    return allData.filter(data => data.status === 'callback_scheduled');
  }

  cleanup() {
    if (this.conversations.size > 500) {
      this.conversations.clear();
      this.callStages.clear();
    }
  }
}

module.exports = new SwissGermanBusinessSupportService();
