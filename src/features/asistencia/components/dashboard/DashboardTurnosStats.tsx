import React, { useMemo } from 'react';
import { ProcessedStaff, DashboardFilters } from './useDashboardTurnos';
import { STAFF_CARGOS } from '../../../personal/types';
import { CARGO_COLORS } from '../../../asistencia2026/utils/colors';

interface Props {
    data: ProcessedStaff[];
    filters: DashboardFilters;
    onFilterChange: (filters: DashboardFilters) => void;
}

export const DashboardTurnosStats = ({ data, filters, onFilterChange }: Props) => {
    // We want to count how many are in Turno vs Libre for each Cargo
    const stats = useMemo(() => {
        const counts: Record<string, { turno: number; libre: number; presentes: number; total: number }> = {};
        
        STAFF_CARGOS.forEach(c => {
            counts[c.value] = { turno: 0, libre: 0, presentes: 0, total: 0 };
        });

        data.forEach(staff => {
            if (counts[staff.cargo]) {
                counts[staff.cargo].total += 1;
                if (staff.isOff) {
                    counts[staff.cargo].libre += 1;
                } else {
                    counts[staff.cargo].turno += 1;
                    if (staff.mark) {
                        counts[staff.cargo].presentes += 1;
                    }
                }
            }
        });

        return counts;
    }, [data]);

    const totals = useMemo(() => {
        let turno = 0, libre = 0, presentes = 0, total = 0;
        Object.values(stats).forEach(s => {
            turno += s.turno;
            libre += s.libre;
            presentes += s.presentes;
            total += s.total;
        });
        return { turno, libre, presentes, total };
    }, [stats]);

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Tarjeta de TODOS */}
            <div 
                onClick={() => onFilterChange({ ...filters, cargo: 'TODOS' })}
                className={`bg-white rounded-xl border p-4 shadow-sm flex flex-col hover:shadow-md transition-all cursor-pointer select-none ${
                    filters.cargo === 'TODOS' ? 'ring-2 ring-brand-500 border-brand-500' : 'border-slate-200 opacity-90 hover:opacity-100'
                }`}
            >
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-brand-500"></div>
                    <span className="text-xs font-bold text-slate-600 uppercase">TODOS LOS CARGOS</span>
                </div>
                <div className="grid grid-cols-3 mt-auto pt-2 border-t border-slate-50 items-end divide-x divide-slate-100">
                    <div className="flex flex-col pr-1">
                        <span className="text-xl font-black text-slate-800 leading-none">{totals.turno}</span>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider truncate" title="En Turno">Turno</span>
                    </div>
                    <div className="flex flex-col text-center px-1">
                        <span className="text-xl font-bold text-emerald-500 leading-none">{totals.presentes}</span>
                        <span className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wider truncate" title="Presentes">Presentes</span>
                    </div>
                    <div className="flex flex-col text-right pl-1">
                        <span className="text-xl font-bold text-slate-400 leading-none">{totals.libre}</span>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider truncate" title="Libres">Libres</span>
                    </div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden flex">
                    <div 
                        className="h-full bg-emerald-500 rounded-l-full" 
                        style={{ width: `${totals.turno > 0 ? (totals.presentes / totals.total) * 100 : 0}%` }}
                        title="Presentes"
                    ></div>
                    <div 
                        className="h-full bg-amber-400 rounded-r-full" 
                        style={{ width: `${totals.turno > 0 ? ((totals.turno - totals.presentes) / totals.total) * 100 : 0}%` }}
                        title="Ausentes / Faltas"
                    ></div>
                </div>
            </div>

            {STAFF_CARGOS.map(cargo => {
                const stat = stats[cargo.value];
                if (stat.total === 0) return null; // Don't show empty cargos

                const colorConfig = CARGO_COLORS[cargo.value as keyof typeof CARGO_COLORS];

                const isSelected = filters.cargo === cargo.value;

                return (
                    <div 
                        key={cargo.value} 
                        onClick={() => onFilterChange({ ...filters, cargo: isSelected ? 'TODOS' : cargo.value })}
                        className={`bg-white rounded-xl border p-4 shadow-sm flex flex-col hover:shadow-md transition-all cursor-pointer select-none ${
                            isSelected ? 'ring-2 ring-brand-500 border-brand-500' : 'border-slate-200 opacity-90 hover:opacity-100'
                        }`}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-3 h-3 rounded-full ${colorConfig || 'bg-slate-300'}`}></div>
                            <span className="text-xs font-bold text-slate-600 uppercase">{cargo.label}</span>
                        </div>
                        <div className="grid grid-cols-3 mt-auto pt-2 border-t border-slate-50 items-end divide-x divide-slate-100">
                            <div className="flex flex-col pr-1">
                                <span className="text-xl font-black text-slate-800 leading-none">{stat.turno}</span>
                                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider truncate" title="En Turno">Turno</span>
                            </div>
                            <div className="flex flex-col text-center px-1">
                                <span className="text-xl font-bold text-emerald-500 leading-none">{stat.presentes}</span>
                                <span className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wider truncate" title="Presentes">Presentes</span>
                            </div>
                            <div className="flex flex-col text-right pl-1">
                                <span className="text-xl font-bold text-slate-400 leading-none">{stat.libre}</span>
                                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider truncate" title="Libres">Libres</span>
                            </div>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden flex">
                            <div 
                                className="h-full bg-emerald-500 rounded-l-full" 
                                style={{ width: `${stat.turno > 0 ? (stat.presentes / stat.total) * 100 : 0}%` }}
                                title="Presentes"
                            ></div>
                            <div 
                                className="h-full bg-amber-400 rounded-r-full" 
                                style={{ width: `${stat.turno > 0 ? ((stat.turno - stat.presentes) / stat.total) * 100 : 0}%` }}
                                title="Ausentes / Faltas"
                            ></div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
