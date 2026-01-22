import sys
import os

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np

# Add the directory containing risk.py to path
RISK_DIR = r"c:\Users\Tomek\.antigravity\alpha"
sys.path.append(RISK_DIR)

# Import risk.py
# We use a try-except block to handle potential import errors gracefully
try:
    import risk
except ImportError as e:
    print(f"Error importing risk.py: {e}")
    risk = None

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/status")
async def get_status():
    if risk:
        return {"state": "ready", "message": "Ready"}
    else:
        return {"state": "error", "message": "Risk module failed to load"}

@app.get("/api/metrics")
async def get_metrics():
    if not risk:
        return {"error": "risk.py not found or failed to import"}

    try:
        # 1. Fetch and Calculate Base Metrics
        raw_prices, fx_rates = risk.fetch_data()
        usd_prices = risk.normalize_to_base_currency(raw_prices, fx_rates)
        metrics = risk.calculate_risk_metrics(usd_prices)
        
        if metrics is None:
             print("Error: Metrics calculation returned None (insufficient data).")
             # Return a valid structure with nulls/zeros to allow frontend to render empty state
             # rather than crashing with 500
             return {
                "error": "Insufficient data to calculate metrics. (Likely Yahoo Finance rate limit or connection issue).",
                "vitals": { k: 0 for k in ["beta", "annualReturn", "annualVol", "sharpe", "sortino", "maxDrawdown", "cvar95", "rolling1mVol"] }, # Partial fallback
                "riskAttribution": [],
                "stressTests": [],
                "periodicReturns": [],
                "monteCarlo": [],
                "history": [],
                "leverage": {}
             }

        # 2. Run Advanced Models
        stress_results = risk.stress_test_portfolio(metrics)
        mc_paths = risk.run_monte_carlo(metrics, num_sims=500, days=60) # Reduced sims for speed
        periodic_rets = risk.calculate_periodic_returns(usd_prices)

        # 3. Format Response
        def to_float(val):
            if val is None: return None
            try:
                return float(val)
            except:
                return None

        # 3. Format Response
        response = {
            "vitals": {
                "beta": to_float(metrics['Beta']),
                "annualReturn": to_float(metrics['Annual_Return']),
                "annualVol": to_float(metrics['Annual_Vol']),
                "sharpe": to_float(metrics['Sharpe']),
                "sortino": to_float(metrics['Sortino']),
                "maxDrawdown": to_float(metrics['Max_Drawdown']),
                "rolling1mVol": to_float(metrics.get('Rolling_1M_Vol')),
                "rolling1mVolBenchmark": to_float(metrics.get('Benchmark_Rolling_1M_Vol')),
                "cvar95": to_float(metrics['CVaR_95']),
                "jensensAlpha": to_float(metrics.get('Jensens_Alpha')),
                "periodInfo": metrics.get('Period_Info'),
                
                # New YTD Fields
                "ytdReturn": to_float(metrics.get('YTD_Return')),
                "benchmarkYtd": to_float(metrics.get('Benchmark_YTD')),
                "ytdBeta": to_float(metrics.get('YTD_Beta')),
                
                # Standardized Sharpe Metrics
                "ytdSharpe": to_float(metrics.get('YTD_Sharpe')),           # Previously riskEfficiencyVol
                "benchmarkYtdSharpe": to_float(metrics.get('Benchmark_YTD_Sharpe')), 
                "benchmarkHistSharpe": to_float(metrics.get('Benchmark_Hist_Sharpe')), # For Hist Avg comparison
                "ytdReturnPln": to_float(metrics.get('YTD_Return_PLN')),
                "wigYtd": to_float(metrics.get('WIG_YTD')),
                "msciYtd": to_float(metrics.get('MSCI_YTD')),
                "ytdLongsContrib": to_float(metrics.get('YTD_Longs_Contrib')),
                "ytdShortsContrib": to_float(metrics.get('YTD_Shorts_Contrib')),
            },
            "leverage": metrics['Leverage_Stats'],
            "riskAttribution": [],
            "stressTests": [],
            "periodicReturns": [],
            "monteCarlo": [],
            "history": []
        }

        # Format Risk Attribution
        for ticker, stats in metrics['Risk_Attribution'].items():
            response["riskAttribution"].append({
                "ticker": ticker,
                "weight": stats['Weight'],
                "pctRisk": stats['Pct_Risk'],
                "mctr": stats['MCTR']
            })
        response["riskAttribution"].sort(key=lambda x: x["pctRisk"], reverse=True)

        # Format Stress Tests
        for scenario, impact in stress_results.items():
            response["stressTests"].append({
                "scenario": scenario,
                "impact": impact
            })

        # Format Periodic Returns
        # Periodic returns is a DataFrame: index=ticker, columns=['1Y', '3Y', '5Y']
        for ticker, row in periodic_rets.iterrows():
            response["periodicReturns"].append({
                "ticker": ticker,
                "ytd": row['YTD'] if 'YTD' in row and not pd.isna(row['YTD']) else None,
                "r1y": row['1Y'] if not pd.isna(row['1Y']) else None,
                "r3y": row['3Y'] if not pd.isna(row['3Y']) else None,
                "r5y": row['5Y'] if not pd.isna(row['5Y']) else None,
            })
        
        # Format Monte Carlo (Percentiles for Cone Chart)
        if mc_paths is not None:
            # mc_paths shape: (sims, days+1)
            days = mc_paths.shape[1]
            p05 = np.percentile(mc_paths, 5, axis=0)
            p50 = np.percentile(mc_paths, 50, axis=0)
            p95 = np.percentile(mc_paths, 95, axis=0)
            
            for t in range(days):
                response["monteCarlo"].append({
                    "day": t,
                    "p05": p05[t],
                    "p50": p50[t],
                    "p95": p95[t]
                })

        # Format History (Cumulative 1000 base)
        portfolio_cum = (1 + metrics['Returns_Stream']).cumprod() * 1000
        benchmark_cum = (1 + metrics['Benchmark_Stream']).cumprod() * 1000
        drawdown_stream = metrics['Drawdown_Stream']
        
        # Align indexes
        common_idx = portfolio_cum.index
        
        # We'll limit history to optimize payload if needed, but for now send full
        for date in common_idx:
            date_str = date.strftime('%Y-%m-%d')
            response["history"].append({
                "date": date_str,
                "portfolio": portfolio_cum.loc[date],
                "benchmark": benchmark_cum.loc[date],
                "drawdown": drawdown_stream.loc[date]
            })

        return response

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
