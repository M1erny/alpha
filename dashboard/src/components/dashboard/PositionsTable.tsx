
import React, { useState, useMemo } from 'react';
import { PieChart } from 'lucide-react';
import type { RiskAttribution, PeriodicReturn, Vitals } from '../../utils/finance';
import { cn } from '../../lib/utils';

interface PositionsTableProps {
    riskAttribution: RiskAttribution[];
    periodicReturns: PeriodicReturn[];
    vitals: Vitals;
}

export const PositionsTable: React.FC<PositionsTableProps> = ({ riskAttribution, periodicReturns, vitals }) => {
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'weight', direction: 'desc' });

    const formatPercent = (val: number | undefined) => typeof val === 'number' ? `${(val * 100).toFixed(2)}%` : 'N/A';

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedRiskAttribution = useMemo(() => {
        if (!riskAttribution) return [];
        let sortableItems = [...riskAttribution];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let aValue: any = a[sortConfig.key as keyof typeof a];
                let bValue: any = b[sortConfig.key as keyof typeof b];

                if (['ytd', 'r1y', 'r3y'].includes(sortConfig.key)) {
                    aValue = periodicReturns.find(p => p.ticker === a.ticker)?.[sortConfig.key as 'ytd' | 'r1y' | 'r3y'] ?? -999;
                    bValue = periodicReturns.find(p => p.ticker === b.ticker)?.[sortConfig.key as 'ytd' | 'r1y' | 'r3y'] ?? -999;
                }

                if (sortConfig.key === 'pctRisk') {
                    aValue = Math.abs(a.pctRisk);
                    bValue = Math.abs(b.pctRisk);
                }

                if (sortConfig.key === 'weight') {
                    aValue = Math.abs(a.weight);
                    bValue = Math.abs(b.weight);
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [riskAttribution, sortConfig, periodicReturns]);

    return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg flex flex-col h-full">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <PieChart className="h-4 w-4" /> Position Summary
            </h3>

            {/* Longs vs Shorts Summary */}
            <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-white/5 rounded-lg">
                <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase">Longs YTD</p>
                    <p className={cn("text-lg font-bold font-mono",
                        vitals.ytdLongsContrib >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                        {vitals.ytdLongsContrib > 0 ? '+' : ''}{formatPercent(vitals.ytdLongsContrib)}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase">Shorts YTD</p>
                    <p className={cn("text-lg font-bold font-mono",
                        vitals.ytdShortsContrib >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                        {vitals.ytdShortsContrib > 0 ? '+' : ''}{formatPercent(vitals.ytdShortsContrib)}
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm">
                    <thead className="text-left text-gray-400 border-b border-white/10 sticky top-0 bg-[#0c1425] z-10">
                        <tr>
                            <th className="pb-2 cursor-pointer hover:text-white" onClick={() => requestSort('ticker')}>
                                Ticker {sortConfig.key === 'ticker' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="pb-2 text-right cursor-pointer hover:text-white" onClick={() => requestSort('weight')}>
                                Weight {sortConfig.key === 'weight' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="pb-2 text-right cursor-pointer hover:text-white" onClick={() => requestSort('ytd')}>
                                YTD {sortConfig.key === 'ytd' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="pb-2 text-right cursor-pointer hover:text-white hidden sm:table-cell" onClick={() => requestSort('r1y')}>
                                1Y {sortConfig.key === 'r1y' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="pb-2 text-right cursor-pointer hover:text-white hidden md:table-cell" onClick={() => requestSort('r3y')}>
                                3Y {sortConfig.key === 'r3y' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="pb-2 text-right cursor-pointer hover:text-white" onClick={() => requestSort('pctRisk')}>
                                Risk % {sortConfig.key === 'pctRisk' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedRiskAttribution.map(item => {
                            const retData = periodicReturns.find(p => p.ticker === item.ticker);
                            const ytdRet = retData?.ytd ?? 0;
                            const r1y = retData?.r1y;
                            const r3y = retData?.r3y;

                            return (
                                <tr key={item.ticker} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="py-2 font-medium text-white">{item.ticker}</td>
                                    <td className={`py-2 text-right font-mono ${item.weight > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {item.weight > 0 ? '+' : ''}{formatPercent(item.weight)}
                                    </td>
                                    <td className={`py-2 text-right font-mono ${ytdRet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {ytdRet > 0 ? '+' : ''}{formatPercent(ytdRet)}
                                    </td>
                                    <td className="py-2 text-right font-mono text-gray-400 hidden sm:table-cell">
                                        {r1y !== null && r1y !== undefined ? formatPercent(r1y) : '-'}
                                    </td>
                                    <td className="py-2 text-right font-mono text-gray-400 hidden md:table-cell">
                                        {r3y !== null && r3y !== undefined ? formatPercent(r3y) : '-'}
                                    </td>
                                    <td className="py-2 text-right font-mono text-amber-400">
                                        {formatPercent(Math.abs(item.pctRisk))}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
