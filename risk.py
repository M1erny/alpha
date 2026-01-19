import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta


# ==========================================
# 1. CONFIGURATION: Define Your Portfolio
# ==========================================
PORTFOLIO_CONFIG = {
    # --- LONG POSITIONS (150% Target) ---
    'AFRM':      {'weight': 0.20, 'type': 'Long', 'currency': 'USD'},
    'INPST.AS':  {'weight': 0.15, 'type': 'Long', 'currency': 'EUR'},
    'HARVIA.HE': {'weight': 0.15, 'type': 'Long', 'currency': 'EUR'},
    'BFT.WA':    {'weight': 0.15, 'type': 'Long', 'currency': 'PLN'},
    'NBIS':      {'weight': 0.05, 'type': 'Long', 'currency': 'USD'},
    'CDR.WA':    {'weight': 0.10, 'type': 'Long', 'currency': 'PLN'},
    '3659.T':    {'weight': 0.05, 'type': 'Long', 'currency': 'JPY'},
    'XTB.WA':    {'weight': 0.10, 'type': 'Long', 'currency': 'PLN'},
    'BRK-B':     {'weight': 0.10, 'type': 'Long', 'currency': 'USD'},
    'EQT':       {'weight': 0.10, 'type': 'Long', 'currency': 'USD'},
    'META':      {'weight': 0.10, 'type': 'Long', 'currency': 'USD'},
    'PSKY':      {'weight': 0.05, 'type': 'Long', 'currency': 'USD'}, # Updated Ticker
    'SWM.WA':    {'weight': 0.05, 'type': 'Long', 'currency': 'PLN'},
    'RBLX':      {'weight': 0.05, 'type': 'Long', 'currency': 'USD'},
    'SNAP':      {'weight': 0.05, 'type': 'Long', 'currency': 'USD'},
    'MU':        {'weight': 0.02, 'type': 'Long', 'currency': 'USD'},
    '000660.KS': {'weight': 0.02, 'type': 'Long', 'currency': 'KRW'},

    # --- SHORT POSITIONS (70% Target) ---
    'MSFT':      {'weight': 0.20, 'type': 'Short', 'currency': 'USD'},
    '7974.T':    {'weight': 0.10, 'type': 'Short', 'currency': 'JPY'},
    'JMT.LS':    {'weight': 0.075, 'type': 'Short', 'currency': 'EUR'},
    'CARL-B.CO': {'weight': 0.075, 'type': 'Short', 'currency': 'DKK'},
    'F':         {'weight': 0.075, 'type': 'Short', 'currency': 'USD'},
    'ABI.BR':    {'weight': 0.075, 'type': 'Short', 'currency': 'EUR'},
    'BDX.WA':    {'weight': 0.05, 'type': 'Short', 'currency': 'PLN'},
    'STLA':      {'weight': 0.05, 'type': 'Short', 'currency': 'USD'},
}

BENCHMARK = 'SPY'
BASE_CURRENCY = 'USD'
LOOKBACK_YEARS = 6

# Cost of Carry Assumptions
MARGIN_RATE = 0.055 # 5.5% on borrowed cash
BORROW_FEE = 0.01   # 1.0% hard-to-borrow fee estimate





# ==========================================
# 2. DATA ENGINE: Fetch & Normalize
# ==========================================
def fetch_data():
    print("--- 1. Initializing Data Download ---")
    
    tickers = list(PORTFOLIO_CONFIG.keys())
    tickers.append(BENCHMARK)
    
    # Identify unique currencies
    currencies = list(set([item['currency'] for item in PORTFOLIO_CONFIG.values()]))
    fx_pairs = []
    for curr in currencies:
        if curr != BASE_CURRENCY:
            fx_pairs.append(f"{curr}{BASE_CURRENCY}=X")
    
    start_date = (datetime.now() - timedelta(days=LOOKBACK_YEARS*365)).strftime('%Y-%m-%d')
    
    print(f"Fetching stock data for {len(tickers)} tickers...")
    stock_raw = yf.download(tickers, start=start_date, auto_adjust=True)
    
    # Handle Data Structure (MultiIndex vs Single)
    if isinstance(stock_raw.columns, pd.MultiIndex):
        try:
            stock_data = stock_raw['Close']
        except KeyError:
             stock_data = stock_raw.xs('Close', axis=1, level=0, drop_level=True)
    elif 'Close' in stock_raw.columns:
         stock_data = stock_raw['Close']
    else:
        stock_data = stock_raw
        
    print(f"Fetching FX rates for: {fx_pairs}...")
    fx_raw = yf.download(fx_pairs, start=start_date, auto_adjust=True)
    
    if isinstance(fx_raw.columns, pd.MultiIndex):
        try:
            fx_data = fx_raw['Close']
        except KeyError:
             fx_data = fx_raw.xs('Close', axis=1, level=0, drop_level=True)
    elif 'Close' in fx_raw.columns:
         fx_data = fx_raw['Close']
    else:
        fx_data = fx_raw

    return stock_data, fx_data

def normalize_to_base_currency(stock_df, fx_df):
    print("--- 2. Normalizing Currencies to USD ---")
    normalized_df = stock_df.copy()
    
    for ticker, info in PORTFOLIO_CONFIG.items():
        if ticker not in normalized_df.columns:
            print(f"Warning: Data for {ticker} not found (Might be new or delisted). Skipping.")
            continue
            
        currency = info['currency']
        if currency == BASE_CURRENCY:
            continue 
            
        fx_ticker = f"{currency}{BASE_CURRENCY}=X"
        
        if fx_ticker in fx_df.columns:
            fx_series = fx_df[fx_ticker].reindex(normalized_df.index).ffill()
            normalized_df[ticker] = normalized_df[ticker] * fx_series
        else:
            print(f"Error: FX data missing for {currency}. Calculations for {ticker} might be wrong.")
            
    return normalized_df

# ==========================================
# 3. RISK CALCULATOR
# ==========================================
# ==========================================
# 3. RISK CALCULATOR (ADVANCED)
# ==========================================
def calculate_risk_metrics(price_df):
    print("--- 3. Calculating Advanced Risk Metrics ---")
    
    returns_df = price_df.pct_change().fillna(0) # Use 0 for missing history
    
    if BENCHMARK not in returns_df.columns:
        print(f"Critical Error: Benchmark {BENCHMARK} data missing.")
        return None

    benchmark_ret = returns_df[BENCHMARK]
    
    # --- 1. PREPARE PORTFOLIO RETURNS ---
    # Construct a weighted portfolio return series
    portfolio_daily_ret = pd.Series(0.0, index=returns_df.index)
    
    # Track Gross Exposure for Leverage Calc
    total_long_weight = 0
    total_short_weight = 0
    
    active_tickers = []
    
    # We need to normalize weights to 100% of invested capital for some metrics,
    # but for risk attribution, we use the actual exposure weights.
    
    for ticker, info in PORTFOLIO_CONFIG.items():
        if ticker in returns_df.columns:
            weight = info['weight']
            direction = 1 if info['type'] == 'Long' else -1
            
            if direction == 1: total_long_weight += weight
            else: total_short_weight += weight
            
            # If ticker didn't exist yet (return is 0), it contributes 0.
            # This implicitly assumes "Cash" was held instead.
            portfolio_daily_ret += returns_df[ticker] * weight * direction
            active_tickers.append(ticker)

    # --- 1.5 LEVERAGE COST (DRAG) ---
    # Daily Cost = (Net Debit * Margin / 360) + (Gross Short * Borrow / 360)
    # Net Debit = Max(0, Long Exposure - 1.0) -> Assuming 1.0 is our Equity
    
    net_debit = max(0, total_long_weight - 1.0)
    daily_margin_cost = (net_debit * MARGIN_RATE) / 360
    daily_borrow_cost = (total_short_weight * BORROW_FEE) / 360
    total_daily_drag = daily_margin_cost + daily_borrow_cost
    
    # Net Returns (After Cost)
    portfolio_net_ret = portfolio_daily_ret - total_daily_drag

    # --- 2. CORE METRICS ---
    # Annualize factor
    ANNUAL_FACTOR = 252
    
    # Beta
    covariance = np.cov(portfolio_daily_ret, benchmark_ret)[0][1]
    market_variance = np.var(benchmark_ret)
    portfolio_beta = covariance / market_variance
    
    # Volatility (Annualized)
    daily_vol = np.std(portfolio_daily_ret)
    annual_vol = daily_vol * np.sqrt(ANNUAL_FACTOR)
    
    # Returns (Annualized)
    avg_daily_ret = np.mean(portfolio_daily_ret)
    annual_ret = avg_daily_ret * ANNUAL_FACTOR
    
    # Sharpe Ratio (assuming Risk Free Rate = 4%)
    rf_rate = 0.04
    sharpe_ratio = (annual_ret - rf_rate) / annual_vol if annual_vol > 0 else 0
    
    # Sortino Ratio (Downside Risk only)
    downside_returns = portfolio_daily_ret[portfolio_daily_ret < 0]
    downside_std = np.std(downside_returns) * np.sqrt(ANNUAL_FACTOR)
    sortino_ratio = (annual_ret - rf_rate) / downside_std if downside_std > 0 else 0
    
    # --- 3. TAIL RISK ---
    # VaR 95% (Historical)
    var_95 = np.percentile(portfolio_daily_ret, 5)
    
    # CVaR 95% (Expected Shortfall) - Average of losses exceeding VaR
    cvar_95 = portfolio_daily_ret[portfolio_daily_ret <= var_95].mean()
    
    # Max Drawdown
    cum_ret = (1 + portfolio_daily_ret).cumprod()
    running_max = cum_ret.cummax()
    drawdown = (cum_ret - running_max) / running_max
    max_drawdown = drawdown.min()

    # --- 4. RISK ATTRIBUTION (MCTR) ---
    # Marginal Contribution to Total Risk
    # Formula: MCTR_i = (Cov(R_i, R_p) / Std(R_p)) * Weight_i
    
    risk_contribution = {}
    total_risk_sum = 0
    
    if daily_vol > 0:
        for ticker in active_tickers:
            info = PORTFOLIO_CONFIG[ticker]
            weight = info['weight']
            direction = 1 if info['type'] == 'Long' else -1 # Directional weight
            signed_weight = weight * direction
            
            asset_ret = returns_df[ticker]
            # Covariance between Asset and Portfolio
            cov_asset_port = np.cov(asset_ret, portfolio_daily_ret)[0][1]
            
            # Marginal Contribution to Volatility
            mctr = (cov_asset_port * signed_weight) / daily_vol
            
            # Percent contribution to total volatility
            pct_contribution = mctr / daily_vol
            
            risk_contribution[ticker] = {
                'MCTR': mctr,
                'Pct_Risk': pct_contribution,
                'Weight': signed_weight
            }
            total_risk_sum += mctr

            total_risk_sum += mctr
            
    # --- 4.5 CAPM Metrics (Jensen's Alpha) ---
    # Alpha = Rp - (Rf + Beta * (Rm - Rf))
    # We need annualized benchmark return for this
    avg_bench_ret = np.mean(benchmark_ret)
    annual_bench_ret = avg_bench_ret * ANNUAL_FACTOR
    
    expected_return = rf_rate + portfolio_beta * (annual_bench_ret - rf_rate)
    jensens_alpha = annual_ret - expected_return
    
    # Metadata for transparency
    calc_start_date = returns_df.index[0].strftime('%Y-%m-%d')
    calc_end_date = returns_df.index[-1].strftime('%Y-%m-%d')
    period_years = (returns_df.index[-1] - returns_df.index[0]).days / 365.25

    # --- 5. YTD METRICS ---
    current_year = datetime.now().year
    ytd_start = f"{current_year}-01-01"
    
    # Filter for YTD data
    with open("debug_risk.txt", "w") as f:
        f.write(f"DEBUG: YTD Start: {ytd_start}\n")
        f.write(f"DEBUG: Data Range: {portfolio_daily_ret.index[0]} to {portfolio_daily_ret.index[-1]}\n")
        f.write(f"DEBUG: Sample Index: {portfolio_daily_ret.index[:5]}\n")
    
    # Ensure timezone handling works (strip tz if present for simple comparison)
    if hasattr(portfolio_daily_ret.index, 'tz'):
        portfolio_daily_ret.index = portfolio_daily_ret.index.tz_localize(None)
    if hasattr(benchmark_ret.index, 'tz'):
        benchmark_ret.index = benchmark_ret.index.tz_localize(None)

    ytd_portfolio = portfolio_daily_ret[portfolio_daily_ret.index >= ytd_start]
    
    with open("debug_risk.txt", "a") as f:
        f.write(f"DEBUG: YTD Rows Found: {len(ytd_portfolio)}\n")
    
    ytd_benchmark = benchmark_ret[benchmark_ret.index >= ytd_start]
    
    if not ytd_portfolio.empty:
        # Cumulative Return
        ytd_return = (1 + ytd_portfolio).prod() - 1
        benchmark_ytd = (1 + ytd_benchmark).prod() - 1
        
        # YTD Beta
        if np.var(ytd_benchmark) > 0:
            ytd_beta = np.cov(ytd_portfolio, ytd_benchmark)[0][1] / np.var(ytd_benchmark)
        else:
            ytd_beta = 0
            
        # Risk Efficiency (Return / Vol)
        # Annualized Vol for YTD
        ytd_vol = np.std(ytd_portfolio) * np.sqrt(ANNUAL_FACTOR)
        risk_efficiency = ytd_return / ytd_vol if ytd_vol > 0 else 0
        
        # Benchmark Sharpe (approx)
        bench_vol = np.std(ytd_benchmark) * np.sqrt(ANNUAL_FACTOR)
        bench_sharpe = (benchmark_ytd * (252/len(ytd_benchmark)) - 0.04) / bench_vol if bench_vol > 0 else 0
        
    else:
        ytd_return = 0.0
        benchmark_ytd = 0.0
        ytd_beta = 0.0
        risk_efficiency = 0.0
        bench_sharpe = 0.0

    with open("debug_risk.txt", "a") as f:
        f.write(f"DEBUG: YTD Return: {ytd_return}\n")
        f.write(f"DEBUG: Bench YTD: {benchmark_ytd}\n")
        f.write(f"DEBUG: YTD Portfolio Sample: {ytd_portfolio.tolist()[:5]}\n")

    return {
        'Beta': portfolio_beta,
        'Annual_Return': annual_ret,
        'Annual_Vol': annual_vol,
        'Sharpe': sharpe_ratio,
        'Sortino': sortino_ratio,
        'VaR_95': var_95,
        'CVaR_95': cvar_95,
        'Max_Drawdown': max_drawdown,
        'Jensens_Alpha': jensens_alpha,
        'Period_Info': {
            'Start_Date': calc_start_date,
            'End_Date': calc_end_date,
            'Years': round(period_years, 1)
        },
        'YTD_Return': ytd_return,
        'Benchmark_YTD': benchmark_ytd,
        'YTD_Beta': ytd_beta,
        'Risk_Efficiency': risk_efficiency,
        'Benchmark_Sharpe': bench_sharpe,
        'Returns_Stream': portfolio_daily_ret,
        'Net_Stream': portfolio_net_ret, # Post-fee
        'Benchmark_Stream': benchmark_ret, 
        'Drawdown_Stream': drawdown,
        'Risk_Attribution': risk_contribution,
        'Correlation_Matrix': returns_df.corr(),
        'Leverage_Stats': {
            'Long_Exp': total_long_weight,
            'Short_Exp': total_short_weight,
            'Daily_Drag': total_daily_drag
        }
    }

def stress_test_portfolio(metrics):
    print("--- 4. Running Stress Tests ---")
    if metrics is None: return {}
    
    beta = metrics['Beta']
    
    # Simple Beta-based Stress Testing
    scenarios = {
        'Market Crash (-10%)': -0.10,
        'Market Correction (-5%)': -0.05,
        'Market Rally (+5%)': 0.05,
        'Market Surge (+10%)': 0.10
    }
    
    results = {}
    for name, mkt_move in scenarios.items():
        # Estimated Portfolio Move = Beta * Market Move
        # (This is a linear approximation, assuming correlations hold 1.0)
        est_move = beta * mkt_move
        results[name] = est_move
        
    return results

def run_monte_carlo(metrics, num_sims=1000, days=60):
    print(f"--- 5. Running Monte Carlo Simulation ({num_sims} paths, {days} days) ---")
    if metrics is None: return None
    
    annual_vol = metrics['Annual_Vol']
    # Geometric Brownian Motion Parameters
    # drift = r - 0.5 * sigma^2
    rf_rate = 0.04 
    dt = 1/252
    
    drift = rf_rate - 0.5 * annual_vol**2
    
    # Simulation: S_t = S_0 * exp((mu - 0.5*sigma^2)*t + sigma*W_t)
    # We simulate daily returns then cumulate
    
    # Z is a matrix of random normal variables (num_sims, days)
    Z = np.random.normal(0, 1, (num_sims, days))
    
    # Daily Returns
    daily_returns = np.exp(drift * dt + annual_vol * np.sqrt(dt) * Z)
    
    # Path Generation (Cumulative Product)
    price_paths = np.zeros((num_sims, days + 1))
    price_paths[:, 0] = 1.0 # Start at 1.0
    
    for t in range(1, days + 1):
        price_paths[:, t] = price_paths[:, t-1] * daily_returns[:, t-1]
        
    return price_paths

def calculate_periodic_returns(data):
    print("--- 6. Calculating Periodic Returns (1Y, 3Y, 5Y) ---")
    periods = {
        '1Y': 252,
        '3Y': 252 * 3,
        '5Y': 252 * 5
    }
    
    results = {}
    
    for ticker in data.columns:
        series = data[ticker].dropna()
        if series.empty: continue
        
        current_price = series.iloc[-1]
        ticker_res = {}
        
        for p_name, days in periods.items():
            if len(series) > days:
                past_price = series.iloc[-(days+1)]
                ret = (current_price - past_price) / past_price
                ticker_res[p_name] = ret
            else:
                ticker_res[p_name] = np.nan 
                
        results[ticker] = ticker_res
        
    return pd.DataFrame(results).T

# ==========================================
# 4. VISUALIZATION
# ==========================================
# ==========================================
# 4. VISUALIZATION & REPORTING
# ==========================================
def generate_report(metrics, data):
    if metrics is None: return

    print("\n" + "="*50)
    print(f"      HEDGE FUND RISK REPORT ({datetime.now().strftime('%Y-%m-%d')})      ")
    print("="*50)
    
    # --- 0. PERIODIC RETURNS (Print First) ---
    periodic_rets = calculate_periodic_returns(data)
    
    print(f"\n[INDIVIDUAL TICKER PERFORMANCE]")
    print(f"  {'TICKER':<10} | {'1 YEAR':<10} | {'3 YEARS':<10} | {'5 YEARS':<10}")
    print("-" * 55)
    
    # Sort by 1Y return for display
    sorted_periodic = periodic_rets.sort_values('1Y', ascending=False)
    
    for ticker, row in sorted_periodic.iterrows():
        r1y = f"{row['1Y']:.1%}" if not np.isnan(row['1Y']) else "N/A"
        r3y = f"{row['3Y']:.1%}" if not np.isnan(row['3Y']) else "N/A"
        r5y = f"{row['5Y']:.1%}" if not np.isnan(row['5Y']) else "N/A"
        
        print(f"  {ticker:<10} | {r1y:<10} | {r3y:<10} | {r5y:<10}")
    
    # --- SUMMARY STATS ---
    print(f"\n[PORTFOLIO VITALS]")
    print(f"  Beta:             {metrics['Beta']:.2f}")
    print(f"  Sharpe Ratio:     {metrics['Sharpe']:.2f}")
    print(f"  Sortino Ratio:    {metrics['Sortino']:.2f}")
    print(f"  Ann. Volatility:  {metrics['Annual_Vol']:.1%}")
    print(f"  Max Drawdown:     {metrics['Max_Drawdown']:.1%}")
    
    print(f"\n[TAIL RISK]")
    print(f"  VaR (95% Daily):  {metrics['VaR_95']:.2%}  (Loss exceeded 5% of days)")
    print(f"  CVaR (95% Daily): {metrics['CVaR_95']:.2%}  (Arg loss on bad days)")
    print(f"  *On $100k, Exp. Shortfall is ~${abs(metrics['CVaR_95']*100000):.0f} per day in crisis.*")

    # --- STRESS TEST ---
    stress_results = stress_test_portfolio(metrics)
    print(f"\n[STRESS TESTS (Linear Beta Approximation)]")
    for scenario, result in stress_results.items():
        print(f"  {scenario:<25} -> PnL Impact: {result:+.2%}")

    # --- RISK ATTRIBUTION ---
    print(f"\n[RISK ATTRIBUTION (Top Drivers of Volatility)]")
    sorted_risk = sorted(metrics['Risk_Attribution'].items(), key=lambda x: x[1]['Pct_Risk'], reverse=True)
    
    print(f"  {'TICKER':<10} | {'WEIGHT':<8} | {'% TOTAL RISK':<12} | {'COMMENT'}")
    print("-" * 60)
    
    for ticker, stats in sorted_risk[:8]: # Top 8
        pct_risk = stats['Pct_Risk']
        weight = stats['Weight']
        comment = "High Risk Efficiency" if abs(pct_risk) < abs(weight) else "Volatile!"
        print(f"  {ticker:<10} | {weight:<8.1%} | {pct_risk:<12.1%} | {comment}")

    # --- PLOTS ---
    # 1. Dashboard Plot
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    fig.suptitle('Institutional Risk Dashboard', fontsize=16)
    
    # A. Current Correlations
    valid_tickers = [t for t in PORTFOLIO_CONFIG.keys() if t in data.columns]
    corr_matrix = metrics['Correlation_Matrix'].loc[valid_tickers, valid_tickers]
    sns.heatmap(corr_matrix, ax=axes[0,0], cmap='RdBu', center=0, annot=False, cbar=True)
    axes[0,0].set_title('Correlation Heatmap')
    
    # B. Cumulative Returns (Alpha Check)
    cum_returns = (1 + metrics['Returns_Stream']).cumprod()
    cum_bench = (1 + metrics['Benchmark_Stream']).cumprod()
    
    final_port_ret = cum_returns.iloc[-1] - 1
    final_bench_ret = cum_bench.iloc[-1] - 1
    alpha = final_port_ret - final_bench_ret
    
    axes[0,1].plot(cum_returns, color='green', linewidth=2, label=f'Portfolio ({final_port_ret:+.1%})')
    axes[0,1].plot(cum_bench, color='gray', linestyle='--', alpha=0.7, label=f'Market ({final_bench_ret:+.1%})')
    
    axes[0,1].set_title(f'Alpha Check (Excess Ret: {alpha:+.1%})')
    axes[0,1].legend()
    axes[0,1].grid(True, alpha=0.3)
    
    # C. Drawdowns
    drawdown = metrics['Drawdown_Stream']
    axes[1,0].fill_between(drawdown.index, drawdown, 0, color='red', alpha=0.3)
    axes[1,0].plot(drawdown, color='red', lw=1)
    axes[1,0].set_title('Underwater Plot (Drawdowns)')
    axes[1,0].grid(True, alpha=0.3)
    
    # D. Risk Contribution Bar Chart
    tickers = [x[0] for x in sorted_risk]
    vals = [x[1]['Pct_Risk'] for x in sorted_risk]
    colors = ['red' if v > 0 else 'green' for v in vals] # Short positions adding risk are usually hedging (negative risk contrib), if positive they add risk
    
    axes[1,1].bar(tickers[:10], vals[:10], color='purple')
    axes[1,1].set_title('Top Risk Contributors (%)')
    axes[1,1].tick_params(axis='x', rotation=45)
    
    # 2. Future Scenarios Plot (New Figure)
    fig2, axes2 = plt.subplots(1, 2, figsize=(15, 6))
    fig2.suptitle('Future Scenarios: "What happens next?"', fontsize=16)
    
    # E. Monte Carlo Cone
    mc_paths = run_monte_carlo(metrics)
    if mc_paths is not None:
        days = mc_paths.shape[1] - 1
        x_axis = range(days + 1)
        
        # Percentiles
        p5 = np.percentile(mc_paths, 5, axis=0)
        p50 = np.percentile(mc_paths, 50, axis=0)
        p95 = np.percentile(mc_paths, 95, axis=0)
        p1 = np.percentile(mc_paths, 1, axis=0) # Worst case
        
        axes2[0].plot(x_axis, p50, color='blue', lw=2, label='Median Path')
        axes2[0].fill_between(x_axis, p5, p95, color='blue', alpha=0.2, label='90% Confidence Cone')
        axes2[0].plot(x_axis, p1, color='red', linestyle='--', lw=1, label='Worst Case (1%)')
        
        axes2[0].set_title(f'Monte Carlo: Next {days} Days (1000 Sims)')
        axes2[0].set_ylabel('Portfolio Value (Start=1.0)')
        axes2[0].set_xlabel('Trading Days Ahead')
        axes2[0].legend()
        axes2[0].grid(True, alpha=0.3)
        
    # F. Stress Test Bar Chart
    scenarios = list(stress_results.keys())
    impacts = list(stress_results.values())
    colors_stress = ['red' if x < 0 else 'green' for x in impacts]
    
    axes2[1].barh(scenarios, impacts, color=colors_stress)
    axes2[1].set_title('Stress Test PnL Impact')
    axes2[1].set_xlabel('Estimated Return')
    axes2[1].grid(True, alpha=0.3)
    # Add value labels
    for i, v in enumerate(impacts):
        axes2[1].text(v if v > 0 else 0, i, f' {v:+.1%}', va='center')

    plt.tight_layout()
    plt.show()


    # 3. Leverage & Ticker Performance (New Figure)
    periodic_rets = calculate_periodic_returns(data)
    
    fig3, axes3 = plt.subplots(1, 2, figsize=(16, 8))
    fig3.suptitle('Leverage Impact & Asset Performance', fontsize=16)
    
    # G. Gross vs Net Equity Curve
    gross_curve = (1 + metrics['Returns_Stream']).cumprod()
    net_curve = (1 + metrics['Net_Stream']).cumprod()
    
    axes3[0].plot(gross_curve, color='green', linestyle='--', label='Gross Return (Pre-Fee)')
    axes3[0].plot(net_curve, color='darkgreen', linewidth=2, label='Net Return (Post-Fee)')
    
    lev_stats = metrics['Leverage_Stats']
    cost_text = (f"Leverage Profile:\n"
                 f"Long: {lev_stats['Long_Exp']:.0%}\n"
                 f"Short: {lev_stats['Short_Exp']:.0%}\n\n"
                 f"Est Annual Drag: -{lev_stats['Daily_Drag']*360:.1%}")
    
    axes3[0].text(0.05, 0.95, cost_text, transform=axes3[0].transAxes, 
                  verticalalignment='top', bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
    
    axes3[0].set_title('Cost of Leverage: Gross vs Net')
    axes3[0].legend()
    axes3[0].grid(True, alpha=0.3)
    
    # H. Ticker Performance Heatmap
    # Prepare data for heatmap
    sorted_periodic = periodic_rets.sort_values('1Y', ascending=False)
    # Convert to numeric, handle NaNs
    heatmap_data = sorted_periodic.astype(float)
    
    # Annotations: Format as percentage string or "" if NaN
    annot_data = heatmap_data.applymap(lambda x: f"{x:.1%}" if not np.isnan(x) else "")
    
    sns.heatmap(heatmap_data, annot=annot_data, fmt="", cmap="RdYlGn", center=0, ax=axes3[1], cbar_kws={'label': 'Total Return'})
    axes3[1].set_title('Asset Performance Heatmap')
    
    plt.tight_layout()
    plt.show()

def audit_data_quality(df):
    print("\n" + "="*50)
    print("      DATA QUALITY AUDIT      ")
    print("="*50)
    
    expected_tickers = list(PORTFOLIO_CONFIG.keys())
    if BENCHMARK not in expected_tickers:
        expected_tickers.append(BENCHMARK)
        
    print(f"{'TICKER':<10} | {'START DATE':<12} | {'END DATE':<12} | {'ROWS':<5} | {'LAST PRICE ($)':<15} | {'STATUS'}")
    print("-" * 85)
    
    problem_tickers = []
    
    for ticker in expected_tickers:
        status = "OK"
        if ticker not in df.columns:
            print(f"{ticker:<10} | {'MISSING':<12} | {'MISSING':<12} | {'0':<5} | {'N/A':<15} | [CRITICAL FAILURE]")
            problem_tickers.append(ticker)
            continue
            
        valid_data = df[ticker].dropna()
        if valid_data.empty:
            print(f"{ticker:<10} | {'EMPTY':<12} | {'EMPTY':<12} | {'0':<5} | {'N/A':<15} | [NO DATA]")
            problem_tickers.append(ticker)
            continue
            
        start_date = valid_data.index[0].strftime('%Y-%m-%d')
        end_date = valid_data.index[-1].strftime('%Y-%m-%d')
        row_count = len(valid_data)
        last_price = valid_data.iloc[-1]
        
        if row_count < 200:
            status = "[WARNING: THIN DATA]"
        
        print(f"{ticker:<10} | {start_date:<12} | {end_date:<12} | {row_count:<5} | {last_price:<15.2f} | {status}")

    print("-" * 85)
    if problem_tickers:
        print(f"\n[!] CAUTION: The following tickers have issues and will distort your risk model: {problem_tickers}")
    else:
        print("\n[OK] All tickers have sufficient data coverage.")

if __name__ == "__main__":
    raw_prices, fx_rates = fetch_data()
    usd_prices = normalize_to_base_currency(raw_prices, fx_rates)
    audit_data_quality(usd_prices)
    metrics = calculate_risk_metrics(usd_prices)
    generate_report(metrics, usd_prices)