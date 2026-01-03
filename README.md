# Vision Pitch AI

A comprehensive football analysis platform using AI to provide tactical insights, referee decision support (Offside/Foul detection), and match statistics.

## Project Structure

- **/frontend**: React + TypeScript + Vite frontend application.
- **/backend**: Node.js + Express backend API with PostgreSQL and MongoDB support.
- **/ai_models**: Python-based AI models for tracking, foul detection, and offside analysis.
- **/data**: Mock and processed match data (JSON).
- **/uploads**: Directory for uploaded match videos.

## Getting Started

### Prerequisites

- Node.js (v18+)
- Python 3.10+
- PostgreSQL
- MongoDB

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   - Copy `env.example` to `.env`.
   - Update database credentials in `.env`.
4. Run migrations (PostgreSQL):
   ```bash
   npm run db:migrate
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend/vision-pitch-ai
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Team Collaboration

### Git Workflow

1. Always create a new branch for features or fixes: `git checkout -b feature/your-feature-name`.
2. Ensure your code follows the project's linting rules.
3. Push your branch and create a Pull Request for review.

### Database Sharing

- **PostgreSQL**: Used for structured data like users, matches, and summaries.
- **MongoDB**: Used for flexible analysis data like tactical formations and heatmaps.
- If databases are not set up, the backend will automatically fall back to serving data from the `data/` directory.

## License

[Add License Info Here]

