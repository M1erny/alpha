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
    r1y: number | null;
    r3y: number | null;
    r5y: number | null;
    ytd: number;
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

export interface FullRiskReport {
    vitals: Vitals;
    leverage: LeverageStats;
    riskAttribution: RiskAttribution[];
    stressTests: StressTest[];
    periodicReturns: PeriodicReturn[];
    monteCarlo: MonteCarloPoint[];
    history: HistoryPoint[];
    error?: string; // Optional error message from backend
}

export const fetchDashboardData = async (): Promise<FullRiskReport | null> => {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/metrics');
        if (!response.ok) {
            // Log detailed error for debugging
            const text = await response.text();
            console.error("Backend Error:", text);
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data as FullRiskReport;
    } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        return null;
    }
};
