/**
 * Control ASISS - API
 * Dotación para exportes: incluye personal SUSPENDIDO (con sus horarios
 * asignados), a diferencia de la grilla operativa que los excluye.
 */

import { supabase, isSupabaseConfigured } from '../../shared/lib/supabaseClient';
import { StaffShift, StaffWithShift } from '../asistencia2026/types';

export type ExportStaff = StaffWithShift & { suspended: boolean };

export async function fetchStaffForExport(): Promise<ExportStaff[]> {
    if (!isSupabaseConfigured()) return [];

    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, rut, nombre, cargo, terminal_code, turno, horario, contacto, status, suspended')
        .eq('status', 'ACTIVO')
        .order('cargo')
        .order('nombre');

    if (staffError) throw staffError;

    const { data: shiftsData, error: shiftsError } = await supabase
        .from('staff_shifts')
        .select('*');

    if (shiftsError) {
        console.warn('fetchStaffForExport - Error fetching shifts:', shiftsError.message);
    }

    const shiftsMap = new Map<string, StaffShift>();
    for (const shift of shiftsData || []) {
        shiftsMap.set(shift.staff_id, shift as StaffShift);
    }

    return (staffData || []).map((s: Record<string, unknown>) => ({
        id: s.id as string,
        rut: s.rut as string,
        nombre: s.nombre as string,
        cargo: s.cargo as string,
        terminal_code: s.terminal_code as ExportStaff['terminal_code'],
        turno: s.turno as string,
        horario: s.horario as string,
        contacto: s.contacto as string,
        status: s.status as ExportStaff['status'],
        suspended: Boolean(s.suspended),
        shift: shiftsMap.get(s.id as string),
    }));
}
