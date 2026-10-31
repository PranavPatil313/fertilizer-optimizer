# Fertilizer Optimizer

[![Project checks](https://github.com/PranavPatil313/fertilizer-optimizer/actions/workflows/ci.yml/badge.svg)](https://github.com/PranavPatil313/fertilizer-optimizer/actions/workflows/ci.yml)

An AI-assisted agriculture application that combines crop and soil inputs with machine-learning predictions, weather context, and fertilizer-planning logic to generate crop-specific recommendation outputs.

> **Project status:** Portfolio / development project. Model outputs and agronomic rules are experimental and should be validated by qualified agronomists and local soil-test recommendations before real-world use.

## What it does

- **NPK and yield prediction** from crop, soil, and plot inputs using a scikit-learn-based ML pipeline.
- **Fertilizer planning** with nutrient recommendations and product-blend calculations.
- **Soil-health and carbon estimates** exposed through dedicated API endpoints. Carbon emission factors in the current code are illustrative placeholders, not verified lifecycle-assessment values.
- **Weather-aware context** using a three-day WeatherAPI forecast when a valid API key is configured.
- **AI-assisted explanations** through the optional Google Gemini integration, with rule-based output available when the integration is not configured.
- **Farm and plot workflows** with user authentication, plot/prediction persistence, and admin endpoints for dataset management and model-training jobs.
- **Report generation** for recommendation outputs, including PDF responses.
- **React web interface** for entering plot information and viewing results.

## Technology

| Layer | Technologies |
|---|---|
| API | Python, FastAPI, Pydantic |
| Machine learning | scikit-learn, XGBoost, CatBoost, pandas, NumPy |
| Persistence | SQLAlchemy (async), SQLite for local fallback, PostgreSQL via asyncpg |
| Integrations | WeatherAPI, Google Gemini (optional) |
| Frontend | React 18, Vite, React Router, Axios, Tailwind CSS, Material UI |
| Infrastructure | Docker, Docker Compose, Nginx, Alembic |

## Repository layout

```text
fertilizer-optimizer/
├── fert-frontend/       # React + Vite frontend
├── src/
│   ├── api/             # FastAPI routes, schemas and API utilities
│   ├── auth/            # API-key and JWT authentication helpers
│   ├── data/             # Crop profiles and project datasets
│   ├── db/               # SQLAlchemy models and database session
│   ├── services/         # Weather, Gemini, dataset and training services
│   ├── artifact/         # Local model artifacts and generated reports
│   ├── recommendation.py # Fertilizer recommendation and report logic
│   └── train.py          # Model-training entry point
├── tests/                # API and recommendation tests
├── alembic/              # Database migrations
├── Dockerfile.backend
└── docker-compose.yml
```

## Run locally

### Prerequisites

- Python 3.10+
- Node.js 20+
- npm
- A supported database. The backend falls back to a local SQLite database when `DATABASE_URL` is not set; PostgreSQL can be configured with an async SQLAlchemy URL.

### 1. Clone the project

```bash
git clone https://github.com/PranavPatil313/fertilizer-optimizer.git
cd fertilizer-optimizer
```

### 2. Configure the backend

```bash
python -m venv .venv
# Windows PowerShell:
.venv\\Scripts\\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env
```

Open `.env` and replace every example value with your own locally generated credentials. At minimum, configure strong, unique values for the API and JWT secrets. Weather and Gemini integrations require their respective provider API keys. Never commit `.env` or real credentials.

### 3. Start the API

```bash
uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8000
```

- API base: http://localhost:8000
- Interactive API documentation: http://localhost:8000/docs

### 4. Start the frontend

In a second terminal:

```bash
cd fert-frontend
npm install
npm run dev
```

Vite prints the local frontend URL (normally http://localhost:5173). Set `VITE_API_URL` in the frontend environment if the API is hosted elsewhere.

## API surface

The FastAPI application exposes endpoints for:

- `/predict` — NPK and yield prediction
- `/recommend` — end-to-end fertilizer recommendation
- `/soil-health` — soil-health index calculation
- `/carbon` — estimated carbon footprint calculation
- `/weather/preview` — weather snapshot and risk summary
- `/report` — recommendation report generation
- `/auth/*` — signup, login and password-reset flows
- `/admin/*` — protected administration and model-training workflows

See the live OpenAPI schema at `/docs` after starting the backend for request and response models.

## Configuration

The repository includes `.env.example` as a starting point. Keep actual secrets in an untracked `.env` file or your deployment platform's secret manager. Values beginning with `VITE_` are embedded in the browser bundle and are visible to every user. The current API uses `x-api-key` on selected routes; for local testing, set `VITE_API_KEY` to match the backend `API_KEY`. This is not a secure way to protect a production API because browser users can extract the key. Before a public deployment, move the privileged key to a server-side proxy or redesign the route authorization to rely on per-user authentication and server-side controls.

## Validation and limitations

The GitHub Actions workflow runs the backend test suite and a production frontend build on pushes and pull requests to `main`. Check the badge above for the latest result; a green frontend build does not imply that model quality or agronomic validity has been established.


- Run the available backend tests with `pytest tests/ -v` after installing the test dependencies.
- Build-check the frontend with `npm run build` from `fert-frontend/`.
- Prediction quality has not been independently benchmarked in this README. Do not describe the model as highly accurate without a held-out evaluation and reported metrics.
- Agronomic recommendations depend on dataset quality, regional conditions, soil testing, and crop-specific guidance. Treat outputs as decision support, not a substitute for professional agronomic advice.
- Carbon factors in `src/carbon.py` are explicitly marked as placeholders and must be replaced with authoritative, documented factors before sustainability claims are made.

## License

No `LICENSE` file is currently present. Add an explicit license before inviting reuse or contributions.
