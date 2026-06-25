export interface AnalysisWindowRow {
  id: number;
  match_id: number;
  model_name: string;
  window_number: number;
  status: "processing" | "completed" | "failed" | string;
  result: unknown | null;
  error: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AnalysisMatch {
  id: number;
  home_team: string;
  away_team: string;
  date: string;
  league?: string | null;
  status?: string | null;
  processing_status?: string | null;
  video_url?: string | null;
  video_filename?: string | null;
  processing_started_at?: string | null;
  processing_completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AnalysisJob {
  id?: number;
  match_id: number;
  job_id?: string;
  ai_job_id?: string;
  status?: string;
  progress?: number;
  message?: string;
  error?: string | null;
  created_at?: string;
  started_at?: string;
  processed_at?: string;
}

export interface MatchAnalysisResponse {
  match: AnalysisMatch;
  job: AnalysisJob | null;
  windows: AnalysisWindowRow[];
  model_counts: Record<string, { total: number; completed: number; failed: number; processing: number }>;
  media: { video_url: string };
}
