import config from '../config/config.js';
import { fetchWithTimeout } from '../utils/asyncUtils.js';

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

    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: ndjsonText,
      timeoutMs: config.requests.modelWindowTimeoutMs,
      retries: config.requests.retryCount,
      retryDelayMs: config.requests.retryDelayMs,
      timeoutMessage:
        'Tactical window ' +
        windowNumber +
        ' timed out after ' +
        config.requests.modelWindowTimeoutMs +
        ' ms'
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
