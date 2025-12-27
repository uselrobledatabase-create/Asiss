import { supabase } from '../../../shared/lib/supabaseClient';

// ==========================================
// FLEET TYPES
// ==========================================

export interface FleetVehicle {
    ppu: string;
    numero_interno: number;
    marca_modelo: string;
    terminal: string;
    estado: 'operativo' | 'en_taller' | 'fuera_servicio';
    odometro: number;
    proxima_mantencion: string | null;
    ultima_limpieza: string | null;
    requiere_limpieza: boolean;
    notas: string | null;
}

export interface PendingBus {
    ppu: string;
    numero_interno: number;
    marca_modelo: string;
    terminal: string;
    ultima_limpieza: string | null;
    dias_sin_limpieza: number;
    limpiado_esta_semana: boolean;
    prioridad: 'ALTA' | 'MEDIA' | 'BAJA';
    requiere_limpieza: boolean;
    estado: string;
}

// ==========================================
// FLEET API FUNCTIONS
// ==========================================

/**
 * Obtener todos los vehículos de la flota
 */
export async function fetchFleetVehicles(terminal?: string): Promise<FleetVehicle[]> {
    let query = supabase
        .from('fleet_vehicles')
        .select('*')
        .eq('estado', 'operativo')
        .order('ppu');

    if (terminal) {
        query = query.eq('terminal', terminal);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

/**
 * Obtener buses pendientes de limpieza (desde vista materializada)
 */
export async function fetchPendingBuses(terminal?: string): Promise<PendingBus[]> {
    let query = supabase
        .from('pending_buses_view')
        .select('*')
        .eq('requiere_limpieza', true)
        .order('dias_sin_limpieza', { ascending: false });

    if (terminal) {
        query = query.eq('terminal', terminal);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching pending buses:', error);
        throw error;
    }
    return data || [];
}

/**
 * Buscar vehículos por PPU (para autocomplete)
 */
export async function searchVehiclesByPpu(searchTerm: string, terminal?: string): Promise<FleetVehicle[]> {
    let query = supabase
        .from('fleet_vehicles')
        .select('*')
        .eq('estado', 'operativo')
        .ilike('ppu', `%${searchTerm}%`)
        .order('ppu')
        .limit(10);

    if (terminal) {
        query = query.eq('terminal', terminal);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

/**
 * Obtener información de un vehículo por PPU
 */
export async function getVehicleByPpu(ppu: string): Promise<FleetVehicle | null> {
    const { data, error } = await supabase
        .from('fleet_vehicles')
        .select('*')
        .eq('ppu', ppu)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

/**
 * Refrescar vista de buses pendientes
 */
export async function refreshPendingBuses(): Promise<void> {
    const { error } = await supabase.rpc('refresh_pending_buses');
    if (error) {
        console.error('Error refreshing pending buses:', error);
        throw error;
    }
}

/**
 * Obtener estadísticas de flota
 */
export async function getFleetStats(terminal?: string) {
    const vehicles = await fetchFleetVehicles(terminal);
    const pending = await fetchPendingBuses(terminal);

    return {
        total: vehicles.length,
        pendientes: pending.length,
        limpiadosEstaSemana: vehicles.filter(v => {
            if (!v.ultima_limpieza) return false;
            const weekStart = getWeekStart();
            return new Date(v.ultima_limpieza) >= weekStart;
        }).length,
        porPrioridad: {
            alta: pending.filter(p => p.prioridad === 'ALTA').length,
            media: pending.filter(p => p.prioridad === 'MEDIA').length,
            baja: pending.filter(p => p.prioridad === 'BAJA').length,
        },
    };
}

/**
 * Obtener inicio de semana actual (lunes 00:00)
 */
function getWeekStart(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Ajustar para que lunes sea día 1
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
}
