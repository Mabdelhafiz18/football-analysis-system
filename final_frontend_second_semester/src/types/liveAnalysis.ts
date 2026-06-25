export type LiveModelStatus = "processing" | "completed" | "failed";

export interface LiveModelMessage {
  model_name: string;
  window_number: number;
  status: LiveModelStatus;
  result?: unknown;
  error?: string;
  message?: string;
  timestamp?: string;
}

export type LiveModelLatest = Record<string, LiveModelMessage>;
export type LiveModelHistory = Record<string, LiveModelMessage[]>;
