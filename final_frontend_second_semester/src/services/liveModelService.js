const API_BASE_URL = 'http://127.0.0.1:8000';

export function connectToMatchLive(matchId, handlers = {}) {
  if (!matchId) {
    console.warn('[Live] Missing matchId');
    return null;
  }

  const url = `${API_BASE_URL}/api/live/match/${matchId}`;

  console.log('[Live] Connecting to:', url);

  const eventSource = new EventSource(url);

  eventSource.onopen = () => {
    console.log('[Live] SSE connection opened for match:', matchId);

    if (handlers.onOpen) {
      handlers.onOpen();
    }
  };

  eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);

      if (payload.type === 'connected') {
        console.log('[Live] Connected:', payload);
      }

      if (payload.type === 'heartbeat') {
        return;
      }

      if (payload.type === 'match_status') {
        console.log('[Live] Match status:', payload.data);

        if (handlers.onStatus) {
          handlers.onStatus(payload.data);
        }
      }

      if (payload.type === 'model_result') {
        console.log('[Live] Model result:', payload.data);

        if (handlers.onModelResult) {
          handlers.onModelResult(payload.data);
        }
      }
    } catch (err) {
      console.warn('[Live] Could not parse SSE message:', event.data);
    }
  };

  eventSource.onerror = (err) => {
    console.warn('[Live] SSE connection error:', err);

    if (handlers.onError) {
      handlers.onError(err);
    }
  };

  return eventSource;
}