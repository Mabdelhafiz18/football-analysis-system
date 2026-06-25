CREATE INDEX IF NOT EXISTS idx_matches_processing_status ON matches (processing_status);

CREATE INDEX IF NOT EXISTS idx_matches_job_id ON matches (job_id);

CREATE INDEX IF NOT EXISTS idx_offsides_match_id ON offsides (match_id);

CREATE INDEX IF NOT EXISTS idx_offsides_timestamp ON offsides (timestamp);

CREATE INDEX IF NOT EXISTS idx_fouls_match_id ON fouls (match_id);

CREATE INDEX IF NOT EXISTS idx_fouls_timestamp ON fouls (timestamp);

CREATE INDEX IF NOT EXISTS idx_shots_match_id ON shots (match_id);

CREATE INDEX IF NOT EXISTS idx_shots_timestamp ON shots (timestamp);