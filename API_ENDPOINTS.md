# API Documentation - Vision Pitch AI

## 1. Authentication (`/auth`)
- `POST /auth/login`
  - Body: `{ "email", "password" }`
  - returns: JWT Token + User object
  - **Example:**
    ```bash
    curl -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" -d '{"email":"user@example.com", "password":"password123"}'
    ```
- `POST /auth/register`
  - Body: `{ "email", "password", "name", "role" }`
  - returns: JWT Token + User object
  - **Example:**
    ```bash
    curl -X POST http://localhost:8000/auth/register -H "Content-Type: application/json" -d '{"email":"new@example.com", "password":"password123", "name":"New User", "role":"manager"}'
    ```

## 2. Matches (`/matches`)
- `GET /matches` - List all matches
  - **Example:** `curl http://localhost:8000/matches`
- `GET /matches/:matchId/status` - Processing status polling
  - **Example:** `curl http://localhost:8000/matches/1/status`
- `GET /matches/:matchId/summary` - Match statistics
  - **Example:** `curl http://localhost:8000/matches/1/summary`
- `GET /matches/:matchId/events` - All incidents (offsides, fouls, shots)
  - Query: `?type=offside|foul|shot&team=home|away`
  - **Example:** `curl http://localhost:8000/matches/1/events?type=offside`
- `GET /matches/:matchId/tracking` - Position data for timestamp
  - Query: `?timestamp=seconds`
  - **Example:** `curl http://localhost:8000/matches/1/tracking?timestamp=10.5`
- `GET /matches/:matchId/tracking/range` - Position data for range
  - Query: `?start_time=seconds&end_time=seconds`
  - **Example:** `curl "http://localhost:8000/matches/1/tracking/range?start_time=0&end_time=10"`

## 3. Decisions (`/decisions`)
- `GET /decisions/offside?match_id=id` - Offside events
  - **Example:** `curl http://localhost:8000/decisions/offside?match_id=1`
- `GET /decisions/fouls?match_id=id` - Foul events
  - **Example:** `curl http://localhost:8000/decisions/fouls?match_id=1`
- `GET /decisions/goal-prediction?match_id=id` - Shot/Goal predictions
  - **Example:** `curl http://localhost:8000/decisions/goal-prediction?match_id=1`

## 4. Tactical Analysis (`/tactical`)
- `GET /tactical/match/:matchId` - Formation, heatmaps, pass network
  - **Example:** `curl http://localhost:8000/tactical/match/1`
- `GET /tactical/pass-network?match_id=id` - Passing data
  - **Example:** `curl http://localhost:8000/tactical/pass-network?match_id=1`

## 5. Analytics (`/analytics`)
- `GET /analytics` - System-wide stats (total goals, avg xG, match distribution)
  - **Example:** `curl http://localhost:8000/analytics`

## 6. Video Upload (`/upload`)
- `POST /upload/upload-video`
  - Body: `FormData` (video file, homeTeam, awayTeam, date, league)
  - returns: `match_id`, `status`
  - **Example (PowerShell):**
    ```powershell
    $filePath = "C:\path\to\video.mp4"
    Invoke-RestMethod -Uri http://localhost:8000/upload/upload-video -Method Post -InFile $filePath -ContentType "multipart/form-data"
    ```

## 7. System
- `GET /health` - Server health check
  - **Example:** `curl http://localhost:8000/health`

