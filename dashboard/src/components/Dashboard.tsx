import React, { useEffect, useState } from 'react';
import { fetchDashboardData, type FullRiskReport } from '../utils/finance';
import { AlertTriangle } from 'lucide-react';
import { Header } from './dashboard/Header';
import { ExecutiveSummary } from './dashboard/ExecutiveSummary';
import { VitalsGrid } from './dashboard/VitalsGrid';
import { ChartsSection } from './dashboard/ChartsSection';
import { RiskAnalysis } from './dashboard/RiskAnalysis';
import { PositionsTable } from './dashboard/PositionsTable';

export const Dashboard: React.FC = () => {
    const [data, setData] = useState<FullRiskReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [statusMsg, setStatusMsg] = useState("Initializing...");

    useEffect(() => {
        let isActive = true;
        const pollStatus = async () => {
            if (!isActive) return;
            try {
                // Change localhost to 127.0.0.1 to avoid IPv6 resolution delays on Windows
                const statusRes = await fetch('http://127.0.0.1:8000/api/status');
                const statusData = await statusRes.json();

                if (statusData.state === 'ready') {
                    setStatusMsg("Loading Metrics...");
                    const metricsRes = await fetchDashboardData();
                    if (metricsRes) {
                        // Fix date string handling if needed
                        setData(metricsRes);
                        setConnectionError(null);
                        setStatusMsg("System Online");
                    } else {
                        setConnectionError("Failed to load dashboard data.");
                    }
                    setLoading(false);
                } else if (statusData.state === 'error') {
                    setStatusMsg(`Error: ${statusData.message}`);
                    setTimeout(pollStatus, 2000);
                } else {
                    setStatusMsg(statusData.message || "Calculating Risk...");
                    setTimeout(pollStatus, 1000);
                }
            } catch (e) {
                console.error("Backend offline?", e);
                setStatusMsg("Connecting to Backend (127.0.0.1:8000)...");
                setTimeout(pollStatus, 2000);
            }
        };

        setStatusMsg("Establishing Connection...");
        pollStatus();
        return () => { isActive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Loading Screen
    if (loading && !data) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
                {/* Fallback to dark background if Tailwind variable fails */}
                <div className="absolute inset-0 bg-[#020617] -z-10" />

                <div className="flex flex-col items-center gap-6 max-w-md text-center p-6 border border-white/10 rounded-xl bg-white/5 backdrop-blur">
                    <div className="relative">
                        <div className="h-16 w-16 animate-spin rounded-full border-4 border-emerald-500/30 border-t-emerald-500" />
                        <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-emerald-500 font-bold">
                            AI
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold tracking-tight text-white">Institutional Risk Engine</h2>
                        <p className="text-sm text-gray-400 font-mono bg-white/5 px-3 py-1 rounded-full animate-pulse border border-white/10">
                            {statusMsg}
                        </p>
                    </div>
                    <div className="text-xs text-gray-500 max-w-xs">
                        Fetching 26+ live data points, calculating MCTR, running Monte Carlo simulations (60 days)...
                    </div>
                </div>
            </div>
        )
    }

    // Connection Error Screen
    if (connectionError && !data) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
                <div className="absolute inset-0 bg-[#020617] -z-10" />
                <div className="flex flex-col items-center gap-6 max-w-md text-center p-6 border border-red-500/20 rounded-xl bg-red-950/10 backdrop-blur">
                    <AlertTriangle className="h-16 w-16 text-red-500" />
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold tracking-tight text-white">Connection Failed</h2>
                        <p className="text-sm text-gray-300">
                            {connectionError}
                        </p>
                        <p className="text-xs text-gray-500">
                            Ensure backend is running on 127.0.0.1:8000
                        </p>
                    </div>
                    <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors">
                        Retry Connection
                    </button>
                </div>
            </div>
        )
    }

    // Safety check just in case
    if (!data) return null;

    const { vitals, leverage, riskAttribution, stressTests, history, periodicReturns, ytdHistory, error: backendError } = data;

    return (
        <div className="min-h-screen bg-background text-foreground p-6 md:p-8">
            {/* Fallback bg */}
            <div className="absolute inset-0 bg-[#020617] -z-20" />

            {backendError && (
                <div className="mb-6 p-4 border border-amber-500/30 bg-amber-500/10 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                        <h3 className="text-sm font-medium text-amber-400">Data Warning</h3>
                        <p className="text-sm text-gray-300 mt-1">{backendError}</p>
                        <p className="text-xs text-gray-500 mt-1">Displayed data may be incomplete or assume zero values.</p>
                    </div>
                </div>
            )}

            <div className="mx-auto max-w-[1600px] space-y-8 relative z-10">

                <Header
                    statusMsg={statusMsg}
                    connectionError={connectionError}
                    lastUpdated={vitals.periodInfo?.End_Date}
                />

                <ExecutiveSummary vitals={vitals} />

                <VitalsGrid vitals={vitals} />

                <ChartsSection history={history} ytdHistory={ytdHistory} leverage={leverage} />

                <div className="grid gap-6 lg:grid-cols-3 h-auto">
                    {/* Reordered: Stress Tests (RiskAnalysis) first, then Positions Table */}
                    <div className="lg:col-span-3">
                        {/* Split RiskAnalysis and PositionsTable into their own rows or grid columns as needed */}
                        {/* Original layout had Stress (1/3) + Heatmap (1/3) + Table (1/3)?? No. */}
                        {/* Original: Row 3 was Stress + Heatmap + Table (3 cols) */}
                        {/* Let's replicate that layout */}
                    </div>
                </div>

                {/* Replicating the 3-column layout at the bottom */}
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Risk Analysis contains Stress Tests and Heatmap (which were 2 columns originally) */}
                    {/* But RiskAnalysis component I made creates a 2-column grid inside it! */}
                    {/* So if I put RiskAnalysis in col-span-2, it will work. */}

                    <div className="lg:col-span-2">
                        <RiskAnalysis
                            stressTests={stressTests}
                            riskAttribution={riskAttribution}
                            periodicReturns={periodicReturns}
                        />
                    </div>

                    <div className="lg:col-span-1">
                        <PositionsTable
                            riskAttribution={riskAttribution}
                            periodicReturns={periodicReturns}
                            vitals={vitals}
                        />
                    </div>
                </div>

            </div>
        </div >
    );
};
