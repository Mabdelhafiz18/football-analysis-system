import type { AnalysisWindowRow } from "@/types/analysis";
import type { LiveModelHistory, LiveModelLatest, LiveModelMessage } from "@/types/liveAnalysis";

export function windowsToLiveState(rows: AnalysisWindowRow[]) {
  const history: LiveModelHistory = {};
  const latest: LiveModelLatest = {};

  for (const row of rows) {
    const message: LiveModelMessage = {
      model_name: row.model_name,
      window_number: Number(row.window_number),
      status: row.status === "failed" ? "failed" : row.status === "completed" ? "completed" : "processing",
      result: row.result ?? undefined,
      error: row.error ?? undefined,
      timestamp: row.updated_at || row.created_at,
    };

    if (!history[row.model_name]) history[row.model_name] = [];
    history[row.model_name].push(message);
    const current = latest[row.model_name];
    if (!current || message.window_number >= current.window_number) latest[row.model_name] = message;
  }

  for (const values of Object.values(history)) {
    values.sort((a, b) => a.window_number - b.window_number);
  }

  return { history, latest };
}

export function mergeLiveMessage(
  message: LiveModelMessage,
  currentLatest: LiveModelLatest,
  currentHistory: LiveModelHistory,
) {
  const key = message.model_name;
  const nextLatest = { ...currentLatest, [key]: message };
  const existing = currentHistory[key] || [];
  const withoutSameWindow = existing.filter((item) => item.window_number !== message.window_number);
  const nextHistory = {
    ...currentHistory,
    [key]: [...withoutSameWindow, message].sort((a, b) => a.window_number - b.window_number),
  };
  return { latest: nextLatest, history: nextHistory };
}
