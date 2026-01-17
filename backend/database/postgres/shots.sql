CREATE TABLE IF NOT EXISTS shots (
    id SERIAL PRIMARY KEY,
    match_id INT REFERENCES matches (id) ON DELETE CASCADE,
    shot_id INT,
    minute INT,
    second DECIMAL(5, 2),
    timestamp DECIMAL(8, 2),
    team team_side_enum,
    player_number INT,
    x DECIMAL(8, 2),
    y DECIMAL(8, 2),
    xg DECIMAL(4, 3),
    outcome VARCHAR(50),
    is_on_target BOOLEAN DEFAULT false,
    is_goal BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (match_id, shot_id)
);