const SUPABASE_REST_PATH = '/rest/v1';

export const normalizeSupabaseProjectUrl = (rawUrl?: string | null): string => {
    if (!rawUrl) return '';

    const trimmedUrl = rawUrl.trim().replace(/\/+$/, '');
    return trimmedUrl.replace(/\/rest\/v1$/, '');
};

export const buildSupabaseAuthUrl = (rawUrl?: string | null): string => {
    const projectUrl = normalizeSupabaseProjectUrl(rawUrl);
    return projectUrl ? `${projectUrl}/auth/v1` : '';
};

export const buildSupabaseFunctionsUrl = (rawUrl?: string | null): string => {
    const projectUrl = normalizeSupabaseProjectUrl(rawUrl);
    return projectUrl ? `${projectUrl}/functions/v1` : '';
};

export const buildSupabaseRestUrl = (rawUrl?: string | null): string => {
    const projectUrl = normalizeSupabaseProjectUrl(rawUrl);
    return projectUrl ? `${projectUrl}${SUPABASE_REST_PATH}` : '';
};
