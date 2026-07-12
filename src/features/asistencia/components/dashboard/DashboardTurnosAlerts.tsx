import React, { useMemo } from 'react';
import { ProcessedStaff, DashboardFilters } from './useDashboardTurnos';
import { Icon, IconName } from '../../../../shared/components/common/Icon';
import { STAFF_CARGOS } from '../../../personal/types';
import { TerminalCode } from '../../../../shared/types/terminal';
import { getDayOfWeekUTC } from '../../../asistencia2026/utils/shiftEngine';

interface Props {
    data: ProcessedStaff[]; // currently filtered data
    allData: ProcessedStaff[]; // all staff for the selected date regardless of filters
    date: string;
    filters: DashboardFilters;
}

interface Alert {
    id: string;
    type: 'critical' | 'warning' | 'info';
    message: string;
    icon: IconName;
}

export const DashboardTurnosAlerts = ({ allData, date, filters }: Props) => {
    
    const alerts = useMemo(() => {
        const generated: Alert[] = [];
        
        // Only generate alerts for the currently viewed terminal, or ALL if ALL is selected
        const terminalsToAnalyze: TerminalCode[] = filters.terminal === 'ALL' 
            ? ['EL_ROBLE', 'LA_REINA', 'MARIA_ANGELICA'] 
            : [filters.terminal as TerminalCode];

        const cargosToCheck = ['planillero', 'supervisor', 'conductor', 'inspector_patio'];

        terminalsToAnalyze.forEach(term => {
            const staffInTerminal = allData.filter(s => s.terminal_code === term);

            cargosToCheck.forEach(cargo => {
                const staffInCargo = staffInTerminal.filter(s => s.cargo === cargo);
                if (staffInCargo.length === 0) return;

                const dayStaff = staffInCargo.filter(s => s.assignedTurno === 'DIA' && !s.isOff);
                const nightStaff = staffInCargo.filter(s => s.assignedTurno === 'NOCHE' && !s.isOff);
                const offStaff = staffInCargo.filter(s => s.isOff);

                // Rule 1: Zero coverage for critical roles
                if (cargo === 'planillero' || cargo === 'supervisor') {
                    if (dayStaff.length === 0) {
                        generated.push({
                            id: `zero-${term}-${cargo}-dia`,
                            type: 'critical',
                            icon: 'alert-triangle',
                            message: `Cobertura crítica: 0 ${cargo}s en Turno DÍA para ${term}.`
                        });
                    }
                    if (nightStaff.length === 0) {
                        generated.push({
                            id: `zero-${term}-${cargo}-noche`,
                            type: 'critical',
                            icon: 'alert-triangle',
                            message: `Cobertura crítica: 0 ${cargo}s en Turno NOCHE para ${term}.`
                        });
                    }
                }

                // Rule 2: Heavy imbalance (e.g. 5 on Day, 1 on Night) for conductors/inspectors
                if (staffInCargo.length >= 4) {
                    const totalWorking = dayStaff.length + nightStaff.length;
                    if (totalWorking > 0) {
                        const dayRatio = dayStaff.length / totalWorking;
                        if (dayRatio > 0.8 && nightStaff.length > 0) { // e.g. 80% on day
                            generated.push({
                                id: `imbalance-${term}-${cargo}-day`,
                                type: 'warning',
                                icon: 'alert-circle',
                                message: `Desbalance en ${term}: ${dayStaff.length} ${cargo}s de DÍA y solo ${nightStaff.length} de NOCHE.`
                            });
                        } else if (dayRatio < 0.2 && dayStaff.length > 0) {
                            generated.push({
                                id: `imbalance-${term}-${cargo}-night`,
                                type: 'warning',
                                icon: 'alert-circle',
                                message: `Desbalance en ${term}: Solo ${dayStaff.length} ${cargo}s de DÍA y ${nightStaff.length} de NOCHE.`
                            });
                        }
                    }
                }

                // Rule 3: Mention specific people missing for small teams
                if ((cargo === 'planillero' || cargo === 'supervisor') && offStaff.length > 0) {
                    offStaff.forEach(off => {
                        generated.push({
                            id: `off-${off.id}`,
                            type: 'info',
                            icon: 'info',
                            message: `Falta ${cargo} ${off.nombre.split(' ')[0]} en ${term} (está libre: ${off.offReason || 'Descanso'}).`
                        });
                    });
                }
            });
        });

        return generated;
    }, [allData, filters.terminal]);

    return (
        <div className="bg-slate-800 rounded-xl flex flex-col h-full shadow-lg border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-2 text-white">
                    <Icon name="bell" size={18} className="text-amber-400" />
                    <h3 className="font-bold">Alertas Inteligentes</h3>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full">
                    {alerts.length}
                </span>
            </div>

            <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-3">
                {alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center h-full text-slate-400 gap-2 opacity-50 py-8">
                        <Icon name="check-circle" size={32} className="text-emerald-500" />
                        <p className="text-sm">Todo en orden. La dotación parece equilibrada para los filtros actuales.</p>
                    </div>
                ) : (
                    alerts.map(alert => (
                        <div 
                            key={alert.id}
                            className={`p-3 rounded-lg border flex gap-3 items-start transition-all ${
                                alert.type === 'critical' ? 'bg-rose-500/10 border-rose-500/30 text-rose-200' :
                                alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' :
                                'bg-blue-500/10 border-blue-500/30 text-blue-200'
                            }`}
                        >
                            <div className={`mt-0.5 ${
                                alert.type === 'critical' ? 'text-rose-400' :
                                alert.type === 'warning' ? 'text-amber-400' :
                                'text-blue-400'
                            }`}>
                                <Icon name={alert.icon} size={16} />
                            </div>
                            <p className="text-sm leading-snug">{alert.message}</p>
                        </div>
                    ))
                )}
            </div>
            <div className="p-3 text-center bg-slate-900/50 border-t border-slate-700">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Analizando {allData.length} registros</p>
            </div>
        </div>
    );
};
