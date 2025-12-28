import { supabase } from '../../../shared/lib/supabaseClient';
import type { AseoCleaner, AseoRecord, AseoTask, AseoNotification, CreateAseoRecordInput } from '../types';

// ==========================================
// CLEANERS
// ==========================================

export async function registerCleaner(name: string): Promise<AseoCleaner> {
    const { data, error } = await supabase
        .from('aseo_cleaners')
        .insert({ name, last_active_at: new Date().toISOString() })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function fetchCleanerByName(name: string): Promise<AseoCleaner | null> {
    const { data, error } = await supabase
        .from('aseo_cleaners')
        .select('*')
        .eq('name', name)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

export async function updateCleanerActivity(cleanerId: string): Promise<void> {
    await supabase
        .from('aseo_cleaners')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', cleanerId);
}

// ==========================================
// RECORDS
// ==========================================

export async function uploadAseoPhoto(file: File): Promise<string> {
    const fileName = `${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('aseo-photos')
        .upload(fileName, file);

    if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Error al subir foto: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
        .from('aseo-photos')
        .getPublicUrl(uploadData.path);

    return publicUrl;
}

export async function createAseoRecord(
    cleanerId: string,
    cleanerName: string,
    input: CreateAseoRecordInput,
    photo: File
): Promise<AseoRecord> {
    // Upload photo first
    const photoUrl = await uploadAseoPhoto(photo);

    // Create record
    const { data, error } = await supabase
        .from('aseo_records')
        .insert({
            cleaner_id: cleanerId,
            cleaner_name: cleanerName,
            ...input,
            photo_url: photoUrl
        })
        .select()
        .single();

    if (error) throw error;

    // Update cleaner activity
    await updateCleanerActivity(cleanerId);

    return data;
}

export async function fetchAseoRecords(cleanerId?: string): Promise<AseoRecord[]> {
    let query = supabase
        .from('aseo_records')
        .select('*')
        .order('created_at', { ascending: false });

    if (cleanerId) {
        query = query.eq('cleaner_id', cleanerId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

// ==========================================
// TASKS
// ==========================================

export async function fetchTasks(cleanerId: string): Promise<AseoTask[]> {
    console.log('🔍 Fetching tasks for cleanerId:', cleanerId);

    const { data, error } = await supabase
        .from('aseo_tasks')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ Error fetching tasks:', error);
        throw error;
    }

    console.log('✅ Tasks found:', data?.length || 0, data);
    return data || [];
}

export async function fetchAllTasks(): Promise<AseoTask[]> {
    const { data, error } = await supabase
        .from('aseo_tasks')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ Error fetching all tasks:', error);
        throw error;
    }

    console.log('✅ All tasks found:', data?.length || 0);
    return data || [];
}

/**
 * Extract bus code from task title
 * Examples: "Limpiar bus SKPK18" -> "SKPK18"
 */
function extractBusCode(title: string): string {
    const match = title.match(/bus\s+([A-Z0-9]+)/i);
    return match ? match[1].toUpperCase() : '';
}

/**
 * Get cleaner name from cleaner_id
 */
async function getCleanerName(cleanerId: string): Promise<string> {
    const { data } = await supabase
        .from('aseo_cleaners')
        .select('name')
        .eq('id', cleanerId)
        .single();

    return data?.name || 'Desconocido';
}

export async function updateTaskStatus(
    taskId: string,
    status: 'PENDIENTE' | 'TERMINADA',
    evidenceFile?: File
): Promise<AseoTask> {
    const updates: any = {
        status,
        completed_at: status === 'TERMINADA' ? new Date().toISOString() : null
    };

    if (evidenceFile) {
        const evidenceUrl = await uploadAseoPhoto(evidenceFile);
        updates.evidence_url = evidenceUrl;
    }

    const { data, error } = await supabase
        .from('aseo_tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

    if (error) throw error;

    // If task is completed, create aseo_record automatically
    if (status === 'TERMINADA' && data) {
        const busCode = extractBusCode(data.title);
        const cleanerName = await getCleanerName(data.cleaner_id);

        if (busCode && updates.evidence_url) {
            try {
                await supabase.from('aseo_records').insert({
                    cleaner_id: data.cleaner_id,
                    cleaner_name: cleanerName,
                    bus_code: busCode,
                    terminal_code: 'TAREA',
                    cleaning_type: 'FULL',
                    photo_url: updates.evidence_url,
                    task_id: taskId,
                    created_at: new Date().toISOString()
                });

                console.log('✅ Created aseo_record from task:', taskId);
            } catch (recordError) {
                console.error('❌ Failed to create record from task:', recordError);
                // Don't throw - task update should succeed even if record creation fails
            }
        }
    }

    return data;
}

export async function createTask(
    cleanerId: string,
    title: string,
    description: string,
    createdBy: string
): Promise<AseoTask> {
    const { data, error } = await supabase
        .from('aseo_tasks')
        .insert({
            cleaner_id: cleanerId,
            title,
            description,
            created_by: createdBy
        })
        .select()
        .single();

    if (error) throw error;

    // Create notification
    await createNotification(cleanerId, 'TAREA_NUEVA', 'Nueva tarea asignada', title, data.id);

    return data;
}

// ==========================================
// NOTIFICATIONS
// ==========================================

export async function fetchNotifications(cleanerId: string): Promise<AseoNotification[]> {
    const { data, error } = await supabase
        .from('aseo_notifications')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
    await supabase
        .from('aseo_notifications')
        .update({ read: true })
        .eq('id', notificationId);
}

export async function createNotification(
    cleanerId: string,
    type: 'TAREA_NUEVA' | 'OBSERVACION' | 'CAMBIO_ESTADO',
    title: string,
    message: string | null,
    relatedId?: string
): Promise<void> {
    await supabase
        .from('aseo_notifications')
        .insert({
            cleaner_id: cleanerId,
            type,
            title,
            message,
            related_id: relatedId || null
        });
}

// ==========================================
// DUPLICATE PREVENTION
// ==========================================

/**
 * Check if a bus has been cleaned this week
 */
export async function checkBusCleanedThisWeek(
    busCode: string
): Promise<{ cleaned: boolean; lastCleaning?: AseoRecord }> {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
        .from('aseo_records')
        .select('*')
        .eq('bus_code', busCode.toUpperCase())
        .gte('created_at', startOfWeek.toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error checking bus:', error);
        return { cleaned: false };
    }

    return {
        cleaned: !!data && data.length > 0,
        lastCleaning: data?.[0]
    };
}

// ==========================================
// ADMIN / STATS
// ==========================================

export async function fetchAllCleaners(): Promise<AseoCleaner[]> {
    const { data, error } = await supabase
        .from('aseo_cleaners')
        .select('*')
        .order('name');

    if (error) throw error;
    return data || [];
}

export interface AseoStats {
    totalToday: number;
    totalWeek: number;
    byType: Record<string, number>;
    byTerminal: Record<string, number>;
}

export async function fetchAseoStats(): Promise<AseoStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: allRecords } = await supabase
        .from('aseo_records')
        .select('*')
        .order('created_at', { ascending: false });

    const records = allRecords || [];

    const todayRecords = records.filter((r: AseoRecord) => new Date(r.created_at) >= today);
    const weekRecords = records.filter((r: AseoRecord) => new Date(r.created_at) >= weekAgo);

    const byType: Record<string, number> = {};
    const byTerminal: Record<string, number> = {};

    records.forEach((r: AseoRecord) => {
        byType[r.cleaning_type] = (byType[r.cleaning_type] || 0) + 1;
        byTerminal[r.terminal_code] = (byTerminal[r.terminal_code] || 0) + 1;
    });

    return {
        totalToday: todayRecords.length,
        totalWeek: weekRecords.length,
        byType,
        byTerminal
    };
}
