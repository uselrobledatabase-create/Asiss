import React, { useState } from 'react';
import { ProcessedStaff } from './useDashboardTurnos';
import { Icon } from '../../../../shared/components/common/Icon';
import { CARGO_COLORS, TERMINAL_COLORS } from '../../../asistencia2026/utils/colors';

interface Props {
    data: ProcessedStaff[];
}

export const DashboardTurnosList = ({ data }: Props) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filtered = data.filter(s => 
        s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.rut.includes(searchTerm)
    );

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 overflow-hidden min-h-[400px]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-700">Detalle de Dotación ({filtered.length})</h3>
                <div className="relative">
                    <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar personal..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 w-64 transition-all"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {filtered.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        No hay personal que coincida con los filtros
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filtered.map(staff => {
                            const cargoColor = CARGO_COLORS[staff.cargo as keyof typeof CARGO_COLORS];
                            const terminalColor = TERMINAL_COLORS[staff.terminal_code as keyof typeof TERMINAL_COLORS];

                            return (
                                <div key={staff.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800 text-sm">{staff.nombre}</span>
                                            <span className="text-xs text-slate-400 font-mono">{staff.rut}</span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {staff.isOff ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100 uppercase">
                                                    LIBRE {staff.offReason ? `(${staff.offReason})` : ''}
                                                </span>
                                            ) : staff.mark ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase">
                                                    PRESENTE
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100 uppercase">
                                                    ASIGNADO (FALTA)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-auto">
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${cargoColor || 'bg-slate-100 text-slate-600'}`}>
                                                {staff.cargo}
                                            </span>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${terminalColor || 'bg-slate-100 text-slate-600'}`}>
                                                {staff.terminal_code}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-right">
                                            {staff.assignedTurno === 'DIA' ? (
                                                <Icon name="sun" size={14} className="text-amber-500" />
                                            ) : (
                                                <Icon name="moon" size={14} className="text-indigo-500" />
                                            )}
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 text-[11px] leading-tight">{staff.assignedTurno}</span>
                                                <span className="text-[10px] text-slate-500 leading-tight">{staff.horario}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
