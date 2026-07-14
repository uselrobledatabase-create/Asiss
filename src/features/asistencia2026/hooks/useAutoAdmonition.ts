import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../../shared/lib/supabaseClient';
import { StaffWithShift } from '../types';
import { generateAmonestacionPDF } from '../../amonestaciones/utils/pdfGenerator';
import { AmonestacionFormData } from '../../amonestaciones/types';
import { formatRut } from '../../personal/utils/rutUtils';

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
            // Get start time from timeRange (e.g. "08:00 a 16:00" -> "08:00")
            const startTimeMatch = timeRange.match(/(\d{1,2}:\d{2})/);
            const startTime = startTimeMatch ? startTimeMatch[1] : "00:00";
            
            // Format name to [APELLIDOS], [NOMBRES]
            const nameParts = staff.nombre.split(' ');
            let apellidos = '';
            let nombres = '';
            if (nameParts.length > 2) {
                apellidos = nameParts.slice(nameParts.length - 2).join(' ');
                nombres = nameParts.slice(0, nameParts.length - 2).join(' ');
            } else if (nameParts.length === 2) {
                nombres = nameParts[0];
                apellidos = nameParts[1];
            } else {
                nombres = staff.nombre;
            }
            const nameFormatted = apellidos ? `${apellidos}, ${nombres}` : staff.nombre;

            const cleanCargo = staff.cargo.replace(/_/g, ' ');
            const cleanTerminal = (staff.terminal_code || '').replace(/_/g, ' ');

            const fullDescription = `${nameFormatted}, RUT: ${formatRut(staff.rut)}, ${cleanCargo}, TERMINAL ${cleanTerminal}, CON TURNO PROGRAMADO DE ${timeRange}, EL DÍA ${formattedDate}.\n\nSE CONSTATA QUE EL COLABORADOR NO SE PRESENTA A SU TURNO EN LA FECHA INDICADA, INCURRIENDO EN AUSENCIA INJUSTIFICADA. ASIMISMO, NO REALIZA AVISO PREVIO NI DEJA CONSTANCIA FORMAL A SU JEFATURA DIRECTA RESPECTO DE SU INASISTENCIA, IMPIDIENDO LA COORDINACIÓN OPORTUNA DE LA CONTINUIDAD OPERATIVA.\n\nESTA SITUACIÓN OBLIGA A REORGANIZAR Y REPROGRAMAR PERSONAL PARA CUBRIR LAS FUNCIONES ASIGNADAS, GENERANDO SOBRECARGA DE LABORES, RETRASOS EN LAS TAREAS DIARIAS Y AFECTACIÓN DIRECTA EN LA OPERACIÓN DEL TERMINAL.\n\nCAYENDO EN FALTA GRAVE (CÓDIGO 24).`;
            
            const formData: AmonestacionFormData = {
                worker_rut: staff.rut,
                worker_name: staff.nombre,
                worker_cargo: cleanCargo,
                worker_base: cleanTerminal,
                shift_schedule: timeRange,
                date: formattedDate,
                time: startTime,
                place_terminal: cleanTerminal,
                place_public_way: '',
                place_vehicle: '',
                place_ppu: '',
                place_detail: '',
                involved_jefatura: '',
                involved_companeros: '',
                involved_other: '',
                description: fullDescription,
                witness1_name: testigoNombre,
                witness1_rut: testigoRut,
                witness1_cargo: testigoCargo,
                witness2_name: '',
                witness2_rut: '',
                witness2_cargo: '',
                responsible_name: "LURASCHI MUÑOZ, CRISTIAN MARCELO",
                responsible_cargo: "JEFE DE TERMINAL",
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
