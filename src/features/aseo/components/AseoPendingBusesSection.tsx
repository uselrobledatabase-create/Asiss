import { useQuery } from '@tanstack/react-query';
import { Icon } from '../../../shared/components/common/Icon';
import { fetchPendingBuses, type PendingBus } from '../api/fleetApi';

interface Props {
    terminal?: string;
}

export const AseoPendingBusesSection = ({ terminal }: Props) => {
    const { data: pendingBuses = [], isLoading } = useQuery({
        queryKey: ['aseo', 'pending-buses', terminal],
        queryFn: () => fetchPendingBuses(terminal),
        refetchInterval: 60000, // Refresh every minute
    });

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'ALTA': return 'from-red-500 to-rose-600';
            case 'MEDIA': return 'from-yellow-500 to-amber-600';
            case 'BAJA': return 'from-green-500 to-emerald-600';
            default: return 'from-slate-400 to-slate-600';
        }
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'ALTA': return { label: 'Alta', icon: 'alert-circle' as const };
            case 'MEDIA': return { label: 'Media', icon: 'clock' as const };
            case 'BAJA': return { label: 'Baja', icon: 'info' as const };
            default: return { label: priority, icon: 'info' as const };
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Icon name="loader" size={32} className="animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-rose-600 rounded-xl shadow-lg p-4 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black">Buses Pendientes</h2>
                        <p className="text-sm text-white/80">Esta semana</p>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-black">{pendingBuses.length}</div>
                        <div className="text-xs text-white/80">Por limpiar</div>
                    </div>
                </div>
            </div>

            {/* Priority Summary */}
            <div className="grid grid-cols-3 gap-2">
                {['ALTA', 'MEDIA', 'BAJA'].map((priority) => {
                    const count = pendingBuses.filter(b => b.prioridad === priority).length;
                    const colors = getPriorityColor(priority);
                    return (
                        <div key={priority} className={`bg-gradient-to-br ${colors} rounded-xl p-3 text-white shadow-md`}>
                            <div className="text-2xl font-black">{count}</div>
                            <div className="text-xs font-semibold">{priority}</div>
                        </div>
                    );
                })}
            </div>

            {/* Buses List */}
            {pendingBuses.length === 0 ? (
                <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                    <Icon name="check-circle" size={48} className="text-emerald-500 mx-auto mb-3" />
                    <p className="text-lg font-bold text-slate-900">¡Excelente trabajo!</p>
                    <p className="text-sm text-slate-600">No hay buses pendientes esta semana</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {pendingBuses.map((bus) => {
                        const badge = getPriorityBadge(bus.prioridad);
                        const priorityColor = getPriorityColor(bus.prioridad);

                        return (
                            <div key={bus.ppu} className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-red-500">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="text-xl font-black text-slate-900">{bus.ppu}</div>
                                        <div className="text-sm text-slate-600">{bus.marca_modelo}</div>
                                        <div className="text-xs text-slate-500">Interno #{bus.numero_interno}</div>
                                    </div>
                                    <div className={`px-3 py-1 bg-gradient-to-r ${priorityColor} text-white rounded-full text-xs font-bold shadow-lg flex items-center gap-1`}>
                                        <Icon name={badge.icon} size={14} />
                                        {badge.label}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Icon name="calendar" size={16} />
                                        <span className="font-semibold">
                                            {bus.dias_sin_limpieza === 999
                                                ? 'Nunca limpiado'
                                                : `${bus.dias_sin_limpieza} días sin limpieza`}
                                        </span>
                                    </div>
                                    <div className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded-lg font-semibold">
                                        {bus.terminal.replace(/_/g, ' ')}
                                    </div>
                                </div>

                                {bus.ultima_limpieza && (
                                    <div className="mt-2 text-xs text-slate-500">
                                        Última limpieza: {new Date(bus.ultima_limpieza).toLocaleDateString('es-CL')}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Info Footer */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                    <Icon name="info" size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-900">
                        <span className="font-bold">Prioridad:</span> Alta (&gt;7 días), Media (4-7 días), Baja (&lt;4 días).
                        La lista se actualiza cada lunes a las 00:00.
                    </p>
                </div>
            </div>
        </div>
    );
};
