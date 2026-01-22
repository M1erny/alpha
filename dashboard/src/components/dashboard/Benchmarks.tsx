
import React from 'react';
import type { Vitals } from '../../utils/finance';

interface BenchmarksProps {
    vitals: Vitals;
}

export const Benchmarks: React.FC<BenchmarksProps> = ({ vitals }) => {
    const formatPercent = (val: number | undefined) => typeof val === 'number' ? `${(val * 100).toFixed(2)}%` : 'N/A';

    return (
        <div className="flex gap-4 text-xs">
            <span className="text-indigo-300 font-medium flex items-center gap-1">
                🇵🇱 WIG <span className="text-white">{formatPercent(vitals.wigYtd)}</span>
            </span>
            <span className="text-blue-300 font-medium flex items-center gap-1">
                🌍 MSCI <span className="text-white">{formatPercent(vitals.msciYtd)}</span>
            </span>
        </div>
    );
};
