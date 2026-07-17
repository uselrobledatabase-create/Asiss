import { supabase, isSupabaseConfigured } from '../../shared/lib/supabaseClient';
import { TerminalCode, TerminalContext } from '../../shared/types/terminal';
import { resolveTerminalsForContext } from '../../shared/utils/terminal';
import { showWarningToast } from '../../shared/state/toastStore';
import { normalizeRut } from './utils/rutUtils';
import {
    Staff,
    StaffFormValues,
    StaffFilters,
    StaffAdmonition,
    StaffCap,
    StaffViewModel,
    StaffCountByCargo,
    StaffCountByTerminal,
    StaffCargo,
    STAFF_CARGOS,
} from './types';

type SupabaseLikeError = {
    code?: string;
    message?: string;
};

let missingStaffSchemaWarned = false;

const isMissingTableError = (error: SupabaseLikeError | null | undefined, table: string) =>
    error?.code === 'PGRST205' && error.message?.includes(`'public.${table}'`);

const warnMissingStaffSchema = () => {
    if (missingStaffSchemaWarned) return;
    missingStaffSchemaWarned = true;
    showWarningToast(
        'Esquema incompleto en Supabase',
        'La base conectada no tiene la tabla staff. Personal se mostrará vacío hasta restaurar ese esquema.'
    );
};

// ==========================================
// STAFF CRUD
// ==========================================

export const fetchStaff = async (
    terminalContext: TerminalContext,
    filters?: StaffFilters
): Promise<StaffViewModel[]> => {
    if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured, returning empty array');
        return [];
    }

    const terminals = resolveTerminalsForContext(terminalContext);

    let query = supabase
        .from('staff')
        .select(`
      *,
      staff_admonitions(count)
    `)
        .in('terminal_code', terminals)
        .order('nombre', { ascending: true });

    // Apply filters
    if (filters?.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
    }

    if (filters?.cargo && filters.cargo !== 'todos') {
        query = query.eq('cargo', filters.cargo);
    }

    if (filters?.search) {
        const searchTerm = `%${filters.search}%`;
        query = query.or(`nombre.ilike.${searchTerm},rut.ilike.${searchTerm}`);
    }

    const { data, error } = await query;

    if (error) {
        if (isMissingTableError(error, 'staff')) {
            warnMissingStaffSchema();
            return [];
        }
        console.error('Error fetching staff:', error);
        throw error;
    }

    return (data || []).map((row) => ({
        ...row,
        admonition_count: row.staff_admonitions?.[0]?.count ?? 0,
    }));
};

export const fetchStaffById = async (id: string): Promise<Staff | null> => {
    const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
    }

    return data;
};

export const fetchStaffByRut = async (rut: string): Promise<Staff | null> => {
    const normalized = normalizeRut(rut);

    const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('rut', normalized)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
    }

    return data;
};

export const createStaff = async (values: StaffFormValues): Promise<Staff> => {
    const { data, error } = await supabase
        .from('staff')
        .insert({
            rut: normalizeRut(values.rut),
            nombre: values.nombre.trim(),
            cargo: values.cargo,
            terminal_code: values.terminal_code,
            turno: values.turno.trim(),
            horario: values.horario.trim(),
            contacto: values.contacto.trim(),
            email: values.email?.trim() || null,
            talla_polera: values.talla_polera?.trim() || null,
            talla_chaqueta: values.talla_chaqueta?.trim() || null,
            talla_pantalon: values.talla_pantalon?.trim() || null,
            talla_zapato_seguridad: values.talla_zapato_seguridad?.trim() || null,
            talla_chaleco_reflectante: values.talla_chaleco_reflectante?.trim() || null,
        })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            throw new Error('Ya existe un trabajador con ese RUT');
        }
        throw error;
    }

    return data;
};

export const updateStaff = async (id: string, values: Partial<StaffFormValues>): Promise<Staff> => {
    const updateData: Record<string, unknown> = {};

    if (values.rut !== undefined) updateData.rut = normalizeRut(values.rut);
    if (values.nombre !== undefined) updateData.nombre = values.nombre.trim();
    if (values.cargo !== undefined) updateData.cargo = values.cargo;
    if (values.terminal_code !== undefined) updateData.terminal_code = values.terminal_code;
    if (values.turno !== undefined) updateData.turno = values.turno.trim();
    if (values.horario !== undefined) updateData.horario = values.horario.trim();
    if (values.contacto !== undefined) updateData.contacto = values.contacto.trim();
    if (values.email !== undefined) updateData.email = values.email?.trim() || null;
    if (values.talla_polera !== undefined) updateData.talla_polera = values.talla_polera?.trim() || null;
    if (values.talla_chaqueta !== undefined) updateData.talla_chaqueta = values.talla_chaqueta?.trim() || null;
    if (values.talla_pantalon !== undefined) updateData.talla_pantalon = values.talla_pantalon?.trim() || null;
    if (values.talla_zapato_seguridad !== undefined) updateData.talla_zapato_seguridad = values.talla_zapato_seguridad?.trim() || null;
    if (values.talla_chaleco_reflectante !== undefined) updateData.talla_chaleco_reflectante = values.talla_chaleco_reflectante?.trim() || null;

    const { data, error } = await supabase
        .from('staff')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const offboardStaff = async (id: string, comment: string): Promise<Staff> => {
    const { data, error } = await supabase
        .from('staff')
        .update({
            status: 'DESVINCULADO',
            terminated_at: new Date().toISOString(),
            termination_comment: comment.trim(),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const suspendStaff = async (id: string): Promise<Staff> => {
    const { data, error } = await supabase
        .from('staff')
        .update({ suspended: true })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const unsuspendStaff = async (id: string): Promise<Staff> => {
    const { data, error } = await supabase
        .from('staff')
        .update({ suspended: false })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// ==========================================
// STAFF CAPS (Cupos)
// ==========================================

export const fetchStaffCaps = async (scopeCode?: string): Promise<StaffCap[]> => {
    let query = supabase.from('staff_caps').select('*');

    if (scopeCode) {
        query = query.eq('scope_code', scopeCode);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

// ==========================================
// STAFF COUNTS
// ==========================================

export interface StaffCountsDetailPerson {
    nombre: string;
    cargo: string;
    terminal_code: string;
}

export const fetchStaffCounts = async (
    terminalContext: TerminalContext
): Promise<{
    byCargo: StaffCountByCargo[];
    byTerminal: StaffCountByTerminal[];
    total: number;
    detail: { licencias: StaffCountsDetailPerson[]; suspendidos: StaffCountsDetailPerson[] };
}> => {
    const terminals = resolveTerminalsForContext(terminalContext);

    // Fetch active staff with IDs for license lookup
    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, nombre, cargo, terminal_code, suspended')
        .eq('status', 'ACTIVO')
        .in('terminal_code', terminals);

    if (staffError) {
        if (isMissingTableError(staffError, 'staff')) {
            warnMissingStaffSchema();
            return {
                byCargo: STAFF_CARGOS.map((c) => ({
                    cargo: c.value,
                    count: 0,
                    max_q: null,
                    with_licenses: 0,
                    suspended: 0,
                    effective_count: 0,
                })),
                byTerminal: terminals.map((t) => ({
                    terminal_code: t,
                    count: 0,
                })),
                total: 0,
                detail: { licencias: [], suspendidos: [] },
            };
        }

        throw staffError;
    }

    // Get today's date for license check
    const today = new Date().toISOString().split('T')[0];

    // Fetch active licenses for today
    const staffIds = (staffData || []).map(s => s.id);
    const { data: licensesData } = await supabase
        .from('attendance_licenses')
        .select('staff_id')
        .in('staff_id', staffIds)
        .lte('start_date', today)
        .gte('end_date', today);

    const staffWithLicenses = new Set((licensesData || []).map(l => l.staff_id));

    // Fetch caps for ER_LR
    const { data: capsData } = await supabase
        .from('staff_caps')
        .select('*')
        .eq('scope_code', 'ER_LR');

    const capsMap = new Map<string, number>();
    (capsData || []).forEach((cap) => {
        capsMap.set(cap.cargo, cap.max_q);
    });

    // Calculate counts by cargo with license and suspension tracking
    const cargoStats = new Map<StaffCargo, { count: number; withLicenses: number; suspended: number }>();
    STAFF_CARGOS.forEach((c) => cargoStats.set(c.value, { count: 0, withLicenses: 0, suspended: 0 }));

    (staffData || []).forEach((staff) => {
        const cargo = staff.cargo as StaffCargo;
        const stats = cargoStats.get(cargo) || { count: 0, withLicenses: 0, suspended: 0 };

        stats.count++;
        if (staffWithLicenses.has(staff.id)) stats.withLicenses++;
        if (staff.suspended) stats.suspended++;

        cargoStats.set(cargo, stats);
    });

    const byCargo: StaffCountByCargo[] = STAFF_CARGOS.map((c) => {
        const stats = cargoStats.get(c.value) || { count: 0, withLicenses: 0, suspended: 0 };

        return {
            cargo: c.value,
            count: stats.count,
            max_q: capsMap.get(c.value) ?? null,
            with_licenses: stats.withLicenses,
            suspended: stats.suspended,
            effective_count: stats.count, // Total activos (suspended = still active)
        };
    });

    // Calculate counts by terminal
    const terminalCountMap = new Map<TerminalCode, number>();
    terminals.forEach((t) => terminalCountMap.set(t, 0));

    (staffData || []).forEach((staff) => {
        const current = terminalCountMap.get(staff.terminal_code as TerminalCode) || 0;
        terminalCountMap.set(staff.terminal_code as TerminalCode, current + 1);
    });

    const byTerminal: StaffCountByTerminal[] = terminals.map((t) => ({
        terminal_code: t,
        count: terminalCountMap.get(t) || 0,
    }));

    // Detalle nominal: quiénes están con licencia hoy y quiénes suspendidos
    const detail = {
        licencias: (staffData || [])
            .filter((s) => staffWithLicenses.has(s.id))
            .map((s) => ({ nombre: s.nombre, cargo: s.cargo, terminal_code: s.terminal_code })),
        suspendidos: (staffData || [])
            .filter((s) => s.suspended)
            .map((s) => ({ nombre: s.nombre, cargo: s.cargo, terminal_code: s.terminal_code })),
    };

    return {
        byCargo,
        byTerminal,
        total: staffData?.length || 0,
        detail,
    };
};

// ==========================================
// ADMONITIONS
// ==========================================

export const fetchAdmonitions = async (staffId: string): Promise<StaffAdmonition[]> => {
    const { data, error } = await supabase
        .from('staff_admonitions')
        .select('*')
        .eq('staff_id', staffId)
        .order('admonition_date', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const createAdmonition = async (
    staffId: string,
    reason: string,
    admonitionDate: string,
    file: File
): Promise<StaffAdmonition> => {
    // Generate unique file path
    const fileExt = file.name.split('.').pop();
    const filePath = `staff/${staffId}/admonitions/${Date.now()}.${fileExt}`;

    // Upload file
    const { error: uploadError } = await supabase.storage
        .from('attendance-docs')
        .upload(filePath, file);

    if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Error al subir el documento');
    }

    // Create admonition record
    const { data, error } = await supabase
        .from('staff_admonitions')
        .insert({
            staff_id: staffId,
            reason: reason.trim(),
            admonition_date: admonitionDate,
            document_path: filePath,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const getAdmonitionDocumentUrl = async (path: string): Promise<string> => {
    const { data, error } = await supabase.storage
        .from('attendance-docs')
        .createSignedUrl(path, 3600); // 1 hour

    if (error) throw error;
    return data.signedUrl;
};

// ==========================================
// REALTIME SUBSCRIPTION
// ==========================================

export const subscribeToStaffChanges = (
    onStaffChange: (payload: { eventType: string; new: Staff | null; old: Staff | null }) => void,
    onAdmonitionChange: (payload: { eventType: string; new: StaffAdmonition | null }) => void
) => {
    const staffChannel = supabase
        .channel('staff-changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'staff' },
            (payload) => {
                onStaffChange({
                    eventType: payload.eventType,
                    new: payload.new as Staff | null,
                    old: payload.old as Staff | null,
                });
            }
        )
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'staff_admonitions' },
            (payload) => {
                onAdmonitionChange({
                    eventType: payload.eventType,
                    new: payload.new as StaffAdmonition | null,
                });
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(staffChannel);
    };
};
