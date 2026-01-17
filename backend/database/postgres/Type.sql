DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_status_enum') THEN
        CREATE TYPE match_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_side_enum') THEN
        CREATE TYPE team_side_enum AS ENUM ('home', 'away');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'offside_decision_enum') THEN
        CREATE TYPE offside_decision_enum AS ENUM ('offside', 'onside');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'foul_severity_enum') THEN
        CREATE TYPE foul_severity_enum AS ENUM ('low', 'medium', 'high');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'card_type_enum') THEN
        CREATE TYPE card_type_enum AS ENUM ('none', 'yellow', 'red');
    END IF;
END $$;