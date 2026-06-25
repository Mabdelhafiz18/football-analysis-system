CREATE TABLE IF NOT EXISTS model_window_results (
  id SERIAL PRIMARY KEY,

  match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  job_id VARCHAR(255),

  model_name VARCHAR(80),
  model_type VARCHAR(80),

  window_index INTEGER,
  window_number INTEGER,
  window_id INTEGER,

  status VARCHAR(50) DEFAULT 'completed',

  result JSONB,
  result_json JSONB,
  payload JSONB,

  error TEXT,
  error_message TEXT,

  window_start_sec DOUBLE PRECISION,
  window_end_sec DOUBLE PRECISION,
  timestamp_sec DOUBLE PRECISION,

  processing_time_ms INTEGER,
  latency_ms INTEGER,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_model_window_results_match_id
ON model_window_results(match_id);

CREATE INDEX IF NOT EXISTS idx_model_window_results_model_name
ON model_window_results(model_name);

CREATE INDEX IF NOT EXISTS idx_model_window_results_window_index
ON model_window_results(window_index);
