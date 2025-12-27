import { useQuery } from '@tanstack/react-query';
import { Icon } from '../../../../shared/components/common/Icon';
import { fetchPendingBuses, getFleetStats, type PendingBus } from '../../api/fleetApi';
import { useState } from 'react';

export const AseoPendingBuses = () => {
    const [terminalFilter, setTerminalFilter] = useState<string>('');
    const [priorityFilter, setPriorityFilter] = useState<string>('');

    const { data: pendingBuses = [], isLoading } = useQuery({
        queryKey: ['aseo', 'admin-pending-buses', terminalFilter],
        queryFn: () => fetchPendingBuses(terminalFilter || undefined),
        refetchInterval: 60000,
    });

    const { data: stats } = useQuery({
        queryKey: ['aseo', 'fleet-stats', terminalFilter],
        queryFn: () => getFleetStats(terminalFilter || undefined),
    });

    const filteredBuses = pendingBuses.filter(bus => {
        if (priorityFilter && bus.prioridad !== priorityFilter) return false;
        return true;
    });

    const getPriorityColor = (priority: 'ALTA' | 'MEDIA' | 'BAJA') => {
        switch (priority) {
            case 'ALTA': return 'from-red-500 to-rose-600';
            case 'MEDIA': return 'from-yellow-500 to-amber-600';
            case 'BAJA': return 'from-green-500 to-emerald-600';
        }
    };

    const getPriorityLabel = (priority: 'ALTA' | 'MEDIA' | 'BAJA') => {
        switch (priority) {
            case 'ALTA': return 'Alta';
            case 'MEDIA': return 'Media';
            case 'BAJA': return 'Baja';
        }
    };

    const daysSince = (dateStr: string | null) => {
        if (!dateStr) return 999;
        const diff = Date.now() - new Date(dateStr).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    };

    const terminals = ['EL_ROBLE', 'LA_REINA', 'MARIA_ANGELICA', 'EL_DESCANSO'];

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                        <div className="text-sm font-semibold text-slate-600 mb-1">Total Flota</div>
                        <div className="text-3xl font-black text-slate-900">{stats.total}</div>
                    </div>
                    <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl shadow-lg p-6 text-white">
                        <div className="text-sm font-semibold text-white/80 mb-1">Pendientes</div>
                        <div className="text-3xl font-black">{stats.pendientes}</div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg p-6 text-white">
                        <div className="text-sm font-semibold text-white/80 mb-1">Limpiados Semana</div>
                        <div className="text-3xl font-black">{stats.limpiadosEstaSemana}</div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg p-6 text-white">
                        <div className="text-sm font-semibold text-white/80 mb-1">% Completado</div>
                        <div className="text-3xl font-black">
                            {Math.round((stats.limpiadosEstaSemana / stats.total) * 100)}%
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center">
                                <Icon name="truck" size={20} className="text-white" />
                            </div>
                            Buses Pendientes de Limpieza
                        </h2>
                        <p className="text-sm text-slate-600 mt-1">
                            {filteredBuses.length} buses requieren atención esta semana
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Terminal</label>
                        <select
                            value={terminalFilter}
                            onChange={(e) => setTerminalFilter(e.target.value)}
                            className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900 font-medium"
                        >
                            <option value="">Todos</option>
                            {terminals.map((t) => (
                                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Prioridad</label>
                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900 font-medium"
                        >
                            <option value="">Todas</option>
                            <option value="ALTA">Alta</option>
                            <option value="MEDIA">Media</option>
                            <option value="BAJA">Baja</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Priority Summary */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(['ALTA', 'MEDIA', 'BAJA'] as const).map((priority) => {
                        const count = stats.porPrioridad[priority.toLowerCase() as 'alta' | 'media' | 'baja'];
                        const colors = getPriorityColor(priority);
                        return (
                            <div key={priority} className={`bg-gradient-to-br ${colors} rounded-2xl p-6 text-white shadow-lg`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-white/80">Prioridad {getPriorityLabel(priority)}</div>
                                        <div className="text-4xl font-black mt-2">{count}</div>
                                    </div>
                                    <Icon name="alert-circle" size={40} className="text-white/30" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Buses List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Icon name="loader" size={40} className="animate-spin text-indigo-600" />
                </div>
            ) : filteredBuses.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-slate-200">
                    <Icon name="check-circle" size={64} className="text-emerald-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-black text-slate-900 mb-2">¡Excelente trabajo!</h3>
                    <p className="text-slate-600">No hay buses pendientes con los filtros seleccionados</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredBuses.map((bus) => {
                        const days = bus.dias_sin_limpieza;
                        const priorityColor = getPriorityColor(bus.prioridad);

                        return (
                            <div key={bus.ppu} className="bg-gradient-to-br from-slate-50 to-red-50 rounded-xl p-5 border-2 border-slate-200 hover:border-red-300 transition-all hover:shadow-lg">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-2xl font-black text-slate-900">{bus.ppu}</div>
                                    <span className={`px-3 py-1 bg-gradient-to-r ${priorityColor} text-white text-xs font-bold rounded-full shadow-lg`}>
                                        {getPriorityLabel(bus.prioridad)}
                                    </span>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="text-sm font-semibold text-slate-700">{bus.marca_modelo}</div>
                                    <div className="text-xs text-slate-600">Interno #{bus.numero_interno}</div>

                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Icon name="user" size={14} />
                                        <span className="font-semibold">{bus.terminal.replace(/_/g, ' ')}</span>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-red-600 font-bold">
                                        <Icon name="calendar" size={14} />
                                        <span>
                                            {days === 999 ? 'Nunca limpiado' : `${days} días sin limpieza`}
                                        </span>
                                    </div>

                                    {bus.limpiado_esta_semana && (
                                        <div className="flex items-center gap-2 text-sm text-emerald-600 font-bold">
                                            <Icon name="check-circle" size={14} />
                                            <span>Limpiado esta semana</span>
                                        </div>
                                    )}
                                </div>

                                {bus.ultima_limpieza && (
                                    <div className="text-xs text-slate-500 border-t border-slate-200 pt-2">
                                        Última limpieza: {new Date(bus.ultima_limpieza).toLocaleDateString('es-CL')}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <Icon name="info" size={20} className="text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-900">
                        <p className="font-bold mb-1">Sistema de Prioridad Automático</p>
                        <p className="text-blue-700">
                            • <strong>Alta:</strong> Más de 7 días sin limpieza<br />
                            • <strong>Media:</strong> Entre 4 y 7 días sin limpieza<br />
                            • <strong>Baja:</strong> Menos de 4 días sin limpieza<br />
                            <br />
                            La lista se actualiza automáticamente cada lunes a las 00:00. Los registros históricos se mantienen para consultas.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
