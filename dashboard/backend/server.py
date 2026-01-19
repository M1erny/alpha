import sys
import os
import asyncio
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz
import requests 
import pandas as pd
import numpy as np
from datetime import datetime

# --- NOTIFICATION CONFIG (Action Required: Fill these details) ---
NOTIFICATION_CONFIG = {
    'enabled': True,
    'provider': 'telegram', # Options: 'telegram' or 'pushover'
    'telegram': {
        'bot_token': 'YOUR_BOT_TOKEN_HERE',
        'chat_id': 'YOUR_CHAT_ID_HERE'
    },
    'pushover': {
        'user_key': 'YOUR_USER_KEY', 
        'api_token': 'YOUR_API_TOKEN'
    }
}

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

            # --- YTD RISK EFFICIENCY ---
            # 1. YTD Beta
            # Need matching indexes
            common_idx = port_stream.index.intersection(bench_stream.index)
            ytd_common_idx = common_idx[common_idx >= start_ytd]
            
            if len(ytd_common_idx) > 2:
                ytd_p = port_stream.loc[ytd_common_idx]
                ytd_b = bench_stream.loc[ytd_common_idx]
                
                cov_matrix = np.cov(ytd_p, ytd_b)
                ytd_beta = cov_matrix[0, 1] / cov_matrix[1, 1]
                
                # YTD Vol (Annualized)
                ytd_port_vol = ytd_p.std() * np.sqrt(252)
                
                # YTD Annualized Return (Approximation for ratio)
                # We use the mean daily return * 252 as the 'annualized rate' for the ratio
                ytd_ann_ret = ytd_p.mean() * 252
                
                # 2. Ratios
                risk_adj_vol = (ytd_ann_ret - rf_rate) / ytd_port_vol if ytd_port_vol > 0 else 0
                risk_adj_beta = (ytd_ann_ret - rf_rate) / ytd_beta if abs(ytd_beta) > 0.01 else 0
            else:
                ytd_beta = 0.0
                risk_adj_vol = 0.0
                risk_adj_beta = 0.0

            # Debug Logs
            print(f"[PM] Data Range: {port_stream.index[0]} to {port_stream.index[-1]}")
            print(f"[PM] YTD Portfolio: {ytd_portfolio:.2%}, Bench: {ytd_benchmark:.2%}")
            print(f"[PM] Bench Vol: {bench_vol:.2%}, Sharpe: {bench_sharpe:.2f}")
            print(f"[PM] YTD Beta: {ytd_beta:.2f}, Eff(Vol): {risk_adj_vol:.2f}, Eff(Beta): {risk_adj_beta:.2f}")

            # --- PREPARE API RESPONSE ---
            # We construct the response dict here so the API call is instant
            
            # Helper for JSON safety
            def safe_float(val):
                if val is None: return 0.0
                try:
                    v = float(val)
                    if np.isnan(v) or np.isinf(v):
                        return 0.0
                    return v
                except:
                    return 0.0

            # 1. Risk Attribution
            risk_attr = []
            for ticker, stats in metrics_calc['Risk_Attribution'].items():
                risk_attr.append({
                    "ticker": ticker,
                    "weight": safe_float(stats.get('Weight', 0)),
                    "pctRisk": safe_float(stats.get('Pct_Risk', 0)),
                    "mctr": safe_float(stats.get('MCTR', 0))
                })
            risk_attr.sort(key=lambda x: x["pctRisk"], reverse=True)

            # 2. Stress Tests
            stress_list = [{"scenario": k, "impact": safe_float(v)} for k, v in stress_results.items()]

            # 3. Periodic + YTD for Heatmap
            periodic_list = []
            
            # Pre-calc YTD for all assets
            ytd_assets = {}
            for ticker in usd_prices.columns:
                series = usd_prices[ticker].copy()
                # Force naive index
                if series.index.tz is not None:
                    series.index = series.index.tz_localize(None)
                
                ytd_series = series[series.index >= start_ytd]
                if not ytd_series.empty:
                    # Total return = (End / Start) - 1
                    ytd_ret = (ytd_series.iloc[-1] / ytd_series.iloc[0]) - 1
                    ytd_assets[ticker] = safe_float(ytd_ret)
                else:
                    # Fallback to last available if very close? or just 0
                    ytd_assets[ticker] = 0.0

            # Debug YTD
            print(f"[PM] Calc YTD for {len(usd_prices.columns)} assets. Sample (AFRM): {ytd_assets.get('AFRM', 'N/A')}")

            for ticker, row in periodic_rets.iterrows():
                periodic_list.append({
                    "ticker": ticker,
                    "r1y": safe_float(row['1Y']) if not pd.isna(row['1Y']) else None,
                    "r3y": safe_float(row['3Y']) if not pd.isna(row['3Y']) else None,
                    "r5y": safe_float(row['5Y']) if not pd.isna(row['5Y']) else None,
                    "ytd": safe_float(ytd_assets.get(ticker, 0.0))
                })

            # 4. Monte Carlo
            mc_list = []
            if mc_paths is not None:
                days = mc_paths.shape[1]
                p05 = np.percentile(mc_paths, 5, axis=0)
                p50 = np.percentile(mc_paths, 50, axis=0)
                p95 = np.percentile(mc_paths, 95, axis=0)
                for t in range(days):
                    mc_list.append({
                        "day": t, 
                        "p05": safe_float(p05[t]), 
                        "p50": safe_float(p50[t]), 
                        "p95": safe_float(p95[t])
                    })

            # 5. History
            history_list = []
            portfolio_cum = (1 + metrics_calc['Returns_Stream']).cumprod() * 1000
            benchmark_cum = (1 + metrics_calc['Benchmark_Stream']).cumprod() * 1000
            drawdown_stream = metrics_calc['Drawdown_Stream']
            for date in portfolio_cum.index:
                history_list.append({
                    "date": date.strftime('%Y-%m-%d'),
                    "portfolio": safe_float(portfolio_cum.loc[date]),
                    "benchmark": safe_float(benchmark_cum.loc[date]),
                    "drawdown": safe_float(drawdown_stream.loc[date])
                })

            self.metrics = {
                "vitals": {
                    "beta": safe_float(metrics_calc['Beta']),
                    "annualReturn": safe_float(metrics_calc['Annual_Return']),
                    "annualVol": safe_float(metrics_calc['Annual_Vol']),
                    "sharpe": safe_float(metrics_calc['Sharpe']),
                    "sortino": safe_float(metrics_calc['Sortino']),
                    "maxDrawdown": safe_float(metrics_calc['Max_Drawdown']),
                    "var95": safe_float(metrics_calc['VaR_95']),
                    "cvar95": safe_float(metrics_calc['CVaR_95']),
                    
                    # New Stats
                    "ytdReturn": safe_float(ytd_portfolio),
                    "benchmarkYtd": safe_float(ytd_benchmark),
                    "benchmarkVol": safe_float(bench_vol),
                    "benchmarkSharpe": safe_float(bench_sharpe),
                    
                    # Risk Efficiency
                    "ytdBeta": safe_float(ytd_beta),
                    "riskEfficiencyVol": safe_float(risk_adj_vol),
                    "riskEfficiencyBeta": safe_float(risk_adj_beta)
                },
                "leverage": {
                    "Long_Exp": safe_float(metrics_calc['Leverage_Stats']['Long_Exp']),
                    "Short_Exp": safe_float(metrics_calc['Leverage_Stats']['Short_Exp']),
                    "Daily_Drag": safe_float(metrics_calc['Leverage_Stats']['Daily_Drag'])
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
            
            # SEND NOTIFICATION
            msg = f"Alpha: {self.metrics['vitals'].get('alpha', 0):.2f}% | Beta: {self.metrics['vitals']['beta']:.2f} | Sharpe: {self.metrics['vitals']['sharpe']:.2f}"
            msg += f"\nYTD: {self.metrics['vitals']['ytdReturn']:.2%} vs Bench: {self.metrics['vitals']['benchmarkYtd']:.2%}"
            self.send_notification("Risk Engine Updated", msg)

        except Exception as e:
            import traceback
            traceback.print_exc()
            self.state = "error"
            self.error = str(e)
            self.message = f"Failed: {str(e)}"

    def send_notification(self, title, message):
        if not NOTIFICATION_CONFIG['enabled']: return

        try:
            if NOTIFICATION_CONFIG['provider'] == 'telegram':
                token = NOTIFICATION_CONFIG['telegram']['bot_token']
                chat_id = NOTIFICATION_CONFIG['telegram']['chat_id']
                if 'YOUR_' in token: 
                    print("[Notification] Telegram not configured.")
                    return
                url = f"https://api.telegram.org/bot{token}/sendMessage"
                payload = {"chat_id": chat_id, "text": f"*{title}*\n{message}", "parse_mode": "Markdown"}
                requests.post(url, json=payload, timeout=5)
                
            elif NOTIFICATION_CONFIG['provider'] == 'pushover':
                user_key = NOTIFICATION_CONFIG['pushover']['user_key']
                api_token = NOTIFICATION_CONFIG['pushover']['api_token']
                if 'YOUR_' in user_key:
                    print("[Notification] Pushover not configured.")
                    return
                url = "https://api.pushover.net/1/messages.json"
                payload = {"token": api_token, "user": user_key, "title": title, "message": message}
                requests.post(url, data=payload, timeout=5)
                
            print(f"[PM] Notification sent: {title}")
        except Exception as e:
            print(f"[PM] Failed to send notification: {e}")

        except Exception as e:
            import traceback
            traceback.print_exc()
            self.state = "error"
            self.error = str(e)
            self.message = f"Failed: {str(e)}"

# Singleton
pm = PortfolioManager()
scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Kick off hydration
    asyncio.create_task(pm.hydrate())
    
    # Schedule Refresh Every 8 Hours (00:00, 08:00, 16:00 Warsaw Time)
    try:
        waw_tz = pytz.timezone('Europe/Warsaw')
        scheduler.add_job(pm.hydrate, 'cron', hour='*/8', minute=0, timezone=waw_tz)
        scheduler.start()
        print("[Scheduler] Automated Refresh scheduled for every 8 hours (00:00, 08:00, 16:00 CET/CEST).")
    except Exception as e:
        print(f"[Scheduler] Failed to start: {e}")
        
    yield
    # Cleanup on shutdown
    scheduler.shutdown()

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
