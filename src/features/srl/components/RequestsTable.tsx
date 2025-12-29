import { useState } from 'react';
import { useSrlRequests } from '../hooks';
import { Icon } from '../../../shared/components/common/Icon';
import { SrlStatus, SrlCriticality } from '../types';
import { RequestDetailModal } from './RequestDetailModal';

interface Props {
    onCreate: () => void;
    onView: (id: string) => void;
}

export const RequestsTable = ({ onCreate, onView }: Props) => {
    const [filters, setFilters] = useState({
        terminal: 'ALL',
        status: 'TODOS',
        criticality: 'TODAS',
        search: ''
    });
    const [detailModalId, setDetailModalId] = useState<string | null>(null);

    const { data: requests = [], isLoading } = useSrlRequests(filters);

    const getStatusBadge = (status: SrlStatus) => {
        const config = {
            CREADA: { bg: 'from-blue-50 to-blue-100', text: 'text-blue-700', border: 'border-blue-200', icon: 'file-plus' },
            ENVIADA: { bg: 'from-sky-50 to-sky-100', text: 'text-sky-700', border: 'border-sky-200', icon: 'send' },
            PROGRAMADA: { bg: 'from-indigo-50 to-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', icon: 'calendar' },
            EN_REVISION: { bg: 'from-amber-50 to-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: 'eye' },
            REPARADA: { bg: 'from-teal-50 to-teal-100', text: 'text-teal-700', border: 'border-teal-200', icon: 'check-circle' },
            NO_REPARADA: { bg: 'from-red-50 to-red-100', text: 'text-red-700', border: 'border-red-200', icon: 'x-circle' },
            REAGENDADA: { bg: 'from-orange-50 to-orange-100', text: 'text-orange-700', border: 'border-orange-200', icon: 'clock' },
            CERRADA: { bg: 'from-slate-100 to-slate-200', text: 'text-slate-600', border: 'border-slate-300', icon: 'archive' },
        };
        const style = config[status] || config.CREADA;
        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border bg-gradient-to-r ${style.bg} ${style.text} ${style.border} uppercase tracking-wider shadow-sm`}>
                <Icon name={style.icon as any} size={12} />
                {status.replace('_', ' ')}
            </span>
        );
    };

    const getCriticalityBadge = (crit: SrlCriticality) => {
        const config = {
            BAJA: { bg: 'bg-slate-100', text: 'text-slate-600', icon: 'minus' },
            MEDIA: { bg: 'bg-amber-100', text: 'text-amber-700', icon: 'alert-circle' },
            ALTA: { bg: 'bg-gradient-to-r from-red-500 to-red-600', text: 'text-white', icon: 'alert-triangle' },
        };
        const style = config[crit];
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${style.bg} ${style.text} shadow-sm`}>
                <Icon name={style.icon as any} size={12} />
                {crit}
            </span>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Toolbar */}
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-gradient-to-br from-white to-slate-50 p-5 rounded-2xl shadow-lg border border-slate-200/60">
                <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:flex-none min-w-[240px]">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <Icon name="search" size={18} />
                        </div>
                        <input
                            placeholder="Buscar PPU, ID..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all shadow-sm hover:shadow-md"
                            value={filters.search}
                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                        />
                    </div>

                    <select
                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none text-slate-700 font-semibold shadow-sm hover:shadow-md transition-all cursor-pointer"
                        value={filters.terminal}
                        onChange={e => setFilters({ ...filters, terminal: e.target.value })}
                    >
                        <option value="ALL">Todos los Terminales</option>
                        <option value="EL_ROBLE">El Roble</option>
                        <option value="LA_REINA">La Reina</option>
                        <option value="MARIA_ANGELICA">María Angélica</option>
                        <option value="EL_DESCANSO">El Descanso</option>
                    </select>

                    <select
                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none text-slate-700 font-semibold shadow-sm hover:shadow-md transition-all cursor-pointer"
                        value={filters.status}
                        onChange={e => setFilters({ ...filters, status: e.target.value })}
                    >
                        <option value="TODOS">Todos los Estados</option>
                        <option value="CREADA">Creada</option>
                        <option value="ENVIADA">Enviada</option>
                        <option value="PROGRAMADA">Programada</option>
                        <option value="REPARADA">Reparada</option>
                        <option value="CERRADA">Cerrada</option>
                    </select>
                </div>

                <button
                    onClick={onCreate}
                    className="w-full lg:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 hover:shadow-xl hover:shadow-blue-500/40"
                >
                    <Icon name="plus" size={20} />
                    <span>Nueva Solicitud</span>
                </button>
            </div>

            {/* Table Content */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden">
                {isLoading ? (
                    <div className="p-16 text-center">
                        <div className="inline-block animate-spin text-blue-600 mb-4">
                            <Icon name="loader" size={40} />
                        </div>
                        <p className="text-slate-500 font-semibold">Cargando solicitudes...</p>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="p-20 text-center">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full mb-5 shadow-lg">
                            <Icon name="inbox" size={40} className="text-slate-300" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900">No hay solicitudes</h3>
                        <p className="text-slate-500 mt-2 max-w-md mx-auto">No se encontraron registros. Cree una nueva solicitud o ajuste los filtros.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Terminal / ID</th>
                                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Estado</th>
                                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Criticidad</th>
                                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Buses</th>
                                    <th className="px-6 py-4 text-center text-xs font-black text-slate-600 uppercase tracking-wider">Doc</th>
                                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Creación</th>
                                    <th className="px-6 py-4 text-right text-xs font-black text-slate-600 uppercase tracking-wider">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {requests.map((req) => (
                                    <tr
                                        key={req.id}
                                        onClick={() => setDetailModalId(req.id)}
                                        className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all duration-200 cursor-pointer group"
                                    >
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-black text-sm text-slate-900">{req.terminal_code.replace('_', ' ')}</span>
                                                <span className="font-mono text-xs text-slate-400">#{req.id.slice(0, 8)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            {getStatusBadge(req.status)}
                                        </td>
                                        <td className="px-6 py-5">
                                            {getCriticalityBadge(req.criticality)}
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {req.srl_request_buses?.slice(0, 3).map((bus, i) => (
                                                    <span
                                                        key={i}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-bold shadow-sm"
                                                        title={`${bus.bus_ppu}${bus.observation ? ` - ${bus.observation}` : ''}`}
                                                    >
                                                        <Icon name="truck" size={11} />
                                                        {bus.bus_ppu}
                                                    </span>
                                                ))}
                                                {(req.srl_request_buses?.length || 0) > 3 && (
                                                    <span
                                                        className="inline-flex items-center px-2 py-1 rounded-md bg-slate-500 text-white text-xs font-bold shadow-sm"
                                                        title={`+${(req.srl_request_buses?.length || 0) - 3} buses más`}
                                                    >
                                                        +{(req.srl_request_buses?.length || 0) - 3}
                                                    </span>
                                                )}
                                                {(req.srl_request_buses?.length === 0) && <span className="text-slate-400 text-xs italic">Sin buses</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            {req.technician_document_url ? (
                                                <div className="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-sm" title="Documento técnico disponible">
                                                    <Icon name="file-text" size={16} className="text-white" />
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center justify-center w-8 h-8 bg-slate-100 rounded-lg" title="Sin documento">
                                                    <Icon name="x" size={12} className="text-slate-300" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-sm text-slate-600 font-medium">
                                            {new Intl.DateTimeFormat('es-CL', {
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }).format(new Date(req.created_at))}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <button className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-sm hover:shadow-md">
                                                <Icon name="chevron-right" size={20} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {detailModalId && (
                <RequestDetailModal
                    isOpen={!!detailModalId}
                    onClose={() => setDetailModalId(null)}
                    requestId={detailModalId}
                />
            )}
        </div>
    );
};
