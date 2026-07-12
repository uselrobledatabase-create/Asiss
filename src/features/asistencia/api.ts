import { supabase, isSupabaseConfigured } from '../../shared/lib/supabaseClient';
import { TerminalCode, TerminalContext } from '../../shared/types/terminal';
import { resolveTerminalsForContext } from '../../shared/utils/terminal';
import { normalizeName } from './utils/authorizers';
import { showSuccessToast, showErrorToast, showWarningToast } from '../../shared/state/toastStore';
import {
    NoMarcacion,
    NoMarcacionFormValues,
    SinCredencial,
    SinCredencialFormValues,
    CambioDia,
    CambioDiaFormValues,
    Autorizacion,
    AutorizacionFormValues,
    Vacacion,
    VacacionFormValues,
    VacationConflictInfo,
    AttendanceFilters,
    AttendanceKPIs,
    AuthStatus,
} from './types';

// ==========================================
// TABLE NAMES
// ==========================================

type AttendanceTable =
    | 'attendance_no_marcaciones'
    | 'attendance_sin_credenciales'
    | 'attendance_cambios_dia'
    | 'attendance_autorizaciones'
    | 'attendance_vacaciones';

type SupabaseLikeError = {
    code?: string;
    message?: string;
};

let missingAttendanceSchemaWarned = false;

const isMissingTableError = (error: SupabaseLikeError | null | undefined, table: string) =>
    error?.code === 'PGRST205' && error.message?.includes(`'public.${table}'`);

const warnMissingAttendanceSchema = () => {
    if (missingAttendanceSchemaWarned) return;
    missingAttendanceSchemaWarned = true;
    showWarningToast(
        'Esquema incompleto en asistencia',
        'La base conectada no tiene las tablas de asistencia clasica. Esa seccion se mostrara vacia hasta restaurarlas.'
    );
};

// ==========================================
// NO MARCACIONES
// ==========================================

export const fetchNoMarcaciones = async (
    terminalContext: TerminalContext,
    filters?: AttendanceFilters
): Promise<NoMarcacion[]> => {
    if (!isSupabaseConfigured()) return [];

    const terminals = resolveTerminalsForContext(terminalContext);

    let query = supabase
        .from('attendance_no_marcaciones')
        .select('*')
        .in('terminal_code', terminals)
        .order('date', { ascending: false });

    if (filters?.auth_status && filters.auth_status !== 'todos') {
        query = query.eq('auth_status', filters.auth_status);
    }

    if (filters?.search) {
        const term = `%${filters.search}%`;
        query = query.or(`nombre.ilike.${term},rut.ilike.${term}`);
    }

    if (filters?.date_from) {
        query = query.gte('date', filters.date_from);
    }

    if (filters?.date_to) {
        query = query.lte('date', filters.date_to);
    }

    const { data, error } = await query;
    if (error) {
        if (isMissingTableError(error, 'attendance_no_marcaciones')) {
            warnMissingAttendanceSchema();
            return [];
        }
        throw error;
    }
    return data || [];
};

export const createNoMarcacion = async (
    values: NoMarcacionFormValues,
    createdBy: string
): Promise<NoMarcacion> => {
    const { data, error } = await supabase
        .from('attendance_no_marcaciones')
        .insert({
            ...values,
            created_by_supervisor: normalizeName(createdBy),
        })
        .select()
        .single();

    if (error) {
        showErrorToast('Error al crear registro', 'No se pudo guardar el registro de No Marcación');
        throw error;
    }

    // Send email notification
    try {
        await sendRecordCreatedEmail('No Marcaciones', {
            rut: values.rut,
            nombre: values.nombre,
            terminal: values.terminal_code,
            date: values.date,
            createdBy: createdBy,
            requestId: data.id,
            createdAt: data.created_at,
            status: data.auth_status,
            details: {
                'Área': values.area || '',
                'Cargo': values.cargo || '',
                'Jefe Terminal': values.jefe_terminal || '',
                'Cabezal': values.cabezal || '',
                'Tipo de Marcación': values.incident_state || '',
                'Hora Esperada': values.schedule_in_out || '',
                'Hora Registrada': values.time_range || '',
                'Informado Por': values.informed_by || createdBy,
                'Observaciones': values.observations || '',
            }
        });
        showSuccessToast(
            'Registro creado exitosamente',
            `No Marcación para ${values.nombre} guardado y correo enviado`,
            createdBy
        );
    } catch {
        showSuccessToast(
            'Registro creado',
            `No Marcación para ${values.nombre} guardado (correo no enviado)`,
            createdBy
        );
    }

    return data;
};

export const updateNoMarcacion = async (
    id: string,
    values: Partial<NoMarcacionFormValues>
): Promise<NoMarcacion> => {
    const { data, error } = await supabase
        .from('attendance_no_marcaciones')
        .update(values)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// ==========================================
// SIN CREDENCIALES
// ==========================================

export const fetchSinCredenciales = async (
    terminalContext: TerminalContext,
    filters?: AttendanceFilters
): Promise<SinCredencial[]> => {
    if (!isSupabaseConfigured()) return [];

    const terminals = resolveTerminalsForContext(terminalContext);

    let query = supabase
        .from('attendance_sin_credenciales')
        .select('*')
        .in('terminal_code', terminals)
        .order('date', { ascending: false });

    if (filters?.auth_status && filters.auth_status !== 'todos') {
        query = query.eq('auth_status', filters.auth_status);
    }

    if (filters?.search) {
        const term = `%${filters.search}%`;
        query = query.or(`nombre.ilike.${term},rut.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) {
        if (isMissingTableError(error, 'attendance_sin_credenciales')) {
            warnMissingAttendanceSchema();
            return [];
        }
        throw error;
    }
    return data || [];
};

export const createSinCredencial = async (
    values: SinCredencialFormValues,
    createdBy: string
): Promise<SinCredencial> => {
    const { data, error } = await supabase
        .from('attendance_sin_credenciales')
        .insert({
            ...values,
            created_by_supervisor: normalizeName(createdBy),
        })
        .select()
        .single();

    if (error) {
        showErrorToast('Error al crear registro', 'No se pudo guardar el registro de Sin Credenciales');
        throw error;
    }

    // Send email notification
    try {
        await sendRecordCreatedEmail('Sin Credenciales', {
            rut: values.rut,
            nombre: values.nombre,
            terminal: values.terminal_code,
            date: values.date,
            createdBy: createdBy,
            requestId: data.id,
            createdAt: data.created_at,
            status: data.auth_status,
            details: {
                'Cabezal': values.cabezal || '',
                'Horario': formatTimeRange(values.start_time, values.end_time),
                'Cargo': values.cargo || '',
                'Área': values.area || '',
                'Supervisor Autoriza': values.supervisor_autoriza || '',
                'Responsable': values.responsable || '',
                'Observaciones': values.observacion || '',
            }
        });
        showSuccessToast(
            'Registro creado exitosamente',
            `Sin Credenciales para ${values.nombre} guardado y correo enviado`,
            createdBy
        );
    } catch {
        showSuccessToast(
            'Registro creado',
            `Sin Credenciales para ${values.nombre} guardado (correo no enviado)`,
            createdBy
        );
    }

    return data;
};

export const updateSinCredencial = async (
    id: string,
    values: Partial<SinCredencialFormValues>
): Promise<SinCredencial> => {
    const { data, error } = await supabase
        .from('attendance_sin_credenciales')
        .update(values)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// ==========================================
// CAMBIOS DE DÍA
// ==========================================

export const fetchCambiosDia = async (
    terminalContext: TerminalContext,
    filters?: AttendanceFilters
): Promise<CambioDia[]> => {
    if (!isSupabaseConfigured()) return [];

    const terminals = resolveTerminalsForContext(terminalContext);

    let query = supabase
        .from('attendance_cambios_dia')
        .select('*')
        .in('terminal_code', terminals)
        .order('date', { ascending: false });

    if (filters?.auth_status && filters.auth_status !== 'todos') {
        query = query.eq('auth_status', filters.auth_status);
    }

    if (filters?.search) {
        const term = `%${filters.search}%`;
        query = query.or(`nombre.ilike.${term},rut.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) {
        if (isMissingTableError(error, 'attendance_cambios_dia')) {
            warnMissingAttendanceSchema();
            return [];
        }
        throw error;
    }
    return data || [];
};

export const createCambioDia = async (
    values: CambioDiaFormValues,
    createdBy: string
): Promise<CambioDia> => {
    let documentPath: string | null = null;

    if (values.document) {
        const fileExt = values.document.name.split('.').pop();
        const filePath = `cambios-dia/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('attendance-docs')
            .upload(filePath, values.document);

        if (uploadError) {
            console.error('Storage Upload Error Detail:', uploadError);
            showErrorToast('Error al subir documento', 'Verifica que el archivo sea imagen o PDF y menor a 5MB');
            throw new Error(`Error al subir documento: ${uploadError.message}`);
        }
        documentPath = filePath;
    }

    const { document: _, ...rest } = values;

    // Sanitize empty strings to null for date/time columns
    const payload: any = {
        ...rest,
        document_path: documentPath,
        created_by_supervisor: normalizeName(createdBy),
    };

    const columnsToSanitize = [
        'day_off_date', 'day_on_date',
        'prog_start', 'prog_end',
        'reprogram_start', 'reprogram_end',
        'day_off_start', 'day_off_end',
        'day_on_start', 'day_on_end'
    ];

    columnsToSanitize.forEach(col => {
        if (payload[col] === '') {
            payload[col] = null;
        }
    });

    const { data, error } = await supabase
        .from('attendance_cambios_dia')
        .insert(payload)
        .select()
        .single();

    if (error) {
        showErrorToast('Error al crear registro', 'No se pudo guardar el registro de Cambio de Día');
        throw error;
    }

    // Send email notification
    try {
        let documentLink: AsissEmailValue = 'No adjunto';
        if (documentPath) {
            const { data: urlData } = supabase.storage
                .from('attendance-docs')
                .getPublicUrl(documentPath);

            documentLink = {
                html: `<a href="${urlData.publicUrl}" target="_blank" style="color:#1f5fe7;text-decoration:underline;font-weight:800;">Ver documento adjunto</a>`,
                text: 'Ver documento adjunto',
            };
        }

        await sendRecordCreatedEmail('Cambios de Día', {
            rut: values.rut,
            nombre: values.nombre,
            terminal: values.terminal_code,
            date: values.date,
            createdBy: createdBy,
            requestId: data.id,
            createdAt: data.created_at,
            status: data.auth_status,
            details: {
                'Jornada Programada': formatTimeRange(values.prog_start, values.prog_end),
                'Día No Trabaja': values.day_off_date || '',
                'Turno Original': formatTimeRange(values.day_off_start, values.day_off_end),
                'Día Trabaja': values.day_on_date || '',
                'Turno Solicitado': formatTimeRange(values.day_on_start, values.day_on_end),
                'Cabezal': values.cabezal || '',
                'Documento': documentLink,
            }
        });
        showSuccessToast(
            'Registro creado exitosamente',
            `Cambio de Día para ${values.nombre} guardado y correo enviado`,
            createdBy
        );
    } catch {
        showSuccessToast(
            'Registro creado',
            `Cambio de Día para ${values.nombre} guardado (correo no enviado)`,
            createdBy
        );
    }

    return data;
};

export const updateCambioDia = async (
    id: string,
    values: Partial<CambioDiaFormValues>
): Promise<CambioDia> => {
    const { document: _, ...rest } = values;

    // Sanitize empty strings to null for date/time columns to avoid Postgres errors
    const payload: any = { ...rest };
    const columnsToSanitize = [
        'day_off_date', 'day_on_date',
        'prog_start', 'prog_end',
        'reprogram_start', 'reprogram_end',
        'day_off_start', 'day_off_end',
        'day_on_start', 'day_on_end'
    ];

    columnsToSanitize.forEach(col => {
        if (payload[col] === '') {
            payload[col] = null;
        }
    });

    const { data, error } = await supabase
        .from('attendance_cambios_dia')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const getDocumentUrl = async (path: string): Promise<string> => {
    const { data, error } = await supabase.storage
        .from('attendance-docs')
        .createSignedUrl(path, 3600);

    if (error) throw error;
    return data.signedUrl;
};

// ==========================================
// AUTORIZACIONES
// ==========================================

export const fetchAutorizaciones = async (
    terminalContext: TerminalContext,
    filters?: AttendanceFilters
): Promise<Autorizacion[]> => {
    if (!isSupabaseConfigured()) return [];

    const terminals = resolveTerminalsForContext(terminalContext);

    let query = supabase
        .from('attendance_autorizaciones')
        .select('*')
        .in('terminal_code', terminals)
        .order('authorization_date', { ascending: false });

    if (filters?.auth_status && filters.auth_status !== 'todos') {
        query = query.eq('auth_status', filters.auth_status);
    }

    if (filters?.search) {
        const term = `%${filters.search}%`;
        query = query.or(`nombre.ilike.${term},rut.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) {
        if (isMissingTableError(error, 'attendance_autorizaciones')) {
            warnMissingAttendanceSchema();
            return [];
        }
        throw error;
    }
    return data || [];
};

export const createAutorizacion = async (
    values: AutorizacionFormValues,
    createdBy: string
): Promise<Autorizacion> => {
    const { data, error } = await supabase
        .from('attendance_autorizaciones')
        .insert({
            ...values,
            created_by_supervisor: normalizeName(createdBy),
        })
        .select()
        .single();

    if (error) {
        showErrorToast('Error al crear registro', 'No se pudo guardar la autorización');
        throw error;
    }

    // Send email notification
    try {
        await sendRecordCreatedEmail('Autorizaciones', {
            rut: values.rut,
            nombre: values.nombre,
            terminal: values.terminal_code,
            date: values.authorization_date,
            createdBy: createdBy,
            requestId: data.id,
            createdAt: data.created_at,
            status: data.auth_status,
            details: {
                'Tipo': values.entry_or_exit === 'ENTRADA' ? 'Llegada Tardía' : 'Retiro Anticipado',
                'Horario': values.horario || '',
                'Hora Inicio': values.horario?.split('-')[0]?.trim() || '',
                'Hora Término': values.horario?.split('-')[1]?.trim() || '',
                'Turno': values.turno || '',
                'Cargo': values.cargo || '',
                'Motivo': values.motivo || '',
            }
        });
        showSuccessToast(
            'Registro creado exitosamente',
            `Autorización para ${values.nombre} guardada y correo enviado`,
            createdBy
        );
    } catch {
        showSuccessToast(
            'Registro creado',
            `Autorización para ${values.nombre} guardada (correo no enviado)`,
            createdBy
        );
    }

    return data;
};

export const updateAutorizacion = async (
    id: string,
    values: Partial<AutorizacionFormValues>
): Promise<Autorizacion> => {
    const { data, error } = await supabase
        .from('attendance_autorizaciones')
        .update(values)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// ==========================================
// AUTHORIZATION WORKFLOW
// ==========================================

export const authorizeRecord = async (
    table: AttendanceTable,
    id: string,
    authorizedBy: string
): Promise<void> => {
    const { error } = await supabase
        .from(table)
        .update({
            auth_status: 'AUTORIZADO' as AuthStatus,
            authorized_by: normalizeName(authorizedBy),
            authorized_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (error) throw error;
};

export const rejectRecord = async (
    table: AttendanceTable,
    id: string,
    authorizedBy: string,
    reason: string
): Promise<void> => {
    const { error } = await supabase
        .from(table)
        .update({
            auth_status: 'RECHAZADO' as AuthStatus,
            authorized_by: normalizeName(authorizedBy),
            authorized_at: new Date().toISOString(),
            rejection_reason: reason,
        })
        .eq('id', id);

    if (error) throw error;
};

// ==========================================
// KPIs
// ==========================================

export const fetchKPIs = async (
    table: AttendanceTable,
    terminalContext: TerminalContext,
    dateColumn = 'date'
): Promise<AttendanceKPIs> => {
    if (!isSupabaseConfigured()) {
        return { pendingToday: 0, pendingTotal: 0, authorizedRange: 0, rejectedRange: 0 };
    }

    const terminals = resolveTerminalsForContext(terminalContext);
    const today = new Date().toISOString().split('T')[0];

    const { count: pendingToday, error: pendingTodayError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .in('terminal_code', terminals)
        .eq('auth_status', 'PENDIENTE')
        .eq(dateColumn, today);

    if (pendingTodayError) {
        if (isMissingTableError(pendingTodayError, table)) {
            warnMissingAttendanceSchema();
            return { pendingToday: 0, pendingTotal: 0, authorizedRange: 0, rejectedRange: 0 };
        }
        throw pendingTodayError;
    }

    const { count: pendingTotal, error: pendingTotalError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .in('terminal_code', terminals)
        .eq('auth_status', 'PENDIENTE');

    if (pendingTotalError) throw pendingTotalError;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { count: authorizedRange, error: authorizedRangeError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .in('terminal_code', terminals)
        .eq('auth_status', 'AUTORIZADO')
        .gte(dateColumn, thirtyDaysAgo);

    if (authorizedRangeError) throw authorizedRangeError;

    const { count: rejectedRange, error: rejectedRangeError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .in('terminal_code', terminals)
        .eq('auth_status', 'RECHAZADO')
        .gte(dateColumn, thirtyDaysAgo);

    if (rejectedRangeError) throw rejectedRangeError;

    return {
        pendingToday: pendingToday ?? 0,
        pendingTotal: pendingTotal ?? 0,
        authorizedRange: authorizedRange ?? 0,
        rejectedRange: rejectedRange ?? 0,
    };
};

// ==========================================
// REALTIME
// ==========================================

export const subscribeToAttendanceChanges = (
    onInsert: (table: AttendanceTable) => void,
    onUpdate: (table: AttendanceTable) => void
): (() => void) => {
    const channel = supabase
        .channel('attendance-changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_no_marcaciones' }, () => onInsert('attendance_no_marcaciones'))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance_no_marcaciones' }, () => onUpdate('attendance_no_marcaciones'))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_sin_credenciales' }, () => onInsert('attendance_sin_credenciales'))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance_sin_credenciales' }, () => onUpdate('attendance_sin_credenciales'))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_cambios_dia' }, () => onInsert('attendance_cambios_dia'))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance_cambios_dia' }, () => onUpdate('attendance_cambios_dia'))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_autorizaciones' }, () => onInsert('attendance_autorizaciones'))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance_autorizaciones' }, () => onUpdate('attendance_autorizaciones'))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_vacaciones' }, () => onInsert('attendance_vacaciones'))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance_vacaciones' }, () => onUpdate('attendance_vacaciones'))
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

// ==========================================
// VACACIONES
// ==========================================

/**
 * Calculate business days between two dates (excludes weekends)
 */
export const calculateBusinessDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    let count = 0;
    const current = new Date(start);

    while (current <= end) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) { // Skip Sunday (0) and Saturday (6)
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
};

/**
 * Calculate calendar days between two dates
 */
export const calculateCalendarDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both days
};

/**
 * Get active staff count by cargo, terminal, and turno
 */
export const getStaffCountByPosition = async (
    cargo: string,
    terminalCode: string,
    turno: string
): Promise<number> => {
    const { count, error } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('cargo', cargo)
        .eq('terminal_code', terminalCode)
        .eq('turno', turno)
        .eq('status', 'ACTIVO');

    if (error) throw error;
    return count ?? 0;
};

/**
 * Check for vacation conflicts (same cargo, terminal, turno with overlapping dates)
 */
export const checkVacationConflicts = async (
    cargo: string,
    terminalCode: string,
    turno: string,
    startDate: string,
    endDate: string,
    excludeRut?: string
): Promise<VacationConflictInfo> => {
    // Get overlapping vacations (approved or pending)
    let query = supabase
        .from('attendance_vacaciones')
        .select('*')
        .eq('cargo', cargo)
        .eq('terminal_code', terminalCode)
        .eq('turno', turno)
        .in('auth_status', ['PENDIENTE', 'AUTORIZADO'])
        .lte('start_date', endDate)
        .gte('end_date', startDate);

    if (excludeRut) {
        query = query.neq('rut', excludeRut);
    }

    const { data: conflictingVacations, error: conflictError } = await query;
    if (conflictError) throw conflictError;

    // Get total staff count for this position
    const totalStaffCount = await getStaffCountByPosition(cargo, terminalCode, turno);

    // Count unique workers on vacation (including this new request = +1)
    const uniqueWorkersOnVacation = new Set(conflictingVacations?.map(v => v.rut) || []).size;
    const availableStaffCount = totalStaffCount - uniqueWorkersOnVacation - 1; // -1 for the new request

    // Calculate max overlapping days
    let overlappingDays = 0;
    if (conflictingVacations && conflictingVacations.length > 0) {
        const reqStart = new Date(startDate);
        const reqEnd = new Date(endDate);

        for (const v of conflictingVacations) {
            const vStart = new Date(v.start_date);
            const vEnd = new Date(v.end_date);
            const overlapStart = new Date(Math.max(reqStart.getTime(), vStart.getTime()));
            const overlapEnd = new Date(Math.min(reqEnd.getTime(), vEnd.getTime()));
            const days = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            if (days > overlappingDays) overlappingDays = days;
        }
    }

    return {
        hasConflict: (conflictingVacations?.length ?? 0) > 0,
        conflictingVacations: (conflictingVacations || []).map(v => ({
            nombre: v.nombre,
            cargo: v.cargo,
            turno: v.turno,
            start_date: v.start_date,
            end_date: v.end_date,
        })),
        totalStaffCount,
        availableStaffCount: Math.max(0, availableStaffCount),
        overlappingDays,
    };
};

export const fetchVacaciones = async (
    terminalContext: TerminalContext,
    filters?: AttendanceFilters
): Promise<Vacacion[]> => {
    if (!isSupabaseConfigured()) return [];

    const terminals = resolveTerminalsForContext(terminalContext);

    let query = supabase
        .from('attendance_vacaciones')
        .select('*')
        .in('terminal_code', terminals)
        .order('start_date', { ascending: false });

    if (filters?.auth_status && filters.auth_status !== 'todos') {
        query = query.eq('auth_status', filters.auth_status);
    }

    if (filters?.search) {
        const term = `%${filters.search}%`;
        query = query.or(`nombre.ilike.${term},rut.ilike.${term}`);
    }

    if (filters?.date_from) {
        query = query.gte('start_date', filters.date_from);
    }

    if (filters?.date_to) {
        query = query.lte('end_date', filters.date_to);
    }

    const { data, error } = await query;
    if (error) {
        if (isMissingTableError(error, 'attendance_vacaciones')) {
            warnMissingAttendanceSchema();
            return [];
        }
        throw error;
    }
    return data || [];
};

export const createVacacion = async (
    values: VacacionFormValues,
    createdBy: string
): Promise<Vacacion> => {
    const calendarDays = calculateCalendarDays(values.start_date, values.end_date);
    const businessDays = calculateBusinessDays(values.start_date, values.end_date);

    // Check for conflicts
    const conflictInfo = await checkVacationConflicts(
        values.cargo,
        values.terminal_code,
        values.turno,
        values.start_date,
        values.end_date
    );

    const conflictDetails = conflictInfo.hasConflict
        ? `${conflictInfo.conflictingVacations.length} persona(s) en misma posición en vacaciones. Disponibles: ${conflictInfo.availableStaffCount}/${conflictInfo.totalStaffCount}`
        : null;

    const { data, error } = await supabase
        .from('attendance_vacaciones')
        .insert({
            rut: values.rut,
            nombre: values.nombre,
            cargo: values.cargo,
            terminal_code: values.terminal_code,
            turno: values.turno,
            start_date: values.start_date,
            end_date: values.end_date,
            return_date: values.return_date,
            calendar_days: calendarDays,
            business_days: businessDays,
            has_conflict: conflictInfo.hasConflict,
            conflict_authorized: values.conflict_authorized,
            conflict_details: conflictDetails,
            created_by_supervisor: normalizeName(createdBy),
        })
        .select()
        .single();

    if (error) {
        showErrorToast('Error al crear registro', 'No se pudo guardar la solicitud de vacaciones');
        throw error;
    }

    // Send email notification
    try {
        const conflictWarning = conflictInfo.hasConflict
            ? `Conflictos detectados\n${conflictDetails}`
            : 'Sin conflictos\ndetectados';

        await sendRecordCreatedEmail('Vacaciones', {
            rut: values.rut,
            nombre: values.nombre,
            terminal: values.terminal_code,
            date: values.start_date,
            createdBy: createdBy,
            requestId: data.id,
            createdAt: data.created_at,
            status: data.auth_status,
            details: {
                'Fecha Inicio': values.start_date,
                'Fecha Término': values.end_date,
                'Fecha Vuelta': values.return_date,
                'Días Calendario': calendarDays.toString(),
                'Días a Descontar': businessDays.toString(),
                'Conflictos': conflictWarning,
            }
        });
        showSuccessToast(
            'Solicitud de vacaciones creada',
            `Vacaciones para ${values.nombre} (${businessDays} días hábiles) registradas`,
            createdBy
        );
    } catch {
        showSuccessToast(
            'Solicitud creada',
            `Vacaciones para ${values.nombre} registradas (correo no enviado)`,
            createdBy
        );
    }

    return data;
};

export const updateVacacion = async (
    id: string,
    values: Partial<VacacionFormValues>
): Promise<Vacacion> => {
    const updateData: Record<string, unknown> = { ...values };

    // Recalculate days if dates changed
    if (values.start_date && values.end_date) {
        updateData.calendar_days = calculateCalendarDays(values.start_date, values.end_date);
        updateData.business_days = calculateBusinessDays(values.start_date, values.end_date);
    }

    const { data, error } = await supabase
        .from('attendance_vacaciones')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// ==========================================
// EMAIL NOTIFICATION
// ==========================================

import { emailService } from '../../shared/services/emailService';
import { displayTerminal } from '../../shared/utils/terminal';
import { fetchAppConfig, EmailConfig } from '../settings/api';
import { formatRut } from '../personal/utils/rutUtils';
import {
    AsissEmailColumn,
    AsissEmailValue,
    buildAsissLogisticaEmail,
    formatEmailDate,
    hasAsissEmailValue,
} from './emailTemplates';

const EMAIL_RECIPIENT = 'isaac.avila@transdev.cl';
const EMAIL_AUDIENCE_LABEL = 'Revisión y autorización';
const PENDING_STATUS_LABEL = 'Pendiente de\nautorización';

interface AttendanceCreatedEmailData {
    rut: string;
    nombre: string;
    terminal: string;
    date: string;
    createdBy: string;
    requestId?: string | number | null;
    createdAt?: string | Date | null;
    status?: AuthStatus;
    details?: Record<string, AsissEmailValue>;
}

const asText = (value: AsissEmailValue): string => {
    if (!hasAsissEmailValue(value)) return '';
    if (typeof value === 'object' && value !== null && 'html' in value) {
        return value.text ?? value.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return String(value);
};

const detailValue = (details: Record<string, AsissEmailValue> | undefined, key: string): AsissEmailValue =>
    details?.[key] ?? '';

const detailDate = (details: Record<string, AsissEmailValue> | undefined, key: string) => {
    const value = detailValue(details, key);
    const text = asText(value);
    return text ? formatEmailDate(text) : '';
};

const formatTimeRange = (start?: string | null, end?: string | null) => {
    const parts = [start, end].map((part) => part?.trim()).filter(Boolean);
    return parts.join(' - ');
};

const requestLabelForSubsection = (subsection: string) => {
    const normalized = subsection.toLowerCase();
    if (normalized.includes('no marc')) return 'No marcación';
    if (normalized.includes('sin cred')) return 'Sin credencial';
    if (normalized.includes('cambio')) return 'Cambio de día';
    if (normalized.includes('autoriz')) return 'Permiso';
    if (normalized.includes('vacacion') || normalized.includes('vacaciones')) return 'Vacaciones';
    return subsection;
};

const statusLabel = (status?: AuthStatus) => {
    if (status === 'AUTORIZADO') return 'Autorizado';
    if (status === 'RECHAZADO') return 'Rechazado';
    return PENDING_STATUS_LABEL;
};

const baseRowData = (data: AttendanceCreatedEmailData): Record<string, AsissEmailValue> => ({
    rut: formatRut(data.rut),
    colaborador: data.nombre,
    terminal: displayTerminal(data.terminal as any),
    estado: statusLabel(data.status),
});

const buildRecordTable = (
    subsection: string,
    data: AttendanceCreatedEmailData
): { columns: AsissEmailColumn[]; rowData: Record<string, AsissEmailValue> } => {
    const details = data.details;
    const requestDate = formatEmailDate(data.createdAt ?? data.date);
    const eventDate = formatEmailDate(data.date);
    const rowData = baseRowData(data);
    const normalized = subsection.toLowerCase();

    if (normalized.includes('vacacion') || normalized.includes('vacaciones')) {
        return {
            columns: [
                { key: 'rut', label: 'RUT', width: 6 },
                { key: 'colaborador', label: 'COLABORADOR', width: 18 },
                { key: 'terminal', label: 'TERMINAL', width: 7 },
                { key: 'fecha_solicitud', label: 'FECHA DE\nSOLICITUD', width: 9 },
                { key: 'tipo', label: 'TIPO', width: 7 },
                { key: 'estado', label: 'ESTADO', width: 12, tone: 'status' },
                { key: 'inicio', label: 'INICIO DE\nVACACIONES', width: 8 },
                { key: 'termino', label: 'TÉRMINO DE\nVACACIONES', width: 8 },
                { key: 'vuelta', label: 'FECHA DE\nVUELTA', width: 8 },
                { key: 'dias_calendario', label: 'DÍAS\nCALENDARIO', width: 5 },
                { key: 'dias_descontar', label: 'DÍAS A\nDESCONTAR', width: 5 },
                { key: 'conflictos', label: 'CONFLICTOS', width: 7, tone: 'conflict' },
            ],
            rowData: {
                ...rowData,
                fecha_solicitud: requestDate,
                tipo: 'Vacaciones',
                inicio: detailDate(details, 'Fecha Inicio'),
                termino: detailDate(details, 'Fecha Término'),
                vuelta: detailDate(details, 'Fecha Vuelta'),
                dias_calendario: detailValue(details, 'Días Calendario'),
                dias_descontar: detailValue(details, 'Días a Descontar'),
                conflictos: detailValue(details, 'Conflictos'),
            },
        };
    }

    if (normalized.includes('no marc')) {
        return {
            columns: [
                { key: 'rut', label: 'RUT', width: 6 },
                { key: 'colaborador', label: 'COLABORADOR', width: 16 },
                { key: 'cargo', label: 'CARGO', width: 8 },
                { key: 'area', label: 'ÁREA', width: 6 },
                { key: 'jefe_terminal', label: 'JEFE\nTERMINAL', width: 8 },
                { key: 'terminal', label: 'TERMINAL', width: 7 },
                { key: 'cabezal', label: 'CABEZAL', width: 6 },
                { key: 'fecha', label: 'FECHA', width: 8 },
                { key: 'tipo_marcacion', label: 'TIPO DE\nMARCACIÓN', width: 8 },
                { key: 'hora_esperada', label: 'HORA\nESPERADA', width: 8 },
                { key: 'hora_registrada', label: 'HORA\nREGISTRADA', width: 8 },
                { key: 'estado', label: 'ESTADO', width: 9, tone: 'status' },
                { key: 'informado_por', label: 'INFORMADO\nPOR', width: 8 },
                { key: 'observaciones', label: 'OBSERVACIONES', width: 12 },
            ],
            rowData: {
                ...rowData,
                cargo: detailValue(details, 'Cargo'),
                area: detailValue(details, 'Área'),
                jefe_terminal: detailValue(details, 'Jefe Terminal'),
                cabezal: detailValue(details, 'Cabezal'),
                fecha: eventDate,
                tipo_marcacion: detailValue(details, 'Tipo de Marcación'),
                hora_esperada: detailValue(details, 'Hora Esperada'),
                hora_registrada: detailValue(details, 'Hora Registrada'),
                informado_por: detailValue(details, 'Informado Por'),
                observaciones: detailValue(details, 'Observaciones'),
            },
        };
    }

    if (normalized.includes('sin cred')) {
        return {
            columns: [
                { key: 'rut', label: 'RUT', width: 7 },
                { key: 'colaborador', label: 'COLABORADOR', width: 18 },
                { key: 'cargo', label: 'CARGO', width: 10 },
                { key: 'area', label: 'ÁREA', width: 7 },
                { key: 'terminal', label: 'TERMINAL', width: 8 },
                { key: 'cabezal', label: 'CABEZAL', width: 7 },
                { key: 'fecha', label: 'FECHA', width: 9 },
                { key: 'horario', label: 'HORARIO', width: 9 },
                { key: 'estado', label: 'ESTADO', width: 10, tone: 'status' },
                { key: 'informado_por', label: 'INFORMADO\nPOR', width: 10 },
                { key: 'responsable', label: 'RESPONSABLE', width: 8 },
                { key: 'observaciones', label: 'OBSERVACIONES', width: 12 },
            ],
            rowData: {
                ...rowData,
                cargo: detailValue(details, 'Cargo'),
                area: detailValue(details, 'Área'),
                cabezal: detailValue(details, 'Cabezal'),
                fecha: eventDate,
                horario: detailValue(details, 'Horario'),
                informado_por: detailValue(details, 'Supervisor Autoriza'),
                responsable: detailValue(details, 'Responsable'),
                observaciones: detailValue(details, 'Observaciones'),
            },
        };
    }

    if (normalized.includes('cambio')) {
        return {
            columns: [
                { key: 'rut', label: 'RUT', width: 7 },
                { key: 'colaborador', label: 'COLABORADOR', width: 18 },
                { key: 'terminal', label: 'TERMINAL', width: 8 },
                { key: 'cabezal', label: 'CABEZAL', width: 7 },
                { key: 'fecha_solicitud', label: 'FECHA DE\nSOLICITUD', width: 10 },
                { key: 'dia_original', label: 'DÍA\nORIGINAL', width: 9 },
                { key: 'dia_solicitado', label: 'DÍA\nSOLICITADO', width: 9 },
                { key: 'turno_original', label: 'TURNO\nORIGINAL', width: 9 },
                { key: 'turno_solicitado', label: 'TURNO\nSOLICITADO', width: 9 },
                { key: 'jornada_programada', label: 'JORNADA\nPROGRAMADA', width: 9 },
                { key: 'estado', label: 'ESTADO', width: 10, tone: 'status' },
                { key: 'documento', label: 'VALIDACIÓN', width: 9 },
            ],
            rowData: {
                ...rowData,
                cabezal: detailValue(details, 'Cabezal'),
                fecha_solicitud: requestDate,
                dia_original: detailDate(details, 'Día No Trabaja'),
                dia_solicitado: detailDate(details, 'Día Trabaja'),
                turno_original: detailValue(details, 'Turno Original'),
                turno_solicitado: detailValue(details, 'Turno Solicitado'),
                jornada_programada: detailValue(details, 'Jornada Programada'),
                documento: detailValue(details, 'Documento'),
            },
        };
    }

    return {
        columns: [
            { key: 'rut', label: 'RUT', width: 7 },
            { key: 'colaborador', label: 'COLABORADOR', width: 18 },
            { key: 'cargo', label: 'CARGO', width: 10 },
            { key: 'terminal', label: 'TERMINAL', width: 8 },
            { key: 'fecha_solicitud', label: 'FECHA DE\nSOLICITUD', width: 10 },
            { key: 'tipo_permiso', label: 'TIPO DE\nPERMISO', width: 10 },
            { key: 'fecha_inicio', label: 'FECHA DE\nINICIO', width: 10 },
            { key: 'hora_inicio', label: 'HORA DE\nINICIO', width: 8 },
            { key: 'hora_termino', label: 'HORA DE\nTÉRMINO', width: 8 },
            { key: 'turno', label: 'TURNO', width: 8 },
            { key: 'estado', label: 'ESTADO', width: 10, tone: 'status' },
            { key: 'motivo', label: 'MOTIVO U\nOBSERVACIONES', width: 13 },
        ],
        rowData: {
            ...rowData,
            cargo: detailValue(details, 'Cargo'),
            fecha_solicitud: requestDate,
            tipo_permiso: detailValue(details, 'Tipo'),
            fecha_inicio: eventDate,
            hora_inicio: detailValue(details, 'Hora Inicio'),
            hora_termino: detailValue(details, 'Hora Término'),
            turno: detailValue(details, 'Turno'),
            motivo: detailValue(details, 'Motivo'),
        },
    };
};

const fetchEmailRecipients = async () => {
    const config = await fetchAppConfig<EmailConfig>('email_notifications');
    return {
        recipients: config?.to && config.to.length > 0 ? config.to : [EMAIL_RECIPIENT],
        ccRecipients: config?.cc || [],
    };
};

export const sendAuthorizationEmail = async (
    type: 'AUTORIZADO' | 'RECHAZADO',
    subsection: string,
    rut: string,
    nombre: string,
    terminal: string,
    date: string,
    reason?: string
): Promise<void> => {
    const subject = `${subsection} ${type} - ${nombre}`;
    const requestLabel = requestLabelForSubsection(subsection);
    const body = buildAsissLogisticaEmail({
        title: `${type === 'AUTORIZADO' ? 'Registro aprobado' : 'Registro rechazado'}: ${requestLabel}`,
        subtitle: 'Actualización registrada en el flujo de autorización.',
        unitOrTerminal: displayTerminal(terminal as any),
        registeredBy: 'Sistema ASISS',
        audience: EMAIL_AUDIENCE_LABEL,
        columns: [
            { key: 'rut', label: 'RUT', width: 10 },
            { key: 'colaborador', label: 'COLABORADOR', width: 24 },
            { key: 'terminal', label: 'TERMINAL', width: 12 },
            { key: 'tipo', label: 'TIPO DE\nSOLICITUD', width: 14 },
            { key: 'fecha', label: 'FECHA', width: 14 },
            { key: 'estado', label: 'ESTADO', width: 14, tone: 'status' },
            { key: 'motivo', label: 'MOTIVO U\nOBSERVACIONES', width: 12 },
        ],
        rowData: {
            rut: formatRut(rut),
            colaborador: nombre,
            terminal: displayTerminal(terminal as any),
            tipo: requestLabel,
            fecha: formatEmailDate(date),
            estado: statusLabel(type),
            motivo: reason || '',
        },
        status: type,
    });

    const { recipients, ccRecipients } = await fetchEmailRecipients();

    try {
        await emailService.sendEmail({
            audience: 'manual',
            manualRecipients: recipients,
            cc: ccRecipients,
            subject,
            body,
            module: 'asistencia',
        });
    } catch (err) {
        console.error('Error sending authorization email:', err);
    }
};

export const sendRecordCreatedEmail = async (
    subsection: string,
    data: {
        rut: string;
        nombre: string;
        terminal: string;
        date: string;
        createdBy: string;
        requestId?: string | number | null;
        createdAt?: string | Date | null;
        status?: AuthStatus;
        details?: Record<string, AsissEmailValue>;
    }
): Promise<void> => {
    const requestLabel = requestLabelForSubsection(subsection);
    const { columns, rowData } = buildRecordTable(subsection, data);
    const subject = `Nuevo Registro: ${requestLabel}`;
    const body = buildAsissLogisticaEmail({
        title: `Nuevo registro: ${requestLabel}`,
        subtitle: 'Solicitud ingresada para revisión y autorización.',
        unitOrTerminal: displayTerminal(data.terminal as any),
        requestId: data.requestId,
        registeredBy: data.createdBy,
        audience: EMAIL_AUDIENCE_LABEL,
        sentAt: new Date(),
        columns,
        rowData,
        status: data.status || 'PENDIENTE',
    });

    const { recipients, ccRecipients } = await fetchEmailRecipients();

    try {
        await emailService.sendEmail({
            audience: 'manual',
            manualRecipients: recipients,
            cc: ccRecipients,
            subject,
            body,
            module: 'asistencia',
        });
    } catch (err) {
        console.error('Error sending record created email:', err);
    }
};
