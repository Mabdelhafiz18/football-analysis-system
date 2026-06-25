const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export interface MatchLiveHandlers {
  onOpen?: () => void;
  onStatus?: (data: unknown) => void;
  onModelResult?: (data: unknown) => void;
  onError?: (error: Event) => void;
}

export function connectToMatchLive(matchId: number, handlers: MatchLiveHandlers = {}) {
  if (!matchId) {
    console.warn("[Live] Missing matchId");
    return null;
  }

  const source = new EventSource(`${API_BASE_URL}/api/live/match/${matchId}`);

  source.onopen = () => handlers.onOpen?.();

  source.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);

      if (payload?.type === "heartbeat" || payload?.type === "connected") return;
      if (payload?.type === "match_status") handlers.onStatus?.(payload.data);
      if (payload?.type === "model_result") handlers.onModelResult?.(payload.data);
    } catch {
      console.warn("[Live] Could not parse SSE message:", event.data);
    }
  };

  source.onerror = (error) => handlers.onError?.(error);
  return source;
}
