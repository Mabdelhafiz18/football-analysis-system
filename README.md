<div align="center">

# ⚽ KoraVision

**Professional-Grade AI Football Analysis Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Python Version](https://img.shields.io/badge/python-%3E%3D3.10-blue)](https://www.python.org/)

Bring the power of Premier League technology to local clubs, academies, and private pitches. No expensive hardware—just pure AI intelligence.

[Features](#-features) • [Getting Started](#-getting-started) • [Architecture](#-architecture) • [AI Services](#-ai-services-deployment) • [API Docs](./API_CONTRACT.md)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [AI Services Deployment](#-ai-services-deployment)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Configuration](#-configuration)
- [Development](#-development)
- [Deployment](#-deployment)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

**KoraVision** is a comprehensive football analysis platform that leverages AI to democratize professional-grade match analysis. Our platform provides tactical insights, referee decision support (VAR), player tracking, and advanced statistics—making them accessible to clubs of all sizes.

### Why KoraVision?

- **🎯 VAR Technology**: Automated offside and foul detection with frame-level precision
- **📊 Tactical Analysis**: Heatmaps, pass networks, and formation analysis
- **🏃 Player Tracking**: Real-time position tracking for all players on the pitch
- **📈 Advanced Metrics**: xG (Expected Goals), shot analysis, and performance statistics
- **☁️ Cloud-Powered**: No expensive hardware required—just upload and analyze
- **🔒 Enterprise-Ready**: Role-based access control, secure storage, and audit logs

---

## ✨ Features

### Core Analysis Modules

| Module | Description | Status |
|--------|-------------|--------|
| **VAR System** | Offside detection with attacker/defender positions | ✅ Active |
| **Foul Detection** | Contact point analysis and severity classification | ✅ Active |
| **Shot Analysis** | xG calculation, shot target prediction, outcome analysis | ✅ Active |
| **Player Tracking** | Real-time position tracking for all 22 players + ball | ✅ Active |
| **Tactical Analysis** | Formation detection, heatmaps, pass networks | ✅ Active |
| **Match Summary** | Automated game report with key statistics | ✅ Active |

### Platform Features

- 📹 **Video Upload**: Support for multiple formats (MP4, AVI, MOV) with cloud storage
- 🔄 **Real-Time Processing**: Live status updates and progress tracking
- 📊 **Interactive Dashboard**: Rich visualizations and data exploration
- 📄 **PDF Reports**: Professional match reports with branding
- 🔐 **Authentication**: JWT-based auth with role management (Admin, Coach, Analyst)
- 🌐 **RESTful API**: Comprehensive API for third-party integrations

---

## 🏗 Architecture


```
### System Architecture

```text
┌─────────────┐        ┌─────────────┐
│  Frontend   │        │   Backend   │
│  (React)    │───────▶│  (Node.js)  │
└─────────────┘        └──────┬──────┘
                              │
                              ▼
                 ┌─────────────────────────┐
                 │ AI Services (Modal GPU) │
                 │                         │
                 │ ┌─────────┐ ┌─────────┐ │
                 │ │ Vision  │ │Tactical │ │
                 │ │  GPU    │ │  GPU    │ │
                 │ └─────────┘ └─────────┘ │
                 │                         │
                 │ ┌─────────┐ ┌─────────┐ │
                 │ │   xG    │ │Offside │ │
                 │ │  GPU    │ │  GPU    │ │
                 │ └─────────┘ └─────────┘ │
                 │                         │
                 │ ┌─────────┐             │
                 │ │  Foul   │             │
                 │ │  GPU    │             │
                 │ └─────────┘             │
                 └──────────┬──────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐  ┌────────┐  ┌────────────┐
        │PostgreSQL│  │MongoDB │  │Azure Blob  │
        │ Matches  │  │ Tracks │  │  Storage   │
        └──────────┘  └────────┘  └────────────┘
```


### Full Live Pipeline (Recommended Flow)

1. **Frontend** uploads a full match video to the **Backend**.
2. **Backend** sends the video to the **Vision GPU** service (`POST /api/process-live-video`) and receives an NDJSON stream of frame‑by‑frame detections (players, ball, pitch coordinates, etc.).
3. **Backend** reads the Vision NDJSON stream, groups it into small windows/frames, and distributes them to:
   - **Tactical GPU** → tactical analysis (possession, pressure, ball progression, alerts)
   - **xG GPU** → shot events and expected goals
   - **Offside GPU** → offside decisions (per frame or window)
4. **Backend** also cuts the original video into short clips/windows and sends them (with optional NDJSON context) to the **Foul GPU** for foul/no‑foul detection.
5. All analysis results are saved to **PostgreSQL** (structured data) and **MongoDB** (tracking/tactical data).
6. **Backend** pushes live updates to the **Frontend** via WebSocket or polling.

---

## 🤖 AI Services Deployment

All AI models are deployed as **Modal** services, each with dedicated GPU instances and REST endpoints. The backend orchestrates calls to these services; the frontend never accesses them directly.

### 1. Vision GPU Service

**Base URL:**  
`https://yaraamahmoudd12--koravision-vision-gpu-live-web.modal.run`

**Docs / Swagger:**  
`https://yaraamahmoudd12--koravision-vision-gpu-live-web.modal.run/docs`

**Main Endpoint:**  
`POST /api/process-live-video`

**Use:** Takes the original football video and returns an NDJSON stream of frame‑by‑frame detections.

**Output:** NDJSON stream containing detections, players, ball, pitch coordinates, `frame_id`, `timestamp`.

---

### 2. Tactical GPU Service

**Base URL:**  
`https://yaraamahmoudd12--koravision-tactical-gpu-live-web.modal.run`

**Docs / Swagger:**  
`https://yaraamahmoudd12--koravision-tactical-gpu-live-web.modal.run/docs`

**Health:**  
`https://yaraamahmoudd12--koravision-tactical-gpu-live-web.modal.run/health`

**Main Endpoint:**  
`POST /api/analyze-live-ndjson?job_id=match_id`

**Use:** Takes Vision NDJSON and returns tactical analysis: teams, possession, pressure, ball progression, transitions, alerts, reliability, and the latest tactical frame output.

**Streaming Endpoint:**  
`POST /api/stream-live-ndjson?job_id=match_id` – returns tactical outputs as an NDJSON stream for live updates.

**Video Overlay Endpoint (Demo/Export):**  
`POST /api/analyze-video-with-json-output/` – takes original video + Vision NDJSON and returns a ZIP containing a tactical overlay video and the latest tactical JSON.

**Important:** For full NDJSON files, use `curl -L` as processing may exceed 150 seconds. For live backends, send small NDJSON windows, not the full match at once.

---

### 3. xG GPU Service

**Base URL:**  
`https://yaraamahmoudd12--koravision-xg-gpu-live-web.modal.run`

**Docs / Swagger:**  
`https://yaraamahmoudd12--koravision-xg-gpu-live-web.modal.run/docs`

**Health:**  
`https://yaraamahmoudd12--koravision-xg-gpu-live-web.modal.run/health`

**Main Endpoint:**  
`POST /api/analyze-live-ndjson?job_id=match_id`

**Use:** Takes Vision NDJSON and returns xG shot analysis: `shot_count`, `total_xg`, shot events, xG per shot, shot location, shooter/team, and explanation.

---

### 4. Foul GPU Service

**Base URL:**  
`https://yaraamahmoudd12--koravision-foul-gpu-live-web.modal.run`

**Docs / Swagger:**  
`https://yaraamahmoudd12--koravision-foul-gpu-live-web.modal.run/docs`

**Health:**  
`https://yaraamahmoudd12--koravision-foul-gpu-live-web.modal.run/health`

**Main Live Clip Endpoint:**  
`POST /api/analyze-live-clip` – takes a short video clip and detects foul/no‑foul.

**Alternative Video Window Endpoint:**  
`POST /api/analyze-live-video-window` – takes a video window plus optional NDJSON context.

**Input:** Short video clip/window (plus matching NDJSON context optional).  
**Output:** `foul_candidate` / `no_foul`, confidence, timestamp, events, debug info.

**Important:** Backend should cut the original video into small clips around important moments or rolling windows. Do not send the full match video to the foul service.

---

### 5. Offside GPU Service

**Base URL:**  
`https://yaraamahmoudd12--web.modal.run`

**Docs / Swagger:**  
`https://yaraamahmoudd12--web.modal.run/docs`

**Health:**  
`https://yaraamahmoudd12--web.modal.run/health`

**Modal Deployment Page:**  
`https://modal.com/apps/yaraamahmoudd12/main/deployed/koravision-offside-gpu-live`

**Main Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze-live-ndjson` | POST | Takes Vision NDJSON packets from Backend, detects offside |
| `/api/analyze-window` | POST | JSON window with player positions, ball, team info |
| `/api/analyze-frame` | POST | Single frame analysis |
| `/api/analyze-live-video-window` | POST | Video window + JSON context (for visual output) |
| `/api/visualize-window` | POST | Returns visualisation of offside decision |
| `/outputs/{filename}` | GET | Retrieve generated output files (e.g., visualisation images) |

**Input fields can include:**  
`match_id`, `window_id`, `frame_id`, `timestamp_sec`, players positions, ball position, `team_id`, `attacking_team_id`, `defending_team_id`, `attacking_direction`, `pitch_xy_m`, Vision NDJSON context, optional video window.

**Output:** `offside` / `no_offside`, confidence, `timestamp_sec`, `attacker_id`, `last_defender_id`, `ball_holder` / `pass_sender`, `offside_line`, event details, optional `visual_output_url`.

**Important:** For live backends, send small Vision NDJSON windows, not the full match. For demo/report, you may send a video window + context to request a visual output.

---

### Recommended Full Backend Flow (Detailed)

```txt
1. Frontend uploads full video to Backend.
2. Backend sends full video to Vision GPU:
   POST Vision /api/process-live-video
3. Vision returns NDJSON stream line by line.
4. Backend reads Vision NDJSON live.
5. Backend groups Vision packets into frames/windows.
6. Backend sends Vision NDJSON windows to Tactical GPU:
   POST Tactical /api/analyze-live-ndjson?job_id=match_id
7. Backend sends Vision NDJSON windows to xG GPU:
   POST xG /api/analyze-live-ndjson?job_id=match_id
8. Backend sends Vision NDJSON windows or single frames to Offside GPU:
   POST Offside /api/analyze-live-ndjson
   or
   POST Offside /api/analyze-window
   or
   POST Offside /api/analyze-frame
9. Backend also cuts the original video into short clips/windows.
10. Backend sends each clip/window to Foul GPU:
    POST Foul /api/analyze-live-clip
    or
    POST Foul /api/analyze-live-video-window
11. Backend may also send matching Vision NDJSON context with the clip.
12. Foul returns: foul_candidate / no_foul, confidence, timestamp, events
13. Offside returns: offside / no_offside, confidence, timestamp_sec, attacker_id, last_defender_id, offside_line, event details
14. Backend saves all results in PostgreSQL.
15. Backend sends live updates to Frontend.

### Data Flow

1. **Upload**: User uploads video via frontend → Backend stores in Azure Blob Storage
2. **Processing**: Backend sends video URL to AI Service → AI processes video
3. **Polling**: Backend polls AI Service for status updates
4. **Storage**: When complete, results are stored in PostgreSQL/MongoDB
5. **Retrieval**: Frontend fetches analysis results via REST API

## 🛠 Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Library**: Radix UI + TailwindCSS
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Animations**: Framer Motion
- **Charts**: Recharts

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: ES6 Modules
- **Authentication**: JWT (jsonwebtoken)
- **File Upload**: Multer
- **Cloud Storage**: Azure Blob Storage (with SAS tokens)
- **Database Clients**: 
  - PostgreSQL: `pg` library
  - MongoDB: Mongoose ODM

### Databases
- **PostgreSQL**: Structured data (users, matches, offsides, fouls, shots, summaries)
- **MongoDB**: Flexible data (player tracking, tactical formations, heatmaps)

### AI Service
- **Language**: Python 3.10+
- **Framework**: Flask/FastAPI
- **ML Libraries**: TensorFlow, PyTorch, OpenCV
- **Models**: YOLO, Custom CNN architectures



## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:

- **Node.js** v18.0.0 or higher ([Download](https://nodejs.org/))
- **Python** 3.10 or higher ([Download](https://www.python.org/))
- **PostgreSQL** 14+ ([Download](https://www.postgresql.org/))
- **MongoDB** 6+ ([Download](https://www.mongodb.com/))
- **Azure Storage Account** (for video storage) ([Create](https://portal.azure.com/))

### Quick Start (Development)

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd "graduation project"
```

#### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp env.example .env
# Edit .env with your credentials (see Configuration section)

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

The backend API will be available at `http://localhost:5000`

#### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

#### 4. AI Service Setup (Optional for Development)

```bash
cd ai_models

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start AI service
python app.py
```

The AI service will be available at `http://localhost:5000`

**Note**: The backend will automatically fall back to simulation mode if the AI service is unavailable.

## 📁 Project Structure

```
graduation-project/
├── frontend/                    # React frontend application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── landing/       # Landing page sections
│   │   │   ├── layout/        # Layout components (Sidebar, Header)
│   │   │   └── ui/            # Base UI components (shadcn/ui)
│   │   ├── contexts/          # React contexts (Auth, Upload)
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utilities and helpers
│   │   ├── pages/             # Page components
│   │   └── utils/             # Utility functions
│   ├── public/                # Static assets
│   └── package.json
│
├── backend/                     # Node.js backend API
│   ├── controllers/            # Request handlers
│   ├── database/              # Database connections & schemas
│   │   ├── mongodb/           # MongoDB models
│   │   │   └── models/       # Mongoose schemas
│   │   └── postgres/          # PostgreSQL schemas
│   │       └── migrations/   # SQL migration scripts
│   ├── middleware/            # Express middleware
│   ├── routes/                # API route definitions
│   ├── services/              # Business logic services
│   │   ├── aiClientService.js      # AI service HTTP client
│   │   ├── aiPollingService.js     # AI polling orchestrator
│   │   ├── azureStorageService.js  # Azure Blob Storage
│   │   ├── databaseService.js      # Database abstraction
│   │   ├── jobService.js           # Job tracking
│   │   └── resultStorageService.js # Result persistence
│   ├── config/                # Configuration
│   └── server.js              # Application entry point
│
├── ai_models/                  # Python AI service
│   ├── models/                # Trained model files
│   ├── utils/                 # Helper functions
│   └── app.py                 # AI service entry point
│
├── data/                       # Mock/test data (JSON)
├── uploads/                    # Local video uploads (dev)
├── API_CONTRACT.md            # API documentation
└── README.md                  # This file
```

## ⚙️ Configuration

### Backend Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

```bash
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=koravision
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password

MONGODB_URI=mongodb://localhost:27017/koravision

# Azure Storage Configuration
AZURE_STORAGE_CONNECTION_STRING=your_connection_string
AZURE_CONTAINER_NAME=videos

# AI Service Configuration
AI_SERVICE_URL=http://localhost:5000
AI_POLLING_INTERVAL=5000          # 5 seconds
AI_PROCESSING_TIMEOUT=1800000     # 30 minutes
AI_MAX_RETRIES=3

# JWT Configuration
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

# File Upload Configuration
MAX_FILE_SIZE=524288000          # 500MB in bytes
UPLOAD_DIR=./uploads
```

### Azure Blob Storage Setup

1. Create an Azure Storage Account
2. Create a container named `videos` (or your preferred name)
3. Set container to **Private** (no public access)
4. Copy the connection string from Azure Portal
5. Add to `.env` file

The backend will automatically generate SAS (Shared Access Signature) tokens for secure, time-limited access.

### Database Setup

#### PostgreSQL

```bash
# Create database
createdb koravision

# Run migrations
cd backend
npm run db:migrate
```

#### MongoDB

MongoDB will automatically create the database on first connection. No manual setup required.

## 💻 Development

### Running the Development Environment

Start all services in separate terminals:

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: AI Service (optional)
cd ai_models && python app.py
```

### Database Migrations

Add new migration files in `backend/database/postgres/` and run:

```bash
npm run db:migrate
```

### Code Quality

```bash
# Frontend linting
cd frontend
npm run lint

# Backend linting (if configured)
cd backend
npm run lint
```

## 🚢 Deployment

### Backend Deployment

1. Set production environment variables
2. Run migrations on production database
3. Build and deploy:

```bash
npm install --production
NODE_ENV=production node server.js
```

### Frontend Deployment

```bash
npm run build
# Deploy the 'dist' folder to your hosting service
```

### Recommended Hosting

- **Frontend**: Vercel, Netlify, Azure Static Web Apps
- **Backend**: Azure App Service, AWS EC2, DigitalOcean
- **AI Service**: Azure Container Instances, AWS Lambda (with containers)
- **Databases**: 
  - PostgreSQL: Azure Database for PostgreSQL, AWS RDS
  - MongoDB: MongoDB Atlas

## 📚 API Documentation


### Key Endpoints

- `POST /api/upload/upload-video` - Upload and process video
- `GET /api/upload/status` - Get system status
- `GET /api/match/:matchId` - Get match details
- `GET /api/match/:matchId/events` - Get match events (offsides, fouls, shots)
- `GET /api/match/:matchId/tracking` - Get player tracking data
- `GET /api/match/:matchId/tactical` - Get tactical analysis
- `GET /api/matches` - List all matches
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration

## 🤝 Contributing

### Git Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

3. Push and create a Pull Request:
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

### Code Style

- **Frontend**: ESLint + Prettier (React/TypeScript)
- **Backend**: ESLint (Node.js ES6+)
- **Python**: PEP 8 (Black formatter)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by the KoraVision Team**

[Report Bug](https://github.com/your-repo/issues) • [Request Feature](https://github.com/your-repo/issues)

</div>

