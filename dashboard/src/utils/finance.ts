export interface Vitals {
    beta: number;
    annualReturn: number;
    annualVol: number;
    sharpe: number;
    sortino: number;
    maxDrawdown: number;
    var95: number;
    cvar95: number;
    ytdReturn: number;
    benchmarkYtd: number;
    benchmarkVol: number;
    benchmarkSharpe: number;
    ytdBeta: number;
    riskEfficiencyVol: number;
    riskEfficiencyBeta: number;
}

export interface LeverageStats {
    Long_Exp: number;
    Short_Exp: number;
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
}

export const fetchDashboardData = async (): Promise<FullRiskReport | null> => {
    try {
        const response = await fetch('http://localhost:8000/api/metrics');
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
