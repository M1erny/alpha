
import sys
import os
import pandas as pd
import numpy as np

# Add local dir to path
sys.path.append(os.getcwd())

import risk

print("--- Fetching ---")
raw, fx = risk.fetch_data()
print(f"Raw shape: {raw.shape}")

print("--- Normalizing ---")
usd_prices = risk.normalize_to_base_currency(raw, fx)
print(f"USD Prices shape: {usd_prices.shape}")

print("--- Calculating Metrics ---")
metrics = risk.calculate_risk_metrics(usd_prices)

if metrics:
    print("Metrics Keys:", metrics.keys())
    ytd_stream = metrics.get('YTD_Stream')
    if ytd_stream is not None:
        print(f"YTD_Stream Type: {type(ytd_stream)}")
        print(f"YTD_Stream Empty: {ytd_stream.empty}")
        print(f"YTD_Stream Head:\n{ytd_stream.head()}")
    else:
        print("YTD_Stream is None!")
else:
    print("Metrics is None")
