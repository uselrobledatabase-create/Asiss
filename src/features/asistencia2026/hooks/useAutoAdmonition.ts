import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../../shared/lib/supabaseClient';
import { StaffWithShift } from '../types';
import { generateAmonestacionPDF } from '../../amonestaciones/utils/pdfGenerator';
import { AmonestacionFormData } from '../../amonestaciones/types';

export const useAutoAdmonition = () => {
    return useMutation({
        mutationFn: async ({ staff, supervisorName, date, timeRange }: { staff: StaffWithShift; supervisorName: string; date: string, timeRange: string }) => {
            // 1. Find the supervisor in the staff table
            const parts = supervisorName.split(' ');
            let supervisorQuery = supabase.from('staff').select('nombre, rut, cargo');
            
            // Search by all parts of the supervisor's name to match first name and last name
            parts.forEach(part => {
                if (part.trim().length > 0) {
                    supervisorQuery = supervisorQuery.ilike('nombre', `%${part.trim()}%`);
                }
            });

            const { data: supervisorData, error: supervisorError } = await supervisorQuery.limit(1).single();
            
            const testigoNombre = supervisorData?.nombre || supervisorName;
            const testigoRut = supervisorData?.rut || 'Sin RUT';
            const testigoCargo = supervisorData?.cargo || 'SUPERVISOR';

            // 2. Format Data for PDF Generator
            const formattedDate = date.split('-').reverse().join('/'); // YYYY-MM-DD to DD/MM/YYYY
            
            const formData: AmonestacionFormData = {
                worker_rut: staff.rut,
                worker_name: staff.nombre,
                worker_cargo: staff.cargo,
                worker_base: staff.terminal_code || '',
                shift_schedule: timeRange,
                date: formattedDate,
                time: "00:00",
                place_terminal: staff.terminal_code || '',
                place_public_way: '',
                place_vehicle: '',
                place_ppu: '',
                place_detail: '',
                involved_jefatura: '',
                involved_companeros: '',
                involved_other: '',
                description: 'SE CONSTATA QUE EL/LA COLABORADOR(A) NO SE PRESENTA A SU TURNO EN LA FECHA INDICADA, INCURRIENDO EN AUSENCIA INJUSTIFICADA. ASIMISMO, NO REALIZA AVISO PREVIO NI DEJA CONSTANCIA FORMAL A SU JEFATURA DIRECTA RESPECTO DE SU INASISTENCIA, IMPIDIENDO LA COORDINACIÓN OPORTUNA DE LA CONTINUIDAD OPERATIVA.',
                witness1_name: testigoNombre,
                witness1_rut: testigoRut,
                witness1_cargo: testigoCargo,
                witness2_name: '',
                witness2_rut: '',
                witness2_cargo: '',
                responsible_name: testigoNombre,
                responsible_cargo: testigoCargo,
                sanction_code_id: 24, // Faltar sin aviso
            };

            // 3. Generate PDF and get Blob
            const pdfBlob = generateAmonestacionPDF(formData, true) as Blob;
            const file = new File([pdfBlob], `amonestacion_${staff.rut}_${date}.pdf`, { type: 'application/pdf' });
            
            const fileExt = file.name.split('.').pop();
            const filePath = `staff/${staff.id}/admonitions/${Date.now()}.${fileExt}`;

            // Upload PDF to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('attendance-docs')
                .upload(filePath, file);

            if (uploadError) {
                console.error('Upload error:', uploadError);
                throw new Error('Error al subir el documento de amonestación');
            }

            // 4. Save record to DB
            const { error: dbError } = await supabase
                .from('staff_admonitions')
                .insert({
                    staff_id: staff.id,
                    reason: 'Ausencia injustificada (Falta Grave - Código 24)',
                    admonition_date: date,
                    document_path: filePath,
                });

            if (dbError) throw dbError;

            // Return the blob URL so we can download/open it
            return URL.createObjectURL(pdfBlob);
        }
    });
};
