import config from '../config/config.js';

class OffsideClientService {
  constructor() {
    this.baseUrl = config.models.offside.url;
  }

  async analyzeWindow(matchId, ndjsonText, windowNumber) {
    if (!this.baseUrl) {
      console.warn('[Offside] OFFSIDE_SERVICE_URL is not configured');
      return null;
    }

    const endpoint = this.baseUrl + '/api/analyze-live-ndjson?job_id=' + matchId;

    console.log('[Offside] Sending live window ' + windowNumber);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: ndjsonText
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('Offside failed with status ' + response.status + ': ' + errorText);
    }

    const result = await response.json();

    console.log('[Offside] Window ' + windowNumber + ' result received');

    return result;
  }
}

const offsideClientService = new OffsideClientService();
export default offsideClientService;