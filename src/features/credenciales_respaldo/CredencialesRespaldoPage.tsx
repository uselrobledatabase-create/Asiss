import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CreditCard, Settings, Download, Filter, AlertTriangle, ClipboardList } from 'lucide-react';
import { PageHeader } from '../../shared/components/common/PageHeader';
import { LoadingState } from '../../shared/components/common/LoadingState';
import { ErrorState } from '../../shared/components/common/ErrorState';
import { exportToXlsx } from '../../shared/utils/exportToXlsx';
import { KpiCards } from './components/KpiCards';
import { ChartsPanel } from './components/ChartsPanel';
import { LoansTable } from './components/LoansTable';
import { LoanFormModal } from './components/LoanFormModal';
import { LoanDetailModal } from './components/LoanDetailModal';
import { RecoverModal } from './components/RecoverModal';
import { CancelModal } from './components/CancelModal';
import { CardsInventoryModal } from './components/CardsInventoryModal';
import { EmailSettingsModal } from './components/EmailSettingsModal';
import { SignedDocumentModal } from './components/SignedDocumentModal';
import { InventoryPanel } from './components/InventoryPanel';
import { ConfirmDialog } from '../../shared/components/common/ConfirmDialog';
import {
    fetchLoans,
    fetchKpis,
    fetchEmailSettings,
    createLoan,
    recoverLoan,
    cancelLoan,
    deleteLoan,
    sendBackupEmails,
    EmailAttachment,
} from './api/backupApi';
import {
    BackupLoan,
    BackupLoansFilters,
    LoanFormValues,
    TerminalFilter,
    STATUS_OPTIONS,
    REASON_OPTIONS,
} from './types';
import { formatRut } from './utils/rut';
import { useSessionStore } from '../../shared/state/sessionStore';
import { showSuccessToast, showErrorToast, showWarningToast } from '../../shared/state/toastStore';

export const CredencialesRespaldoPage = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((state) => state.session);

    // Shared terminal filter — drives BOTH the inventory panel and the loans registry
    const [terminalFilter, setTerminalFilter] = useState<TerminalFilter>('TODAS');

    // Filters
    const [filters, setFilters] = useState<BackupLoansFilters>({
        status: 'TODAS',
        reason: 'TODAS',
        alertsOnly: false,
    });

    // Modals
    const [showNewLoanModal, setShowNewLoanModal] = useState(false);
    const [showCardsModal, setShowCardsModal] = useState(false);
    const [showEmailSettingsModal, setShowEmailSettingsModal] = useState(false);
    const [selectedLoan, setSelectedLoan] = useState<BackupLoan | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showRecoverModal, setShowRecoverModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showSignedDocModal, setShowSignedDocModal] = useState(false);
    const [pendingEmailLoan, setPendingEmailLoan] = useState<BackupLoan | null>(null);
    const [emailSendLoading, setEmailSendLoading] = useState(false);
    const [loanToDelete, setLoanToDelete] = useState<BackupLoan | null>(null);

    // Queries
    const loansQuery = useQuery({
        queryKey: ['backup-loans', filters],
        queryFn: () => fetchLoans(filters),
    });

    const kpisQuery = useQuery({
        queryKey: ['backup-kpis'],
        queryFn: fetchKpis,
    });

    const emailSettingsQuery = useQuery({
        queryKey: ['backup-email-settings'],
        queryFn: fetchEmailSettings,
    });

    // Mutations
    const createLoanMutation = useMutation({
        mutationFn: async (values: LoanFormValues) => {
            const loan = await createLoan(values);
            return { loan, sendEmails: values.send_emails };
        },
        onSuccess: ({ loan, sendEmails }) => {
            queryClient.invalidateQueries({ queryKey: ['backup-loans'] });
            queryClient.invalidateQueries({ queryKey: ['backup-kpis'] });
            queryClient.invalidateQueries({ queryKey: ['backup-cards'] });
            setShowNewLoanModal(false);

            // If emails should be sent, open the signed document modal
            if (sendEmails) {
                setPendingEmailLoan(loan);
                setShowSignedDocModal(true);
            }
        },
    });

    const recoverMutation = useMutation({
        mutationFn: ({ id, recoveredAt, observation }: { id: string; recoveredAt: string; observation?: string }) =>
            recoverLoan(id, recoveredAt, observation),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backup-loans'] });
            queryClient.invalidateQueries({ queryKey: ['backup-kpis'] });
            queryClient.invalidateQueries({ queryKey: ['backup-cards'] });
            setShowRecoverModal(false);
            setSelectedLoan(null);
        },
    });

    const cancelMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelLoan(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backup-loans'] });
            queryClient.invalidateQueries({ queryKey: ['backup-kpis'] });
            queryClient.invalidateQueries({ queryKey: ['backup-cards'] });
            setShowCancelModal(false);
            setSelectedLoan(null);
        },
    });

    const deleteLoanMutation = useMutation({
        mutationFn: (id: string) => deleteLoan(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backup-loans'] });
            queryClient.invalidateQueries({ queryKey: ['backup-kpis'] });
            queryClient.invalidateQueries({ queryKey: ['backup-cards'] });
            setLoanToDelete(null);
            showSuccessToast('Registro eliminado', 'El registro de prestamo fue eliminado.');
        },
        onError: (error: unknown) => {
            showErrorToast('No se pudo eliminar', error instanceof Error ? error.message : 'Error desconocido');
        },
    });

    // Filter loans by the shared terminal filter (by the assigned card's inventory terminal,
    // so the registry mirrors exactly what the inventory panel shows for that terminal)
    const filteredLoans = useMemo(() => {
        let loans = loansQuery.data || [];

        if (terminalFilter !== 'TODAS') {
            loans = loans.filter((l) => l.backup_cards?.inventory_terminal === terminalFilter);
        }

        if (filters.alertsOnly) {
            const now = new Date();
            loans = loans.filter((l) => {
                if (l.status !== 'ASIGNADA') return false;
                const issuedAt = new Date(l.issued_at);
                const daysPassed = Math.floor((now.getTime() - issuedAt.getTime()) / (1000 * 60 * 60 * 24));
                return daysPassed > l.alert_after_days;
            });
        }

        return loans;
    }, [loansQuery.data, terminalFilter, filters.alertsOnly]);

    // Handlers
    const handleView = (loan: BackupLoan) => {
        setSelectedLoan(loan);
        setShowDetailModal(true);
    };

    const handleEdit = (loan: BackupLoan) => {
        // For now, just view - edit can be added later
        handleView(loan);
    };

    const handleRecover = (loan: BackupLoan) => {
        setSelectedLoan(loan);
        setShowRecoverModal(true);
    };

    const handleCancel = (loan: BackupLoan) => {
        setSelectedLoan(loan);
        setShowCancelModal(true);
    };

    const handleResendEmails = (loan: BackupLoan) => {
        // Open signed document modal for resending
        setPendingEmailLoan(loan);
        setShowSignedDocModal(true);
    };

    const handleSendEmailWithAttachment = async (attachment: EmailAttachment | null) => {
        if (!pendingEmailLoan) return;

        const settings = emailSettingsQuery.data?.find(
            (s) => s.scope_code === pendingEmailLoan.person_terminal || s.scope_type === 'GLOBAL'
        );

        if (!settings) {
            showWarningToast('Configuración requerida', 'Configure los correos primero en el botón "Correos"');
            setShowSignedDocModal(false);
            setPendingEmailLoan(null);
            return;
        }

        setEmailSendLoading(true);
        const result = await sendBackupEmails(
            pendingEmailLoan,
            settings.manager_email,
            settings.cc_emails || undefined,
            attachment
        );
        setEmailSendLoading(false);

        if (result.success) {
            showSuccessToast('Correos enviados', 'Los correos de notificación fueron enviados correctamente', pendingEmailLoan.person_name);
            queryClient.invalidateQueries({ queryKey: ['backup-loans'] });
        } else {
            showErrorToast('Error al enviar correos', result.error || 'Error desconocido');
        }

        setShowSignedDocModal(false);
        setPendingEmailLoan(null);
    };

    const handleExport = () => {
        if (!filteredLoans.length) return;

        const now = new Date();
        const exportData = filteredLoans.map((loan) => {
            const issuedAt = new Date(loan.issued_at);
            const daysPassed = Math.floor((now.getTime() - issuedAt.getTime()) / (1000 * 60 * 60 * 24));
            return {
                rut: formatRut(loan.person_rut),
                nombre: loan.person_name,
                cargo: loan.person_cargo || '',
                terminal: loan.person_terminal,
                tarjeta: loan.backup_cards?.card_number || '',
                motivo: loan.reason === 'PERDIDA' ? 'Perdida' : 'Deterioro',
                fecha_entrega: new Date(loan.issued_at).toLocaleDateString('es-CL'),
                dias: daysPassed,
                estado: loan.status,
                descuento: loan.discount_applied ? loan.discount_amount : 0,
                correo_trabajador: loan.boss_email || '',
                creado_por: loan.created_by_supervisor,
            };
        });

        exportToXlsx({
            filename: `prestamos_respaldo_${new Date().toISOString().split('T')[0]}`,
            sheetName: 'Prestamos',
            rows: exportData,
            columns: [
                { key: 'rut', header: 'RUT' },
                { key: 'nombre', header: 'Nombre' },
                { key: 'cargo', header: 'Cargo' },
                { key: 'terminal', header: 'Terminal' },
                { key: 'tarjeta', header: 'Tarjeta' },
                { key: 'motivo', header: 'Motivo' },
                { key: 'fecha_entrega', header: 'Fecha Entrega' },
                { key: 'dias', header: 'Dias' },
                { key: 'estado', header: 'Estado' },
                { key: 'descuento', header: 'Descuento' },
                { key: 'email_jefatura', header: 'Email Jefatura' },
                { key: 'creado_por', header: 'Creado Por' },
            ],
        });
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Credenciales de Respaldo"
                description="Control de prestamo de tarjetas de respaldo"
                actions={
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setShowEmailSettingsModal(true)}
                            className="btn btn-secondary flex items-center gap-2"
                        >
                            <Settings className="w-4 h-4" />
                            <span className="hidden sm:inline">Correos</span>
                        </button>
                        <button
                            onClick={() => setShowCardsModal(true)}
                            className="btn btn-secondary flex items-center gap-2"
                        >
                            <CreditCard className="w-4 h-4" />
                            <span className="hidden sm:inline">Tarjetas</span>
                        </button>
                        <button onClick={handleExport} className="btn btn-secondary flex items-center gap-2">
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">XLSX</span>
                        </button>
                        <button
                            onClick={() => setShowNewLoanModal(true)}
                            className="btn btn-primary flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Nuevo Prestamo
                        </button>
                    </div>
                }
            />

            {/* KPIs */}
            <KpiCards kpis={kpisQuery.data || {
                availableByTerminal: { 'El Roble': 0, 'La Reina': 0, 'Maria Angelica': 0 },
                activeLoans: 0,
                overdueLoans: 0,
                avgReturnDays: 0,
                totalDiscounts: 0,
            }} isLoading={kpisQuery.isLoading} />

            {/* Charts */}
            {!loansQuery.isLoading && loansQuery.data && loansQuery.data.length > 0 && (
                <ChartsPanel loans={loansQuery.data} />
            )}

            {/* Inventory by terminal (El Roble / La Reina / Maria Angelica) — the terminal
                filter here is shared and also filters the loans registry below */}
            <InventoryPanel terminalFilter={terminalFilter} onTerminalFilterChange={setTerminalFilter} />

            <div className="divider" />

            {/* Loan registry section header */}
            <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 text-white">
                    <ClipboardList className="w-5 h-5" />
                </span>
                <div>
                    <h2 className="text-lg font-bold text-slate-900 leading-tight flex items-center gap-2">
                        Registros de Prestamos
                        {terminalFilter !== 'TODAS' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold">
                                {terminalFilter}
                            </span>
                        )}
                    </h2>
                    <p className="text-xs text-slate-500">
                        Historial de entregas y devoluciones · sincronizado con el filtro de terminal del inventario
                    </p>
                </div>
            </div>

            {/* Compact Filters */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter className="w-4 h-4 text-slate-400 flex-shrink-0 hidden md:block" />
                    <input
                        type="text"
                        className="h-9 md:h-8 px-3 text-sm border border-slate-200 rounded-lg w-full md:w-40 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                        placeholder="Buscar RUT o Nombre..."
                        value={filters.search || ''}
                        onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <select
                        className="h-9 md:h-8 px-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 w-full md:w-auto transition-all"
                        value={filters.status || 'TODAS'}
                        onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as any }))}
                    >
                        <option value="TODAS">Todo Estado</option>
                        {STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <select
                        className="h-9 md:h-8 px-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 w-full md:w-auto flex-grow md:flex-grow-0 transition-all"
                        value={filters.reason || 'TODAS'}
                        onChange={(e) => setFilters((prev) => ({ ...prev, reason: e.target.value as any }))}
                    >
                        <option value="TODAS">Todo Motivo</option>
                        {REASON_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>

                    <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors select-none h-9 md:h-8">
                        <input
                            type="checkbox"
                            checked={filters.alertsOnly || false}
                            onChange={(e) => setFilters((prev) => ({ ...prev, alertsOnly: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                        />
                        <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-xs font-medium text-slate-700">Atrasados</span>
                        </div>
                    </label>
                </div>

                <div className="hidden md:block h-4 w-px bg-slate-200" />

                <div className="grid grid-cols-2 items-center gap-2 w-full md:w-auto">
                    <input
                        type="date"
                        className="h-9 md:h-8 px-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 w-full transition-all"
                        value={filters.dateFrom || ''}
                        onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                        title="Desde"
                    />
                    <input
                        type="date"
                        className="h-9 md:h-8 px-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 w-full transition-all"
                        value={filters.dateTo || ''}
                        onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                        title="Hasta"
                    />
                </div>
            </div>

            {/* Table */}
            {loansQuery.isLoading && <LoadingState label="Cargando prestamos..." />}
            {loansQuery.isError && <ErrorState message="Error al cargar prestamos" onRetry={loansQuery.refetch} />}
            {!loansQuery.isLoading && !loansQuery.isError && (
                <LoansTable
                    loans={filteredLoans}
                    onView={handleView}
                    onEdit={handleEdit}
                    onRecover={handleRecover}
                    onCancel={handleCancel}
                    onResendEmails={handleResendEmails}
                    onDelete={setLoanToDelete}
                />
            )}

            {/* Modals */}
            <LoanFormModal
                isOpen={showNewLoanModal}
                onClose={() => setShowNewLoanModal(false)}
                onSubmit={async (values, printFn) => {
                    const result = await createLoanMutation.mutateAsync(values);
                    // Print AFTER successful save if discount was applied
                    if (values.discount_applied) {
                        printFn();
                    }
                }}
                isLoading={createLoanMutation.isPending}
                supervisorName={session?.supervisorName || 'Supervisor'}
            />

            <LoanDetailModal
                isOpen={showDetailModal}
                loan={selectedLoan}
                onClose={() => {
                    setShowDetailModal(false);
                    setSelectedLoan(null);
                }}
            />

            <RecoverModal
                isOpen={showRecoverModal}
                loan={selectedLoan}
                onClose={() => {
                    setShowRecoverModal(false);
                    setSelectedLoan(null);
                }}
                onSubmit={async (id, recoveredAt, observation) => {
                    await recoverMutation.mutateAsync({ id, recoveredAt, observation });
                }}
                isLoading={recoverMutation.isPending}
            />

            <CancelModal
                isOpen={showCancelModal}
                loan={selectedLoan}
                onClose={() => {
                    setShowCancelModal(false);
                    setSelectedLoan(null);
                }}
                onSubmit={async (id, reason) => {
                    await cancelMutation.mutateAsync({ id, reason });
                }}
                isLoading={cancelMutation.isPending}
            />

            <CardsInventoryModal
                isOpen={showCardsModal}
                onClose={() => setShowCardsModal(false)}
            />

            <EmailSettingsModal
                isOpen={showEmailSettingsModal}
                onClose={() => setShowEmailSettingsModal(false)}
            />

            <SignedDocumentModal
                isOpen={showSignedDocModal}
                loan={pendingEmailLoan}
                managerEmail={emailSettingsQuery.data?.find(
                    (s) => s.scope_code === pendingEmailLoan?.person_terminal || s.scope_type === 'GLOBAL'
                )?.manager_email || ''}
                workerEmail={pendingEmailLoan?.boss_email || ''}
                cc={emailSettingsQuery.data?.find(
                    (s) => s.scope_code === pendingEmailLoan?.person_terminal || s.scope_type === 'GLOBAL'
                )?.cc_emails || undefined}
                onClose={() => {
                    setShowSignedDocModal(false);
                    setPendingEmailLoan(null);
                }}
                onSubmit={handleSendEmailWithAttachment}
                isLoading={emailSendLoading}
            />

            <ConfirmDialog
                isOpen={!!loanToDelete}
                title="Eliminar registro"
                message={
                    <>
                        Vas a eliminar el registro de prestamo de{' '}
                        <strong className="text-slate-900">{loanToDelete?.person_name}</strong>
                        {loanToDelete?.backup_cards?.card_number ? (
                            <> (tarjeta <strong className="text-slate-900 font-mono">{loanToDelete.backup_cards.card_number}</strong>)</>
                        ) : null}
                        . Esta accion es permanente y no se puede deshacer.
                        {loanToDelete?.status === 'ASIGNADA' && (
                            <span className="block mt-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                El prestamo esta activo: al eliminarlo, la tarjeta se liberara automaticamente al inventario.
                            </span>
                        )}
                    </>
                }
                isLoading={deleteLoanMutation.isPending}
                onConfirm={() => loanToDelete && deleteLoanMutation.mutate(loanToDelete.id)}
                onClose={() => setLoanToDelete(null)}
            />
        </div>
    );
};
