
import React from 'react';
import { LayoutDashboard, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

interface HeaderProps {
    statusMsg: string;
    connectionError: string | null;
    lastUpdated?: string;
}

export const Header: React.FC<HeaderProps> = ({ statusMsg, connectionError, lastUpdated }) => {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <LayoutDashboard className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">
                            Institutional Risk Dashboard
                        </h1>
                        <p className="text-sm text-gray-400 font-mono flex items-center gap-2">
                            <span className={cn("inline-block w-2 h-2 rounded-full", connectionError ? "bg-red-500" : "bg-emerald-500 animate-pulse")} />
                            {connectionError ? "Offline" : statusMsg}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                    <Zap className="h-3 w-3 text-yellow-500" />
                    <span className="text-xs font-mono text-gray-300">
                        {lastUpdated ? `Updated: ${lastUpdated}` : "Live Stream"}
                    </span>
                </div>
            </div>
        </div>
    );
};
