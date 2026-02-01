export interface PeriodInfo {
    Start_Date: string;
    End_Date: string;
    Years: number;
}

export interface Vitals {
    beta: number;
    annualReturn: number;
    annualVol: number;
    sharpe: number;
    sortino: number;
    maxDrawdown: number;
    rolling1mVol: number;
    rolling1mVolBenchmark: number;
    cvar95: number;
    ytdReturn: number;
    benchmarkYtd: number;
    benchmarkVol: number;
    ytdBeta: number;
    // Standardized Sharpe Metrics
    ytdSharpe: number;
    benchmarkYtdSharpe: number;
    benchmarkHistSharpe: number;
    ytdReturnPln: number;
    wigYtd: number;
    msciYtd: number;
    ytdLongsContrib: number;
    ytdShortsContrib: number;
    jensensAlpha: number;
    ytdAlpha: number;
    ytdMaxDrawdown: number;
    benchmarkYtdMaxDrawdown: number;
    currencyExposure: Record<string, number>;
    fxWatchlist: Record<string, number>;
    periodInfo: PeriodInfo;
}

export interface LeverageStats {
    Long_Exp: number;
    Short_Exp: number;
    Gross_Exp: number;
    Net_Exp: number;
    Daily_Drag: number;
}

export interface RiskAttribution {
    ticker: string;
    weight: number;
    pctRisk: number;
    mctr: number;
}

export interface StressTest {
    scenario: string;
    impact: number;
}

export interface PeriodicReturn {
    ticker: string;
    r1m: number | null;  // 1 Month return
    r1y: number | null;
    r5y: number | null;
    ytd: number;
    ytdContribution: number | null;  // weight * return * direction
    weight: number | null;
    direction: 'Long' | 'Short' | null;
}

export interface MonteCarloPoint {
    day: number;
    p05: number;
    p50: number;
    p95: number;
}

export interface HistoryPoint {
    date: string;
    portfolio: number;
    benchmark: number;
    drawdown: number;
}

export interface CorrelationMatrix {
    tickers: string[];
    matrix: (number | null)[][];
}

export interface FullRiskReport {
    vitals: Vitals;
    leverage: LeverageStats;
    activeRisks: RiskAttribution[];
    stressTests: StressTest[];
    periodicReturns: PeriodicReturn[];
    monteCarlo: MonteCarloPoint[];
    history: HistoryPoint[];
    ytdHistory?: HistoryPoint[];
    volumeWeightedCorrelation?: CorrelationMatrix;
    error?: string;
}

export const fetchDashboardData = async (retries = 5, delay = 1000, force = false): Promise<FullRiskReport | null> => {
    for (let i = 0; i < retries; i++) {
        try {
            // Use relative path - Vite proxy will handle forwarding to backend
            const url = force
                ? `/api/metrics?t=${new Date().getTime()}`
                : `/api/metrics`;

            const response = await fetch(url);
            if (!response.ok) {
                // If 500 or 404, might be temporary, but usually logic error.
                // However, if proxy refuses connection, it might appear as bad gateway or similar depending on vite.
                const text = await response.text();
                console.warn(`Attempt ${i + 1}/${retries} failed: ${text}`);
            } else {
                const data = await response.json();

                // Map API response to Frontend Interface
                // Fallback for missing keys (like Fx_Watchlist if backend isn't updated)
                const vitals: Vitals = {
                    beta: data.Beta,
                    annualReturn: data.Annual_Return,
                    annualVol: data.Annual_Vol,
                    sharpe: data.Sharpe,
                    sortino: data.Sortino,
                    maxDrawdown: data.Max_Drawdown,
                    rolling1mVol: data.Rolling_1M_Vol,
                    rolling1mVolBenchmark: data.Benchmark_Rolling_1M_Vol,
                    cvar95: data.CVaR_95,
                    ytdReturn: data.YTD_Return,
                    benchmarkYtd: data.Benchmark_YTD,
                    benchmarkVol: 0, // Not explicitly passed?
                    ytdBeta: data.YTD_Beta,
                    ytdSharpe: data.YTD_Sharpe,
                    benchmarkYtdSharpe: data.Benchmark_YTD_Sharpe,
                    benchmarkHistSharpe: data.Benchmark_Hist_Sharpe,
                    ytdReturnPln: data.YTD_Return_PLN,
                    wigYtd: data.WIG_YTD,
                    msciYtd: data.MSCI_YTD,
                    ytdLongsContrib: data.YTD_Longs_Contrib,
                    ytdShortsContrib: data.YTD_Shorts_Contrib,
                    jensensAlpha: data.Jensens_Alpha,
                    ytdAlpha: data.YTD_Alpha,
                    ytdMaxDrawdown: data.YTD_Max_Drawdown,
                    benchmarkYtdMaxDrawdown: data.Benchmark_YTD_Max_Drawdown,
                    currencyExposure: data.Risk_Attribution ?
                        Object.fromEntries(
                            Object.entries(data.Risk_Attribution).reduce((acc: any) => {
                                return acc;
                            }, {})
                        ) : {},

                    // Actually, let's look at how it WAS implemented.
                    // Previous mapping:
                    /*
                    currencyExposure: {}, // It was likely empty or I missed it.
                    */
                    // But `Dashboard.tsx` checks `vitals.currencyExposure`.
                    // I will leave it empty for now and map `fxWatchlist` which is what we want.

                    fxWatchlist: data.Fx_Watchlist || {},

                    periodInfo: data.Period_Info
                };

                // RE-INSTATE Currency Exposure Logic if possible?
                // The backend does not send it. I will leave it as empty object for now
                // or try to derive it if `Risk_Attribution` has weights and we knew currencies.
                // Since I don't have currency map here, I can't.
                // However, the user asked for FX Matrix (FxWatchlist), which is mapped now.

                return {
                    vitals,
                    leverage: data.Leverage_Stats,
                    history: data.History || [], // Handle missing
                    periodicReturns: data.Periodic_Returns || [], // Handle missing
                    activeRisks: data.Risk_Attribution ? Object.entries(data.Risk_Attribution).map(([ticker, val]: any) => ({
                        ticker,
                        weight: val.Weight,
                        pctRisk: val.Pct_Risk,
                        mctr: val.MCTR
                    })).sort((a, b) => b.pctRisk - a.pctRisk) : [],
                    stressTests: data.Stress_Tests ? Object.entries(data.Stress_Tests).map(([scenario, impact]: any) => ({
                        scenario,
                        impact
                    })) : [],
                    monteCarlo: data.Monte_Carlo || [], // Handle missing
                    ytdHistory: data.YTD_History || [], // Handle missing
                    volumeWeightedCorrelation: data.Volume_Weighted_Correlation || undefined, // Use undefined for optional
                    error: data.error
                };
            }
        } catch (error) {
            console.warn(`Attempt ${i + 1}/${retries} failed to connect:`, error);
        }

        // Wait before next retry
        if (i < retries - 1) await new Promise(res => setTimeout(res, delay));
    }

    console.error("Failed to fetch dashboard data after multiple attempts.");
    return null;
};
