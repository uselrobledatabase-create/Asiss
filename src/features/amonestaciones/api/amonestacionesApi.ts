import { supabase } from '../../../shared/lib/supabaseClient';
import { AmonestacionFormData } from '../types';
import { normalizeRut } from '../../personal/utils/rutUtils';

type SupabaseLikeError = {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
};

const isMissingTableError = (error: SupabaseLikeError | null | undefined, table: string) =>
    error?.code === 'PGRST205' && error.message?.includes(`'public.${table}'`);

const isMissingColumnError = (error: SupabaseLikeError | null | undefined, column: string) => {
    const combinedMessage = `${error?.message ?? ''} ${error?.details ?? ''} ${error?.hint ?? ''}`.toLowerCase();
    return (
        error?.code === 'PGRST204' ||
        error?.code === '42703' ||
        combinedMessage.includes(`'${column.toLowerCase()}'`) ||
        combinedMessage.includes(column.toLowerCase())
    );
};

export interface AmonestacionRecord extends AmonestacionFormData {
    id: string;
    created_at: string;
    status: 'GENERATED' | 'ANNULLED';
    created_by: string;
}

export const createAmonestacion = async (data: AmonestacionFormData) => {
    const basePayload = {
        date: data.date,
        time: data.time,
        worker_rut: data.worker_rut,
        worker_name: data.worker_name,
        worker_cargo: data.worker_cargo,
        worker_base: data.worker_base,
        shift_schedule: data.shift_schedule,
        sanction_code_id: data.sanction_code_id,
        description: data.description,

        place_terminal: data.place_terminal,
        place_public_way: data.place_public_way,
        place_vehicle: data.place_vehicle,
        place_ppu: data.place_ppu,
        place_detail: data.place_detail,

        involved_jefatura: data.involved_jefatura,
        involved_companeros: data.involved_companeros,
        involved_other: data.involved_other,

        witness1_name: data.witness1_name,
        witness1_rut: data.witness1_rut,
        witness1_cargo: data.witness1_cargo,
        witness2_name: data.witness2_name,
        witness2_rut: data.witness2_rut,
        witness2_cargo: data.witness2_cargo,

        responsible_name: data.responsible_name,
        responsible_cargo: data.responsible_cargo,
        status: 'GENERATED'
    };

    const payloadWithDocument = data.document_path
        ? { ...basePayload, document_path: data.document_path }
        : basePayload;

    let record: AmonestacionRecord | null = null;
    let error: SupabaseLikeError | null = null;

    const withDocumentResponse = await supabase
        .from('amonestaciones')
        .insert([payloadWithDocument])
        .select()
        .single();

    record = withDocumentResponse.data as AmonestacionRecord | null;
    error = withDocumentResponse.error;

    if (error && data.document_path && isMissingColumnError(error, 'document_path')) {
        const fallbackResponse = await supabase
            .from('amonestaciones')
            .insert([basePayload])
            .select()
            .single();

        record = fallbackResponse.data as AmonestacionRecord | null;
        error = fallbackResponse.error;
    }

    if (error) {
        if (isMissingTableError(error, 'amonestaciones')) {
            throw new Error('La tabla amonestaciones no existe en la base conectada.');
        }
        console.error('Error creating amonestacion:', error);
        throw error;
    }
    if (!record) {
        throw new Error('No se pudo crear el registro de amonestación.');
    }
    return record;
};

export const deleteAmonestacion = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('amonestaciones')
        .delete()
        .eq('id', id);

    if (error) {
        if (isMissingTableError(error, 'amonestaciones')) {
            return;
        }
        console.error('Error deleting amonestacion:', error);
        throw error;
    }
};

export const fetchAmonestaciones = async () => {
    const { data, error } = await supabase
        .from('amonestaciones')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        if (isMissingTableError(error, 'amonestaciones')) {
            return [];
        }
        console.error('Error fetching amonestaciones:', error);
        throw error;
    }
    return data as AmonestacionRecord[];
};

export const getAmonestacionDocumentUrl = async (path: string): Promise<string> => {
    const { data, error } = await supabase.storage
        .from('attendance-docs')
        .createSignedUrl(path, 3600);

    if (error) throw error;
    return data.signedUrl;
};

const parseDisplayDateToIso = (value: string) => {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return value;
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
};

export const resolveAmonestacionDocumentUrl = async (record: AmonestacionRecord): Promise<string> => {
    if (record.document_path) {
        return getAmonestacionDocumentUrl(record.document_path);
    }

    const normalizedRut = normalizeRut(record.worker_rut);
    const { data: staffRecord, error: staffError } = await supabase
        .from('staff')
        .select('id')
        .eq('rut', normalizedRut)
        .limit(1)
        .maybeSingle();

    if (staffError) throw staffError;
    if (!staffRecord?.id) {
        throw new Error('No se encontró al trabajador relacionado con esta amonestación.');
    }

    let admonitionQuery = supabase
        .from('staff_admonitions')
        .select('document_path')
        .eq('staff_id', staffRecord.id)
        .eq('admonition_date', parseDisplayDateToIso(record.date))
        .order('created_at', { ascending: false })
        .limit(1);

    if (record.sanction_code_id === 24) {
        admonitionQuery = admonitionQuery.ilike('reason', '%Código 24%');
    }

    const { data: admonitionRecord, error: admonitionError } = await admonitionQuery.maybeSingle();

    if (admonitionError) throw admonitionError;
    if (!admonitionRecord?.document_path) {
        throw new Error('No se encontró la evidencia adjunta para esta amonestación.');
    }

    return getAmonestacionDocumentUrl(admonitionRecord.document_path);
};
