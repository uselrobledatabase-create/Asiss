import { supabase } from '../../../shared/lib/supabaseClient';
import { AmonestacionFormData } from '../types';

export interface AmonestacionRecord extends AmonestacionFormData {
    id: string;
    created_at: string;
    status: 'GENERATED' | 'ANNULLED';
    created_by: string;
}

export const createAmonestacion = async (data: AmonestacionFormData) => {
    const { data: record, error } = await supabase
        .from('amonestaciones')
        .insert([
            {
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
            }
        ])
        .select()
        .single();

    if (error) {
        console.error('Error creating amonestacion:', error);
        throw error;
    }
    return record;
};

export const deleteAmonestacion = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('amonestaciones')
        .delete()
        .eq('id', id);

    if (error) {
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
        console.error('Error fetching amonestaciones:', error);
        throw error;
    }
    return data as AmonestacionRecord[];
};
