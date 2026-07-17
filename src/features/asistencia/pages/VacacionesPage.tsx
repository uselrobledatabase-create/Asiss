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
import { VacacionesCalendar } from '../components/VacacionesCalendar';
import { VacacionesForm } from '../forms/VacacionesForm';
import { useVacaciones, useAttendanceKPIs, useCreateVacacion, useUpdateVacacion, useAuthorize, useReject, useAttendanceRealtime } from '../hooks';
import { AttendanceFilters, AUTH_STATUS_OPTIONS, Vacacion, VacacionFormValues } from '../types';

type ModalState =
    | { type: 'none' }
    | { type: 'create' }
    | { type: 'edit'; record: Vacacion }
    | { type: 'authorize'; record: Vacacion }
    | { type: 'reject'; record: Vacacion };

export const VacacionesPage = () => {
    const terminalContext = useTerminalStore((s) => s.context);
    const setTerminalContext = useTerminalStore((s) => s.setContext);
    const session = useSessionStore((s) => s.session);
    const supervisorName = session?.supervisorName ?? '';
    const canAuthorize = isAuthorizer(supervisorName);

    const [filters, setFilters] = useState<AttendanceFilters>({
        auth_status: canAuthorize ? 'PENDIENTE' : 'todos',
    });
    const [modal, setModal] = useState<ModalState>({ type: 'none' });
    const [showCalendar, setShowCalendar] = useState(false);

    const query = useVacaciones(terminalContext, filters);
    const kpis = useAttendanceKPIs('vacaciones', terminalContext);
    const createMutation = useCreateVacacion();
    const updateMutation = useUpdateVacacion();
    const authorizeMutation = useAuthorize();
    const rejectMutation = useReject();
    useAttendanceRealtime();

    const exportColumns = [
        { key: 'rut', header: 'RUT', value: (r: Vacacion) => formatRut(r.rut) },
        { key: 'nombre', header: 'Nombre', value: (r: Vacacion) => r.nombre },
        { key: 'cargo', header: 'Cargo', value: (r: Vacacion) => r.cargo },
        { key: 'terminal', header: 'Terminal', value: (r: Vacacion) => displayTerminal(r.terminal_code) },
        { key: 'turno', header: 'Turno', value: (r: Vacacion) => r.turno },
        { key: 'start_date', header: 'Fecha Inicio', value: (r: Vacacion) => formatDateDDMMYYYY(r.start_date) },
        { key: 'end_date', header: 'Fecha Término', value: (r: Vacacion) => formatDateDDMMYYYY(r.end_date) },
        { key: 'return_date', header: 'Fecha Vuelta', value: (r: Vacacion) => formatDateDDMMYYYY(r.return_date) },
        { key: 'calendar_days', header: 'Días Calendario', value: (r: Vacacion) => r.calendar_days.toString() },
        { key: 'business_days', header: 'Días Hábiles', value: (r: Vacacion) => r.business_days.toString() },
        { key: 'has_conflict', header: 'Conflicto', value: (r: Vacacion) => r.has_conflict ? 'Sí' : 'No' },
        { key: 'auth_status', header: 'Estado', value: (r: Vacacion) => r.auth_status },
    ];

    const handleCreate = async (values: VacacionFormValues) => {
        await createMutation.mutateAsync({ values, createdBy: supervisorName });
        setModal({ type: 'none' });
    };

    const handleUpdate = async (values: VacacionFormValues) => {
        if (modal.type !== 'edit') return;
        await updateMutation.mutateAsync({ id: modal.record.id, values });
        setModal({ type: 'none' });
    };

    const handleAuthorize = async () => {
        if (modal.type !== 'authorize') return;
        const r = modal.record;
        await authorizeMutation.mutateAsync({
            subsection: 'vacaciones',
            id: r.id,
            authorizedBy: supervisorName,
            rut: r.rut,
            nombre: r.nombre,
            terminal: r.terminal_code,
            date: r.start_date,
        });
        setModal({ type: 'none' });
    };

    const handleReject = async (reason?: string) => {
        if (modal.type !== 'reject' || !reason) return;
        const r = modal.record;
        await rejectMutation.mutateAsync({
            subsection: 'vacaciones',
            id: r.id,
            authorizedBy: supervisorName,
            reason,
            rut: r.rut,
            nombre: r.nombre,
            terminal: r.terminal_code,
            date: r.start_date,
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

    const formatDateShort = (date: string) => {
        return formatDateDDMMYYYY(date);
    };

    return (
        <div className="space-y-4">
            <PageHeader
                title="Vacaciones"
                description="Gestión inteligente de vacaciones con detección de conflictos"
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <button className="btn btn-secondary" onClick={() => setShowCalendar(true)}>
                            <Icon name="calendar" size={16} />
                            <span>Calendario</span>
                        </button>
                        <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
                            <Icon name="plus" size={16} />
                            <span>Nueva Solicitud</span>
                        </button>
                        <ExportMenu
                            onExportView={() => exportToXlsx({ filename: 'vacaciones', sheetName: 'Datos', rows: query.data || [], columns: exportColumns })}
                            onExportAll={() => exportToXlsx({ filename: 'vacaciones_all', sheetName: 'Datos', rows: query.data || [], columns: exportColumns })}
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

            {query.isLoading && <LoadingState label="Cargando vacaciones..." />}
            {query.isError && <ErrorState onRetry={() => query.refetch()} />}
            {!query.isLoading && !query.isError && (
                <RecordCardList empty="No hay solicitudes de vacaciones registradas">
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
                                    {row.cargo && <RecordChip>{row.cargo}</RecordChip>}
                                    {row.turno && <RecordChip tone="indigo">{row.turno}</RecordChip>}
                                </>
                            }
                            fields={[
                                { label: 'Inicio', value: formatDateDDMMYYYY(row.start_date) },
                                { label: 'Término', value: formatDateDDMMYYYY(row.end_date) },
                                { label: 'Regreso', value: formatDateDDMMYYYY(row.return_date) },
                                { label: 'Días corridos', value: row.calendar_days },
                                { label: 'Días hábiles', value: row.business_days },
                                {
                                    label: 'Conflicto de cobertura',
                                    value: row.has_conflict ? (
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${row.conflict_authorized ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>
                                            {row.conflict_authorized ? 'Con conflicto autorizado' : 'CON CONFLICTO'}
                                        </span>
                                    ) : (
                                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Sin conflicto</span>
                                    ),
                                },
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
                            <h3 className="text-xl font-bold">{modal.type === 'create' ? 'Nueva Solicitud de Vacaciones' : 'Editar Solicitud'}</h3>
                            <button onClick={() => setModal({ type: 'none' })} className="text-slate-400 hover:text-slate-600"><Icon name="x" size={24} /></button>
                        </div>
                        <VacacionesForm
                            initialData={modal.type === 'edit' ? modal.record : undefined}
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

            <VacacionesCalendar
                isOpen={showCalendar}
                onClose={() => setShowCalendar(false)}
                vacaciones={query.data || []}
            />
        </div>
    );
};
