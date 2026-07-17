import { useState } from 'react';
import { PageHeader } from '../../../shared/components/common/PageHeader';
import { FiltersBar } from '../../../shared/components/common/FiltersBar';
import { LoadingState } from '../../../shared/components/common/LoadingState';
import { ErrorState } from '../../../shared/components/common/ErrorState';
import { ExportMenu } from '../../../shared/components/common/ExportMenu';
import { Icon } from '../../../shared/components/common/Icon';
import { useTerminalStore } from '../../../shared/state/terminalStore';
import { useSessionStore } from '../../../shared/state/sessionStore';
import { exportToXlsx } from '../../../shared/utils/exportToXlsx';
import { displayTerminal } from '../../../shared/utils/terminal';
import { formatRut } from '../../personal/utils/rutUtils';
import { formatDateDDMMYYYY } from '../../../shared/utils/dates';
import { isAuthorizer } from '../utils/authorizers';
import { AttendanceKPIs } from '../components/AttendanceKPIs';
import { AuthorizeRejectModal } from '../components/AuthorizeRejectModal';
import { RecordCard, RecordCardList, RecordChip, RecordActions } from '../components/RecordCard';
import { AutorizacionesForm } from '../forms/AutorizacionesForm';
import { useAutorizaciones, useAttendanceKPIs, useCreateAutorizacion, useUpdateAutorizacion, useAuthorize, useReject, useAttendanceRealtime } from '../hooks';
import { AttendanceFilters, AUTH_STATUS_OPTIONS, Autorizacion, AutorizacionFormValues, ENTRY_EXIT_OPTIONS } from '../types';

type ModalState =
    | { type: 'none' }
    | { type: 'create' }
    | { type: 'edit'; record: Autorizacion }
    | { type: 'authorize'; record: Autorizacion }
    | { type: 'reject'; record: Autorizacion };

export const AutorizacionesPage = () => {
    const terminalContext = useTerminalStore((s) => s.context);
    const setTerminalContext = useTerminalStore((s) => s.setContext);
    const session = useSessionStore((s) => s.session);
    const supervisorName = session?.supervisorName ?? '';
    const canAuthorize = isAuthorizer(supervisorName);

    const [filters, setFilters] = useState<AttendanceFilters>({
        auth_status: canAuthorize ? 'PENDIENTE' : 'todos',
    });
    const [modal, setModal] = useState<ModalState>({ type: 'none' });

    const query = useAutorizaciones(terminalContext, filters);
    const kpis = useAttendanceKPIs('autorizaciones', terminalContext);
    const createMutation = useCreateAutorizacion();
    const updateMutation = useUpdateAutorizacion();
    const authorizeMutation = useAuthorize();
    const rejectMutation = useReject();
    useAttendanceRealtime();

    const getEntryExitLabel = (value: string) => ENTRY_EXIT_OPTIONS.find(o => o.value === value)?.label || value;

    const exportColumns = [
        { key: 'rut', header: 'RUT', value: (r: Autorizacion) => formatRut(r.rut) },
        { key: 'nombre', header: 'Nombre', value: (r: Autorizacion) => r.nombre },
        { key: 'cargo', header: 'Cargo', value: (r: Autorizacion) => r.cargo },
        { key: 'terminal', header: 'Terminal', value: (r: Autorizacion) => displayTerminal(r.terminal_code) },
        { key: 'turno', header: 'Turno', value: (r: Autorizacion) => r.turno },
        { key: 'horario', header: 'Horario', value: (r: Autorizacion) => r.horario },
        { key: 'authorization_date', header: 'Fecha', value: (r: Autorizacion) => formatDateDDMMYYYY(r.authorization_date) },
        { key: 'entry_or_exit', header: 'Tipo', value: (r: Autorizacion) => getEntryExitLabel(r.entry_or_exit) },
        { key: 'motivo', header: 'Motivo', value: (r: Autorizacion) => r.motivo },
        { key: 'auth_status', header: 'Autorización', value: (r: Autorizacion) => r.auth_status },
    ];

    const handleCreate = async (values: AutorizacionFormValues) => {
        await createMutation.mutateAsync({ values, createdBy: supervisorName });
        setModal({ type: 'none' });
    };

    const handleUpdate = async (values: AutorizacionFormValues) => {
        if (modal.type !== 'edit') return;
        await updateMutation.mutateAsync({ id: modal.record.id, values });
        setModal({ type: 'none' });
    };

    const handleAuthorize = async () => {
        if (modal.type !== 'authorize') return;
        const r = modal.record;
        await authorizeMutation.mutateAsync({
            subsection: 'autorizaciones',
            id: r.id,
            authorizedBy: supervisorName,
            rut: r.rut,
            nombre: r.nombre,
            terminal: r.terminal_code,
            date: r.authorization_date,
        });
        setModal({ type: 'none' });
    };

    const handleReject = async (reason?: string) => {
        if (modal.type !== 'reject' || !reason) return;
        const r = modal.record;
        await rejectMutation.mutateAsync({
            subsection: 'autorizaciones',
            id: r.id,
            authorizedBy: supervisorName,
            reason,
            rut: r.rut,
            nombre: r.nombre,
            terminal: r.terminal_code,
            date: r.authorization_date,
        });
        setModal({ type: 'none' });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'AUTORIZADO': return <span className="badge badge-success">{status}</span>;
            case 'RECHAZADO': return <span className="badge badge-danger">{status}</span>;
            default: return <span className="badge badge-warning">{status}</span>;
        }
    };

    const getTypeBadge = (type: string) => {
        return type === 'ENTRADA'
            ? <span className="badge bg-blue-100 text-blue-700">Llegada Tardía</span>
            : <span className="badge bg-purple-100 text-purple-700">Retiro Anticipado</span>;
    };

    return (
        <div className="space-y-4">
            <PageHeader
                title="Autorizaciones"
                description="Retiros anticipados y llegadas tardías"
                actions={
                    <div className="flex gap-2">
                        <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
                            <Icon name="check-circle" size={18} /> Nueva Solicitud
                        </button>
                        <ExportMenu
                            onExportView={() => exportToXlsx({ filename: 'autorizaciones', sheetName: 'Datos', rows: query.data || [], columns: exportColumns })}
                            onExportAll={() => exportToXlsx({ filename: 'autorizaciones_all', sheetName: 'Datos', rows: query.data || [], columns: exportColumns })}
                        />
                    </div>
                }
            />

            <AttendanceKPIs data={kpis.data} isLoading={kpis.isLoading} />

            <FiltersBar terminalContext={terminalContext} onTerminalChange={setTerminalContext}>
                <div className="flex flex-col gap-1">
                    <label className="label">Estado</label>
                    <select className="input" value={filters.auth_status}
                        onChange={(e) => setFilters((prev) => ({ ...prev, auth_status: e.target.value as any }))}>
                        {AUTH_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="label">Buscar</label>
                    <input className="input" placeholder="RUT o nombre" value={filters.search ?? ''}
                        onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} />
                </div>
            </FiltersBar>

            {query.isLoading && <LoadingState label="Cargando registros..." />}
            {query.isError && <ErrorState onRetry={() => query.refetch()} />}
            {!query.isLoading && !query.isError && (
                <RecordCardList empty="Sin autorizaciones para el filtro aplicado">
                    {(query.data || []).map((row) => (
                        <RecordCard
                            key={row.id}
                            nombre={row.nombre}
                            rut={formatRut(row.rut)}
                            status={row.auth_status}
                            rejectionReason={row.rejection_reason}
                            chips={
                                <>
                                    <RecordChip tone="brand">{displayTerminal(row.terminal_code)}</RecordChip>
                                    <RecordChip>{formatDateDDMMYYYY(row.authorization_date)}</RecordChip>
                                </>
                            }
                            fields={[
                                {
                                    label: 'Tipo',
                                    value: row.entry_or_exit === 'ENTRADA' ? 'Llegada tardía (entrada)' : 'Retiro anticipado (salida)',
                                },
                                { label: 'Motivo', value: row.motivo, wide: true },
                            ]}
                            actions={
                                <RecordActions
                                    canEdit={row.auth_status === 'PENDIENTE'}
                                    canAuthorize={canAuthorize && row.auth_status === 'PENDIENTE'}
                                    onEdit={() => setModal({ type: 'edit', record: row })}
                                    onAuthorize={() => setModal({ type: 'authorize', record: row })}
                                    onReject={() => setModal({ type: 'reject', record: row })}
                                />
                            }
                        />
                    ))}
                </RecordCardList>
            )}

            {(modal.type === 'create' || modal.type === 'edit') && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModal({ type: 'none' })} />
                    <div className="relative w-full max-w-3xl card p-6 max-h-[90vh] overflow-y-auto animate-scale-in">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold">{modal.type === 'create' ? 'Nueva Solicitud' : 'Editar Solicitud'}</h3>
                            <button onClick={() => setModal({ type: 'none' })} className="text-slate-400 hover:text-slate-600"><Icon name="x" size={24} /></button>
                        </div>
                        <AutorizacionesForm
                            initialData={modal.type === 'edit' ? { ...modal.record, cargo: modal.record.cargo ?? '', turno: modal.record.turno ?? '', horario: modal.record.horario ?? '' } : undefined}
                            onSubmit={modal.type === 'create' ? handleCreate : handleUpdate}
                            onCancel={() => setModal({ type: 'none' })}
                            isLoading={createMutation.isPending || updateMutation.isPending}
                        />
                    </div>
                </div>
            )}

            {modal.type === 'authorize' && (
                <AuthorizeRejectModal mode="authorize" itemName={modal.record.nombre}
                    onConfirm={handleAuthorize} onCancel={() => setModal({ type: 'none' })} isLoading={authorizeMutation.isPending} />
            )}

            {modal.type === 'reject' && (
                <AuthorizeRejectModal mode="reject" itemName={modal.record.nombre}
                    onConfirm={handleReject} onCancel={() => setModal({ type: 'none' })} isLoading={rejectMutation.isPending} />
            )}
        </div>
    );
};
