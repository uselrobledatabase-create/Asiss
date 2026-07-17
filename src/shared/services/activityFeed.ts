/**
 * Feed de actividad en línea (tiempo real entre usuarios conectados).
 *
 * Usa Supabase Realtime Broadcast: cuando cualquier usuario logeado
 * realiza una acción (presente/ausente, sin credencial, no marcación,
 * cambio de día, permiso, vacaciones, tareas, reuniones, cambios de
 * programación…), todos los demás conectados reciben la notificación
 * al instante — "X puso PRESENTE a Y" — en cualquier sección.
 *
 * broadcast self:false → el autor no recibe su propia notificación
 * (él ya ve su toast de confirmación local).
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export interface ActivityEvent {
    /** Quién realizó la acción (nombre del supervisor) */
    actor: string;
    /** Verbo/acción en pasado, ej: "puso PRESENTE a" */
    accion: string;
    /** Sobre quién/qué, ej: nombre del trabajador o título de la tarea */
    objetivo: string;
    /** Sección de origen, ej: "Asistencia", "Control ASISS" */
    seccion: string;
    /** Detalle opcional, ej: "Jue 16-07 · 20:00-08:00" */
    detalle?: string;
    ts: number;
}

type Handler = (ev: ActivityEvent) => void;

const handlers = new Set<Handler>();
let channel: RealtimeChannel | null = null;

function ensureChannel(): RealtimeChannel | null {
    if (channel || !isSupabaseConfigured()) return channel;

    channel = supabase.channel('asiss-activity-feed', {
        config: { broadcast: { self: false } },
    });
    channel.on('broadcast', { event: 'activity' }, ({ payload }) => {
        const ev = payload as ActivityEvent;
        if (!ev?.actor || !ev?.accion) return;
        handlers.forEach((h) => {
            try { h(ev); } catch { /* handler aislado */ }
        });
    });
    channel.subscribe();
    return channel;
}

/** Publica una actividad a todos los usuarios conectados (fire-and-forget) */
export function broadcastActivity(ev: Omit<ActivityEvent, 'ts'>): void {
    try {
        const ch = ensureChannel();
        ch?.send({
            type: 'broadcast',
            event: 'activity',
            payload: { ...ev, ts: Date.now() },
        });
    } catch {
        // La notificación en vivo nunca debe romper la acción principal
    }
}

/** Suscribe un handler al feed; retorna la función para desuscribir */
export function onActivity(handler: Handler): () => void {
    ensureChannel();
    handlers.add(handler);
    return () => handlers.delete(handler);
}
