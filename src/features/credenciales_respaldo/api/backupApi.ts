import { supabase } from '../../../shared/lib/supabaseClient';
import {
    BackupCard,
    BackupLoan,
    BackupEmailSettings,
    BackupLoansFilters,
    BackupKpis,
    LoanFormValues,
    CardFormValues,
    INVENTORY_TERMINALS,
    InventoryTerminal,
} from '../types';

// ============================================
// CARDS API
// ============================================

export const fetchCards = async (status?: string, terminal?: string): Promise<BackupCard[]> => {
    let query = supabase.from('backup_cards').select('*').order('card_number', { ascending: true });

    if (status && status !== 'TODAS') {
        query = query.eq('status', status);
    }
    if (terminal) {
        query = query.eq('inventory_terminal', terminal);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as BackupCard[];
};

export const fetchAvailableCards = async (terminal?: string): Promise<BackupCard[]> => {
    let query = supabase.from('backup_cards').select('*').eq('status', 'LIBRE').order('card_number');

    if (terminal) {
        query = query.eq('inventory_terminal', terminal);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as BackupCard[];
};

export const createCard = async (values: CardFormValues): Promise<BackupCard> => {
    const { data, error } = await supabase
        .from('backup_cards')
        .insert({
            card_number: values.card_number,
            inventory_terminal: values.inventory_terminal,
            notes: values.notes || null,
            status: 'LIBRE',
        })
        .select()
        .single();

    if (error) throw error;
    return data as BackupCard;
};

export const updateCardStatus = async (id: string, status: string): Promise<void> => {
    const { error } = await supabase
        .from('backup_cards')
        .update({ status })
        .eq('id', id);

    if (error) throw error;
};

export const updateCardNotes = async (id: string, notes: string): Promise<void> => {
    const { error } = await supabase
        .from('backup_cards')
        .update({ notes: notes.trim() || null })
        .eq('id', id);

    if (error) throw error;
};

export const deactivateCard = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('backup_cards')
        .update({ status: 'INACTIVA' })
        .eq('id', id);

    if (error) throw error;
};

export const deleteCard = async (id: string): Promise<void> => {
    // Data integrity guard: a card cannot be deleted while it still has loan records.
    const { data: loans, error: loansError } = await supabase
        .from('backup_loans')
        .select('id, status')
        .eq('card_id', id);

    if (loansError) throw loansError;

    if (loans && loans.length > 0) {
        const hasActive = loans.some((l) => l.status === 'ASIGNADA');
        if (hasActive) {
            throw new Error('La credencial tiene un prestamo activo. Recupere o cancele el prestamo antes de eliminarla.');
        }
        throw new Error(
            `La credencial tiene ${loans.length} registro(s) historico(s) asociado(s). Eliminelos primero desde "Registros de Prestamos".`
        );
    }

    const { error } = await supabase.from('backup_cards').delete().eq('id', id);
    if (error) throw error;
};

// ============================================
// LOANS API
// ============================================

export const fetchLoans = async (filters?: BackupLoansFilters): Promise<BackupLoan[]> => {
    let query = supabase
        .from('backup_loans')
        .select('*, backup_cards(*)')
        .order('issued_at', { ascending: false });

    if (filters) {
        if (filters.search) {
            query = query.or(`person_rut.ilike.%${filters.search}%,person_name.ilike.%${filters.search}%`);
        }
        if (filters.terminal) {
            query = query.eq('person_terminal', filters.terminal);
        }
        if (filters.status && filters.status !== 'TODAS') {
            query = query.eq('status', filters.status);
        }
        if (filters.reason && filters.reason !== 'TODAS') {
            query = query.eq('reason', filters.reason);
        }
        if (filters.dateFrom) {
            query = query.gte('issued_at', filters.dateFrom);
        }
        if (filters.dateTo) {
            query = query.lte('issued_at', filters.dateTo + 'T23:59:59');
        }
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as BackupLoan[];
};

export const createLoan = async (values: LoanFormValues): Promise<BackupLoan> => {
    // Start a transaction: create loan and update card status
    const { data: loan, error: loanError } = await supabase
        .from('backup_loans')
        .insert({
            card_id: values.card_id,
            person_rut: values.person_rut,
            person_name: values.person_name,
            person_cargo: values.person_cargo || null,
            person_terminal: values.person_terminal,
            reason: values.reason,
            requested_at: values.requested_at,
            issued_at: values.issued_at,
            discount_amount: values.discount_amount,
            discount_applied: values.discount_applied,
            created_by_supervisor: values.created_by_supervisor,
            status: 'ASIGNADA',
        })
        .select('*, backup_cards(*)')
        .single();

    if (loanError) throw loanError;

    // Update card status to ASIGNADA
    const { error: cardError } = await supabase
        .from('backup_cards')
        .update({ status: 'ASIGNADA' })
        .eq('id', values.card_id);

    if (cardError) throw cardError;

    return loan as BackupLoan;
};

export const recoverLoan = async (
    id: string,
    recoveredAt: string,
    observation?: string
): Promise<void> => {
    // Get loan to find card_id
    const { data: loan, error: fetchError } = await supabase
        .from('backup_loans')
        .select('card_id')
        .eq('id', id)
        .single();

    if (fetchError) throw fetchError;

    // Update loan status
    const { error: loanError } = await supabase
        .from('backup_loans')
        .update({
            status: 'CERRADA',
            recovered_at: recoveredAt,
            closed_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (loanError) throw loanError;

    // Free the card
    const { error: cardError } = await supabase
        .from('backup_cards')
        .update({ status: 'LIBRE' })
        .eq('id', loan.card_id);

    if (cardError) throw cardError;
};

export const cancelLoan = async (id: string, reason: string): Promise<void> => {
    // Get loan to find card_id
    const { data: loan, error: fetchError } = await supabase
        .from('backup_loans')
        .select('card_id')
        .eq('id', id)
        .single();

    if (fetchError) throw fetchError;

    // Update loan status
    const { error: loanError } = await supabase
        .from('backup_loans')
        .update({
            status: 'CANCELADA',
            cancel_reason: reason,
            closed_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (loanError) throw loanError;

    // Free the card
    const { error: cardError } = await supabase
        .from('backup_cards')
        .update({ status: 'LIBRE' })
        .eq('id', loan.card_id);

    if (cardError) throw cardError;
};

export const deleteLoan = async (id: string): Promise<void> => {
    // If the loan is still active, free the card back to the inventory before deleting.
    const { data: loan, error: fetchError } = await supabase
        .from('backup_loans')
        .select('card_id, status')
        .eq('id', id)
        .single();

    if (fetchError) throw fetchError;

    if (loan.status === 'ASIGNADA' && loan.card_id) {
        const { error: cardError } = await supabase
            .from('backup_cards')
            .update({ status: 'LIBRE' })
            .eq('id', loan.card_id);

        if (cardError) throw cardError;
    }

    const { error } = await supabase.from('backup_loans').delete().eq('id', id);
    if (error) throw error;
};

export const updateLoanEmailsSent = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('backup_loans')
        .update({ emails_sent_at: new Date().toISOString() })
        .eq('id', id);

    if (error) throw error;
};

export const uploadDiscountEvidence = async (
    loanId: string,
    file: File
): Promise<string> => {
    const filename = `${loanId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
        .from('backup-evidence')
        .upload(filename, file);

    if (uploadError) throw uploadError;

    // Update loan with evidence path
    const { error: updateError } = await supabase
        .from('backup_loans')
        .update({ discount_evidence_path: filename })
        .eq('id', loanId);

    if (updateError) throw updateError;

    return filename;
};

// ============================================
// EMAIL SETTINGS API
// ============================================

export const fetchEmailSettings = async (): Promise<BackupEmailSettings[]> => {
    const { data, error } = await supabase
        .from('backup_email_settings')
        .select('*')
        .order('scope_type', { ascending: false });

    if (error) throw error;
    return data as BackupEmailSettings[];
};

export const upsertEmailSettings = async (
    settings: Omit<BackupEmailSettings, 'id' | 'updated_at'>
): Promise<BackupEmailSettings> => {
    const { data, error } = await supabase
        .from('backup_email_settings')
        .upsert(settings, { onConflict: 'scope_type,scope_code' })
        .select()
        .single();

    if (error) throw error;
    return data as BackupEmailSettings;
};

// ============================================
// KPIS API
// ============================================

export const fetchKpis = async (): Promise<BackupKpis> => {
    // Fetch all cards for availability count
    const { data: cards, error: cardsError } = await supabase
        .from('backup_cards')
        .select('inventory_terminal, status');

    if (cardsError) throw cardsError;

    // Count available by terminal
    const availableByTerminal: Record<InventoryTerminal, number> = {
        'El Roble': 0,
        'La Reina': 0,
        'Maria Angelica': 0,
    };

    cards?.forEach((card) => {
        if (card.status === 'LIBRE') {
            const terminal = card.inventory_terminal as InventoryTerminal;
            if (INVENTORY_TERMINALS.includes(terminal)) {
                availableByTerminal[terminal]++;
            }
        }
    });

    // Fetch active loans
    const { data: activeLoans, error: activeError } = await supabase
        .from('backup_loans')
        .select('id, issued_at, alert_after_days, discount_amount, discount_applied')
        .eq('status', 'ASIGNADA');

    if (activeError) throw activeError;

    const now = new Date();
    let overdueCount = 0;
    let totalDiscounts = 0;

    activeLoans?.forEach((loan) => {
        const issuedAt = new Date(loan.issued_at);
        const daysPassed = Math.floor((now.getTime() - issuedAt.getTime()) / (1000 * 60 * 60 * 24));
        if (daysPassed > loan.alert_after_days) {
            overdueCount++;
        }
        if (loan.discount_applied) {
            totalDiscounts += loan.discount_amount;
        }
    });

    // Fetch closed loans for average return time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: closedLoans, error: closedError } = await supabase
        .from('backup_loans')
        .select('issued_at, recovered_at, discount_amount, discount_applied')
        .in('status', ['RECUPERADA', 'CERRADA'])
        .gte('closed_at', thirtyDaysAgo.toISOString());

    if (closedError) throw closedError;

    let totalReturnDays = 0;
    let returnCount = 0;

    closedLoans?.forEach((loan) => {
        if (loan.recovered_at) {
            const issuedAt = new Date(loan.issued_at);
            const recoveredAt = new Date(loan.recovered_at);
            const days = Math.floor((recoveredAt.getTime() - issuedAt.getTime()) / (1000 * 60 * 60 * 24));
            totalReturnDays += days;
            returnCount++;
        }
        if (loan.discount_applied) {
            totalDiscounts += loan.discount_amount;
        }
    });

    return {
        availableByTerminal,
        activeLoans: activeLoans?.length || 0,
        overdueLoans: overdueCount,
        avgReturnDays: returnCount > 0 ? Math.round(totalReturnDays / returnCount) : 0,
        totalDiscounts,
    };
};

// ============================================
// EMAIL SENDING (uses shared emailService)
// ============================================

import { emailService } from '../../../shared/services/emailService';
import { EmailAttachment } from '../../../shared/types/email';

export type { EmailAttachment };

// Professional SVG Icons for emails
const EMAIL_ICONS = {
    user: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="5" r="3.5" stroke="#64748b" stroke-width="1.5"/>
        <path d="M2 16C2 12.686 5.13401 10 9 10C12.866 10 16 12.686 16 16" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    id: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1.5" y="3.5" width="15" height="11" rx="2" stroke="#64748b" stroke-width="1.5"/>
        <circle cx="6" cy="8" r="1.5" stroke="#64748b" stroke-width="1"/>
        <path d="M4 12C4 10.8954 4.89543 10 6 10C7.10457 10 8 10.8954 8 12" stroke="#64748b" stroke-width="1"/>
        <path d="M10.5 7.5H14.5M10.5 10H13" stroke="#64748b" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`,
    building: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 16V3.5C2 3.22386 2.22386 3 2.5 3H9.5C9.77614 3 10 3.22386 10 3.5V16" stroke="#64748b" stroke-width="1.5"/>
        <path d="M10 7H14.5C14.7761 7 15 7.22386 15 7.5V16" stroke="#64748b" stroke-width="1.5"/>
        <path d="M5 6H7M5 9H7M5 12H7M12 10H13M12 13H13" stroke="#64748b" stroke-width="1.2" stroke-linecap="round"/>
        <path d="M1 16H17" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    calendar: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="3.5" width="14" height="12" rx="2" stroke="#64748b" stroke-width="1.5"/>
        <path d="M2 7H16" stroke="#64748b" stroke-width="1.5"/>
        <path d="M5.5 1.5V4.5M12.5 1.5V4.5" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    card: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="3" width="16" height="12" rx="2" stroke="#64748b" stroke-width="1.5"/>
        <path d="M1 7H17" stroke="#64748b" stroke-width="1.5"/>
        <path d="M4 11H8" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    warning: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 6V10M9 12.5V13" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M3 15L9 3L15 15H3Z" stroke="#f59e0b" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`,
    money: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="9" r="7" stroke="#64748b" stroke-width="1.5"/>
        <path d="M9 5V13M11 7H7.5C6.67157 7 6 7.67157 6 8.5C6 9.32843 6.67157 10 7.5 10H10.5C11.3284 10 12 10.6716 12 11.5C12 12.3284 11.3284 13 10.5 13H6" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    supervisor: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="6" r="3" stroke="#64748b" stroke-width="1.5"/>
        <path d="M3 16C3 13.2386 5.68629 11 9 11C12.3137 11 15 13.2386 15 16" stroke="#64748b" stroke-width="1.5"/>
        <path d="M9 3L10 1.5L11 3" stroke="#f59e0b" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
};

const generateDataRow = (icon: string, label: string, value: string, highlight = false) => `
    <tr>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; width: 40%; vertical-align: middle;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                    <td style="padding-right: 12px; vertical-align: middle;">${icon}</td>
                    <td style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">${label}</td>
                </tr>
            </table>
        </td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: ${highlight ? '700' : '500'}; color: ${highlight ? '#0f172a' : '#334155'}; text-align: right;">${value}</td>
    </tr>
`;

const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

export const sendBackupEmails = async (
    loan: BackupLoan,
    managerEmail: string,
    cc?: string,
    attachment?: EmailAttachment | null
): Promise<{ success: boolean; error?: string }> => {
    const cardNumber = loan.backup_cards?.card_number || 'N/A';
    const terminalName = loan.person_terminal;
    const reasonText = loan.reason === 'PERDIDA' ? 'Pérdida de Credencial' : 'Deterioro de Credencial';
    const fechaEntrega = formatDate(loan.issued_at);

    // Prepare attachments array if provided
    const attachments = attachment ? [attachment] : undefined;

    // Get reason badge color
    const reasonColor = loan.reason === 'PERDIDA' ? '#ef4444' : '#f59e0b';
    const reasonBg = loan.reason === 'PERDIDA' ? '#fef2f2' : '#fffbeb';

    try {
        // =============================================
        // EMAIL 1: To manager (Solicitud Nueva Credencial)
        // =============================================
        const managerSubject = `Solicitud Nueva Credencial - ${loan.person_name}`;
        const managerBody = `
            <!-- Status Banner -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                    <td style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 24px; text-align: center;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                                <td align="center" style="padding-bottom: 8px;">
                                    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="28" cy="28" r="26" fill="#dbeafe" stroke="#3b82f6" stroke-width="3"/>
                                        <rect x="18" y="20" width="20" height="16" rx="2" stroke="#2563eb" stroke-width="2.5"/>
                                        <circle cx="24" cy="27" r="3" stroke="#2563eb" stroke-width="2"/>
                                        <path d="M20 33C20 31 21.5 29 24 29C26.5 29 28 31 28 33" stroke="#2563eb" stroke-width="2"/>
                                        <path d="M31 25H35M31 29H34" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/>
                                    </svg>
                                </td>
                            </tr>
                            <tr>
                                <td align="center">
                                    <span style="font-size: 11px; font-weight: 700; color: #1e40af; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">Acción Requerida</span>
                                    <span style="font-size: 20px; font-weight: 800; color: #1d4ed8; letter-spacing: -0.5px;">SOLICITUD DE NUEVA CREDENCIAL</span>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
            
            <!-- Reason Badge -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                    <td align="center">
                        <span style="display: inline-block; padding: 8px 20px; background: ${reasonBg}; border: 1px solid ${reasonColor}; border-radius: 100px; color: ${reasonColor}; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">${reasonText}</span>
                    </td>
                </tr>
            </table>
            
            <!-- Worker Data Section -->
            <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Datos del Trabajador</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; border-spacing: 0; border-collapse: separate; margin-bottom: 24px;">
                ${generateDataRow(EMAIL_ICONS.user, 'Nombre', loan.person_name, true)}
                ${generateDataRow(EMAIL_ICONS.id, 'RUT', loan.person_rut)}
                ${generateDataRow(EMAIL_ICONS.building, 'Terminal', terminalName)}
                ${generateDataRow(EMAIL_ICONS.id, 'Cargo', loan.person_cargo || 'No especificado')}
            </table>
            
            <!-- Backup Info Section -->
            <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Información del Respaldo</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; border-spacing: 0; border-collapse: separate; margin-bottom: 24px;">
                ${generateDataRow(EMAIL_ICONS.card, 'Tarjeta Asignada', `N° ${cardNumber}`, true)}
                ${generateDataRow(EMAIL_ICONS.calendar, 'Fecha Solicitud', loan.requested_at)}
                ${generateDataRow(EMAIL_ICONS.supervisor, 'Supervisor Entrega', loan.created_by_supervisor)}
            </table>
            
            <!-- Action Message -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 16px;">
                <tr>
                    <td style="padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;">
                        <p style="margin: 0; font-size: 14px; color: #166534; font-weight: 600; text-align: center;">
                            ✅ Por favor proceder con la emisión de una nueva credencial para este trabajador.
                        </p>
                    </td>
                </tr>
            </table>
            
            ${attachment ? `
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                    <td style="padding: 12px 16px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px;">
                        <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 500;">
                            📎 <strong>Documento adjunto:</strong> Autorización de descuento firmada
                        </p>
                    </td>
                </tr>
            </table>
            ` : ''}
        `.trim();

        await emailService.sendEmail({
            audience: 'manual',
            manualRecipients: [managerEmail],
            cc: cc ? cc.split(',').map((e) => e.trim()).filter(Boolean) : undefined,
            subject: managerSubject,
            body: managerBody,
            attachments,
            module: 'credenciales',
        });

        // =============================================
        // EMAIL 2: To boss (Notificación Credencial Respaldo)
        // =============================================
        const bossSubject = `Notificación Credencial Respaldo - ${loan.person_name}`;
        const bossBody = `
            <!-- Status Banner -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                    <td style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 12px; padding: 24px; text-align: center;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                                <td align="center" style="padding-bottom: 8px;">
                                    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="28" cy="28" r="26" fill="#fef9c3" stroke="#eab308" stroke-width="3"/>
                                        <path d="M28 18V32M28 36V38" stroke="#ca8a04" stroke-width="4" stroke-linecap="round"/>
                                    </svg>
                                </td>
                            </tr>
                            <tr>
                                <td align="center">
                                    <span style="font-size: 11px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">Notificación Importante</span>
                                    <span style="font-size: 18px; font-weight: 800; color: #b45309; letter-spacing: -0.5px;">CREDENCIAL DE RESPALDO ASIGNADA</span>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
            
            <!-- Intro Message -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                    <td style="padding: 16px 20px; background: #f8fafc; border-radius: 12px;">
                        <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.6;">
                            Se le informa que el trabajador a su cargo <strong style="color: #0f172a;">${loan.person_name}</strong> utilizará una tarjeta de respaldo mientras se gestiona una nueva credencial.
                        </p>
                    </td>
                </tr>
            </table>
            
            <!-- Worker Data Section -->
            <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Datos del Trabajador</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; border-spacing: 0; border-collapse: separate; margin-bottom: 24px;">
                ${generateDataRow(EMAIL_ICONS.user, 'Nombre', loan.person_name, true)}
                ${generateDataRow(EMAIL_ICONS.id, 'RUT', loan.person_rut)}
                ${generateDataRow(EMAIL_ICONS.building, 'Terminal', terminalName)}
                ${generateDataRow(EMAIL_ICONS.id, 'Cargo', loan.person_cargo || 'No especificado')}
            </table>
            
            <!-- Backup Info Section -->
            <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Información del Respaldo</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; border-spacing: 0; border-collapse: separate; margin-bottom: 24px;">
                ${generateDataRow(EMAIL_ICONS.card, 'Tarjeta Asignada', `N° ${cardNumber}`, true)}
                ${generateDataRow(EMAIL_ICONS.warning, 'Motivo', reasonText)}
                ${generateDataRow(EMAIL_ICONS.calendar, 'Fecha de Entrega', fechaEntrega)}
                ${loan.discount_applied ? generateDataRow(EMAIL_ICONS.money, 'Descuento Aplicado', `$${loan.discount_amount.toLocaleString('es-CL')} (1 cuota)`, true) : ''}
            </table>
            
            <!-- Important Notice -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 16px;">
                <tr>
                    <td style="padding: 20px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px;">
                        <p style="margin: 0; font-size: 14px; color: #1e40af; font-weight: 500; text-align: center;">
                            ℹ️ Una vez que el trabajador reciba su nueva credencial, deberá devolver la tarjeta de respaldo.
                        </p>
                    </td>
                </tr>
            </table>
            
            ${attachment ? `
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                    <td style="padding: 12px 16px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px;">
                        <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 500;">
                            📎 <strong>Documento adjunto:</strong> Autorización de descuento firmada
                        </p>
                    </td>
                </tr>
            </table>
            ` : ''}
            
            <!-- Signature -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                    <td style="padding-top: 16px; border-top: 1px solid #e2e8f0;">
                        <p style="margin: 0; font-size: 14px; color: #64748b;">Saludos cordiales,</p>
                        <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 700; color: #0f172a;">Gestión de Personal</p>
                    </td>
                </tr>
            </table>
        `.trim();

        // Only send worker notification if boss_email (worker email) exists
        if (loan.boss_email) {
            await emailService.sendEmail({
                audience: 'manual',
                manualRecipients: [loan.boss_email],
                subject: bossSubject,
                body: bossBody,
                // NO attachment for worker notification - only manager gets the discount form
                module: 'credenciales',
            });
        }

        // Mark emails as sent
        await updateLoanEmailsSent(loan.id);

        return { success: true };
    } catch (error) {
        console.error('Error sending backup emails:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido al enviar correos'
        };
    }
};
