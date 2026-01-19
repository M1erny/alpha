import sys
import os
import asyncio
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import pandas as pd
import numpy as np
from datetime import datetime

# --- CONFIGURATION ---
# Determine path to risk.py (Parent of current project root)
# Current: .../alpha/dashboard/backend/server.py
# Risk.py: .../alpha/risk.py
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
RISK_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))

if RISK_DIR not in sys.path:
    sys.path.append(RISK_DIR)

try:
    import risk
except ImportError as e:
    print(f"CRITICAL: Could not import risk.py from {RISK_DIR}. Error: {e}")
    risk = None

# --- STATE MANAGEMENT ---
class PortfolioManager:
    def __init__(self):
        self.state = "idle" # idle, loading, ready, error
        self.message = "Waiting to start..."
        self.last_update = None
        self.metrics = None
        self.history = None
        self.error = None

    async def hydrate(self):
        if not risk:
            self.state = "error"
            self.message = "risk.py module missing"
            return
            
        self.state = "loading"
        self.message = "Connecting to Market Data..."
        print(f"[PM] Starting hydration from {RISK_DIR}...")
        
        try:
            # Run blocking I/O in a separate thread to not block the event loop
            # fetch_data() can take 10-30s
            loop = asyncio.get_event_loop()
            
            self.message = "Downloading Tickers (Yahoo Finance)..."
            raw_prices, fx_rates = await loop.run_in_executor(None, risk.fetch_data)
            
            self.message = "Normalizing Currencies..."
            usd_prices = await loop.run_in_executor(None, risk.normalize_to_base_currency, raw_prices, fx_rates)
            
            self.message = "Calculating Risk Metrics..."
            metrics_calc = await loop.run_in_executor(None, risk.calculate_risk_metrics, usd_prices)
            
            # --- Advanced Models ---
            self.message = "Running Monte Carlo Simulations..."
            mc_paths = await loop.run_in_executor(None, risk.run_monte_carlo, metrics_calc, 500, 60)
            
            self.message = "Stress Testing..."
            stress_results = await loop.run_in_executor(None, risk.stress_test_portfolio, metrics_calc)
            
            periodic_rets = await loop.run_in_executor(None, risk.calculate_periodic_returns, usd_prices)

            # --- ADVANCED CALCULATIONS ---
            # 0. YTD Calculations (2026)
            start_ytd = pd.Timestamp("2026-01-01")
            
            # Get streams
            port_stream = metrics_calc['Returns_Stream']
            bench_stream = metrics_calc['Benchmark_Stream']

            # Make TZ Naive to ensure slicing works
            if port_stream.index.tz is not None:
                port_stream.index = port_stream.index.tz_localize(None)
            if bench_stream.index.tz is not None:
                bench_stream.index = bench_stream.index.tz_localize(None)

            # Helper to calc total return from daily rets
            def calc_period_return(daily_rets, start_date):
                # Ensure start_date is within range logic or just slice
                period_rets = daily_rets[daily_rets.index >= start_date]
                if period_rets.empty: return 0.0
                return (1 + period_rets).prod() - 1

            ytd_portfolio = calc_period_return(port_stream, start_ytd)
            ytd_benchmark = calc_period_return(bench_stream, start_ytd)
            
            # Benchmark specific stats (Robust Pandas Methods)
            bench_vol = bench_stream.std() * np.sqrt(252)
            rf_rate = 0.04
            bench_annual_ret = bench_stream.mean() * 252
            
            # Safety checks for NaN/Zero
            if pd.isna(bench_vol) or bench_vol == 0:
                bench_sharpe = 0.0
                bench_vol = 0.0 if pd.isna(bench_vol) else bench_vol
            else:
                bench_sharpe = (bench_annual_ret - rf_rate) / bench_vol

            # Debug Logs
            print(f"[PM] Data Range: {port_stream.index[0]} to {port_stream.index[-1]}")
            print(f"[PM] YTD Portfolio: {ytd_portfolio:.2%}, Bench: {ytd_benchmark:.2%}")
            print(f"[PM] Bench Vol: {bench_vol:.2%}, Sharpe: {bench_sharpe:.2f}")

            # --- PREPARE API RESPONSE ---
            # We construct the response dict here so the API call is instant
            
            # 1. Risk Attribution
            risk_attr = []
            for ticker, stats in metrics_calc['Risk_Attribution'].items():
                risk_attr.append({
                    "ticker": ticker,
                    "weight": stats['Weight'],
                    "pctRisk": stats['Pct_Risk'],
                    "mctr": stats['MCTR']
                })
            risk_attr.sort(key=lambda x: x["pctRisk"], reverse=True)

            # 2. Stress Tests
            stress_list = [{"scenario": k, "impact": v} for k, v in stress_results.items()]

            # 3. Periodic
            periodic_list = []
            for ticker, row in periodic_rets.iterrows():
                periodic_list.append({
                    "ticker": ticker,
                    "r1y": row['1Y'] if not pd.isna(row['1Y']) else None,
                    "r3y": row['3Y'] if not pd.isna(row['3Y']) else None,
                    "r5y": row['5Y'] if not pd.isna(row['5Y']) else None,
                })

            # 4. Monte Carlo
            mc_list = []
            if mc_paths is not None:
                days = mc_paths.shape[1]
                p05 = np.percentile(mc_paths, 5, axis=0)
                p50 = np.percentile(mc_paths, 50, axis=0)
                p95 = np.percentile(mc_paths, 95, axis=0)
                for t in range(days):
                    mc_list.append({"day": t, "p05": p05[t], "p50": p50[t], "p95": p95[t]})

            # 5. History
            history_list = []
            portfolio_cum = (1 + metrics_calc['Returns_Stream']).cumprod() * 1000
            benchmark_cum = (1 + metrics_calc['Benchmark_Stream']).cumprod() * 1000
            drawdown_stream = metrics_calc['Drawdown_Stream']
            for date in portfolio_cum.index:
                history_list.append({
                    "date": date.strftime('%Y-%m-%d'),
                    "portfolio": float(portfolio_cum.loc[date]),
                    "benchmark": float(benchmark_cum.loc[date]),
                    "drawdown": float(drawdown_stream.loc[date])
                })

            self.metrics = {
                "vitals": {
                    "beta": float(metrics_calc['Beta']),
                    "annualReturn": float(metrics_calc['Annual_Return']),
                    "annualVol": float(metrics_calc['Annual_Vol']),
                    "sharpe": float(metrics_calc['Sharpe']),
                    "sortino": float(metrics_calc['Sortino']),
                    "maxDrawdown": float(metrics_calc['Max_Drawdown']),
                    "var95": float(metrics_calc['VaR_95']),
                    "cvar95": float(metrics_calc['CVaR_95']),
                    
                    # New Stats
                    "ytdReturn": float(ytd_portfolio),
                    "benchmarkYtd": float(ytd_benchmark),
                    "benchmarkVol": float(bench_vol),
                    "benchmarkSharpe": float(bench_sharpe)
                },
                "leverage": {
                    "Long_Exp": float(metrics_calc['Leverage_Stats']['Long_Exp']),
                    "Short_Exp": float(metrics_calc['Leverage_Stats']['Short_Exp']),
                    "Daily_Drag": float(metrics_calc['Leverage_Stats']['Daily_Drag'])
                },
                "riskAttribution": risk_attr,
                "stressTests": stress_list,
                "periodicReturns": periodic_list,
                "monteCarlo": mc_list,
                "history": history_list
            }
            
            self.last_update = datetime.now()
            self.state = "ready"
            self.message = "System Online"
            print("[PM] Hydration Complete.")

        except Exception as e:
            import traceback
            traceback.print_exc()
            self.state = "error"
            self.error = str(e)
            self.message = f"Failed: {str(e)}"

# Singleton
pm = PortfolioManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Kick off hydration
    asyncio.create_task(pm.hydrate())
    yield
    # Shutdown logic if needed

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/status")
async def get_status():
    return {
        "state": pm.state,
        "message": pm.message,
        "last_update": pm.last_update,
        "error": pm.error
    }

@app.get("/api/metrics")
async def get_metrics():
    if pm.state == "ready" and pm.metrics:
        return pm.metrics
    elif pm.state == "error":
        return {"error": pm.error, "message": pm.message}
    else:
        # 503 Service Unavailable ideally, but let's just return a status dict
        return {"status": "loading", "message": pm.message}

@app.post("/api/refresh")
async def refresh_metrics(background_tasks: BackgroundTasks):
    if pm.state == "loading":
        return {"status": "busy", "message": "Already updating..."}
    
    background_tasks.add_task(pm.hydrate)
    return {"status": "accepted", "message": "Refresh started"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
