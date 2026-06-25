import { openAsBlob } from 'node:fs';
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import config from '../config/config.js';
import { fetchWithTimeout } from '../utils/asyncUtils.js';

const execFileAsync = promisify(execFile);

class FoulClientService {
  constructor() {
    this.baseUrl = config.models.foul.url;
    this.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    this.clipDurationSeconds = Number(process.env.FOUL_CLIP_DURATION_SECONDS || 5);
    this.requestTimeoutMs = config.requests.foulTimeoutMs;
  }

  async _fetchWithTimeout(url, options) {
    return fetchWithTimeout(url, {
      ...options,
      timeoutMs: this.requestTimeoutMs,
      retries: config.requests.retryCount,
      retryDelayMs: config.requests.retryDelayMs,
      timeoutMessage: 'Foul request timed out after ' + this.requestTimeoutMs + ' ms'
    });
  }

  async analyzeWindow(matchId, ndjsonText, windowNumber) {
    if (!this.baseUrl) {
      console.warn('[Foul] FOUL_SERVICE_URL is not configured');
      return null;
    }

    const endpoint = this.baseUrl + '/api/analyze-live-ndjson?job_id=' + matchId;

    console.log('[Foul] Sending live NDJSON window ' + windowNumber);

    const response = await this._fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: ndjsonText
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('Foul NDJSON failed with status ' + response.status + ': ' + errorText);
    }

    const result = await response.json();

    console.log('[Foul] NDJSON window ' + windowNumber + ' result received');

    return result;
  }

  _buildClipBounds(windowStartTime, windowEndTime) {
    const duration = Number.isFinite(this.clipDurationSeconds) && this.clipDurationSeconds > 0
      ? this.clipDurationSeconds
      : 5;

    const hasStart = Number.isFinite(windowStartTime);
    const hasEnd = Number.isFinite(windowEndTime);

    let centerTime = 0;

    if (hasStart && hasEnd) {
      centerTime = (windowStartTime + windowEndTime) / 2;
    } else if (hasStart) {
      centerTime = windowStartTime;
    } else if (hasEnd) {
      centerTime = windowEndTime;
    }

    const startTime = Math.max(0, centerTime - duration / 2);
    const endTime = startTime + duration;

    return {
      startTime: Number(startTime.toFixed(3)),
      endTime: Number(endTime.toFixed(3)),
      duration: Number(duration.toFixed(3))
    };
  }

  async _createClip(videoPath, matchId, windowNumber, startTime, duration) {
    if (!videoPath) {
      throw new Error('Video path is missing for Foul clip analysis');
    }

    const absoluteVideoPath = path.resolve(videoPath);
    const tempDir = path.join(process.cwd(), 'temp', 'foul-clips');
    const clipPath = path.join(
      tempDir,
      'match_' + matchId + '_window_' + windowNumber + '_' + Date.now() + '.mp4'
    );

    await fs.access(absoluteVideoPath);
    await fs.mkdir(tempDir, { recursive: true });

    const args = [
      '-y',
      '-ss',
      String(startTime),
      '-i',
      absoluteVideoPath,
      '-t',
      String(duration),
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-an',
      '-movflags',
      '+faststart',
      clipPath
    ];

    console.log(
      '[Foul] Cutting clip for window ' +
        windowNumber +
        ' from ' +
        startTime +
        's for ' +
        duration +
        's'
    );

    try {
      await execFileAsync(this.ffmpegPath, args, {
        windowsHide: true,
        maxBuffer: 20 * 1024 * 1024
      });
    } catch (err) {
      const details = err.stderr || err.message;
      throw new Error('FFmpeg clip creation failed: ' + details);
    }

    return clipPath;
  }

  async analyzeClipWindow({
    matchId,
    videoPath,
    ndjsonText,
    windowNumber,
    windowStartTime,
    windowEndTime
  }) {
    if (!this.baseUrl) {
      throw new Error('FOUL_SERVICE_URL is not configured');
    }

    const bounds = this._buildClipBounds(windowStartTime, windowEndTime);
    let clipPath = null;

    try {
      clipPath = await this._createClip(
        videoPath,
        matchId,
        windowNumber,
        bounds.startTime,
        bounds.duration
      );

      const clipBlob = await openAsBlob(clipPath, { type: 'video/mp4' });
      const formData = new FormData();
      const windowId = 'match_' + matchId + '_window_' + windowNumber;

      formData.append(
        'file',
        clipBlob,
        path.basename(clipPath)
      );
      formData.append('match_id', String(matchId));
      formData.append('window_id', windowId);
      formData.append('start_time', String(bounds.startTime));
      formData.append('end_time', String(bounds.endTime));

      if (ndjsonText) {
        formData.append('ndjson', ndjsonText);
      }

      const endpoint = this.baseUrl + '/api/analyze-live-clip';

      console.log('[Foul] Sending GPU clip window ' + windowNumber);

      const response = await this._fetchWithTimeout(endpoint, {
        method: 'POST',
        body: formData
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(
          'Foul clip failed with status ' + response.status + ': ' + responseText
        );
      }

      let result;

      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error('Foul clip returned invalid JSON: ' + responseText);
      }

      console.log('[Foul] GPU clip window ' + windowNumber + ' result received');

      return {
        ...result,
        verification_stage: 'full_gpu_clip',
        clip_verified: true,
        source_window_number: windowNumber,
        clip_bounds: {
          start_time: bounds.startTime,
          end_time: bounds.endTime,
          duration_sec: bounds.duration
        }
      };
    } finally {
      if (clipPath) {
        fs.rm(clipPath, { force: true }).catch((err) => {
          console.warn('[Foul] Could not delete temporary clip:', err.message);
        });
      }
    }
  }
}

const foulClientService = new FoulClientService();
export default foulClientService;
