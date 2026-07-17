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
import { CambiosDeDiaForm } from '../forms/CambiosDeDiaForm';
import { useCambiosDia, useAttendanceKPIs, useCreateCambioDia, useUpdateCambioDia, useAuthorize, useReject, useAttendanceRealtime } from '../hooks';
import { getDocumentUrl } from '../api';
import { AttendanceFilters, AUTH_STATUS_OPTIONS, CambioDia, CambioDiaFormValues } from '../types';
import { useStaffList } from '../../personal/hooks';

type ModalState =
    | { type: 'none' }
    | { type: 'create' }
    | { type: 'edit'; record: CambioDia }
    | { type: 'authorize'; record: CambioDia }
    | { type: 'reject'; record: CambioDia };

export const CambiosDeDiaPage = () => {
    const terminalContext = useTerminalStore((s) => s.context);
    const setTerminalContext = useTerminalStore((s) => s.setContext);
    const session = useSessionStore((s) => s.session);
    const supervisorName = session?.supervisorName ?? '';
    const canAuthorize = isAuthorizer(supervisorName);

    const [filters, setFilters] = useState<AttendanceFilters>({
        auth_status: canAuthorize ? 'PENDIENTE' : 'todos',
    });
    const [modal, setModal] = useState<ModalState>({ type: 'none' });

    const query = useCambiosDia(terminalContext, filters);
    const kpis = useAttendanceKPIs('cambios-dia', terminalContext);
    const createMutation = useCreateCambioDia();
    const updateMutation = useUpdateCambioDia();
    const authorizeMutation = useAuthorize();
    const rejectMutation = useReject();
    useAttendanceRealtime();

    const staffQuery = useStaffList(terminalContext);
    const getCargo = (rut: string) => {
        const person = staffQuery.data?.find((s: any) => s.rut === rut);
        return person?.cargo || '-';
    };

    const exportColumns = [
        { key: 'rut', header: 'RUT', value: (r: CambioDia) => formatRut(r.rut) },
        { key: 'nombre', header: 'NOMBRE', value: (r: CambioDia) => r.nombre },
        { key: 'terminal', header: 'TERMINAL', value: (r: CambioDia) => displayTerminal(r.terminal_code) },
        { key: 'cabezal', header: 'CABEZAL', value: (r: CambioDia) => r.cabezal || '-' },
        { key: 'day_off_date', header: 'FECHA ORIGINAL', value: (r: CambioDia) => formatDateDDMMYYYY(r.day_off_date) },
        { key: 'day_on_date', header: 'FECHA NUEVO', value: (r: CambioDia) => formatDateDDMMYYYY(r.day_on_date) },
        { key: 'day_on_start', header: 'INICIO NUEVO', value: (r: CambioDia) => r.day_on_start || r.reprogram_start },
        { key: 'day_on_end', header: 'TÉRMINO NUEVO', value: (r: CambioDia) => r.day_on_end || r.reprogram_end },
        { key: 'cargo', header: 'CARGO', value: (r: CambioDia) => getCargo(r.rut) },
        { key: 'autoriza', header: 'Autoriza', value: () => 'CLM' },
        { key: 'area', header: 'Área', value: () => 'Logística' },
        { key: 'responsable', header: 'Responsable', value: () => supervisorName },
        { key: 'motivo_cambio', header: 'Motivo Cambio', value: () => '' },
    ];

    const handleCreate = async (values: CambioDiaFormValues) => {
        await createMutation.mutateAsync({ values, createdBy: supervisorName });
        setModal({ type: 'none' });
    };

    const handleUpdate = async (values: CambioDiaFormValues) => {
        if (modal.type !== 'edit') return;
        await updateMutation.mutateAsync({ id: modal.record.id, values });
        setModal({ type: 'none' });
    };

    const handleAuthorize = async () => {
        if (modal.type !== 'authorize') return;
        const r = modal.record;
        await authorizeMutation.mutateAsync({
            subsection: 'cambios-dia',
            id: r.id,
            authorizedBy: supervisorName,
            rut: r.rut,
            nombre: r.nombre,
            terminal: r.terminal_code,
            date: r.date,
        });
        setModal({ type: 'none' });
    };

    const handleReject = async (reason?: string) => {
        if (modal.type !== 'reject' || !reason) return;
        const r = modal.record;
        await rejectMutation.mutateAsync({
            subsection: 'cambios-dia',
            id: r.id,
            authorizedBy: supervisorName,
            reason,
            rut: r.rut,
            nombre: r.nombre,
            terminal: r.terminal_code,
            date: r.date,
        });
        setModal({ type: 'none' });
    };

    const handleViewDocument = async (path: string) => {
        try {
            const url = await getDocumentUrl(path);
            window.open(url, '_blank');
        } catch (err) {
            console.error('Error getting document URL:', err);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'AUTORIZADO': return <span className="badge badge-success">{status}</span>;
            case 'RECHAZADO': return <span className="badge badge-danger">{status}</span>;
            default: return <span className="badge badge-warning">{status}</span>;
        }
    };

    return (
        <div className="space-y-4">
            <PageHeader
                title="Cambios de Día"
                description="Reprogramaciones de jornada laboral"
                actions={
                    <div className="flex gap-2">
                        <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
                            <Icon name="calendar" size={18} /> Nuevo Registro
                        </button>
                        <ExportMenu
                            onExportView={() => exportToXlsx({ filename: 'cambios_dia', sheetName: 'Datos', rows: query.data || [], columns: exportColumns })}
                            onExportAll={() => exportToXlsx({ filename: 'cambios_dia_all', sheetName: 'Datos', rows: query.data || [], columns: exportColumns })}
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
                <RecordCardList empty="Sin cambios de día para el filtro aplicado">
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
                                    <RecordChip>{formatDateDDMMYYYY(row.date)}</RecordChip>
                                </>
                            }
                            fields={[
                                { label: 'Día que libera', value: row.day_off_date ? formatDateDDMMYYYY(row.day_off_date) : null },
                                { label: 'Día que trabaja', value: row.day_on_date ? formatDateDDMMYYYY(row.day_on_date) : null },
                                { label: 'Turno nuevo', value: row.day_on_start ? `${row.day_on_start} - ${row.day_on_end || ''}` : null },
                                { label: 'Reprogramación', value: row.reprogram_start ? `${row.reprogram_start} - ${row.reprogram_end || ''}` : null },
                                { label: 'Cabezal', value: row.cabezal },
                                {
                                    label: 'Documento',
                                    value: row.document_path ? (
                                        <button onClick={() => handleViewDocument(row.document_path!)} className="font-bold text-brand-600 hover:underline">
                                            Ver documento
                                        </button>
                                    ) : null,
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
                    <div className="relative w-full max-w-4xl card p-6 max-h-[90vh] overflow-y-auto animate-scale-in">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold">{modal.type === 'create' ? 'Nuevo Registro' : 'Editar Registro'}</h3>
                            <button onClick={() => setModal({ type: 'none' })} className="text-slate-400 hover:text-slate-600"><Icon name="x" size={24} /></button>
                        </div>
                        <CambiosDeDiaForm
                            initialData={modal.type === 'edit' ? { ...modal.record, cabezal: modal.record.cabezal ?? '', prog_start: modal.record.prog_start ?? '', prog_end: modal.record.prog_end ?? '', reprogram_start: modal.record.reprogram_start ?? '', reprogram_end: modal.record.reprogram_end ?? '', day_off_date: modal.record.day_off_date ?? '', day_off_start: modal.record.day_off_start ?? '', day_off_end: modal.record.day_off_end ?? '', day_on_date: modal.record.day_on_date ?? '', day_on_start: modal.record.day_on_start ?? '', day_on_end: modal.record.day_on_end ?? '', document: null } : undefined}
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
