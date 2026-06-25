import config from '../config/config.js';
import { fetchWithTimeout } from '../utils/asyncUtils.js';

class NdjsonModelClientService {
  async sendNdjsonWindow(modelName, baseUrl, matchId, ndjsonText) {
    if (!baseUrl) {
      throw new Error(modelName + ' service URL is not configured');
    }

    const endpoint = baseUrl + '/api/analyze-live-ndjson?job_id=' + matchId;

    console.log('[' + modelName + '] Sending NDJSON window to: ' + endpoint);

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
        modelName +
        ' request timed out after ' +
        config.requests.modelWindowTimeoutMs +
        ' ms'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(modelName + ' failed with status ' + response.status + ': ' + errorText);
    }

    const result = await response.json();

    console.log('[' + modelName + '] Result received');

    return result;
  }

  async sendToTactical(matchId, ndjsonText) {
    return this.sendNdjsonWindow(
      'Tactical',
      config.models.tactical.url,
      matchId,
      ndjsonText
    );
  }

  async sendToXg(matchId, ndjsonText) {
    return this.sendNdjsonWindow(
      'xG',
      config.models.xg.url,
      matchId,
      ndjsonText
    );
  }

  async sendToOffside(matchId, ndjsonText) {
    return this.sendNdjsonWindow(
      'Offside',
      config.models.offside.url,
      matchId,
      ndjsonText
    );
  }

  async sendToAll(matchId, ndjsonText) {
    const results = {
      tactical: null,
      xg: null,
      offside: null
    };

    try {
      results.tactical = await this.sendToTactical(matchId, ndjsonText);
    } catch (err) {
      console.warn('[Tactical] Error:', err.message);
      results.tactical = { error: err.message };
    }

    try {
      results.xg = await this.sendToXg(matchId, ndjsonText);
    } catch (err) {
      console.warn('[xG] Error:', err.message);
      results.xg = { error: err.message };
    }

    try {
      results.offside = await this.sendToOffside(matchId, ndjsonText);
    } catch (err) {
      console.warn('[Offside] Error:', err.message);
      results.offside = { error: err.message };
    }

    return results;
  }
}

const ndjsonModelClientService = new NdjsonModelClientService();
export default ndjsonModelClientService;
