import { supabase } from '../../shared/lib/supabaseClient';
import { InspeccionICARow, InspeccionICAInsert } from './types';

const TABLE = 'inspeccion_ica';

export interface InspeccionesFilters {
    ppu?: string;
    terminal_code?: string;
    fechaDesde?: string;
    fechaHasta?: string;
}

export interface FlotaVehiculo {
    ppu: string;
    terminal?: string;
}

// ── PPU autocomplete from flota table ────────────────────────────────────────

export const fetchFlotaPPUs = async (search: string): Promise<FlotaVehiculo[]> => {
    if (!search || search.length < 2) return [];
    const { data, error } = await supabase
        .from('flota')
        .select('ppu, terminal')
        .ilike('ppu', `%${search}%`)
        .order('ppu')
        .limit(15);
    if (error) return [];
    return (data ?? []) as FlotaVehiculo[];
};

// ── Save / Fetch inspecciones ICA ─────────────────────────────────────────────

export const saveInspeccion = async (data: InspeccionICAInsert): Promise<InspeccionICARow> => {
    const { data: result, error } = await supabase
        .from(TABLE)
        .insert(data)
        .select()
        .single();
    if (error) throw error;
    return result as InspeccionICARow;
};

export const fetchInspecciones = async (filters?: InspeccionesFilters): Promise<InspeccionICARow[]> => {
    let query = supabase
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

    if (filters?.ppu) query = query.ilike('ppu', `%${filters.ppu}%`);
    if (filters?.terminal_code) query = query.eq('terminal_code', filters.terminal_code);
    if (filters?.fechaDesde) query = query.gte('fecha', filters.fechaDesde);
    if (filters?.fechaHasta) query = query.lte('fecha', filters.fechaHasta);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as InspeccionICARow[];
};

export const fetchAllInspecciones = async (): Promise<InspeccionICARow[]> => {
    const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('fecha', { ascending: false });
    if (error) throw error;
    return (data ?? []) as InspeccionICARow[];
};
