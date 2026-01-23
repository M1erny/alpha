import sys
import os
import pandas as pd
import yfinance as yf
sys.path.append(r'c:\Users\Tomek\.antigravity\alpha')
import risk

print("--- DEBUGGING DATA FETCH ---")
tickers = ['SPY', 'WIG20.WA', 'URTH']
start_date = "2026-01-01"
print(f"Downloading {tickers} from {start_date}...")
data = yf.download(tickers, start=start_date, progress=False)
print("Data Columns:", data.columns)
if isinstance(data.columns, pd.MultiIndex):
    close = data['Close']
else:
    close = data['Close'] if 'Close' in data else data

print("\n--- HEAD ---")
print(close.head())

print("\n--- INFO ---")
for t in tickers:
    if t in close.columns:
        series = close[t].dropna()
        print(f"{t}: {len(series)} rows. Last: {series.iloc[-1] if not series.empty else 'EMPTY'}")
    else:
        print(f"{t}: NOT FOUND in columns")

print("\n--- RISK MODULE TEST ---")
try:
    prices, fx = risk.fetch_data()
    print("Risk Fetch Data Keys:", prices.columns)
    if 'WIG20.WA' in prices.columns:
        print(f"WIG20.WA in risk data: {len(prices['WIG20.WA'].dropna())} rows")
    else:
        print("WIG20.WA NOT in risk data")

    # Mock YTD Alpha Calc
    usd_prices = risk.normalize_to_base_currency(prices, fx)
    metrics = risk.calculate_risk_metrics(usd_prices)
    if metrics:
        print(f"YTD Alpha: {metrics.get('YTD_Alpha')}")
        print(f"YTD Beta: {metrics.get('YTD_Beta')}")
        print(f"WIG YTD: {metrics.get('WIG_YTD')}")
except Exception as e:
    print(f"Risk Module Error: {e}")
