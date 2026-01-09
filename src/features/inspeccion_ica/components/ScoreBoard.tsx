import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';

interface ScoreBoardProps {
    score: number;
    total: number;
    completed: number;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({ score, total, completed }) => {
    const percentage = Math.round((completed / total) * 100);
    const scoreColor = score === 10 ? 'text-green-500' : score >= 8 ? 'text-yellow-500' : 'text-red-500';
    const progressColor = score === 10 ? 'bg-green-500' : score >= 8 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="fixed top-20 right-4 z-40 w-full max-w-[200px] hidden lg:block">
            <GlassCard className="!p-4">
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-end">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cumplimiento</span>
                        <span className={`text-2xl font-bold ${scoreColor}`}>{score}/{total}</span>
                    </div>

                    <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`absolute top-0 left-0 h-full ${progressColor} transition-all duration-500 ease-out`}
                            style={{ width: `${(score / total) * 100}%` }}
                        />
                    </div>

                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                        {completed === total ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                            <AlertCircle className="w-4 h-4 text-blue-500" />
                        )}
                        <span className="text-xs text-slate-600">
                            {completed === total ? 'Evaluación completa' : `Faltan ${total - completed} puntos`}
                        </span>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
};

export const MobileScoreBar: React.FC<ScoreBoardProps> = ({ score, total, completed }) => {
    const progressColor = score === 10 ? 'bg-green-500' : score >= 8 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 px-4 py-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div className="flex items-center justify-between gap-4 mb-2">
                <span className="text-sm font-semibold text-slate-700">Progreso: {completed}/{total}</span>
                <span className="text-sm font-bold text-slate-900">Score: {score}</span>
            </div>
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full ${progressColor} transition-all duration-500 ease-out`}
                    style={{ width: `${(completed / total) * 100}%` }}
                />
            </div>
        </div>
    );
}
