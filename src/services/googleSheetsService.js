const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const config = require('../../config/config');
const logger = require('../utils/logger');

class GoogleSheetsService {
  constructor() {
    this.spreadsheetId = config.GOOGLE_SHEET_ID;
    
    // Enhanced private key handling
    let privateKey = config.GOOGLE_PRIVATE_KEY;
    
    // Fix common private key format issues
    if (privateKey) {
      // Remove quotes if present
      privateKey = privateKey.replace(/^["']|["']$/g, '');
      
      // Handle escaped newlines
      privateKey = privateKey.replace(/\\n/g, '\n');
      
      // Ensure proper formatting
      if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        logger.warn('Private key may be malformed - missing header');
      }
    }
    
    this.serviceAccountAuth = new JWT({
      email: config.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });
    
    this.doc = null;
    this.urgentSheet = null;
    this.callbackSheet = null;
    this.callLogsSheet = null;
    this.initialized = false;
  }

  // Initialize Google Sheets connection with better error handling
  async initialize() {
    try {
      // Skip if already initialized
      if (this.initialized) {
        return true;
      }

      // Check if required config is present
      if (!this.spreadsheetId) {
        logger.warn('Google Sheets disabled - no GOOGLE_SHEET_ID provided');
        return false;
      }

      if (!config.GOOGLE_SERVICE_ACCOUNT_EMAIL || !config.GOOGLE_PRIVATE_KEY) {
        logger.warn('Google Sheets disabled - missing service account credentials');
        return false;
      }

      logger.info('Initializing Google Sheets connection...');
      
      this.doc = new GoogleSpreadsheet(this.spreadsheetId, this.serviceAccountAuth);
      
      // Test the connection
      await this.doc.loadInfo();
      logger.info(`Connected to Google Sheet: "${this.doc.title}"`);
      
      // Get or create sheets
      this.urgentSheet = await this.getOrCreateSheet('Dringendi_Fäll', [
        'Datum',
        'Ziit', 
        'Referenz_Nummer',
        'Telefon_Nummer',
        'Problem_Beschreibig',
        'Geschäfts_Adrässe',
        'Status',
        'Bearbeitet_vo',
        'Lösigsziit',
        'Notize'
      ]);

      this.callbackSheet = await this.getOrCreateSheet('Planti_Rückrüef', [
        'Datum',
        'Ziit',
        'Referenz_Nummer', 
        'Telefon_Nummer',
        'Aafrag',
        'Gwünschti_Rückruf_Ziit',
        'Status',
        'Bearbeitet_vo',
        'Rückruf_erledigt',
        'Notize'
      ]);

      this.callLogsSheet = await this.getOrCreateSheet('Call_Logs', [
        'Datum',
        'Ziit',
        'Call_SID',
        'Telefon_Nummer',
        'Duur_Sekunde',
        'Status',
        'Typ',
        'AI_Confidence',
        'Transkription'
      ]);

      this.initialized = true;
      logger.info('Google Sheets initialized successfully');
      return true;

    } catch (error) {
      logger.error('Error initializing Google Sheets:', error.message);
      
      // Provide helpful error messages
      if (error.message.includes('DECODER routines')) {
        logger.error('Private key format issue. Please check your GOOGLE_PRIVATE_KEY format.');
        logger.error('Make sure it includes proper newlines and header/footer.');
      } else if (error.message.includes('permission')) {
        logger.error('Permission denied. Make sure the service account has access to the spreadsheet.');
      } else if (error.message.includes('not found')) {
        logger.error('Spreadsheet not found. Check your GOOGLE_SHEET_ID.');
      }
      
      return false;
    }
  }

  // Get or create a sheet with headers
  async getOrCreateSheet(title, headers) {
    try {
      let sheet = this.doc.sheetsByTitle[title];
      
      if (!sheet) {
        // Create new sheet
        sheet = await this.doc.addSheet({ 
          title: title,
          headerValues: headers
        });
        logger.info(`Created new sheet: ${title}`);
      } else {
        // Load existing sheet
        await sheet.loadHeaderRow();
        
        // Add missing headers if needed
        const existingHeaders = sheet.headerValues;
        const missingHeaders = headers.filter(h => !existingHeaders.includes(h));
        
        if (missingHeaders.length > 0) {
          await sheet.setHeaderRow([...existingHeaders, ...missingHeaders]);
          logger.info(`Updated headers for sheet: ${title}`);
        }
      }

      return sheet;
    } catch (error) {
      logger.error(`Error with sheet ${title}:`, error.message);
      return null;
    }
  }

  // Safe method wrapper that checks initialization
  async safeExecute(operation, fallbackValue = null) {
    try {
      if (!this.initialized) {
        const initSuccess = await this.initialize();
        if (!initSuccess) {
          logger.warn('Google Sheets not available, using fallback');
          return fallbackValue;
        }
      }
      return await operation();
    } catch (error) {
      logger.error('Google Sheets operation failed:', error.message);
      return fallbackValue;
    }
  }

  // Save urgent case to Google Sheets
  async saveUrgentCase(caseData) {
    return this.safeExecute(async () => {
      const now = new Date();
      const rowData = {
        'Datum': now.toLocaleDateString('de-CH'),
        'Ziit': now.toLocaleTimeString('de-CH'),
        'Referenz_Nummer': caseData.referenceNumber,
        'Telefon_Nummer': caseData.phoneNumber || 'Unbekannt',
        'Problem_Beschreibig': caseData.detailedMessage || 'Kei Details',
        'Geschäfts_Adrässe': caseData.businessAddress || 'Kei Adrässe',
        'Status': 'Neu',
        'Bearbeitet_vo': '',
        'Lösigsziit': '',
        'Notize': `Erstellt vo AI Agent - ${caseData.timestamp}`
      };

      const row = await this.urgentSheet.addRow(rowData);
      logger.info(`Urgent case saved to sheets: ${caseData.referenceNumber}`);
      
      return {
        success: true,
        rowId: row.rowNumber,
        data: rowData
      };
    }, { success: false, error: 'Google Sheets not available' });
  }

  // Save callback request to Google Sheets
  async saveCallbackRequest(callbackData) {
    return this.safeExecute(async () => {
      const now = new Date();
      const rowData = {
        'Datum': now.toLocaleDateString('de-CH'),
        'Ziit': now.toLocaleTimeString('de-CH'),
        'Referenz_Nummer': callbackData.referenceNumber,
        'Telefon_Nummer': callbackData.phoneNumber || 'Unbekannt',
        'Aafrag': callbackData.inquiry || 'Allgemeni Aafrag',
        'Gwünschti_Rückruf_Ziit': callbackData.callbackTime || 'Nöd spezifiziert',
        'Status': 'Plannt',
        'Bearbeitet_vo': '',
        'Rückruf_erledigt': '',
        'Notize': `Erstellt vo AI Agent - ${callbackData.timestamp}`
      };

      const row = await this.callbackSheet.addRow(rowData);
      logger.info(`Callback request saved to sheets: ${callbackData.referenceNumber}`);
      
      return {
        success: true,
        rowId: row.rowNumber,
        data: rowData
      };
    }, { success: false, error: 'Google Sheets not available' });
  }

  // Log call details
  async logCall(callData) {
    return this.safeExecute(async () => {
      const now = new Date();
      const rowData = {
        'Datum': now.toLocaleDateString('de-CH'),
        'Ziit': now.toLocaleTimeString('de-CH'),
        'Call_SID': callData.callSid,
        'Telefon_Nummer': callData.from || 'Unbekannt',
        'Duur_Sekunde': callData.duration || 0,
        'Status': callData.status || 'Completed',
        'Typ': callData.type || 'Incoming',
        'AI_Confidence': callData.confidence || 0,
        'Transkription': callData.transcription || ''
      };

      await this.callLogsSheet.addRow(rowData);
      logger.info(`Call logged: ${callData.callSid}`);
      
      return { success: true };
    }, { success: false, error: 'Google Sheets not available' });
  }

  // Get all urgent cases
  async getUrgentCases() {
    return this.safeExecute(async () => {
      const rows = await this.urgentSheet.getRows();
      return rows.map(row => ({
        datum: row.get('Datum'),
        ziit: row.get('Ziit'),
        referenzNummer: row.get('Referenz_Nummer'),
        telefonNummer: row.get('Telefon_Nummer'),
        problemBeschreibig: row.get('Problem_Beschreibig'),
        geschäftsAdrässe: row.get('Geschäfts_Adrässe'),
        status: row.get('Status'),
        bearbeitetVo: row.get('Bearbeitet_vo'),
        lösigsziit: row.get('Lösigsziit'),
        notize: row.get('Notize'),
        rowNumber: row.rowNumber
      }));
    }, []);
  }

  // Get all callback requests
  async getCallbackRequests() {
    return this.safeExecute(async () => {
      const rows = await this.callbackSheet.getRows();
      return rows.map(row => ({
        datum: row.get('Datum'),
        ziit: row.get('Ziit'),
        referenzNummer: row.get('Referenz_Nummer'),
        telefonNummer: row.get('Telefon_Nummer'),
        aafrag: row.get('Aafrag'),
        gwünschtiRückrufZiit: row.get('Gwünschti_Rückruf_Ziit'),
        status: row.get('Status'),
        bearbeitetVo: row.get('Bearbeitet_vo'),
        rückrufErledigt: row.get('Rückruf_erledigt'),
        notize: row.get('Notize'),
        rowNumber: row.rowNumber
      }));
    }, []);
  }

  // Update case status
  async updateCaseStatus(referenceNumber, status, notes = '') {
    return this.safeExecute(async () => {
      const rows = await this.urgentSheet.getRows();
      const targetRow = rows.find(row => row.get('Referenz_Nummer') === referenceNumber);

      if (targetRow) {
        targetRow.set('Status', status);
        targetRow.set('Lösigsziit', new Date().toLocaleString('de-CH'));
        if (notes) {
          const existingNotes = targetRow.get('Notize') || '';
          targetRow.set('Notize', existingNotes + ' | ' + notes);
        }
        await targetRow.save();
        
        logger.info(`Updated case ${referenceNumber} to status: ${status}`);
        return { success: true };
      }

      return { success: false, error: 'Case not found' };
    }, { success: false, error: 'Google Sheets not available' });
  }

  // Update callback status
  async updateCallbackStatus(referenceNumber, status, notes = '') {
    return this.safeExecute(async () => {
      const rows = await this.callbackSheet.getRows();
      const targetRow = rows.find(row => row.get('Referenz_Nummer') === referenceNumber);

      if (targetRow) {
        targetRow.set('Status', status);
        targetRow.set('Rückruf_erledigt', new Date().toLocaleString('de-CH'));
        if (notes) {
          const existingNotes = targetRow.get('Notize') || '';
          targetRow.set('Notize', existingNotes + ' | ' + notes);
        }
        await targetRow.save();
        
        logger.info(`Updated callback ${referenceNumber} to status: ${status}`);
        return { success: true };
      }

      return { success: false, error: 'Callback not found' };
    }, { success: false, error: 'Google Sheets not available' });
  }

  // Get statistics
  async getStatistics() {
    return this.safeExecute(async () => {
      const urgentCases = await this.getUrgentCases();
      const callbacks = await this.getCallbackRequests();

      const today = new Date().toLocaleDateString('de-CH');
      
      return {
        totalUrgentCases: urgentCases.length,
        todayUrgentCases: urgentCases.filter(c => c.datum === today).length,
        resolvedUrgentCases: urgentCases.filter(c => c.status === 'Erledigt').length,
        
        totalCallbacks: callbacks.length,
        todayCallbacks: callbacks.filter(c => c.datum === today).length,
        completedCallbacks: callbacks.filter(c => c.status === 'Erledigt').length,
        
        lastUpdated: new Date().toISOString(),
        googleSheetsStatus: 'Connected'
      };
    }, {
      totalUrgentCases: 0,
      todayUrgentCases: 0,
      resolvedUrgentCases: 0,
      totalCallbacks: 0,
      todayCallbacks: 0,
      completedCallbacks: 0,
      lastUpdated: new Date().toISOString(),
      googleSheetsStatus: 'Disconnected'
    });
  }

  // Check if Google Sheets is working
  isConnected() {
    return this.initialized;
  }
}

module.exports = new GoogleSheetsService();