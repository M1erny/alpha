
import React, { useState } from 'react';
import { Zap, Clock } from 'lucide-react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import type { StressTest, RiskAttribution, PeriodicReturn } from '../../utils/finance';
import { cn } from '../../lib/utils';

interface RiskAnalysisProps {
    stressTests: StressTest[];
    riskAttribution: RiskAttribution[];
    periodicReturns: PeriodicReturn[];
}

export const RiskAnalysis: React.FC<RiskAnalysisProps> = ({ stressTests, riskAttribution, periodicReturns }) => {
    const [heatmapPeriod, setHeatmapPeriod] = useState<'ytd' | 'r1y' | 'r3y'>('ytd');
    const formatPercent = (val: number | undefined) => typeof val === 'number' ? `${(val * 100).toFixed(2)}%` : 'N/A';

    return (
        <div className="grid gap-6 lg:grid-cols-2 h-[400px]">
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
                                if (depth < 2 && name === 'Portfolio') return <g />;
                                if (!payload || !name) return <g />;

                                let fl = '#334155';
                                if (value > 0) {
                                    if (value > 0.20) fl = '#10b981';
                                    else if (value > 0.10) fl = '#059669';
                                    else if (value > 0.05) fl = '#047857';
                                    else fl = '#065f46';
                                } else {
                                    if (value < -0.20) fl = '#ef4444';
                                    else if (value < -0.10) fl = '#dc2626';
                                    else if (value < -0.05) fl = '#b91c1c';
                                    else fl = '#991b1b';
                                }
                                if (Math.abs(value) < 0.01) fl = '#334155';

                                return (
                                    <g>
                                        <rect
                                            x={x} y={y} width={width} height={height}
                                            rx={4} ry={4}
                                            style={{ fill: fl, stroke: '#0f172a', strokeWidth: 2 }}
                                        />
                                        {width > 30 && height > 30 && (
                                            <>
                                                <text
                                                    x={x + width / 2} y={y + height / 2 - 7}
                                                    textAnchor="middle" fill="#fff" fontSize={12} fontWeight="bold"
                                                    style={{ pointerEvents: 'none' }}
                                                >
                                                    {name}
                                                </text>
                                                <text
                                                    x={x + width / 2} y={y + height / 2 + 7}
                                                    textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={10}
                                                    style={{ pointerEvents: 'none' }}
                                                >
                                                    {(value * 100).toFixed(1)}%
                                                </text>
                                            </>
                                        )}
                                    </g>
                                );
                            }}
                        >
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                                formatter={(_val: any, _name: any, item: any) => [`${(item.payload.value * 100).toFixed(2)}%`, 'Return']}
                                itemStyle={{ color: '#fff' }}
                            />
                        </Treemap>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
