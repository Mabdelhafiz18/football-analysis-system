-- Processing Jobs table for tracking AI service processing status
-- This table tracks the relationship between backend jobs and AI service jobs
CREATE TABLE IF NOT EXISTS processing_jobs (
    id SERIAL PRIMARY KEY,
    match_id INT UNIQUE REFERENCES matches (id) ON DELETE CASCADE,
    job_id VARCHAR(255) NOT NULL,  -- Backend job ID (e.g., job-1234567890-101)
    ai_job_id VARCHAR(255),         -- AI service job ID (returned from AI service)
    status match_status_enum DEFAULT 'pending',
    progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    message TEXT,
    video_filename TEXT,
    match_info JSONB,               -- Store match info as JSON for flexibility
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    processed_at TIMESTAMP,
    error TEXT,
    UNIQUE (job_id)
);

-- Index for faster lookups by job IDs
CREATE INDEX IF NOT EXISTS idx_processing_jobs_job_id ON processing_jobs (job_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_ai_job_id ON processing_jobs (ai_job_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs (status);
