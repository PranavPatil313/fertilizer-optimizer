# Fertilizer Optimizer - Project File Structure

## Overview
This is a full-stack fertilizer recommendation system with machine learning capabilities. The project consists of a FastAPI backend and a React frontend, with PostgreSQL database support.

---

## Root Directory Files

### Configuration Files
- **`.env`** - Environment variables (database URLs, API keys, secrets) - **DO NOT COMMIT**
- **`.env.example`** - Template showing required environment variables
- **`requirements1.txt`** - Python dependencies for the backend
- **`README.md`** - Project documentation
- **`alembic.ini`** - Alembic configuration for database migrations
- **`docker-compose.yml`** - Docker orchestration for API and PostgreSQL services
- **`Dockerfile`** - Container image definition for the backend API
- **`fertilizer.db`** - SQLite database file (legacy/backup, main DB is PostgreSQL)

### Utility Scripts
- **`temp_reset_password.py`** - Temporary utility script for password reset functionality

---

## Backend Structure (`src/`)

### Main Application Files

#### `src/main.py`
- **Purpose**: Legacy/alternative FastAPI entry point
- **Function**: Basic FastAPI app with rate limiting setup
- **Note**: Main application is in `src/api/main.py`

#### `src/api/main.py`
- **Purpose**: Primary FastAPI application entry point
- **Key Features**:
  - FastAPI app initialization with CORS middleware
  - Rate limiting configuration (development vs production)
  - Database table auto-creation on startup
  - API route definitions:
    - `/predict` - NPK and yield predictions
    - `/soil-health` - Soil health index calculation
    - `/carbon` - Carbon footprint estimation
    - `/recommend` - Full recommendation pipeline
    - `/report` - PDF report generation
  - Exception handlers for validation errors and rate limiting
  - Request logging middleware

#### `src/api/schemas.py`
- **Purpose**: Pydantic models for request/response validation
- **Models**:
  - `PlotInput` - Input schema for plot data (crop, soil, weather, etc.)
  - `PredictResponse` - NPK and yield predictions
  - `SoilHealthResponse` - Soil health metrics
  - `CarbonResponse` - Carbon footprint data

#### `src/api/schemas_auth.py`
- **Purpose**: Authentication-related Pydantic schemas
- **Contains**: User registration, login, token schemas

### API Route Modules

#### `src/api/auth.py`
- **Purpose**: Authentication endpoints
- **Endpoints**: Login, signup, token refresh, password reset

#### `src/api/plots.py`
- **Purpose**: Plot management endpoints
- **Endpoints**: CRUD operations for user plots

#### `src/api/admin.py`
- **Purpose**: Admin-only endpoints
- **Endpoints**: User management, dataset management, training job management

#### `src/api/crud.py`
- **Purpose**: Database CRUD operations
- **Functions**: Async database operations for plots, predictions, users

#### `src/api/deps.py`
- **Purpose**: FastAPI dependencies
- **Functions**: 
  - `get_current_user_token` - JWT token validation
  - Other dependency injection functions

#### `src/api/utils.py`
- **Purpose**: API utility functions
- **Functions**:
  - `predict_npk_and_yield()` - ML model prediction wrapper
  - `soil_health_index_calc()` - Soil health calculation
  - `compute_carbon_from_plan()` - Carbon footprint calculation

### Core Business Logic

#### `src/recommendation.py`
- **Purpose**: Fertilizer recommendation engine
- **Key Functions**:
  - `make_recommendation()` - Creates fertilizer application plan based on predictions
  - `suggest_organic_substitute()` - Suggests organic alternatives
  - `generate_pdf_report()` - Generates PDF reports using ReportLab
  - `load_crop_profile()` - Loads crop-specific profiles from JSON
- **Features**:
  - Crop-specific application schedules
  - Basal and topdress splitting
  - Safety limits per application
  - Organic matter-based recommendations

#### `src/carbon.py`
- **Purpose**: Carbon footprint calculations
- **Function**: `compute_co2eq_from_npk()` - Calculates CO2 equivalent from NPK usage

#### `src/model_utils.py`
- **Purpose**: ML model loading and prediction utilities
- **Functions**: Model loading, preprocessing, prediction pipeline

#### `src/train_model.py`
- **Purpose**: Model training script
- **Features**:
  - Synthetic dataset generation
  - Model training with XGBoost, CatBoost, Random Forest
  - Model evaluation and validation
  - Model serialization (saves to `src/artifact/`)

#### `src/train.py`
- **Purpose**: Alternative/additional training script

### Authentication Module (`src/auth/`)

#### `src/auth/jwt.py`
- **Purpose**: JWT token generation and validation
- **Functions**: Create tokens, verify tokens, decode tokens

#### `src/auth/api_key_auth.py`
- **Purpose**: API key authentication
- **Function**: Validates API keys for protected endpoints

#### `src/auth/utils.py`
- **Purpose**: Authentication utilities
- **Functions**: Password hashing, verification

#### `src/auth.py`
- **Purpose**: Legacy authentication module (may be duplicate)

### Database Module (`src/db/`)

#### `src/db/models.py`
- **Purpose**: SQLAlchemy ORM models
- **Models**:
  - `User` - User accounts
  - `Plot` - User plots/farms
  - `Prediction` - ML predictions linked to plots
  - `Dataset` - Training datasets
  - `TrainingJob` - ML model training jobs

#### `src/db/session.py`
- **Purpose**: Database session management
- **Functions**: Async database engine, session factory

### Services Module (`src/services/`)

#### `src/services/datasets.py`
- **Purpose**: Dataset management service
- **Functions**: Dataset upload, processing, validation

#### `src/services/training.py`
- **Purpose**: ML training service
- **Functions**: Training job orchestration, model training pipeline

### Data Directory (`src/data/`)

#### `src/data/crop_profiles.json`
- **Purpose**: Crop-specific configuration profiles
- **Content**: Application schedules, nutrient requirements per crop type

#### `src/data/processed/`
- **Purpose**: Processed training datasets
- **Files**: Cleaned CSV files for model training

#### `src/data/uploads/`
- **Purpose**: User-uploaded datasets
- **Files**: Original uploaded training data files

### Artifacts Directory (`src/artifact/`)

#### `src/artifact/model.pkl`
- **Purpose**: Trained ML model (serialized)
- **Format**: Pickle file containing XGBoost/CatBoost model

#### `src/artifact/preprocessor.pkl`
- **Purpose**: Data preprocessing pipeline
- **Format**: Pickle file containing transformers (scalers, encoders)

#### `src/artifact/metadata.json`
- **Purpose**: Model metadata (version, training date, performance metrics)

#### `src/artifact/job_*/`
- **Purpose**: Versioned model artifacts
- **Structure**: Each job has `model.pkl`, `preprocessor.pkl`, `metadata.json`

#### `src/artifact/recommendation_report_*.pdf`
- **Purpose**: Generated PDF reports
- **Format**: ReportLab-generated PDFs with recommendations

### Logging

#### `src/logging_config.py`
- **Purpose**: Logging configuration
- **Function**: Sets up structured logging for the application

---

## Frontend Structure (`fert-frontend/`)

### Configuration Files

#### `fert-frontend/package.json`
- **Purpose**: Node.js dependencies and scripts
- **Scripts**: `dev`, `build`, `preview`
- **Dependencies**: React, Vite, Material-UI, Axios, React Router, Recharts

#### `fert-frontend/vite.config.js`
- **Purpose**: Vite build tool configuration
- **Settings**: React plugin, build options

#### `fert-frontend/tailwind.config.js` / `tailwind.config.cjs`
- **Purpose**: Tailwind CSS configuration
- **Settings**: Custom theme, plugins

#### `fert-frontend/postcss.config.cjs`
- **Purpose**: PostCSS configuration for Tailwind

#### `fert-frontend/index.html`
- **Purpose**: HTML entry point
- **Content**: Root div, script tags

#### `fert-frontend/.env` / `.env.example`
- **Purpose**: Frontend environment variables
- **Variables**: API base URL, authentication settings

#### `fert-frontend/Dockerfile`
- **Purpose**: Frontend container image definition

### Source Code (`fert-frontend/src/`)

#### `fert-frontend/src/main.jsx`
- **Purpose**: React application entry point
- **Function**: Renders App component, sets up React Router

#### `fert-frontend/src/App.jsx`
- **Purpose**: Main application component
- **Function**: 
  - Route definitions
  - Protected route wrappers
  - Navigation structure

#### `fert-frontend/src/index.css`
- **Purpose**: Global CSS styles
- **Content**: Tailwind directives, custom styles

### Pages (`fert-frontend/src/pages/`)

#### `Home.jsx`
- **Purpose**: Landing page
- **Content**: Introduction, features, call-to-action

#### `Login.jsx`
- **Purpose**: User login page
- **Features**: Email/password authentication

#### `Signup.jsx`
- **Purpose**: User registration page
- **Features**: Account creation form

#### `AdminLogin.jsx`
- **Purpose**: Admin authentication page
- **Features**: Admin-specific login

#### `Dashboard.jsx`
- **Purpose**: User dashboard
- **Features**: Plot overview, recent predictions, quick actions

#### `CreatePlot.jsx`
- **Purpose**: Create new plot/farm
- **Features**: Form for plot data input

#### `Recommend.jsx`
- **Purpose**: Fertilizer recommendation interface
- **Features**: 
  - Input form for soil/crop data
  - Real-time recommendations
  - Results display

#### `RecommendPreview.jsx`
- **Purpose**: Preview recommendation results
- **Features**: Results visualization before final submission

#### `Results.jsx`
- **Purpose**: Display recommendation results
- **Features**: 
  - Charts and visualizations
  - PDF download
  - Save to dashboard

#### `AdminPanel.jsx`
- **Purpose**: Admin control panel
- **Features**: 
  - User management
  - Dataset upload/management
  - Training job management
  - Model versioning

### Components (`fert-frontend/src/components/`)

#### `Navbar.jsx`
- **Purpose**: Navigation bar
- **Features**: Links, user menu, logout

#### `InputForm.jsx`
- **Purpose**: Reusable form component
- **Features**: Form validation, error handling

#### `InputFields.jsx`
- **Purpose**: Input field components
- **Features**: Standardized form inputs

#### `ProtectedRoute.jsx`
- **Purpose**: Route protection wrapper
- **Function**: Redirects unauthenticated users to login

#### `AdminRoute.jsx`
- **Purpose**: Admin-only route protection
- **Function**: Checks admin role before allowing access

#### `PdfPreview.jsx`
- **Purpose**: PDF preview component
- **Features**: Display PDF reports in browser

### Authentication (`fert-frontend/src/auth/`)

#### `AuthProvider.jsx`
- **Purpose**: Authentication context provider
- **Function**: Manages global auth state

#### `useAuth.js`
- **Purpose**: Authentication hook
- **Function**: Provides auth state and methods to components

### API Client (`fert-frontend/src/api/`)

#### `api.js`
- **Purpose**: Axios API client configuration
- **Features**: 
  - Base URL setup
  - Request interceptors (adds auth tokens)
  - Response interceptors (handles errors)

### Hooks (`fert-frontend/src/hooks/`)

#### `useDebounce.js`
- **Purpose**: Debounce hook for search/input
- **Function**: Delays function execution

#### `useLocalStorageListener.js`
- **Purpose**: LocalStorage change listener
- **Function**: Syncs state across tabs

### Utils (`fert-frontend/src/utils/`)

#### `unitConversion.js`
- **Purpose**: Unit conversion utilities
- **Functions**: Convert between metric/imperial units

#### `workspaceEvents.js`
- **Purpose**: Workspace event handling
- **Function**: Cross-tab communication

### Widgets (`fert-frontend/src/widgets/`)

#### `NpkChart.jsx`
- **Purpose**: NPK visualization chart
- **Library**: Recharts

#### `YieldChart.jsx`
- **Purpose**: Yield prediction chart
- **Library**: Recharts

#### `CarbonChart.jsx`
- **Purpose**: Carbon footprint visualization
- **Library**: Recharts

### Build Output (`fert-frontend/dist/`)
- **Purpose**: Production build output
- **Content**: Compiled JavaScript, CSS, HTML
- **Note**: Generated by `npm run build`

---

## Database Migrations (`alembic/`)

#### `alembic/env.py`
- **Purpose**: Alembic environment configuration
- **Function**: Database connection, migration context

#### `alembic/script.py.mako`
- **Purpose**: Migration script template
- **Function**: Template for generating migration files

#### `alembic/versions/`
- **Purpose**: Database migration versions
- **Files**:
  - `859b7ace032c_create_users_plots_predictions.py` - Initial schema
  - `fa8b115d5119_create_users_plots_predictions.py` - Alternative/updated schema

#### `alembic/README`
- **Purpose**: Alembic documentation

---

## Tests (`tests/`)

#### `tests/conftest.py`
- **Purpose**: Pytest configuration and fixtures
- **Content**: Test database setup, mock data, fixtures

#### `tests/test_recommendation.py`
- **Purpose**: Recommendation engine tests
- **Tests**: Recommendation logic, organic substitutes

#### `tests/test_api_plots.py`
- **Purpose**: Plot API endpoint tests
- **Tests**: CRUD operations, validation

#### `tests/test_product.py`
- **Purpose**: Product/fertilizer tests
- **Tests**: Product calculations, recommendations

#### `tests/test_pdf.py`
- **Purpose**: PDF generation tests
- **Tests**: Report generation, content validation

---

## Data Files (`data/`)

#### `data/sample_input.csv`
- **Purpose**: Sample input data for testing
- **Content**: Example plot data

#### `data/synthetic_sample.csv`
- **Purpose**: Synthetic training data sample
- **Content**: Generated dataset for model training

---

## Development Files

### `.vscode/`
- **Purpose**: VS Code workspace settings
- **Files**: `settings.json` - Editor configuration

### `venv/`
- **Purpose**: Python virtual environment
- **Content**: Installed Python packages
- **Note**: Should not be committed to version control

### `node_modules/` (in fert-frontend)
- **Purpose**: Node.js dependencies
- **Note**: Should not be committed to version control

### `__pycache__/`
- **Purpose**: Python bytecode cache
- **Note**: Should not be committed to version control

### `.pytest_cache/`
- **Purpose**: Pytest cache
- **Note**: Should not be committed to version control

### `catboost_info/`
- **Purpose**: CatBoost training artifacts
- **Note**: Generated during model training

---

## Key Workflows

### 1. **Recommendation Flow**
```
User Input → API (/recommend) → ML Prediction → Recommendation Engine → PDF Report → Database Storage
```

### 2. **Model Training Flow**
```
Dataset Upload → Processing → Training Service → Model Training → Artifact Storage → Model Deployment
```

### 3. **Authentication Flow**
```
Login → JWT Token → Protected Routes → User Context → API Calls
```

### 4. **Frontend-Backend Communication**
```
React App → Axios Client → FastAPI Endpoints → Business Logic → Database → Response → React State Update
```

---

## Environment Variables

### Backend (`.env`)
- `DATABASE_URL` - PostgreSQL connection string
- `API_KEY` - API authentication key
- `RATE_LIMIT` - Rate limiting configuration
- `ENV` - Environment (development/production)
- `DEBUG` - Debug mode flag
- `CORS_ORIGINS` - Allowed CORS origins
- `SECRET_KEY` - JWT secret key

### Frontend (`fert-frontend/.env`)
- `VITE_API_BASE_URL` - Backend API URL
- `VITE_APP_NAME` - Application name

---

## Deployment

### Docker
- **Backend**: `Dockerfile` builds Python 3.12 image with FastAPI
- **Frontend**: `fert-frontend/Dockerfile` builds production React app
- **Database**: `docker-compose.yml` orchestrates PostgreSQL container
- **Orchestration**: `docker-compose.yml` manages all services

### Database
- **Production**: PostgreSQL (via Docker)
- **Development**: Can use SQLite (`fertilizer.db`) or PostgreSQL
- **Migrations**: Alembic handles schema changes

---

## File Naming Conventions

- **Python**: snake_case (e.g., `train_model.py`)
- **React Components**: PascalCase (e.g., `InputForm.jsx`)
- **Config Files**: lowercase with extensions (e.g., `vite.config.js`)
- **Database Models**: PascalCase classes (e.g., `User`, `Plot`)
- **API Routes**: lowercase with hyphens in URLs (e.g., `/soil-health`)

---

## Important Notes

1. **Never commit** `.env` files - use `.env.example` as template
2. **Artifacts** (`src/artifact/`) contain trained models - can be large
3. **Database migrations** should be run before deployment
4. **Frontend build** must be run before production deployment
5. **Rate limiting** is more lenient in development mode
6. **CORS** is configured for localhost by default - update for production

