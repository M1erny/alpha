# Institutional Portfolio Dashboard (Alpha)

## Overview
The **Institutional Portfolio Dashboard** is a high-performance risk analytics platform designed for monitoring hedge fund portfolios. It provides real-time insights into portfolio health, risk exposure, and performance attribution, utilizing institutional-grade financial models.

The repository is structured with the core **Risk Engine** (`risk.py`) at the root, serving as the quantitative backbone for the full-stack visualization layer located in `dashboard/`.

## Key Features

### 📊 Performance & Risk Analytics
- **Standardized YTD Calculation:** Tracks performance using the previous year's closing price (Dec 31) as the base, ensuring industry-standard accuracy.
- **Advanced Risk Metrics:** Real-time calculation of **Value at Risk (VaR 95%)**, **CVaR (Expected Shortfall)**, **Sharpe Ratio**, **Sortino Ratio**, and **Beta**.
- **Dynamic Benchmarking:** Compare performance against major indices:
    - **SPY** (S&P 500)
    - **WIG20** (Warsaw Stock Exchange)
    - **URTH** (MSCI World)

### 🧪 Simulation & Stress Testing
- **Monte Carlo Simulation:** Runs 1,000 path simulations over a 60-day horizon to forecast potential portfolio trajectories.
- **Stress Testing:** Evaluates portfolio resilience under hypothetical market scenarios (e.g., Market Crash -10%, Surge +10%).

### 📉 Risk Attribution
- **Marginal Contribution to Total Risk (MCTR):** Decomposes portfolio volatility to identify which assets are the primary drivers of risk.
- **Correlation Heatmap:** Visualizes cross-asset correlations to detect diversification breakdowns.

---

## Tech Stack

### Quantitative Engine (Root)
- **Language:** Python 3.12+
- **Core Library:** `risk.py`
- **Key Libraries:** `pandas`, `numpy`, `yfinance`, `scipy`

### Application Layer (`/dashboard`)
- **Backend:** FastAPI (Python)
- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** TailwindCSS v4

---

## Installation & Setup

### Prerequisites
- **Python 3.10+**
- **Node.js 18+**

### Installation Steps

1.  **Clone the Repository**
    ```bash
    git clone <repo-url> alpha
    cd alpha
    ```

2.  **Install Core & Backend Dependencies**
    ```bash
    pip install -r dashboard/backend/requirements.txt
    ```
    *Note: Ensure `pandas`, `numpy`, `yfinance` are installed for `risk.py`.*

3.  **Install Frontend Dependencies**
    ```bash
    cd dashboard
    npm install
    ```

---

## Usage

### Manual Startup
To run the full stack application:

**Terminal 1 (Backend):**
```bash
cd dashboard/backend
python server.py
# Note: server.py expects 'risk.py' to be importable from the parent directory
```

**Terminal 2 (Frontend):**
```bash
cd dashboard
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Architecture

```
alpha/
├── risk.py                # CORE: Financial modeling & data engine
├── dashboard/             # APP: Full-stack visualization
│   ├── src/               # Frontend Source (React)
│   ├── backend/           # API Server (FastAPI)
│   └── ...
├── debug_*.py             # scripts: Verification & Debugging tools
└── README.md              # Project documentation
```

---

## License
Private / Proprietary.
