
import sys
import os
import pandas as pd
import numpy as np
from datetime import datetime

# Add directory to path
sys.path.append(os.getcwd())

import risk

# Override PORTFOLIO_CONFIG for testing to match mock data
risk.PORTFOLIO_CONFIG = {
    'A': {'weight': 0.5, 'type': 'Long', 'currency': 'USD'},
    'B': {'weight': 0.5, 'type': 'Short', 'currency': 'USD'}
}
risk.active_tickers = ['A', 'B']

# Mock Data
# Date range including YTD start
dates = pd.date_range(end=datetime.now(), periods=20)
ytd_start_idx = 10
# Current year start is inside the range
# We need to ensure risk.py's "ytd_start" logic matches these dates.
# risk.py uses current_year-01-01.
# So we must set dates to valid current year dates.
current_year = datetime.now().year
dates = pd.date_range(start=f"{current_year}-01-01", periods=10)
# Prepend some history
history_dates = pd.date_range(end=dates[0] - pd.Timedelta(days=1), periods=10)
all_dates = history_dates.union(dates)

data = {
    'A': np.linspace(100, 110, len(all_dates)), # +10%
    'B': np.linspace(100, 110, len(all_dates)), # +10%
    'SPY': np.linspace(200, 220, len(all_dates)),
    'WIG.WA': np.linspace(100, 100, len(all_dates)),
    'URTH': np.linspace(100, 100, len(all_dates)),
}
prices_df = pd.DataFrame(data, index=all_dates)

print("Running Calculate Risk Metrics on Mock Data...")
try:
    metrics = risk.calculate_risk_metrics(prices_df)
    
    if metrics:
        print("\n--- B&H YTD RESULTS ---")
        print(f"YTD Return: {metrics.get('YTD_Return'):.4%}")
        
        # Expected:
        # A (Long 0.5): 100 -> 110 (+10%). Contrib = 0.5 * 10% = +5%.
        # B (Short 0.5): 100 -> 110 (+10%). Contrib = 0.5 * -1 * 10% = -5%.
        # Total = 0%.
        
        print(f"YTD Longs Contrib: {metrics.get('YTD_Longs_Contrib'):.4%}")
        print(f"YTD Shorts Contrib: {metrics.get('YTD_Shorts_Contrib'):.4%}")
        
        print("\nTest Case 2: A up 20%, B down 10%")
        prices_df['A'] = np.linspace(100, 120, len(all_dates)) # +20%
        prices_df['B'] = np.linspace(100, 90, len(all_dates)) # -10%
        # A: 0.5 * 20% = +10%
        # B: 0.5 * -1 * -10% = +5%
        # Total = +15%
        
        metrics2 = risk.calculate_risk_metrics(prices_df)
        print(f"YTD Return 2: {metrics2.get('YTD_Return'):.4%}")
        
    else:
        print("Metrics returned None")

except Exception as e:
    print(f"Calculation failed: {e}")
    import traceback
    traceback.print_exc()
