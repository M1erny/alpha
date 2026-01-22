
import sys
import os
import pandas as pd
import yfinance as yf

# Add directory to path
sys.path.append(os.getcwd())

import risk

print("Fetching data...")
raw_prices, fx_rates = risk.fetch_data()
print(f"Raw Prices Shape: {raw_prices.shape}")
print(f"Raw Prices Head:\n{raw_prices.head()}")
print(f"FX Rates Shape: {fx_rates.shape}")

print("Normalizing...")
usd_prices = risk.normalize_to_base_currency(raw_prices, fx_rates)
print(f"USD Prices Shape: {usd_prices.shape}")
print(f"USD Prices Head:\n{usd_prices.head()}")

if usd_prices.empty:
    print("USD Prices is EMPTY!")
