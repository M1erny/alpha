
import sys
import os
import pandas as pd
import numpy as np

# Add directory to path
sys.path.append(os.getcwd())

print("Importing risk...")
try:
    import risk
except Exception as e:
    print(f"Import failed: {e}")
    sys.exit(1)

print("Fetching data...")
try:
    raw_prices, fx_rates = risk.fetch_data()
    usd_prices = risk.normalize_to_base_currency(raw_prices, fx_rates)
    print(f"Data fetched. Shape: {usd_prices.shape}")
except Exception as e:
    print(f"Fetch failed: {e}")
    sys.exit(1)

print("Calculating Metrics (B&H YTD)...")
try:
    metrics = risk.calculate_risk_metrics(usd_prices)
    
    print("\n--- B&H YTD RESULTS ---")
    print(f"YTD Return: {metrics.get('YTD_Return'):.4%}")
    print(f"YTD PLN Return: {metrics.get('YTD_Return_PLN'):.4%}")
    print(f"YTD Sharpe: {metrics.get('YTD_Sharpe'):.4f}")
    print(f"YTD Beta: {metrics.get('YTD_Beta'):.4f}")
    print(f"Longs Contrib: {metrics.get('YTD_Longs_Contrib'):.4%}")
    print(f"Shorts Contrib: {metrics.get('YTD_Shorts_Contrib'):.4%}")
    
    # Check if debug file was written
    if os.path.exists("debug_risk.txt"):
        print("\nTail of debug_risk.txt:")
        with open("debug_risk.txt", "r") as f:
            print("".join(f.readlines()[-10:]))
            
except Exception as e:
    print(f"Calculation failed: {e}")
    import traceback
    traceback.print_exc()
