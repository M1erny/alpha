
import React from 'react';
import { MetricCard } from '../MetricCard';
import { Activity, TrendingUp, ShieldCheck, Scale, AlertTriangle, Zap, Calendar } from 'lucide-react';
import type { Vitals } from '../../utils/finance';

interface VitalsGridProps {
    vitals: Vitals;
}

export const VitalsGrid: React.FC<VitalsGridProps> = ({ vitals }) => {
    const formatPercent = (val: number | undefined) => typeof val === 'number' ? `${(val * 100).toFixed(2)}%` : 'N/A';
    const formatNumber = (val: number | undefined) => typeof val === 'number' ? val.toFixed(2) : 'N/A';

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <MetricCard title="Annual Return" value={formatPercent(vitals.annualReturn)} icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} trend="up" />
            <MetricCard title="Volatility" value={formatPercent(vitals.annualVol)} icon={<Activity className="h-4 w-4 text-blue-500" />} trend={vitals.annualVol > 0.2 ? 'down' : 'up'} />
            <MetricCard title="Beta" value={formatNumber(vitals.beta)} icon={<Scale className="h-4 w-4 text-violet-500" />} />
            <MetricCard title="Sharpe Ratio" value={formatNumber(vitals.sharpe)} icon={<Zap className="h-4 w-4 text-amber-500" />} />
            <MetricCard title="Max Drawdown" value={formatPercent(vitals.maxDrawdown)} icon={<ShieldCheck className="h-4 w-4 text-rose-500" />} subValue="Peak-Trough" trend="down" />
            <MetricCard
                title="Rolling 1M Vol"
                value={formatPercent(vitals.rolling1mVol)}
                icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
                subValue={`SPY: ${formatPercent(vitals.rolling1mVolBenchmark)}`}
            />
            <MetricCard
                title="Jensen's Alpha"
                value={formatPercent(vitals.jensensAlpha)}
                icon={<Zap className="h-4 w-4 text-amber-500" />}
                subValue="Historical (Ann.)"
            />
            <MetricCard
                title="Backtest Period"
                value={`${vitals.periodInfo?.Years || 0} Yrs`}
                icon={<Calendar className="h-4 w-4 text-gray-500" />}
                subValue={`${vitals.periodInfo?.Start_Date.slice(0, 4)} - ${vitals.periodInfo?.End_Date.slice(0, 4)}`}
            />
        </div>
    );
};
