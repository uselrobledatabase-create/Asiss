/**
 * Asis Command API
 * Supabase CRUD operations for command logs and settings
 */

import { supabase, isSupabaseConfigured } from '../../../shared/lib/supabaseClient';
import { assertAuthorizedSupervisor } from '../../../shared/utils/authorizedSupervisors';
import { emailService } from '../../../shared/services/emailService';
import { CommandLog, CommandLogInsert, CommandEmailSetting, CommandIntent, ResolvedPerson } from '../types';

type SupabaseLikeError = {
    code?: string;
    message?: string;
};

const isMissingTableError = (error: SupabaseLikeError | null | undefined, table: string) =>
    error?.code === 'PGRST205' && error.message?.includes(`'public.${table}'`);

// ==========================================
// COMMAND LOGS
// ==========================================

/**
 * Fetch recent command logs
 */
export async function fetchCommandLogs(
    limit: number = 20,
    executedBy?: string
): Promise<CommandLog[]> {
    if (!isSupabaseConfigured()) return [];

    let query = supabase
        .from('asis_command_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (executedBy) {
        query = query.eq('executed_by', executedBy);
    }

    const { data, error } = await query;

    if (error) {
        if (isMissingTableError(error, 'asis_command_logs')) {
            return [];
        }
        console.error('fetchCommandLogs error:', error.message);
        return [];
    }

    return data || [];
}

/**
 * Create command log entry
 */
export async function createCommandLog(log: CommandLogInsert): Promise<CommandLog | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
        .from('asis_command_logs')
        .insert(log)
        .select()
        .single();

    if (error) {
        if (isMissingTableError(error, 'asis_command_logs')) {
            return null;
        }
        console.error('createCommandLog error:', error.message);
        return null;
    }

    return data;
}

// ==========================================
// EMAIL SETTINGS
// ==========================================

/**
 * Fetch email settings for all intents
 */
export async function fetchEmailSettings(): Promise<CommandEmailSetting[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
        .from('asis_command_email_settings')
        .select('*')
        .order('intent');

    if (error) {
        if (isMissingTableError(error, 'asis_command_email_settings')) {
            return [];
        }
        console.error('fetchEmailSettings error:', error.message);
        return [];
    }

    return data || [];
}

/**
 * Get email setting for specific intent
 */
export async function getEmailSettingForIntent(intent: CommandIntent): Promise<CommandEmailSetting | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
        .from('asis_command_email_settings')
        .select('*')
        .eq('intent', intent)
        .single();

    if (error && error.code !== 'PGRST116') {
        if (isMissingTableError(error, 'asis_command_email_settings')) {
            return null;
        }
        console.error('getEmailSettingForIntent error:', error.message);
    }

    return data || null;
}

/**
 * Update email setting
 */
export async function updateEmailSetting(
    intent: CommandIntent,
    recipients: string,
    subjectTemplate: string,
    enabled: boolean
): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase
        .from('asis_command_email_settings')
        .upsert({
            intent,
            recipients,
            subject_template: subjectTemplate,
            enabled,
        }, { onConflict: 'intent' });

    if (error) {
        if (isMissingTableError(error, 'asis_command_email_settings')) {
            return false;
        }
        console.error('updateEmailSetting error:', error.message);
        return false;
    }

    return true;
}

// ==========================================
// PERSON RESOLUTION
// ==========================================

/**
 * Find person by RUT
 */
export async function findPersonByRut(rut: string): Promise<ResolvedPerson | null> {
    if (!isSupabaseConfigured() || !rut) return null;

    // Normalize RUT for search (try both with and without separators)
    const rutPatterns = [
        rut,
        rut.replace(/-/g, ''),
        rut.replace(/\./g, '').replace(/-/g, ''),
    ];

    for (const rutPattern of rutPatterns) {
        const { data, error } = await supabase
            .from('staff')
            .select('id, rut, nombre, cargo, terminal_code, horario, status')
            .or(`rut.eq.${rutPattern},rut.ilike.%${rutPattern}%`)
            .limit(1)
            .single();

        if (data && !error) {
            return data as ResolvedPerson;
        }
    }

    return null;
}

// ==========================================
// COMMAND EXECUTION
// ==========================================

/**
 * Execute vacation command
 */
export async function executeVacation(
    staffId: string,
    startDate: string,
    endDate: string,
    note: string,
    createdBy: string
): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) return { success: false, error: 'Supabase no configurado' };

    // 1. Fetch staff details to populate required fields
    const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('id', staffId)
        .single();

    if (staffError || !staff) {
        return { success: false, error: 'Personal no encontrado' };
    }

    // 2. Calculate days
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    let calendarDays = 0;
    let businessDays = 0;
    const current = new Date(start);

    while (current <= end) {
        calendarDays++;
        const day = current.getDay();
        if (day !== 0 && day !== 6) businessDays++; // Mon-Fri
        current.setDate(current.getDate() + 1);
    }

    // 3. Insert vacation record
    const { error } = await supabase
        .from('attendance_vacaciones')
        .insert({
            staff_id: staffId,
            rut: staff.rut,
            nombre: staff.nombre,
            cargo: staff.cargo,
            terminal_code: staff.terminal_code,
            turno: staff.turno || 'DIA',
            start_date: startDate,
            end_date: endDate,
            return_date: endDate, // Should calculate return date, keeping simplistic for now
            calendar_days: calendarDays,
            business_days: businessDays,
            note,
            created_by_supervisor: createdBy,
            auth_status: 'PENDIENTE',
        });

    if (error) {
        return { success: false, error: error.message };
    }

    // 4. Send Email Notification
    try {
        await emailService.sendEmail({
            audience: 'manual',
            manualRecipients: ['rrhh@informacionasiss.cl'],
            subject: `Solicitud de Vacaciones - ${staff.nombre}`,
            body: `Se ha generado una SOLICITUD DE VACACIONES:\n\nNombre: ${staff.nombre}\nRUT: ${staff.rut}\nCargo: ${staff.cargo}\nTerminal: ${staff.terminal_code}\n\nDesde: ${startDate}\nHasta: ${endDate}\nDías Hábiles: ${businessDays}\nDías Corridos: ${calendarDays}\n\nNota: ${note}\n\nSolicitado por: ${createdBy}\nEstado: PENDIENTE DE APROBACIÓN\n\nSistema Asis Command`,
            module: 'asistencia',
        });
    } catch (emailErr) {
        console.error('Error sending vacation email:', emailErr);
    }

    return { success: true };
}

/**
 * Execute license command
 */
export async function executeLicense(
    staffId: string,
    startDate: string,
    endDate: string,
    note: string,
    createdBy: string
): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) return { success: false, error: 'Supabase no configurado' };

    const { error } = await supabase
        .from('attendance_licenses')
        .insert({
            staff_id: staffId,
            start_date: startDate,
            end_date: endDate,
            note,
            created_by: createdBy,
        });

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Execute permission command
 */
export async function executePermission(
    staffId: string,
    startDate: string,
    endDate: string,
    permissionType: string,
    note: string,
    createdBy: string
): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) return { success: false, error: 'Supabase no configurado' };

    const { error } = await supabase
        .from('attendance_permissions')
        .insert({
            staff_id: staffId,
            start_date: startDate,
            end_date: endDate,
            permission_type: permissionType,
            note,
            created_by: createdBy,
        });

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Execute authorization (Llegada/Salida)
 */
export async function executeAuthorization(
    staffId: string,
    person: ResolvedPerson,
    date: string,
    type: 'LLEGADA' | 'SALIDA',
    time: string, // HH:mm
    reason: string,
    createdBy: string
): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) return { success: false, error: 'Supabase no configurado' };
    assertAuthorizedSupervisor(createdBy, 'autorizar registros desde Asis Command');

    // Determine authorization type for DB enum
    const entryOrExit = type === 'LLEGADA' ? 'ENTRADA' : 'SALIDA';

    const { error } = await supabase
        .from('attendance_autorizaciones')
        .insert({
            rut: person.rut,
            nombre: person.nombre,
            cargo: person.cargo,
            terminal_code: person.terminal_code,
            turno: person.horario.split(' ')[0] || 'DIA', // Simple inference
            horario: person.horario,
            authorization_date: date,
            entry_or_exit: entryOrExit,
            motivo: reason, // In this table reason is "motivo"
            created_by_supervisor: createdBy,
            auth_status: 'AUTORIZADO', // Auto-authorized by supervisor
            authorized_by: createdBy,
            authorized_at: new Date().toISOString(),
        });

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Execute Day Change
 */
export async function executeDayChange(
    person: ResolvedPerson,
    originalDate: string,
    newDate: string, // Logic: original is day OFF, new is day ON (or vice versa depending on context)
    reason: string,
    createdBy: string
): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) return { success: false, error: 'Supabase no configurado' };

    // Note: Day Change logic is complex. We assume simplest case:
    // User wants to work on 'newDate' instead of 'originalDate'
    // So originalDate is the day they were supposed to work but won't (Day Off)
    // And newDate is the day they will work (Day On)

    // Since parsing usually gives 2 dates, we'll map them:
    // Date 1 -> Day Off (Origin)
    // Date 2 -> Day On (Destination)

    const { error } = await supabase
        .from('attendance_cambios_dia')
        .insert({
            rut: person.rut,
            nombre: person.nombre,
            terminal_code: person.terminal_code,
            date: new Date().toISOString().split('T')[0], // Request date
            day_off_date: originalDate,
            day_on_date: newDate,
            document_path: reason ? `Motivo: ${reason}` : null,
            created_by_supervisor: createdBy,
            auth_status: 'PENDIENTE',
        });

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Execute No Mark Incident
 */
export async function executeNoMark(
    person: ResolvedPerson,
    date: string,
    reason: string,
    createdBy: string
): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) return { success: false, error: 'Supabase no configurado' };

    const { error } = await supabase
        .from('attendance_no_marcaciones')
        .insert({
            rut: person.rut,
            nombre: person.nombre,
            terminal_code: person.terminal_code,
            date: date,
            observations: reason,
            incident_state: 'INFORMADA',
            created_by_supervisor: createdBy,
            auth_status: 'PENDIENTE',
        });

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Execute No Credential Incident
 */
export async function executeNoCredential(
    person: ResolvedPerson,
    date: string,
    reason: string,
    createdBy: string
): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) return { success: false, error: 'Supabase no configurado' };

    const { error } = await supabase
        .from('attendance_sin_credenciales')
        .insert({
            rut: person.rut,
            nombre: person.nombre,
            terminal_code: person.terminal_code,
            date: date,
            observacion: reason,
            cargo: person.cargo,
            created_by_supervisor: createdBy,
            auth_status: 'PENDIENTE',
        });

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}
