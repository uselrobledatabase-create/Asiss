// Types for Credenciales de Respaldo feature

// Enums matching database
export type BackupCardStatus = 'LIBRE' | 'ASIGNADA' | 'INACTIVA';
export type BackupLoanStatus = 'ASIGNADA' | 'RECUPERADA' | 'CERRADA' | 'CANCELADA';
export type BackupReason = 'PERDIDA' | 'DETERIORO';

// Inventory terminal options
export const INVENTORY_TERMINALS = ['El Roble', 'La Reina', 'Maria Angelica'] as const;
export type InventoryTerminal = typeof INVENTORY_TERMINALS[number];

// Shared terminal filter used by both the inventory panel and the loans registry
export type TerminalFilter = 'TODAS' | InventoryTerminal;

// Backup card (inventory)
export interface BackupCard {
    id: string;
    card_number: string;
    inventory_terminal: InventoryTerminal;
    status: BackupCardStatus;
    notes?: string | null;
    created_at: string;
    updated_at: string;
}

// Backup loan
export interface BackupLoan {
    id: string;
    card_id: string;
    person_rut: string;
    person_name: string;
    person_cargo?: string | null;
    person_terminal: string;
    person_turno?: string | null;
    person_horario?: string | null;
    person_contacto?: string | null;
    boss_email?: string | null;  // Database column (used for worker notification email)
    reason: BackupReason;
    requested_at: string;
    issued_at: string;
    expected_return_days: number;
    alert_after_days: number;
    status: BackupLoanStatus;
    recovered_at?: string | null;
    closed_at?: string | null;
    cancel_reason?: string | null;
    discount_amount: number;
    discount_applied: boolean;
    discount_evidence_path?: string | null;
    created_by_supervisor: string;
    emails_sent_at?: string | null;
    created_at: string;
    updated_at: string;
    // Joined card info
    backup_cards?: BackupCard;
}

// Email settings
export interface BackupEmailSettings {
    id: string;
    scope_type: 'GLOBAL' | 'TERMINAL';
    scope_code: string;
    manager_email: string;
    cc_emails?: string | null;
    subject_manager: string;
    subject_boss: string;
    enabled: boolean;
    updated_at: string;
}

// Form values for creating a loan
export interface LoanFormValues {
    // Person data
    person_rut: string;
    person_name: string;
    person_cargo: string;
    person_terminal: string;
    // Request
    reason: BackupReason;
    requested_at: string;
    // Assignment date (issued_at) — editable, defaults to today
    issued_at: string;
    // Card
    card_id: string;
    // Discount
    discount_applied: boolean;
    discount_amount: number;
    // Email
    send_emails: boolean;
    // Supervisor
    created_by_supervisor: string;
}

// Card form values
export interface CardFormValues {
    card_number: string;
    inventory_terminal: InventoryTerminal;
    notes: string;
}

// Filters
export interface BackupLoansFilters {
    search?: string;
    terminal?: string;
    status?: BackupLoanStatus | 'TODAS';
    reason?: BackupReason | 'TODAS';
    dateFrom?: string;
    dateTo?: string;
    alertsOnly?: boolean;
}

// KPI data
export interface BackupKpis {
    availableByTerminal: Record<InventoryTerminal, number>;
    activeLoans: number;
    overdueLoans: number;
    avgReturnDays: number;
    totalDiscounts: number;
}

// Chart data
export interface WeeklyLoanData {
    week: string;
    count: number;
}

export interface ReasonBreakdown {
    name: string;
    value: number;
}

export interface TerminalStatusData {
    terminal: string;
    LIBRE: number;
    ASIGNADA: number;
    RECUPERADA: number;
    CERRADA: number;
}

// Options
export const REASON_OPTIONS = [
    { value: 'PERDIDA', label: 'Perdida' },
    { value: 'DETERIORO', label: 'Deterioro' },
] as const;

export const STATUS_OPTIONS = [
    { value: 'ASIGNADA', label: 'Asignada' },
    { value: 'RECUPERADA', label: 'Recuperada' },
    { value: 'CERRADA', label: 'Cerrada' },
    { value: 'CANCELADA', label: 'Cancelada' },
] as const;

export const CARD_STATUS_OPTIONS = [
    { value: 'LIBRE', label: 'Libre' },
    { value: 'ASIGNADA', label: 'Asignada' },
    { value: 'INACTIVA', label: 'Inactiva' },
] as const;
