# 🌱 FertilizerOptimizer

> **Enterprise-Grade AI Agronomy & Sustainability Platform**

FertilizerOptimizer is a full-stack, machine-learning-powered web application designed for agronomists, agricultural co-ops, and large-scale farming enterprises. 

By combining standard soil test metrics (N, P, K, pH, OM%) with live regional weather data, the platform's ML pipeline generates highly accurate, sustainable fertilizer plans that maximize crop yield while minimizing the ecological carbon footprint.

---

## ✨ Key Features

- **🧠 Machine Learning Agronomy:** Predicts optimal Nitrogen, Phosphorus, and Potassium requirements and forecasts crop yield based on regional datasets.
- **🌍 Sustainability & Carbon Tracking:** Automatically calculates the CO₂ equivalent footprint of recommended fertilizer plans.
- **⛅ Weather-Aware Insights:** Integrates with weather APIs to adjust application safety windows based on 3-day precipitation forecasts.
- **🗺️ GIS Interactive Mapping:** Visualize all managed farm plots on an interactive geographic map with live filtering.
- **📑 White-Labeled PDF Reports:** Generate custom-branded agronomy reports (via ReportLab) to hand directly to farmers.
- **🔄 Continuous Feedback Loop:** Log actual harvested yields to monitor ML model drift and improve future predictions.
- **⚡ Batch CSV Processing:** Import hundreds of farm plots simultaneously with a rate-limit-safe background queue.
- **🏢 Multi-Tenant Admin Console:** Manage users, trigger background ML training jobs, and dispatch automated weekly email summaries.

---

## 🛠️ Technology Stack

### Backend (API & ML)
- **Framework:** FastAPI (Python 3.10+)
- **Machine Learning:** Scikit-Learn (Ensemble Regressors), Pandas, NumPy
- **Database:** SQLite + SQLAlchemy (Async)
- **Document Generation:** ReportLab
- **Authentication:** JWT (JSON Web Tokens) & Passlib (Bcrypt)

### Frontend (Web App)
- **Framework:** React 18 + Vite
- **Routing:** React Router DOM
- **Styling:** Tailwind CSS
- **Data Visualization:** Recharts (Analytics) & React-Leaflet (GIS Mapping)

### DevOps & Infrastructure
- **Containerization:** Docker & Docker Compose (Multi-stage builds)
- **Web Server:** Nginx (Static SPA serving)
- **CI/CD:** GitHub Actions (Automated Pytest testing and Docker builds)

---

## 🚀 Quickstart (Docker)

The easiest way to run FertilizerOptimizer locally or on a cloud VPS is using Docker Compose. This will spin up the backend API, the frontend Nginx server, and wire them together.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed.

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/fertilizer-optimizer.git
cd fertilizer-optimizer
```

### 2. Configure Environment
Create a `.env` file in the root directory:
```env
ENV=production
SECRET_KEY=your_super_secret_jwt_key
ADMIN_EMAILS=admin@yourcompany.com
```

### 3. Spin up the stack
```bash
docker-compose up -d --build
```

### 4. Access the Application
- **Frontend:** http://localhost:5173
- **Backend API Docs:** http://localhost:8000/docs

---

## 🧪 Running Tests

The backend features an automated testing suite using `pytest`.

```bash
pip install -r requirements.txt
pip install pytest httpx pytest-asyncio
pytest tests/ -v
```

---

## 📄 License

This project is licensed under the MIT License.