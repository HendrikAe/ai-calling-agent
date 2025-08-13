const OpenAI = require('openai');
const config = require('../../config/config');
const logger = require('../utils/logger');

class BusinessSupportService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY
    });
    
    // Store conversation contexts and data collection
    this.conversations = new Map();
    this.urgentCases = new Map();
    this.callStages = new Map(); // Track call progression
    this.collectedData = new Map(); // Store name, address, etc.
  }

  // Step 1: Analyze the initial issue description
  async analyzeIssue(speechText, callSid) {
    try {
      let context = this.conversations.get(callSid) || [];
      context.push({ role: 'user', content: speechText });

      const systemPrompt = `You are a business support AI. A customer just explained their issue after you asked "What happened? How can I help you today?"

CLASSIFY AS URGENT OR NOT URGENT:

URGENT ISSUES (need immediate attention + address collection):
- System/website completely down
- Cannot access critical business functions
- Data loss or corruption
- Security breach or suspicious activity
- Payment/billing system not working
- Cannot process orders/customers
- Server crashes or technical emergencies
- Database issues affecting operations

NOT URGENT ISSUES (team will reach out + schedule callback):
- General questions about features
- Training requests
- Feature requests or suggestions
- Minor bugs that don't stop business
- Account settings questions
- General inquiries
- Planning discussions
- Documentation requests

Customer said: "${speechText}"

Respond in JSON:
{
  "urgency": "urgent|not_urgent",
  "issueType": "system_down|access_issue|data_loss|security|billing_emergency|general_question|feature_request|training|minor_bug",
  "confidence": 0.9,
  "suggestedResponse": "Immediate response to the customer",
  "requiresAddress": true/false,
  "reasoning": "Why classified this way"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          ...context.slice(-3)
        ],
        temperature: 0.2, // Low temperature for consistent classification
        max_tokens: 300
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      
      // Set call stage based on urgency
      if (analysis.urgency === 'urgent') {
        this.callStages.set(callSid, 'urgent_details');
        analysis.requiresAddress = true;
      } else {
        this.callStages.set(callSid, 'non_urgent_callback');
        analysis.requiresAddress = false;
      }

      context.push({ role: 'assistant', content: analysis.suggestedResponse });
      this.conversations.set(callSid, context);
      
      logger.info(`Issue Analysis: ${JSON.stringify(analysis)}`);
      return analysis;

    } catch (error) {
      logger.error('Error analyzing issue:', error);
      return {
        urgency: 'urgent',
        issueType: 'system_down',
        confidence: 0.1,
        suggestedResponse: 'I understand you have an urgent issue. Let me get your details to help you immediately.',
        requiresAddress: true,
        reasoning: 'Fallback - treating as urgent to be safe'
      };
    }
  }

  // Step 2: Handle urgent case - collect detailed message
  async handleUrgentDetails(speechText, callSid) {
    try {
      let context = this.conversations.get(callSid) || [];
      context.push({ role: 'user', content: speechText });

      const currentData = this.collectedData.get(callSid) || {};

      const systemPrompt = `You are collecting detailed information for an URGENT business issue.

CURRENT STAGE: Getting detailed message before asking for address
WHAT USER JUST SAID: "${speechText}"

Your job:
1. Acknowledge their detailed explanation
2. Ask for their business address for immediate support dispatch
3. Be professional and urgent

Respond in JSON:
{
  "response": "Acknowledge details and ask for business address",
  "nextStage": "collect_address",
  "messageComplete": true
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          ...context.slice(-3)
        ],
        temperature: 0.3,
        max_tokens: 200
      });

      const handling = JSON.parse(response.choices[0].message.content);
      
      // Store the detailed message
      currentData.detailedMessage = speechText;
      currentData.timestamp = new Date().toISOString();
      this.collectedData.set(callSid, currentData);

      // Update stage to collect address
      this.callStages.set(callSid, 'collect_address');

      context.push({ role: 'assistant', content: handling.response });
      this.conversations.set(callSid, context);

      return handling;

    } catch (error) {
      logger.error('Error handling urgent details:', error);
      return {
        response: 'I have noted your urgent issue details. Now I need your business address so our team can assist you immediately.',
        nextStage: 'collect_address',
        messageComplete: true
      };
    }
  }

  // Step 3: Collect business address for urgent cases
  async collectAddress(speechText, callSid) {
    try {
      let context = this.conversations.get(callSid) || [];
      context.push({ role: 'user', content: speechText });

      const currentData = this.collectedData.get(callSid) || {};

      const systemPrompt = `You are collecting a business address for an urgent support case.

USER PROVIDED ADDRESS: "${speechText}"

Your job:
1. Confirm you received the address
2. Generate a reference number (format: UBG-XXXXXX)
3. Promise immediate action
4. Give timeline for response

Respond in JSON:
{
  "response": "Confirm address, provide reference number, promise action",
  "referenceNumber": "UBG-" + 6 random digits,
  "addressReceived": true,
  "estimatedResponse": "within 30 minutes",
  "caseComplete": true
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          ...context.slice(-3)
        ],
        temperature: 0.3,
        max_tokens: 200
      });

      const addressHandling = JSON.parse(response.choices[0].message.content);
      
      // Store complete urgent case
      currentData.businessAddress = speechText;
      currentData.referenceNumber = addressHandling.referenceNumber;
      currentData.status = 'urgent_escalated';
      currentData.estimatedResponse = addressHandling.estimatedResponse;
      
      this.collectedData.set(callSid, currentData);
      this.urgentCases.set(callSid, currentData);

      // Complete the urgent flow
      this.callStages.set(callSid, 'urgent_complete');

      context.push({ role: 'assistant', content: addressHandling.response });
      this.conversations.set(callSid, context);

      logger.info(`URGENT CASE COMPLETE: ${addressHandling.referenceNumber} - ${JSON.stringify(currentData)}`);

      return addressHandling;

    } catch (error) {
      logger.error('Error collecting address:', error);
      return {
        response: 'Thank you for the address. Your urgent case UBG-123456 has been escalated and our team will contact you within 30 minutes.',
        referenceNumber: 'UBG-123456',
        addressReceived: true,
        estimatedResponse: 'within 30 minutes',
        caseComplete: true
      };
    }
  }

  // Step 4: Handle non-urgent cases - schedule callback
  async handleNonUrgentCallback(speechText, callSid) {
    try {
      let context = this.conversations.get(callSid) || [];
      context.push({ role: 'user', content: speechText });

      const systemPrompt = `You are handling a NON-URGENT business inquiry and need to schedule a callback.

CUSTOMER INQUIRY: "${speechText}"

Your job:
1. Acknowledge their inquiry
2. Explain our team will reach out
3. Ask when is a good time to call back
4. Be professional but not urgent

Respond in JSON:
{
  "response": "Acknowledge inquiry and ask for preferred callback time",
  "needsCallbackTime": true,
  "nextStage": "schedule_callback"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          ...context.slice(-3)
        ],
        temperature: 0.4,
        max_tokens: 200
      });

      const handling = JSON.parse(response.choices[0].message.content);
      
      // Update stage to schedule callback
      this.callStages.set(callSid, 'schedule_callback');

      context.push({ role: 'assistant', content: handling.response });
      this.conversations.set(callSid, context);

      return handling;

    } catch (error) {
      logger.error('Error handling non-urgent:', error);
      return {
        response: 'I understand your inquiry. Our team will reach out to you. What would be a good time for us to call you back?',
        needsCallbackTime: true,
        nextStage: 'schedule_callback'
      };
    }
  }

  // Step 5: Schedule the callback time
  async scheduleCallback(speechText, callSid) {
    try {
      let context = this.conversations.get(callSid) || [];
      context.push({ role: 'user', content: speechText });

      const currentData = this.collectedData.get(callSid) || {};

      const systemPrompt = `You are confirming a callback time for a non-urgent business inquiry.

CUSTOMER PREFERRED TIME: "${speechText}"

Your job:
1. Confirm the callback time
2. Generate a reference number (format: CBK-XXXXXX)
3. Reassure them about the callback

Respond in JSON:
{
  "response": "Confirm callback time and provide reference",
  "callbackTime": "formatted time from user input",
  "referenceNumber": "CBK-" + 6 random digits,
  "callbackScheduled": true
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          ...context.slice(-3)
        ],
        temperature: 0.3,
        max_tokens: 200
      });

      const scheduling = JSON.parse(response.choices[0].message.content);
      
      // Store callback information
      currentData.callbackTime = speechText;
      currentData.referenceNumber = scheduling.referenceNumber;
      currentData.status = 'callback_scheduled';
      currentData.timestamp = new Date().toISOString();
      
      this.collectedData.set(callSid, currentData);

      // Complete the non-urgent flow
      this.callStages.set(callSid, 'callback_complete');

      context.push({ role: 'assistant', content: scheduling.response });
      this.conversations.set(callSid, context);

      logger.info(`CALLBACK SCHEDULED: ${scheduling.referenceNumber} - ${JSON.stringify(currentData)}`);

      return scheduling;

    } catch (error) {
      logger.error('Error scheduling callback:', error);
      return {
        response: 'Perfect! Our team will call you back at that time. Your reference number is CBK-123456.',
        callbackTime: speechText,
        referenceNumber: 'CBK-123456',
        callbackScheduled: true
      };
    }
  }

  // Get current call stage
  getCallStage(callSid) {
    return this.callStages.get(callSid) || 'initial';
  }

  // Get all urgent cases (for admin dashboard)
  getUrgentCases() {
    return Array.from(this.urgentCases.values());
  }

  // Get all scheduled callbacks (for admin dashboard)
  getScheduledCallbacks() {
    const allData = Array.from(this.collectedData.values());
    return allData.filter(data => data.status === 'callback_scheduled');
  }

  // Cleanup old data
  cleanup() {
    if (this.conversations.size > 1000) {
      this.conversations.clear();
      this.callStages.clear();
    }
  }
}

module.exports = new BusinessSupportService();