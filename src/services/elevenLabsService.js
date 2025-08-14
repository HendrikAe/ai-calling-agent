const axios = require('axios');
const config = require('../../config/config');
const logger = require('../utils/logger');

class ElevenLabsService {
  constructor() {
    this.apiKey = config.ELEVENLABS_API_KEY;
    this.baseURL = 'https://api.elevenlabs.io/v1';
    
    // German/Swiss German voice IDs (you'll need to get these from ElevenLabs)
    this.voices = {
      // Professional German voices
      german_male: 'ErXwobaYiN019PkySvjV', // Adam (multilingual)
      german_female: 'EXAVITQu4vr4xnSDxMaL', // Bella (multilingual)
      swiss_custom: null // You can clone a Swiss German voice
    };
    
    // Default voice settings for natural speech
    this.voiceSettings = {
      stability: 0.75,        // Higher = more stable/consistent
      similarity_boost: 0.85, // Higher = more similar to original voice
      style: 0.2,            // Lower = more natural conversation
      use_speaker_boost: true
    };
  }

  // Generate speech audio from text
  async generateSpeech(text, voiceId = null) {
    try {
      const selectedVoiceId = voiceId || this.voices.german_female;
      
      const response = await axios.post(
        `${this.baseURL}/text-to-speech/${selectedVoiceId}`,
        {
          text: text,
          model_id: 'eleven_multilingual_v2', // Best for German
          voice_settings: this.voiceSettings
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey
          },
          responseType: 'arraybuffer',
          timeout: 30000 // 30 second timeout
        }
      );

      // Return the audio buffer
      return {
        success: true,
        audioBuffer: response.data,
        contentType: 'audio/mpeg'
      };

    } catch (error) {
      logger.error('ElevenLabs API error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get available voices
  async getVoices() {
    try {
      const response = await axios.get(`${this.baseURL}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      return response.data.voices;
    } catch (error) {
      logger.error('Error fetching voices:', error);
      return [];
    }
  }

  // Clone a voice (useful for creating Swiss German speaker)
  async cloneVoice(name, files, description = '') {
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      
      // Add audio files
      files.forEach((file, index) => {
        formData.append('files', file, `sample_${index}.mp3`);
      });

      const response = await axios.post(
        `${this.baseURL}/voices/add`,
        formData,
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Error cloning voice:', error);
      return null;
    }
  }

  // Generate audio URL for Twilio
  async generateTwilioAudio(text, voiceId = null) {
    try {
      const audioResult = await this.generateSpeech(text, voiceId);
      
      if (!audioResult.success) {
        return null;
      }

      // In production, upload to AWS S3, Google Cloud Storage, or similar
      // For now, we'll return a data URL (limited size)
      const base64Audio = Buffer.from(audioResult.audioBuffer).toString('base64');
      return `data:audio/mpeg;base64,${base64Audio}`;

    } catch (error) {
      logger.error('Error generating Twilio audio:', error);
      return null;
    }
  }

  // Check API quota
  async getQuota() {
    try {
      const response = await axios.get(`${this.baseURL}/user`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      return {
        charactersUsed: response.data.subscription.character_count,
        charactersLimit: response.data.subscription.character_limit,
        resetDate: response.data.subscription.next_character_refresh_unix
      };
    } catch (error) {
      logger.error('Error checking quota:', error);
      return null;
    }
  }
}

module.exports = new ElevenLabsService();