import config from '../config/config.js';

class FoulClientService {
  constructor() {
    this.baseUrl = config.models.foul.url;
  }

  async analyzeWindow(matchId, ndjsonText, windowNumber) {
    if (!this.baseUrl) {
      console.warn('[Foul] FOUL_SERVICE_URL is not configured');
      return null;
    }

    const endpoint = this.baseUrl + '/api/analyze-live-ndjson?job_id=' + matchId;

    console.log('[Foul] Sending live window ' + windowNumber);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: ndjsonText
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('Foul failed with status ' + response.status + ': ' + errorText);
    }

    const result = await response.json();

    console.log('[Foul] Window ' + windowNumber + ' result received');

    return result;
  }
}

const foulClientService = new FoulClientService();
export default foulClientService;