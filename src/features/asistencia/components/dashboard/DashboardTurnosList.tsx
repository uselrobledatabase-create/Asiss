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

            <div className="flex-1 overflow-y-auto p-0">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 font-semibold text-slate-500 uppercase tracking-wider text-[11px]">Personal</th>
                            <th className="px-6 py-3 font-semibold text-slate-500 uppercase tracking-wider text-[11px]">Cargo</th>
                            <th className="px-6 py-3 font-semibold text-slate-500 uppercase tracking-wider text-[11px]">Terminal</th>
                            <th className="px-6 py-3 font-semibold text-slate-500 uppercase tracking-wider text-[11px]">Turno Asignado</th>
                            <th className="px-6 py-3 font-semibold text-slate-500 uppercase tracking-wider text-[11px]">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                    No hay personal que coincida con los filtros
                                </td>
                            </tr>
                        ) : (
                            filtered.map(staff => {
                                const cargoColor = CARGO_COLORS[staff.cargo as keyof typeof CARGO_COLORS];
                                const terminalColor = TERMINAL_COLORS[staff.terminal_code as keyof typeof TERMINAL_COLORS];

                                return (
                                    <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-800">{staff.nombre}</span>
                                                <span className="text-[11px] text-slate-400 font-mono">{staff.rut}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${cargoColor || 'bg-slate-100 text-slate-600'}`}>
                                                {staff.cargo}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${terminalColor || 'bg-slate-100 text-slate-600'}`}>
                                                {staff.terminal_code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-2">
                                                {staff.assignedTurno === 'DIA' ? (
                                                    <Icon name="sun" size={14} className="text-amber-500" />
                                                ) : (
                                                    <Icon name="moon" size={14} className="text-indigo-500" />
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-700">{staff.assignedTurno}</span>
                                                    <span className="text-[11px] text-slate-500">{staff.horario}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            {staff.isOff ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                                                    LIBRE {staff.offReason ? `(${staff.offReason})` : ''}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                    EN TURNO
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
