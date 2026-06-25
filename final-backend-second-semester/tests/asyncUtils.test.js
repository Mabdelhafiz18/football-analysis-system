import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLimiter, fetchWithTimeout } from '../utils/asyncUtils.js';

test('fetchWithTimeout retries transient failures before succeeding', async () => {
  let attempts = 0;

  const result = await fetchWithTimeout('https://example.test', {
    retries: 2,
    retryDelayMs: 1,
    fetchImpl: async () => {
      attempts += 1;

      if (attempts < 3) {
        throw new Error('temporary network failure');
      }

      return { ok: true, status: 200 };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(attempts, 3);
});

test('fetchWithTimeout aborts a request after the configured timeout', async () => {
  await assert.rejects(
    fetchWithTimeout('https://example.test', {
      timeoutMs: 5,
      fetchImpl: (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        })
    }),
    /timed out after 5 ms/
  );
});

test('createLimiter keeps concurrent tasks at the configured limit', async () => {
  const limit = createLimiter(2);
  let active = 0;
  let maxActive = 0;

  await Promise.all(
    Array.from({ length: 6 }, () =>
      limit(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
      })
    )
  );

  assert.equal(maxActive, 2);
});
