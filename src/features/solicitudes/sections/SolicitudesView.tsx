
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiltersBar } from '../../../shared/components/common/FiltersBar';
import { DataTable, TableColumn } from '../../../shared/components/common/DataTable';
import { EmptyState } from '../../../shared/components/common/EmptyState';
import { LoadingState } from '../../../shared/components/common/LoadingState';
import { ErrorState } from '../../../shared/components/common/ErrorState';
import { ExportMenu } from '../../../shared/components/common/ExportMenu';
import { useTerminalStore } from '../../../shared/state/terminalStore';
import { solicitudesAdapter } from '../service';
import { SolicitudFilters, SolicitudViewModel } from '../types';
import { exportToXlsx } from '../../../shared/utils/exportToXlsx';
import { displayTerminal } from '../../../shared/utils/terminal';
import { Icon } from '../../../shared/components/common/Icon';
import { SolicitudDetailModal } from '../components/SolicitudDetailModal';

export const SolicitudesView = () => {
    const terminalContext = useTerminalStore((state) => state.context);
    const setTerminalContext = useTerminalStore((state) => state.setContext);
    const [filters, setFilters] = useState<SolicitudFilters>({ estado: 'todas' });
    const [localProcessedIds, setLocalProcessedIds] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<'pending' | 'processed'>('pending');

    // Detail Modal State
    const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudViewModel | null>(null);

    const query = useQuery({
        queryKey: ['solicitudes', terminalContext, filters],
        queryFn: () => solicitudesAdapter.list({ terminalContext, filters, scope: 'view' }),
    });

    // In a real app, 'reviewed' would come from backend. Here we merge local state.
    const fullData = useMemo(() => {
        if (!query.data) return [];
        return query.data.map(item => ({
            ...item,
            reviewed: item.reviewed || localProcessedIds.includes(item.id)
        }));
    }, [query.data, localProcessedIds]);

    const displayData = useMemo(() => {
        if (viewMode === 'pending') {
            return fullData.filter(item => !item.reviewed);
        } else {
            return fullData.filter(item => item.reviewed);
        }
    }, [fullData, viewMode]);

    const handleMarkAsReviewed = (id: string) => {
        setLocalProcessedIds(prev => [...prev, id]);
        setSelectedSolicitud(null); // Close modal
    };

    const columns: TableColumn<SolicitudViewModel>[] = useMemo(
        () => [
            { key: 'tipo', header: 'Tipo', render: (row) => <span className="font-medium text-slate-700">{row.tipo}</span> },
            { key: 'solicitante', header: 'Solicitante' },
            {
                key: 'estado',
                header: 'Estado',
                render: (row) => (
                    <span className={`badge capitalize ${row.estado === 'listo' ? 'bg-indigo-100 text-indigo-700' : ''}`}>
                        {row.estado === 'listo' ? 'Listo' : row.estado}
                    </span>
                ),
                value: (row) => row.estado
            },
            { key: 'fecha', header: 'Fecha' },
            {
                key: 'id',
                header: 'Acciones',
                render: (row) => (
                    <button
                        onClick={(e) => { e.stopPropagation(); setSelectedSolicitud(row); }}
                        className="btn btn-sm btn-ghost text-brand-600 hover:bg-brand-50"
                    >
                        Ver Detalle
                    </button>
                )
            },
        ],
        [],
    );

    const exportColumns = [
        { key: 'id', header: 'ID' },
        { key: 'tipo', header: 'Tipo' },
        { key: 'solicitante', header: 'Solicitante' },
        { key: 'estado', header: 'Estado' },
        { key: 'fecha', header: 'Fecha' },
        { key: 'reviewed', header: 'Revisado', value: (row: any) => row.reviewed ? 'SI' : 'NO' }
    ];

    const handleExportView = () => {
        exportToXlsx({ filename: 'solicitudes_vista', sheetName: 'Solicitudes', rows: displayData, columns: exportColumns });
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('pending')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Pendientes ({fullData.filter(i => !i.reviewed).length})
                    </button>
                    <button
                        onClick={() => setViewMode('processed')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'processed' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Procesados ({fullData.filter(i => i.reviewed).length})
                    </button>
                </div>

                <div className="flex gap-2">
                    <FiltersBar terminalContext={terminalContext} onTerminalChange={setTerminalContext}>
                        {null}
                    </FiltersBar>
                    <ExportMenu onExportView={handleExportView} onExportAll={() => { }} />
                </div>
            </div>

            {query.isLoading && <LoadingState />}
            {query.isError && <ErrorState onRetry={query.refetch} />}

            {!query.isLoading && !query.isError && (
                <>
                    {!displayData.length && (
                        <EmptyState
                            description={viewMode === 'pending' ? "¡Todo al día! No hay solicitudes pendientes." : "No hay solicitudes procesadas aún."}
                        />
                    )}

                    {displayData.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <DataTable
                                columns={columns}
                                rows={displayData}
                            /* onRowClick={(row) => setSelectedSolicitud(row)} */ // Optional: allow row click to open
                            />
                        </div>
                    )}
                </>
            )}

            {/* Detail Modal */}
            {selectedSolicitud && (
                <SolicitudDetailModal
                    solicitud={selectedSolicitud}
                    onClose={() => setSelectedSolicitud(null)}
                    onMarkAsReviewed={!selectedSolicitud.reviewed ? () => handleMarkAsReviewed(selectedSolicitud.id) : undefined}
                />
            )}
        </div>
    );
};
