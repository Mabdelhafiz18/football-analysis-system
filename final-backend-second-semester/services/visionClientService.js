import { openAsBlob } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import config from '../config/config.js';
import { fetchWithTimeout } from '../utils/asyncUtils.js';

function getVideoMimeType(videoPath) {
  const extension = extname(videoPath).toLowerCase();

  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.webm': 'video/webm',
    '.m4v': 'video/x-m4v'
  };

  return mimeTypes[extension] || 'application/octet-stream';
}

function formatBytes(bytes) {
  const megabytes = bytes / (1024 * 1024);

  if (megabytes < 1024) {
    return megabytes.toFixed(2) + ' MB';
  }

  return (megabytes / 1024).toFixed(2) + ' GB';
}

async function readWithTimeout(reader, timeoutMs) {
  let timeout = null;

  try {
    return await Promise.race([
      reader.read(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          reader.cancel().catch(() => {});
          reject(new Error('Vision stream timed out after ' + timeoutMs + ' ms'));
        }, timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

class VisionClientService {
  constructor() {
    this.baseUrl = config.models.vision.url;
  }

  async processVideo(videoPath, onPacket) {
    if (!this.baseUrl) {
      throw new Error('VISION_SERVICE_URL is not configured');
    }

    await access(videoPath);

    const fileInfo = await stat(videoPath);

    if (!fileInfo.isFile()) {
      throw new Error('Vision input path is not a file: ' + videoPath);
    }

    const endpoint = this.baseUrl + '/api/process-live-video';
    const filename = basename(videoPath);
    const mimeType = getVideoMimeType(videoPath);

    console.log('[VisionClient] Streaming video directly from disk');
    console.log('[VisionClient] File: ' + filename);
    console.log('[VisionClient] Size: ' + formatBytes(fileInfo.size));
    console.log('[VisionClient] Endpoint: ' + endpoint);

    /*
     * "file" is tried first because the deployed Vision endpoint uses this
     * multipart field in the working integration. Other names remain only
     * as compatibility fallbacks.
     *
     * fs.openAsBlob() creates a file-backed Blob. It does not read the
     * complete video into Node.js RAM like readFile() did.
     */
    const fieldNamesToTry = ['file', 'video', 'video_file'];
    let lastError = null;

    for (const fieldName of fieldNamesToTry) {
      try {
        console.log('[VisionClient] Trying multipart field: ' + fieldName);

        const videoBlob = await openAsBlob(videoPath, { type: mimeType });
        const formData = new FormData();

        formData.append(fieldName, videoBlob, filename);

        const response = await fetchWithTimeout(endpoint, {
          method: 'POST',
          body: formData,
          timeoutMs: config.requests.visionTimeoutMs,
          retries: config.requests.retryCount,
          retryDelayMs: config.requests.retryDelayMs,
          timeoutMessage:
            'Vision request timed out after ' +
            config.requests.visionTimeoutMs +
            ' ms while uploading or waiting for analysis'
        });

        if (!response.ok) {
          const errorText = await response.text();

          lastError = new Error(
            'Vision service failed with status ' +
              response.status +
              ' using field "' +
              fieldName +
              '": ' +
              errorText
          );

          console.warn(
            '[VisionClient] HTTP ' +
              response.status +
              ' using field ' +
              fieldName
          );

          continue;
        }

        if (!response.body) {
          throw new Error('Vision service returned an empty response body');
        }

        console.log('[VisionClient] Vision NDJSON stream started');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let ndjsonBuffer = '';
        let packetsCount = 0;

        const handleLine = async (line) => {
          const cleanLine = line.trim();

          if (!cleanLine) {
            return;
          }

          try {
            const packet = JSON.parse(cleanLine);

            if (packet.type === 'job_completed') {
              console.log(
                '[VisionClient] Vision job completed message received'
              );
              return;
            }

            packetsCount += 1;

            if (typeof onPacket === 'function') {
              await onPacket(packet);
            }
          } catch (parseError) {
            console.warn(
              '[VisionClient] Could not parse NDJSON line:',
              cleanLine
            );
          }
        };

        while (true) {
          const result = await readWithTimeout(
            reader,
            config.requests.visionTimeoutMs
          );

          if (result.done) {
            break;
          }

          ndjsonBuffer += decoder.decode(result.value, { stream: true });

          const lines = ndjsonBuffer.split('\n');
          ndjsonBuffer = lines.pop() || '';

          for (const line of lines) {
            await handleLine(line);
          }
        }

        ndjsonBuffer += decoder.decode();

        if (ndjsonBuffer.trim()) {
          await handleLine(ndjsonBuffer);
        }

        console.log(
          '[VisionClient] Vision stream finished. Packets: ' + packetsCount
        );

        return {
          status: 'completed',
          packets_count: packetsCount
        };
      } catch (error) {
        lastError = error;

        const causeMessage =
          error && error.cause && error.cause.message
            ? ' | cause: ' + error.cause.message
            : '';

        console.warn(
          '[VisionClient] Error using field ' +
            fieldName +
            ': ' +
            error.message +
            causeMessage
        );
      }
    }

    throw lastError || new Error('Vision service failed');
  }
}

const visionClientService = new VisionClientService();

export default visionClientService;
