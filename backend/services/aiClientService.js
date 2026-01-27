import config from '../config/config.js';

/**
 * AI Service Client
 * HTTP client for communicating with the AI processing service
 * Implements retry logic, error handling, and timeout management
 */
class AIClientService {
  constructor() {
    this.baseUrl = config.ai.url;
    this.maxRetries = config.ai.maxRetries || 3;
    this.retryDelay = 1000; // 1 second base delay
    this.timeout = 30000; // 30 second timeout for regular requests
    this.uploadTimeout = 300000; // 5 minute timeout for video uploads
  }

  /**
   * Make an HTTP request with retry logic
   * @param {string} endpoint - API endpoint (e.g., '/api/process-video')
   * @param {Object} options - Fetch options
   * @param {number} retries - Number of retries remaining
   * @returns {Promise<Object>} - Response data
   */
  async request(endpoint, options = {}, retries = this.maxRetries) {
    const url = `${this.baseUrl}${endpoint}`;
    const timeout = options.timeout || this.timeout;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const fetchOptions = {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    try {
      console.log(`[AIClient] ${options.method || 'GET'} ${url}`);
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorBody);
        } catch {
          errorData = { message: errorBody };
        }

        const error = new Error(errorData.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = errorData;
        throw error;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout
      if (error.name === 'AbortError') {
        error.message = `Request timeout after ${timeout}ms`;
        error.code = 'TIMEOUT';
      }

      // Retry on network errors or 5xx errors
      const shouldRetry = retries > 0 && (
        error.code === 'TIMEOUT' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND' ||
        (error.status && error.status >= 500)
      );

      if (shouldRetry) {
        const delay = this.retryDelay * (this.maxRetries - retries + 1); // Exponential backoff
        console.warn(`[AIClient] Request failed, retrying in ${delay}ms... (${retries} retries left)`);
        await this.sleep(delay);
        return this.request(endpoint, options, retries - 1);
      }

      console.error(`[AIClient] Request failed:`, error.message);
      throw error;
    }
  }

  /**
   * Sleep helper for retry delays
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send video for processing
   * POST /api/process-video
   * @param {Object} payload - Video processing request
   * @param {number} payload.match_id - Match ID
   * @param {string} payload.video_url - URL or path to video file
   * @param {string} payload.video_filename - Original filename
   * @param {Object} payload.match_info - Match metadata
   * @returns {Promise<{job_id: string, status: string, match_id: number, message: string}>}
   */
  async processVideo(payload) {
    console.log(`[AIClient] Sending video for processing: match_id=${payload.match_id}`);
    
    const response = await this.request('/api/process-video', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeout: this.uploadTimeout
    });

    console.log(`[AIClient] Processing started: job_id=${response.job_id}`);
    return response;
  }

  /**
   * Get processing status
   * GET /api/status/{job_id}
   * @param {string} jobId - Job ID from processVideo response
   * @returns {Promise<Object>} - Status object with progress and results (when completed)
   */
  async getStatus(jobId) {
    const response = await this.request(`/api/status/${jobId}`, {
      method: 'GET'
    });

    return response;
  }

  /**
   * Check if AI service is healthy
   * GET /health
   * @returns {Promise<boolean>} - True if service is healthy
   */
  async healthCheck() {
    try {
      const response = await this.request('/health', {
        method: 'GET',
        timeout: 5000 // 5 second timeout for health check
      });
      return response.status === 'healthy';
    } catch (error) {
      console.warn('[AIClient] Health check failed:', error.message);
      return false;
    }
  }

  /**
   * Check if the AI service is available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      return await this.healthCheck();
    } catch {
      return false;
    }
  }

  /**
   * Get the base URL of the AI service
   * @returns {string}
   */
  getBaseUrl() {
    return this.baseUrl;
  }
}

// Export singleton instance
const aiClientService = new AIClientService();
export default aiClientService;
