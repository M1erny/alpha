import React, { useEffect, useState } from 'react';
import {
    fetchDashboardData, type FullRiskReport
} from '../utils/finance';
import { MetricCard } from './MetricCard';
import {
    LayoutDashboard, TrendingUp, Activity, Scale, ShieldCheck,
    PieChart, AlertTriangle, Zap, Clock
} from 'lucide-react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
    CartesianGrid, Legend, Treemap
} from 'recharts';
import { cn } from '../lib/utils';

export const Dashboard: React.FC = () => {
    const [data, setData] = useState<FullRiskReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [statusMsg, setStatusMsg] = useState("Initializing...");
    const [heatmapPeriod, setHeatmapPeriod] = useState<'ytd' | 'r1y' | 'r3y'>('ytd');

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
                    setData(metricsRes);
                    setLoading(false);
                } else if (statusData.state === 'error') {
                    setStatusMsg(`Error: ${statusData.message}`);
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
    }, []);

    const formatPercent = (val: number | undefined) => typeof val === 'number' ? `${(val * 100).toFixed(2)}%` : 'N/A';
    const formatNumber = (val: number | undefined) => typeof val === 'number' ? val.toFixed(2) : 'N/A';

    if (loading || !data) {
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

    const { vitals, leverage, riskAttribution, stressTests, history, periodicReturns } = data;

    return (
        <div className="min-h-screen bg-background text-foreground p-6 md:p-8">
            {/* Fallback bg */}
            <div className="absolute inset-0 bg-[#020617] -z-20" />

            <div className="mx-auto max-w-[1600px] space-y-8 relative z-10">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                            <LayoutDashboard className="h-8 w-8 text-primary" />
                            Institutional Risk Dashboard
                        </h1>
                        <p className="text-muted-foreground mt-1 flex items-center gap-2">
                            <span className="bg-white/10 px-2 py-0.5 rounded text-xs text-white">
                                {vitals.periodInfo?.Years} Years Data
                            </span>
                            <span>
                                {vitals.periodInfo?.Start_Date} — {vitals.periodInfo?.End_Date}
                            </span>
                        </p>
                    </div>
                    <div className="flex gap-4 text-sm text-right">
                        <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                            <p className="text-muted-foreground">Long Exposure</p>
                            <p className="font-mono text-emerald-400">{formatPercent(leverage.Long_Exp)}</p>
                        </div>
                        <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                            <p className="text-muted-foreground">Short Exposure</p>
                            <p className="font-mono text-rose-400">{formatPercent(leverage.Short_Exp)}</p>
                        </div>
                    </div>
                </div>

                {/* PREMIUM STATS BAR (YTD & Benchmark Comparison) */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-white/5 rounded-xl border border-white/10 p-4 backdrop-blur-md">
                    <div className="flex flex-col border-r border-white/10 pr-4 last:border-0 hidden md:flex">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Market Conditions</span>
                        <div className="mt-1">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">YTD Beta</span>
                                <span className="text-white font-mono">{formatNumber(vitals.ytdBeta)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400">Regime</span>
                                <span className={cn("font-mono", vitals.ytdBeta > 1 ? "text-amber-400" : "text-blue-400")}>
                                    {vitals.ytdBeta > 1 ? "Aggressive" : "Defensive"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col border-r border-white/10 pr-4 last:border-0 pl-4">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">2026 YTD Return</span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className={cn("text-2xl font-bold", vitals.ytdReturn >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                {vitals.ytdReturn > 0 ? "+" : ""}{formatPercent(vitals.ytdReturn)}
                            </span>
                            <span className="text-xs text-muted-foreground">vs {formatPercent(vitals.benchmarkYtd)} (SPY)</span>
                        </div>
                    </div>
                    <div className="flex flex-col border-r border-white/10 pr-4 last:border-0 pl-4">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider text-amber-400 font-bold">Jensen's Alpha (CAPM)</span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className={cn("text-2xl font-bold", vitals.jensensAlpha >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                {vitals.jensensAlpha > 0 ? "+" : ""}{formatPercent(vitals.jensensAlpha)}
                            </span>
                            <span className="text-xs text-muted-foreground">Annualized</span>
                        </div>
                    </div>
                    <div className="flex flex-col border-r border-white/10 pr-4 last:border-0 pl-4">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">YTD Sharpe Ratio</span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className={cn("text-2xl font-bold", vitals.ytdSharpe > 1 ? "text-emerald-400" : "text-white")}>
                                {formatNumber(vitals.ytdSharpe)}
                            </span>
                            <span className="text-xs text-muted-foreground">vs {formatNumber(vitals.benchmarkYtdSharpe)} (SPY)</span>
                        </div>
                    </div>
                    <div className="flex flex-col pl-4">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Sharpe (Hist Avg)</span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl font-bold text-amber-500">
                                {formatNumber(vitals.sharpe)}
                            </span>
                            <span className="text-xs text-muted-foreground">vs {formatNumber(vitals.benchmarkHistSharpe)} (SPY)</span>
                        </div>
                    </div>
                </div>

                {/* ROW 1: VITALS (6 Key Metrics) */}
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                    <MetricCard title="Annual Return" value={formatPercent(vitals.annualReturn)} icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} trend="up" />
                    <MetricCard title="Volatility" value={formatPercent(vitals.annualVol)} icon={<Activity className="h-4 w-4 text-blue-500" />} trend={vitals.annualVol > 0.2 ? 'down' : 'up'} />
                    <MetricCard title="Beta" value={formatNumber(vitals.beta)} icon={<Scale className="h-4 w-4 text-violet-500" />} />
                    <MetricCard title="Sharpe Ratio" value={formatNumber(vitals.sharpe)} icon={<Zap className="h-4 w-4 text-amber-500" />} />
                    <MetricCard title="Max Drawdown" value={formatPercent(vitals.maxDrawdown)} icon={<ShieldCheck className="h-4 w-4 text-rose-500" />} subValue="Peak to Trough" trend="down" />
                    <MetricCard title="Rolling 1M Vol" value={formatPercent(vitals.rolling1mVol)} icon={<AlertTriangle className="h-4 w-4 text-orange-500" />} description="Recent Volatility" />
                </div>

                {/* ROW 2: MAIN CHARTS (Performance + Underwater + Monte Carlo) */}
                <div className="grid gap-6 lg:grid-cols-3 h-[450px]">
                    {/* 1. Cumulative Performance (Long) */}
                    <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg flex flex-col">
                        <h3 className="text-lg font-semibold text-white mb-4">Cumulative Performance vs Benchmark</h3>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={history}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="date" hide />
                                    <YAxis domain={['auto', 'auto']} tickFormatter={(v) => `$${v}`} stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                                        formatter={(val: number | undefined) => [typeof val === 'number' ? `$${val.toFixed(0)}` : 'N/A', '']}
                                        labelStyle={{ color: '#94a3b8' }}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="benchmark" name="Market (SPY)" stroke="#64748b" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 2. Exposure History (Replacing Monte Carlo) */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg flex flex-col">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center justify-between">
                            Exposure Over Time
                            <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded">6Y</span>
                        </h3>
                        <div className="flex-1 min-h-0 flex items-center justify-center">
                            <div className="text-center text-gray-400">
                                <p className="text-sm">Gross: {formatPercent(leverage.Gross_Exp)}</p>
                                <p className="text-sm">Net: {formatPercent(leverage.Net_Exp)}</p>
                                <p className="text-xs mt-2 text-gray-500">Historical chart coming soon</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ROW 3: DETAILED ANALYSIS (Stress, Attribution, Periodic) */}
                <div className="grid gap-6 lg:grid-cols-3 h-[400px]">

                    {/* 1. Stress Tests */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg flex flex-col">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Zap className="h-4 w-4" /> Stress Scenarios
                        </h3>
                        <div className="flex-1 flex flex-col justify-center space-y-4">
                            {stressTests.map((test) => (
                                <div key={test.scenario} className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{test.scenario}</span>
                                        <span className={test.impact > 0 ? "text-emerald-400" : "text-rose-400"}>
                                            {formatPercent(test.impact)}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-white/5 rounded-full overflow-hidden relative">
                                        {/* Center line */}
                                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
                                        <div
                                            className={cn("h-full absolute top-0", test.impact > 0 ? "bg-emerald-500 left-1/2" : "bg-rose-500 right-1/2")}
                                            style={{ width: `${Math.min(Math.abs(test.impact * 100 * 3), 50)}%` }} // Visual scaling
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 2. Periodic Returns Treemap (Heatmap) */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg flex flex-col min-h-[400px]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Clock className="h-4 w-4" /> Asset Heatmap
                            </h3>
                            <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                                {(['ytd', 'r1y', 'r3y'] as const).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setHeatmapPeriod(p)}
                                        className={cn(
                                            "px-3 py-1 text-[10px] font-medium rounded-md transition-all uppercase tracking-wider",
                                            heatmapPeriod === p ? "bg-indigo-600 text-white shadow-sm" : "text-gray-400 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        {p === 'ytd' ? '2026' : p === 'r1y' ? '1Y' : '3Y'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <Treemap
                                    data={[{
                                        name: 'Portfolio',
                                        children: riskAttribution.map(item => {
                                            const retData = periodicReturns.find(p => p.ticker === item.ticker);
                                            let val = 0;
                                            if (retData) {
                                                if (heatmapPeriod === 'ytd') val = retData.ytd ?? 0;
                                                if (heatmapPeriod === 'r1y') val = retData.r1y ?? 0;
                                                if (heatmapPeriod === 'r3y') val = retData.r3y ?? 0;
                                            }
                                            return {
                                                name: item.ticker,
                                                size: Math.abs(item.weight) * 100, // Scale up for visibility
                                                value: val
                                            };
                                        }).filter(x => x.size > 0.5) // Min 0.5% allocation
                                    }]}
                                    dataKey="size"
                                    aspectRatio={4 / 3}
                                    stroke="#0f172a"
                                    content={(props: any) => {
                                        const { x, y, width, height, payload, name, value, depth } = props;
                                        // Ignore Root Node
                                        if (depth < 2 && name === 'Portfolio') return <g />;
                                        if (!payload || !name) return <g />;

                                        // Color scale: Red (-20%) to Green (+20%)
                                        // We use a customized color scale for a "Bloomberg Terminal" look
                                        let fl = '#334155';
                                        if (value > 0) {
                                            // Green Scale
                                            if (value > 0.20) fl = '#10b981';      // Emerald-500
                                            else if (value > 0.10) fl = '#059669'; // Emerald-600
                                            else if (value > 0.05) fl = '#047857'; // Emerald-700
                                            else fl = '#065f46';                   // Emerald-800
                                        } else {
                                            // Red Scale
                                            if (value < -0.20) fl = '#ef4444';     // Red-500
                                            else if (value < -0.10) fl = '#dc2626'; // Red-600
                                            else if (value < -0.05) fl = '#b91c1c'; // Red-700
                                            else fl = '#991b1b';                   // Red-800(ish)
                                        }
                                        if (Math.abs(value) < 0.01) fl = '#334155'; // Neutral

                                        return (
                                            <g>
                                                <rect
                                                    x={x}
                                                    y={y}
                                                    width={width}
                                                    height={height}
                                                    rx={4} // Rounded corners
                                                    ry={4}
                                                    style={{
                                                        fill: fl,
                                                        stroke: '#0f172a',
                                                        strokeWidth: 2,
                                                    }}
                                                />
                                                {width > 30 && height > 30 && (
                                                    <text
                                                        x={x + width / 2}
                                                        y={y + height / 2 - 7}
                                                        textAnchor="middle"
                                                        fill="#fff"
                                                        fontSize={12}
                                                        fontWeight="bold"
                                                        style={{ pointerEvents: 'none' }}
                                                    >
                                                        {name}
                                                    </text>
                                                )}
                                                {width > 30 && height > 30 && (
                                                    <text
                                                        x={x + width / 2}
                                                        y={y + height / 2 + 7}
                                                        textAnchor="middle"
                                                        fill="rgba(255,255,255,0.8)"
                                                        fontSize={10}
                                                        style={{ pointerEvents: 'none' }}
                                                    >
                                                        {(value * 100).toFixed(1)}%
                                                    </text>
                                                )}
                                            </g>
                                        );
                                    }}
                                >
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                                        formatter={(_val: any, _name: any, item: any) => {
                                            // Shows return
                                            return [`${(item.payload.value * 100).toFixed(2)}%`, 'Return'];
                                        }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                </Treemap>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 3. Risk Attribution Table */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg flex flex-col">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <PieChart className="h-4 w-4" /> Position Summary
                        </h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm">
                                <thead className="text-left text-gray-400 border-b border-white/10">
                                    <tr>
                                        <th className="pb-2">Ticker</th>
                                        <th className="pb-2 text-right">Weight</th>
                                        <th className="pb-2 text-right">Risk %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {riskAttribution.slice(0, 10).map(item => (
                                        <tr key={item.ticker} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="py-2 font-medium text-white">{item.ticker}</td>
                                            <td className={`py-2 text-right font-mono ${item.weight > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {item.weight > 0 ? '+' : ''}{formatPercent(item.weight)}
                                            </td>
                                            <td className="py-2 text-right font-mono text-amber-400">
                                                {formatPercent(Math.abs(item.pctRisk))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>

            </div>
        </div >
    );
};
