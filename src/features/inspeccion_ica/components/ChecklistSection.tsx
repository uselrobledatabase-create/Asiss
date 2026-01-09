import React, { useState } from 'react';
import { Check, X, ChevronDown, ChevronUp, AlertCircle, MessageSquare } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { ICA_CHECKPOINTS, Checkpoint } from '../types';

interface ChecklistSectionProps {
    detalles: any;
    onChange: (id: number, cumple: boolean, obs?: string) => void;
}

export const ChecklistSection: React.FC<ChecklistSectionProps> = ({ detalles, onChange }) => {
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white px-2">
                Puntos de Control (Norma A18)
            </h2>
            <div className="grid grid-cols-1 gap-4">
                {ICA_CHECKPOINTS.map((point) => (
                    <CheckPointItem
                        key={point.id}
                        point={point}
                        value={detalles[point.id]}
                        onChange={onChange}
                    />
                ))}
            </div>
        </div>
    );
};

const CheckPointItem: React.FC<{
    point: Checkpoint;
    value: { cumple: boolean | null; observacion?: string };
    onChange: (id: number, cumple: boolean, obs?: string) => void;
}> = ({ point, value, onChange }) => {
    const [showObs, setShowObs] = useState(false);
    const isCumple = value?.cumple === true;
    const isNoCumple = value?.cumple === false;

    const handleSelection = (cumple: boolean) => {
        onChange(point.id, cumple, value?.observacion);
        if (!cumple) {
            setShowObs(true);
        }
    };

    return (
        <GlassCard className="!p-0 overflow-visible">
            <div className={`
        relative p-4 md:p-6 transition-all duration-300
        ${isCumple ? 'bg-green-50/50' : ''}
        ${isNoCumple ? 'bg-red-50/50' : ''}
      `}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                    {/* Label Section */}
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold text-sm">
                                {point.id}
                            </span>
                            <h4 className="text-lg font-medium text-slate-800 dark:text-slate-100">
                                {point.label}
                            </h4>
                        </div>
                    </div>

                    {/* Actions Section */}
                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={() => handleSelection(true)}
                            className={`
                flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
                ${isCumple
                                    ? 'bg-green-500 text-white shadow-lg shadow-green-200 scale-105'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                }
              `}
                        >
                            <Check className="w-5 h-5" />
                            <span className="hidden md:inline">Cumple</span>
                        </button>
                        <button
                            onClick={() => handleSelection(false)}
                            className={`
                flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
                ${isNoCumple
                                    ? 'bg-red-500 text-white shadow-lg shadow-red-200 scale-105'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                }
              `}
                        >
                            <X className="w-5 h-5" />
                            <span className="hidden md:inline">No Cumple</span>
                        </button>
                    </div>
                </div>

                {/* Observation Section - Expands if No Cumple */}
                {(isNoCumple || showObs) && (
                    <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-start gap-2">
                            <MessageSquare className="w-4 h-4 text-slate-400 mt-2" />
                            <textarea
                                value={value?.observacion || ''}
                                onChange={(e) => onChange(point.id, false, e.target.value)}
                                placeholder="Detalle la observación aquí..."
                                className="w-full min-h-[80px] p-3 rounded-xl border border-red-200 bg-white focus:ring-2 focus:ring-red-100 outline-none text-slate-700 placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                )}
            </div>
        </GlassCard>
    );
};
