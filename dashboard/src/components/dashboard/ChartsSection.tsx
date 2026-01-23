
import React from 'react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
    CartesianGrid, Legend
} from 'recharts';
import type { HistoryPoint, LeverageStats } from '../../utils/finance';

interface ChartsSectionProps {
    history: HistoryPoint[];
    ytdHistory?: HistoryPoint[];
    leverage: LeverageStats;
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({ history, ytdHistory, leverage }) => {
    const formatPercent = (val: number | undefined) => typeof val === 'number' ? `${(val * 100).toFixed(2)}%` : 'N/A';

    return (
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

            {/* 2. YTD Growth of $100k */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg flex flex-col">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center justify-between">
                    <div>
                        YTD Growth ($100k)
                        <span className="ml-2 text-xs font-normal text-gray-400">
                            (Gross: {formatPercent(leverage.Gross_Exp)} | Net: {formatPercent(leverage.Net_Exp)})
                        </span>
                    </div>
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded">2026</span>
                </h3>
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={ytdHistory}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="date" hide />
                            <YAxis
                                domain={['auto', 'auto']}
                                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                                stroke="#666"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                width={35}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                                formatter={(val: number | undefined) => [typeof val === 'number' ? `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'N/A', '']}
                                labelStyle={{ color: '#94a3b8' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                            <Line type="monotone" dataKey="portfolio" name="Portfolio (Lev)" stroke="#10b981" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="benchmark" name="SPY" stroke="#64748b" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
