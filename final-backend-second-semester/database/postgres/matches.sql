CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    home_team VARCHAR(100) NOT NULL,
    away_team VARCHAR(100) NOT NULL,
    date TIMESTAMP NOT NULL,
    league VARCHAR(100),
    status match_status_enum DEFAULT 'pending',
    processing_status match_status_enum DEFAULT 'pending',
    video_url TEXT,
    video_filename TEXT,
    job_id VARCHAR(100) UNIQUE,
    error_message TEXT,
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);