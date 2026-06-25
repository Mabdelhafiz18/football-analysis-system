import config from '../config/config.js';

class XgClientService {
  constructor() {
    this.baseUrl = config.models.xg.url;
  }

  async analyzeWindow(matchId, ndjsonText, windowNumber) {
    if (!this.baseUrl) {
      console.warn('[xG] XG_SERVICE_URL is not configured');
      return null;
    }

    const endpoint = this.baseUrl + '/api/analyze-live-ndjson?job_id=' + matchId;

    console.log('[xG] Sending live window ' + windowNumber);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: ndjsonText
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('xG failed with status ' + response.status + ': ' + errorText);
    }

    const result = await response.json();

    console.log('[xG] Window ' + windowNumber + ' result received');

    return result;
  }
}

const xgClientService = new XgClientService();
export default xgClientService;