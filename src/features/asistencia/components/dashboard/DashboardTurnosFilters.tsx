import React from 'react';
import { Icon } from '../../../../shared/components/common/Icon';
import { DashboardFilters } from './useDashboardTurnos';
import { TerminalCode } from '../../../../shared/types/terminal';
import { getMonthName, getDayOfWeekUTC } from '../../../asistencia2026/utils/shiftEngine';

interface Props {
    filters: DashboardFilters;
    onChange: (filters: DashboardFilters) => void;
    date: string;
    onPrevDay: () => void;
    onNextDay: () => void;
    onToday: () => void;
}

const TERMINALS: { value: TerminalCode | 'ALL'; label: string; icon: any }[] = [
    { value: 'ALL', label: 'Todos', icon: 'globe' },
    { value: 'EL_ROBLE', label: 'El Roble', icon: 'map-pin' },
    { value: 'LA_REINA', label: 'La Reina', icon: 'map-pin' },
    { value: 'MARIA_ANGELICA', label: 'María Angélica', icon: 'map-pin' },
];

export const DashboardTurnosFilters = ({ filters, onChange, date, onPrevDay, onNextDay, onToday }: Props) => {
    
    // Format date nicely
    const dateObj = new Date(date + 'T12:00:00');
    const dayOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][getDayOfWeekUTC(dateObj)];
    const dateFormatted = `${dayOfWeek} ${dateObj.getDate()} de ${getMonthName(dateObj.getMonth())} ${dateObj.getFullYear()}`;

    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center">
            
            {/* Date Navigation */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onPrevDay}
                    className="p-2 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors border border-slate-200"
                    title="Día Anterior"
                >
                    <Icon name="chevron-left" size={20} />
                </button>
                <div className="flex flex-col items-center min-w-[200px]">
                    <span className="text-sm font-semibold text-slate-800">{dateFormatted}</span>
                    <button onClick={onToday} className="text-xs text-brand-600 hover:underline">Ir a Hoy</button>
                </div>
                <button
                    onClick={onNextDay}
                    className="p-2 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors border border-slate-200"
                    title="Día Siguiente"
                >
                    <Icon name="chevron-right" size={20} />
                </button>
            </div>

            <div className="flex flex-wrap gap-4 items-center">
                {/* Terminal Filter */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {TERMINALS.map(t => (
                        <button
                            key={t.value}
                            onClick={() => onChange({ ...filters, terminal: t.value })}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                                filters.terminal === t.value
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <span className="hidden sm:inline">{t.label}</span>
                            <span className="sm:hidden">{t.label.substring(0,2)}</span>
                        </button>
                    ))}
                </div>

                <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

                {/* Turno Filter */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {['TODOS', 'DIA', 'NOCHE'].map(t => (
                        <button
                            key={t}
                            onClick={() => onChange({ ...filters, turno: t as any })}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                filters.turno === t
                                    ? 'bg-white text-brand-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {t === 'TODOS' ? '24 Hrs' : t === 'DIA' ? 'Día' : 'Noche'}
                        </button>
                    ))}
                </div>

                <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

                {/* Estado Filter */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {['TODOS', 'TURNO', 'LIBRE'].map(t => (
                        <button
                            key={t}
                            onClick={() => onChange({ ...filters, estado: t as any })}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                filters.estado === t
                                    ? 'bg-white text-emerald-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {t === 'TODOS' ? 'Toda la Dotación' : t === 'TURNO' ? 'En Turno' : 'Libres/Ausentes'}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
