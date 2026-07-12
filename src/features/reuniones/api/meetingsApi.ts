import { supabase, isSupabaseConfigured } from '../../../shared/lib/supabaseClient';
import { TerminalContext } from '../../../shared/types/terminal';
import { resolveTerminalsForContext } from '../../../shared/utils/terminal';
import { emailService } from '../../../shared/services/emailService';
import { showSuccessToast, showErrorToast, showWarningToast } from '../../../shared/state/toastStore';
import {
    Meeting,
    MeetingFormValues,
    MeetingInvitee,
    InviteeInput,
    MeetingFile,
    MeetingAction,
    ActionFormValues,
    MeetingFilters,
    MeetingEmailSettings,
    MeetingWithCounts,
    ActionStatus,
} from '../types';

type SupabaseLikeError = {
    code?: string;
    message?: string;
};

let legacyMeetingsSchemaWarned = false;

const isMissingTableError = (error: SupabaseLikeError | null | undefined, table: string) =>
    error?.code === 'PGRST205' && error.message?.includes(`'public.${table}'`);

const isMissingColumnError = (error: SupabaseLikeError | null | undefined, table: string, column: string) =>
    error?.code === '42703' && error.message?.includes(`${table}.${column}`);

const isLegacyMeetingsSchemaError = (error: SupabaseLikeError | null | undefined) =>
    isMissingColumnError(error, 'meetings', 'starts_at') ||
    isMissingColumnError(error, 'meetings', 'terminal_code') ||
    isMissingTableError(error, 'meeting_invitees');

const warnLegacyMeetingsSchema = () => {
    if (legacyMeetingsSchemaWarned) return;
    legacyMeetingsSchemaWarned = true;
    showWarningToast(
        'Esquema antiguo de reuniones',
        'La base conectada usa un esquema anterior para reuniones. Se cargara un modo compatible con datos limitados.'
    );
};

const mapMeetingRecord = (meeting: Record<string, any>): MeetingWithCounts => ({
    id: meeting.id,
    title: meeting.title ?? 'Sin titulo',
    terminal_code: (meeting.terminal_code ?? 'EL_ROBLE') as Meeting['terminal_code'],
    starts_at: meeting.starts_at ?? meeting.scheduled_at ?? meeting.created_at ?? new Date().toISOString(),
    duration_minutes: typeof meeting.duration_minutes === 'number' ? meeting.duration_minutes : 30,
    location: meeting.location ?? null,
    meeting_link: meeting.meeting_link ?? null,
    status: (meeting.status ?? 'PROGRAMADA') as Meeting['status'],
    cancel_reason: meeting.cancel_reason ?? null,
    agenda_json: Array.isArray(meeting.agenda_json) ? meeting.agenda_json : [],
    minutes_text: meeting.minutes_text ?? null,
    created_by_supervisor: meeting.created_by_supervisor ?? String(meeting.created_by ?? 'Sistema'),
    created_at: meeting.created_at ?? new Date().toISOString(),
    updated_at: meeting.updated_at ?? meeting.created_at ?? new Date().toISOString(),
    invitees_count: meeting.meeting_invitees?.[0]?.count || 0,
    files_count: meeting.meeting_files?.[0]?.count || 0,
    actions_count: meeting.meeting_actions?.[0]?.count || 0,
});

const fetchLegacyMeetings = async (filters?: MeetingFilters): Promise<MeetingWithCounts[]> => {
    let query = supabase
        .from('meetings')
        .select('*')
        .order('scheduled_at', { ascending: false });

    if (filters?.search) {
        query = query.ilike('title', `%${filters.search}%`);
    }

    if (filters?.date_from) {
        query = query.gte('scheduled_at', filters.date_from);
    }

    if (filters?.date_to) {
        query = query.lte('scheduled_at', filters.date_to + 'T23:59:59');
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || [])
        .filter((meeting: Record<string, any>) => {
            if (!filters?.status || filters.status === 'todos') return true;
            return (meeting.status ?? 'PROGRAMADA') === filters.status;
        })
        .map((meeting: Record<string, any>) => mapMeetingRecord(meeting));
};

// ==========================================
// MEETINGS CRUD
// ==========================================

export const fetchMeetings = async (
    terminalContext: TerminalContext,
    filters?: MeetingFilters
): Promise<MeetingWithCounts[]> => {
    if (!isSupabaseConfigured()) return [];

    const terminals = resolveTerminalsForContext(terminalContext);

    let query = supabase
        .from('meetings')
        .select(`
            *,
            meeting_invitees(count),
            meeting_files(count),
            meeting_actions(count)
        `)
        .in('terminal_code', terminals)
        .order('starts_at', { ascending: false });

    if (filters?.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
    }

    if (filters?.search) {
        const term = `%${filters.search}%`;
        query = query.ilike('title', term);
    }

    if (filters?.date_from) {
        query = query.gte('starts_at', filters.date_from);
    }

    if (filters?.date_to) {
        query = query.lte('starts_at', filters.date_to + 'T23:59:59');
    }

    const { data, error } = await query;
    if (error) {
        if (isLegacyMeetingsSchemaError(error)) {
            warnLegacyMeetingsSchema();
            return fetchLegacyMeetings(filters);
        }
        throw error;
    }

    return (data || []).map((meeting: Record<string, any>) => mapMeetingRecord(meeting));
};

export const fetchMeetingById = async (id: string): Promise<Meeting | null> => {
    const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
    }

    if (!data) return null;

    const normalized = mapMeetingRecord(data);
    return {
        id: normalized.id,
        title: normalized.title,
        terminal_code: normalized.terminal_code,
        starts_at: normalized.starts_at,
        duration_minutes: normalized.duration_minutes,
        location: normalized.location,
        meeting_link: normalized.meeting_link,
        status: normalized.status,
        cancel_reason: normalized.cancel_reason,
        agenda_json: normalized.agenda_json,
        minutes_text: normalized.minutes_text,
        created_by_supervisor: normalized.created_by_supervisor,
        created_at: normalized.created_at,
        updated_at: normalized.updated_at,
    };
};

export const createMeeting = async (
    values: MeetingFormValues,
    createdBy: string
): Promise<Meeting> => {
    // Create meeting
    const { data: meeting, error } = await supabase
        .from('meetings')
        .insert({
            title: values.title,
            terminal_code: values.terminal_code,
            starts_at: values.starts_at,
            duration_minutes: values.duration_minutes,
            location: values.location || null,
            meeting_link: values.meeting_link || null,
            agenda_json: values.agenda_json || [],
            created_by_supervisor: createdBy,
        })
        .select()
        .single();

    if (error) {
        showErrorToast('Error al crear reunión', 'No se pudo guardar la reunión');
        throw error;
    }

    // Add invitees
    if (values.invitees.length > 0) {
        await addInvitees(meeting.id, values.invitees);
    }

    showSuccessToast('Reunión creada', `"${values.title}" programada correctamente`, createdBy);
    return meeting;
};

export const updateMeeting = async (
    id: string,
    values: Partial<MeetingFormValues>
): Promise<Meeting> => {
    const updateData: Record<string, unknown> = {};

    if (values.title !== undefined) updateData.title = values.title;
    if (values.terminal_code !== undefined) updateData.terminal_code = values.terminal_code;
    if (values.starts_at !== undefined) updateData.starts_at = values.starts_at;
    if (values.duration_minutes !== undefined) updateData.duration_minutes = values.duration_minutes;
    if (values.location !== undefined) updateData.location = values.location || null;
    if (values.meeting_link !== undefined) updateData.meeting_link = values.meeting_link || null;
    if (values.agenda_json !== undefined) updateData.agenda_json = values.agenda_json;

    const { data, error } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateMeetingStatus = async (
    id: string,
    status: 'REALIZADA' | 'CANCELADA',
    cancelReason?: string
): Promise<void> => {
    const updateData: Record<string, unknown> = { status };
    if (cancelReason) updateData.cancel_reason = cancelReason;

    const { error } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('id', id);

    if (error) throw error;
};

export const updateMinutes = async (
    id: string,
    minutesText: string
): Promise<void> => {
    const { error } = await supabase
        .from('meetings')
        .update({ minutes_text: minutesText })
        .eq('id', id);

    if (error) throw error;
};

// ==========================================
// INVITEES
// ==========================================

export const fetchInvitees = async (meetingId: string): Promise<MeetingInvitee[]> => {
    const { data, error } = await supabase
        .from('meeting_invitees')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('invitee_name');

    if (error) throw error;
    return data || [];
};

export const addInvitees = async (
    meetingId: string,
    invitees: InviteeInput[]
): Promise<void> => {
    const rows = invitees.map(inv => ({
        meeting_id: meetingId,
        staff_id: inv.staff_id || null,
        invitee_name: inv.invitee_name,
        invitee_email: inv.invitee_email || null,
    }));

    const { error } = await supabase
        .from('meeting_invitees')
        .insert(rows);

    if (error) throw error;
};

export const removeInvitee = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('meeting_invitees')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const updateInviteeNotificationStatus = async (
    id: string,
    status: 'ENVIADO' | 'ERROR'
): Promise<void> => {
    const { error } = await supabase
        .from('meeting_invitees')
        .update({
            notification_status: status,
            notified_at: status === 'ENVIADO' ? new Date().toISOString() : null,
        })
        .eq('id', id);

    if (error) throw error;
};

// ==========================================
// FILES
// ==========================================

export const fetchFiles = async (meetingId: string): Promise<MeetingFile[]> => {
    const { data, error } = await supabase
        .from('meeting_files')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const uploadFile = async (
    meetingId: string,
    file: File,
    uploadedBy: string
): Promise<MeetingFile> => {
    const fileExt = file.name.split('.').pop();
    const filePath = `meetings/${meetingId}/${Date.now()}.${fileExt}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
        .from('meeting-files')
        .upload(filePath, file);

    if (uploadError) {
        showErrorToast('Error al subir archivo', uploadError.message);
        throw uploadError;
    }

    // Create DB record
    const { data, error } = await supabase
        .from('meeting_files')
        .insert({
            meeting_id: meetingId,
            storage_path: filePath,
            file_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            uploaded_by: uploadedBy,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteFile = async (id: string, storagePath: string): Promise<void> => {
    // Delete from storage
    await supabase.storage.from('meeting-files').remove([storagePath]);

    // Delete DB record
    const { error } = await supabase
        .from('meeting_files')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const getFileUrl = async (storagePath: string): Promise<string> => {
    const { data, error } = await supabase.storage
        .from('meeting-files')
        .createSignedUrl(storagePath, 3600);

    if (error) throw error;
    return data.signedUrl;
};

// ==========================================
// ACTIONS/AGREEMENTS
// ==========================================

export const fetchActions = async (meetingId: string): Promise<MeetingAction[]> => {
    const { data, error } = await supabase
        .from('meeting_actions')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const createAction = async (
    meetingId: string,
    values: ActionFormValues
): Promise<MeetingAction> => {
    const { data, error } = await supabase
        .from('meeting_actions')
        .insert({
            meeting_id: meetingId,
            description: values.description,
            responsible_staff_id: values.responsible_staff_id || null,
            responsible_name: values.responsible_name || null,
            due_date: values.due_date || null,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateAction = async (
    id: string,
    values: Partial<ActionFormValues & { status: ActionStatus }>
): Promise<MeetingAction> => {
    const { data, error } = await supabase
        .from('meeting_actions')
        .update(values)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteAction = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('meeting_actions')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

// ==========================================
// EMAIL SETTINGS
// ==========================================

export const fetchEmailSettings = async (
    scopeType: 'GLOBAL' | 'TERMINAL',
    scopeCode: string
): Promise<MeetingEmailSettings | null> => {
    const { data, error } = await supabase
        .from('meeting_email_settings')
        .select('*')
        .eq('scope_type', scopeType)
        .eq('scope_code', scopeCode)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
    }
    return data;
};

export const upsertEmailSettings = async (
    settings: Omit<MeetingEmailSettings, 'id' | 'updated_at'>
): Promise<void> => {
    const { error } = await supabase
        .from('meeting_email_settings')
        .upsert(settings, { onConflict: 'scope_type,scope_code' });

    if (error) throw error;
};

// ==========================================
// EMAIL SENDING
// ==========================================

export const sendMeetingInvitation = async (
    meeting: Meeting,
    invitees: MeetingInvitee[],
    organizer: string
): Promise<void> => {
    const settings = await fetchEmailSettings('GLOBAL', 'ALL');
    if (!settings?.enabled) return;

    const date = new Date(meeting.starts_at);
    const dateStr = date.toLocaleDateString('es-CL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const agendaText = meeting.agenda_json
        .map((item, i) => `${i + 1}. ${item.text}`)
        .join('\n') || 'Sin agenda definida';

    for (const invitee of invitees) {
        if (!invitee.invitee_email) continue;

        try {
            const subject = settings.subject_template
                .replace('{{title}}', meeting.title);

            const body = settings.body_template
                .replace('{{invitee_name}}', invitee.invitee_name)
                .replace('{{title}}', meeting.title)
                .replace('{{date}}', dateStr)
                .replace('{{time}}', timeStr)
                .replace('{{duration}}', meeting.duration_minutes.toString())
                .replace('{{location}}', meeting.location || meeting.meeting_link || 'Por confirmar')
                .replace('{{agenda}}', agendaText)
                .replace('{{organizer}}', organizer);

            await emailService.sendEmail({
                audience: 'manual',
                manualRecipients: [invitee.invitee_email],
                cc: settings.cc_emails?.split(',').map(e => e.trim()).filter(Boolean) || [],
                subject,
                body: body.replace(/\n/g, '<br>'),
            });

            await updateInviteeNotificationStatus(invitee.id, 'ENVIADO');
        } catch (err) {
            console.error('Error sending invitation:', err);
            await updateInviteeNotificationStatus(invitee.id, 'ERROR');
        }
    }
};

export const sendCancellationNotice = async (
    meeting: Meeting,
    invitees: MeetingInvitee[],
    organizer: string,
    reason: string
): Promise<void> => {
    for (const invitee of invitees) {
        if (!invitee.invitee_email) continue;

        try {
            await emailService.sendEmail({
                audience: 'manual',
                manualRecipients: [invitee.invitee_email],
                subject: `Reunión Cancelada: ${meeting.title}`,
                body: `
                    <p>Estimado/a ${invitee.invitee_name},</p>
                    <p>Le informamos que la reunión <strong>"${meeting.title}"</strong> ha sido cancelada.</p>
                    <p><strong>Motivo:</strong> ${reason}</p>
                    <p>Saludos cordiales,<br>${organizer}</p>
                `.trim(),
            });
        } catch (err) {
            console.error('Error sending cancellation:', err);
        }
    }
};

// ==========================================
// SUPERVISORS (for invitee selector)
// ==========================================

export const fetchSupervisors = async (): Promise<{ id: string; nombre: string; email: string | null; terminal_code: string }[]> => {
    const { data, error } = await supabase
        .from('staff')
        .select('id, nombre, email, terminal_code')
        .eq('cargo', 'Supervisor')
        .eq('status', 'ACTIVO')
        .order('nombre');

    if (error) throw error;
    return data || [];
};
