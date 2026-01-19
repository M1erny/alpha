import React, { useEffect, useState } from 'react';
import {
    fetchDashboardData, FullRiskReport
} from '../utils/finance';
import { MetricCard } from './MetricCard';
import {
    LayoutDashboard, TrendingUp, Activity, Scale, ShieldCheck,
    PieChart, AlertTriangle, Zap, BarChart3, Clock
} from 'lucide-react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, AreaChart, Area,
    BarChart, Bar, Cell, CartesianGrid, Legend
} from 'recharts';
import { cn } from '../lib/utils';

export const Dashboard: React.FC = () => {
    const [data, setData] = useState<FullRiskReport | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData().then(res => {
            setData(res);
            setLoading(false);
        });
    }, []);

    const formatPercent = (val: number | undefined) => typeof val === 'number' ? `${(val * 100).toFixed(2)}%` : 'N/A';
    const formatNumber = (val: number | undefined) => typeof val === 'number' ? val.toFixed(2) : 'N/A';

    if (loading || !data) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-muted-foreground animate-pulse">Running Risk Engine...</p>
                </div>
            </div>
        )
    }

    const { vitals, leverage, riskAttribution, stressTests, monteCarlo, history, periodicReturns } = data;

    return (
        <div className="min-h-screen bg-background text-foreground p-6 md:p-8">
            <div className="mx-auto max-w-[1600px] space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                            <LayoutDashboard className="h-8 w-8 text-primary" />
                            Institutional Risk Dashboard
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Live quantitative analysis • {history[history.length - 1]?.date}
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

                {/* ROW 1: VITALS (6 Key Metrics) */}
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                    <MetricCard title="Annual Return" value={formatPercent(vitals.annualReturn)} icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} trend="up" />
                    <MetricCard title="Volatility" value={formatPercent(vitals.annualVol)} icon={<Activity className="h-4 w-4 text-blue-500" />} trend={vitals.annualVol > 0.2 ? 'down' : 'up'} />
                    <MetricCard title="Beta" value={formatNumber(vitals.beta)} icon={<Scale className="h-4 w-4 text-violet-500" />} />
                    <MetricCard title="Sharpe Ratio" value={formatNumber(vitals.sharpe)} icon={<Zap className="h-4 w-4 text-amber-500" />} />
                    <MetricCard title="Max Drawdown" value={formatPercent(vitals.maxDrawdown)} icon={<ShieldCheck className="h-4 w-4 text-rose-500" />} subValue="Peak to Trough" trend="down" />
                    <MetricCard title="VaR (95%)" value={formatPercent(vitals.var95)} icon={<AlertTriangle className="h-4 w-4 text-orange-500" />} description="Daily Value at Risk" />
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
                                        formatter={(val: number) => [`$${val.toFixed(0)}`, '']}
                                        labelStyle={{ color: '#94a3b8' }}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="benchmark" name="Market (SPY)" stroke="#64748b" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 2. Monte Carlo Cone */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg flex flex-col">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center justify-between">
                            Monte Carlo Projection
                            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">60 Days</span>
                        </h3>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monteCarlo}>
                                    <defs>
                                        <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="day" hide />
                                    <YAxis domain={['auto', 'auto']} hide />
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                                    {/* Confidence Interval */}
                                    <Area type="monotone" dataKey="p95" stroke="none" fill="none" />
                                    <Area type="monotone" dataKey="p05" stroke="none" fill="url(#cone)" />
                                    {/* Median Path */}
                                    <Line type="monotone" dataKey="p50" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                            Simulated future paths (Geometric Brownian Motion)
                        </p>
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

                    {/* 2. Periodic Returns Heatmap */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg flex flex-col">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Clock className="h-4 w-4" /> Asset Performance
                        </h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            <table className="w-full text-sm">
                                <thead className="text-xs text-muted-foreground border-b border-white/10">
                                    <tr>
                                        <th className="text-left pb-2 font-medium">Ticker</th>
                                        <th className="text-right pb-2 font-medium">1Y</th>
                                        <th className="text-right pb-2 font-medium">3Y</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {periodicReturns.sort((a, b) => (b.r1y || -99) - (a.r1y || -99)).slice(0, 10).map((row) => (
                                        <tr key={row.ticker} className="group hover:bg-white/5 transition-colors">
                                            <td className="py-2 text-white font-medium">{row.ticker}</td>
                                            <td className={cn("text-right py-2", (row.r1y || 0) > 0 ? "text-emerald-400" : "text-rose-400")}>
                                                {formatPercent(row.r1y as number)}
                                            </td>
                                            <td className={cn("text-right py-2", (row.r3y || 0) > 0 ? "text-emerald-400" : "text-rose-400")}>
                                                {formatPercent(row.r3y as number)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 3. Risk Attribution */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg flex flex-col">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <PieChart className="h-4 w-4" /> Top Risk Drivers (MCTR)
                        </h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            {riskAttribution.slice(0, 8).map(item => (
                                <div key={item.ticker} className="mb-4 last:mb-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-white">{item.ticker}</span>
                                            <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-white/5 rounded">
                                                {formatPercent(item.weight)}
                                            </span>
                                        </div>
                                        <span className="text-sm font-mono text-rose-300">
                                            {formatPercent(item.pctRisk)} Risk
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-rose-500 rounded-full"
                                            style={{ width: `${Math.min(Math.abs(item.pctRisk * 100 * 2), 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};
