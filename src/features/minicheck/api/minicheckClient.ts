import { createClient } from '@supabase/supabase-js';
import { normalizeSupabaseProjectUrl } from '../../../shared/lib/supabaseConfig';

// Try MiniCheck-specific credentials first, fallback to main Supabase credentials
const minicheckUrl = normalizeSupabaseProjectUrl(
    import.meta.env.VITE_MINICHECK_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
);
const minicheckAnonKey = import.meta.env.VITE_MINICHECK_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!minicheckUrl || !minicheckAnonKey) {
    console.warn('MiniCheck Supabase credentials not configured.');
}

export const minicheckSupabase = createClient(
    minicheckUrl || 'https://placeholder.supabase.co',
    minicheckAnonKey || 'placeholder-key',
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
        realtime: {
            params: {
                eventsPerSecond: 10,
            },
        },
    }
);

export const isMiniCheckConfigured = (): boolean => {
    return Boolean(minicheckUrl && minicheckAnonKey);
};
