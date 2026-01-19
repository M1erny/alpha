import sys
import os
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

@app.get("/api/metrics")
async def get_metrics():
    if not risk:
        return {"error": "risk.py not found or failed to import"}

    try:
        # 1. Fetch and Calculate Base Metrics
        raw_prices, fx_rates = risk.fetch_data()
        usd_prices = risk.normalize_to_base_currency(raw_prices, fx_rates)
        metrics = risk.calculate_risk_metrics(usd_prices)
        
        # 2. Run Advanced Models
        stress_results = risk.stress_test_portfolio(metrics)
        mc_paths = risk.run_monte_carlo(metrics, num_sims=500, days=60) # Reduced sims for speed
        periodic_rets = risk.calculate_periodic_returns(usd_prices)

        # 3. Format Response
        response = {
            "vitals": {
                "beta": metrics['Beta'],
                "annualReturn": metrics['Annual_Return'],
                "annualVol": metrics['Annual_Vol'],
                "sharpe": metrics['Sharpe'],
                "sortino": metrics['Sortino'],
                "maxDrawdown": metrics['Max_Drawdown'],
                "var95": metrics['VaR_95'],
                "cvar95": metrics['CVaR_95'],
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
