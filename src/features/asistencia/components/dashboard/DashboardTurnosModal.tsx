import { useState, useMemo } from 'react';
import { Icon } from '../../../../shared/components/common/Icon';
import { getLocalTodayStr, getPreviousWeek as getPreviousDay, getNextWeek as getNextDay } from '../../../asistencia2026/utils/shiftEngine';
import { useDashboardTurnos, DashboardFilters } from './useDashboardTurnos';
import { DashboardTurnosFilters } from './DashboardTurnosFilters';
import { DashboardTurnosStats } from './DashboardTurnosStats';
import { DashboardTurnosList } from './DashboardTurnosList';
import { DashboardTurnosAlerts } from './DashboardTurnosAlerts';
import { AnimatePresence, motion } from 'framer-motion';

interface Props {
    onClose: () => void;
}

export const DashboardTurnosModal = ({ onClose }: Props) => {
    // We use a simplified date add/subtract since shiftEngine week logic might jump 7 days.
    // Let's implement our own daily navigation here.
    const [date, setDate] = useState(() => getLocalTodayStr());
    const [filters, setFilters] = useState<DashboardFilters>({
        date: getLocalTodayStr(),
        terminal: 'ALL',
        turno: 'TODOS',
        estado: 'TODOS',
    });

    const { data, isLoading } = useDashboardTurnos(date);

    const handlePrevDay = () => {
        const d = new Date(date + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        const newDate = d.toISOString().split('T')[0];
        setDate(newDate);
        setFilters(f => ({ ...f, date: newDate }));
    };

    const handleNextDay = () => {
        const d = new Date(date + 'T12:00:00');
        d.setDate(d.getDate() + 1);
        const newDate = d.toISOString().split('T')[0];
        setDate(newDate);
        setFilters(f => ({ ...f, date: newDate }));
    };

    const handleToday = () => {
        const today = getLocalTodayStr();
        setDate(today);
        setFilters(f => ({ ...f, date: today }));
    };

    const filteredData = useMemo(() => {
        return data.filter(staff => {
            if (filters.terminal !== 'ALL' && staff.terminal_code !== filters.terminal) return false;
            if (filters.turno !== 'TODOS' && staff.assignedTurno !== filters.turno) return false;
            if (filters.estado === 'TURNO' && staff.isOff) return false;
            if (filters.estado === 'LIBRE' && !staff.isOff) return false;
            return true;
        });
    }, [data, filters]);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-7xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand-100 text-brand-600 rounded-lg">
                                <Icon name="bar-chart" size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Dashboard de Turnos</h2>
                                <p className="text-sm text-slate-500">Gestión y previsión de dotación diaria</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <Icon name="x" size={24} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-slate-50/30">
                        <DashboardTurnosFilters
                            filters={filters}
                            onChange={setFilters}
                            date={date}
                            onPrevDay={handlePrevDay}
                            onNextDay={handleNextDay}
                            onToday={handleToday}
                        />

                        {isLoading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="flex flex-col items-center gap-3 text-slate-400">
                                    <Icon name="loader" size={32} className="animate-spin" />
                                    <p>Cargando dotación...</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                                <div className="lg:col-span-3 flex flex-col gap-6">
                                    <DashboardTurnosStats data={filteredData} />
                                    <DashboardTurnosList data={filteredData} />
                                </div>
                                <div className="lg:col-span-1">
                                    <DashboardTurnosAlerts data={filteredData} allData={data} date={date} filters={filters} />
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
