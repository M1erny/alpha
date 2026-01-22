
import React from 'react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
    CartesianGrid, Legend
} from 'recharts';
import type { HistoryPoint, LeverageStats } from '../../utils/finance';

interface ChartsSectionProps {
    history: HistoryPoint[];
    leverage: LeverageStats;
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({ history, leverage }) => {
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

            {/* 2. Exposure History */}
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
    );
};
