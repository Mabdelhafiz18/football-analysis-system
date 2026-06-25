import { readFile } from 'fs/promises';
import { basename } from 'path';
import config from '../config/config.js';

class VisionClientService {
  constructor() {
    this.baseUrl = config.models.vision.url;
  }

  async processVideo(videoPath, onPacket) {
    if (!this.baseUrl) {
      throw new Error('VISION_SERVICE_URL is not configured');
    }

    const endpoint = this.baseUrl + '/api/process-live-video';

    const videoBuffer = await readFile(videoPath);
    const filename = basename(videoPath);

    const fieldNamesToTry = ['video', 'file', 'video_file'];
    let lastError = null;

    for (const fieldName of fieldNamesToTry) {
      try {
        console.log('[VisionClient] Trying field name: ' + fieldName);

        const formData = new FormData();
        const blob = new Blob([videoBuffer], { type: 'video/mp4' });

        formData.append(fieldName, blob, filename);

        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorText = await response.text();
          lastError = new Error(
            'Vision service failed with status ' + response.status + ': ' + errorText
          );
          console.warn('[VisionClient] Failed with field ' + fieldName + ': ' + response.status);
          continue;
        }

        if (!response.body) {
          throw new Error('Vision service returned empty response body');
        }

        console.log('[VisionClient] Vision stream started');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = '';
        let packetsCount = 0;

        const handleLine = async (line) => {
          const cleanLine = line.trim();

          if (!cleanLine) {
            return;
          }

          try {
            const packet = JSON.parse(cleanLine);

            if (packet.type === 'job_completed') {
              console.log('[VisionClient] Vision job completed message received');
              return;
            }

            packetsCount++;

            if (typeof onPacket === 'function') {
              await onPacket(packet);
            }
          } catch (parseError) {
            console.warn('[VisionClient] Could not parse NDJSON line:', cleanLine);
          }
        };

        while (true) {
          const result = await reader.read();

          if (result.done) {
            break;
          }

          buffer += decoder.decode(result.value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            await handleLine(line);
          }
        }

        if (buffer.trim()) {
          await handleLine(buffer);
        }

        console.log('[VisionClient] Vision stream finished. Packets: ' + packetsCount);

        return {
          status: 'completed',
          packets_count: packetsCount
        };
      } catch (err) {
        lastError = err;
        console.warn('[VisionClient] Error with field ' + fieldName + ':', err.message);
      }
    }

    throw lastError || new Error('Vision service failed');
  }
}

const visionClientService = new VisionClientService();
export default visionClientService;