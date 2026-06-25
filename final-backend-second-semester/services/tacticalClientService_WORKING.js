import config from '../config/config.js';

class TacticalClientService {
  constructor() {
    this.baseUrl = config.models.tactical.url;
  }

  async analyzeWindow(matchId, ndjsonText, windowNumber) {
    if (!this.baseUrl) {
      console.warn('[Tactical] TACTICAL_SERVICE_URL is not configured');
      return null;
    }

    const endpoint = this.baseUrl + '/api/analyze-live-ndjson?job_id=' + matchId;

    console.log('[Tactical] Sending live window ' + windowNumber);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: ndjsonText
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('Tactical failed with status ' + response.status + ': ' + errorText);
    }

    const result = await response.json();

    console.log('[Tactical] Window ' + windowNumber + ' result received');

    return result;
  }
}

const tacticalClientService = new TacticalClientService();
export default tacticalClientService;