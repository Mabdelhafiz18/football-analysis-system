function toPositiveInteger(value, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }

  return Math.floor(number);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}) {
  const {
    timeoutMs = 300000,
    retries = 0,
    retryDelayMs = 1000,
    fetchImpl = fetch,
    timeoutMessage
  } = options;

  const requestOptions = { ...options };
  delete requestOptions.timeoutMs;
  delete requestOptions.retries;
  delete requestOptions.retryDelayMs;
  delete requestOptions.fetchImpl;
  delete requestOptions.timeoutMessage;

  let lastError = null;
  const maxAttempts = toPositiveInteger(retries, 0) + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetchImpl(url, {
        ...requestOptions,
        signal: controller.signal
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        lastError = new Error(
          timeoutMessage || 'Request timed out after ' + timeoutMs + ' ms'
        );
      } else {
        lastError = err;
      }

      if (attempt >= maxAttempts) {
        throw lastError;
      }

      await sleep(retryDelayMs);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error('Request failed');
}

function createLimiter(concurrency) {
  const limit = toPositiveInteger(concurrency, 1);
  const queue = [];
  let activeCount = 0;

  const runNext = () => {
    if (activeCount >= limit || queue.length === 0) {
      return;
    }

    const item = queue.shift();
    activeCount += 1;

    Promise.resolve()
      .then(item.task)
      .then(item.resolve, item.reject)
      .finally(() => {
        activeCount -= 1;
        runNext();
      });
  };

  return function limitTask(task) {
    return new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      runNext();
    });
  };
}

export {
  createLimiter,
  fetchWithTimeout,
  toPositiveInteger
};
