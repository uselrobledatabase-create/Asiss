import { useEffect, useState } from 'react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

type HealthState = 'checking' | 'ok' | 'invalid-key' | 'unreachable';

/**
 * Verifica al cargar la app que Supabase acepte la clave API configurada.
 * Si la clave fue rotada o el proyecto está pausado, muestra un aviso claro
 * en vez de dejar que cada módulo falle en silencio.
 */
export const SupabaseHealthBanner = () => {
    const [state, setState] = useState<HealthState>('checking');

    useEffect(() => {
        if (!supabaseUrl || !supabaseAnonKey) {
            setState('invalid-key');
            return;
        }
        let cancelled = false;
        fetch(`${supabaseUrl}/auth/v1/health`, {
            headers: { apikey: supabaseAnonKey },
        })
            .then((res) => {
                if (cancelled) return;
                setState(res.status === 401 || res.status === 403 ? 'invalid-key' : 'ok');
            })
            .catch(() => {
                if (!cancelled) setState('unreachable');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (state === 'checking' || state === 'ok') return null;

    return (
        <div className="fixed inset-x-0 top-0 z-[9999] bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-lg">
            {state === 'invalid-key'
                ? 'Sin conexión con la base de datos: la clave API de Supabase no es válida. Copia la clave vigente desde el panel de Supabase (Settings → API Keys) y actualiza VITE_SUPABASE_ANON_KEY.'
                : 'No se pudo contactar el servidor de Supabase. Verifica tu conexión a internet o que el proyecto no esté pausado.'}
        </div>
    );
};
