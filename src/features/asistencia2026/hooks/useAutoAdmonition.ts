import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../../shared/lib/supabaseClient';
import { jsPDF } from 'jspdf';
import { StaffWithShift } from '../types';

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

            // 2. Generate PDF using jsPDF
            const doc = new jsPDF();
            
            // Configure fonts and styles
            doc.setFont('helvetica');
            
            // Title
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('AMONESTACIÓN POR AUSENCIA INJUSTIFICADA', 105, 20, { align: 'center' });
            
            // Subtitle / Info
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            
            const formattedDate = date.split('-').reverse().join('/'); // YYYY-MM-DD to DD/MM/YYYY
            
            // Format name to [APELLIDOS], [NOMBRES]
            // We assume DB name is usually "NOMBRES APELLIDOS" in some format. We'll just do a best effort split.
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

            doc.text(`${nameFormatted}, RUT: ${staff.rut}, ${staff.cargo}, TERMINAL ${staff.terminal_code}, CON TURNO PROGRAMADO DE ${timeRange}, EL DÍA ${formattedDate}.`, 20, 40, { maxWidth: 170, align: 'justify', lineHeightFactor: 1.5 });
            
            doc.text('SE CONSTATA QUE EL/LA COLABORADOR(A) NO SE PRESENTA A SU TURNO EN LA FECHA INDICADA, INCURRIENDO EN AUSENCIA INJUSTIFICADA. ASIMISMO, NO REALIZA AVISO PREVIO NI DEJA CONSTANCIA FORMAL A SU JEFATURA DIRECTA RESPECTO DE SU INASISTENCIA, IMPIDIENDO LA COORDINACIÓN OPORTUNA DE LA CONTINUIDAD OPERATIVA.', 20, 70, { maxWidth: 170, align: 'justify', lineHeightFactor: 1.5 });
            
            doc.text('ESTA SITUACIÓN OBLIGA A REORGANIZAR Y REPROGRAMAR PERSONAL PARA CUBRIR LAS FUNCIONES ASIGNADAS, GENERANDO SOBRECARGA DE LABORES, RETRASOS EN LAS TAREAS DIARIAS Y AFECTACIÓN DIRECTA EN LA OPERACIÓN DEL TERMINAL.', 20, 115, { maxWidth: 170, align: 'justify', lineHeightFactor: 1.5 });
            
            doc.setFont('helvetica', 'bold');
            doc.text('CAYENDO EN FALTA GRAVE (CÓDIGO 24).', 20, 155, { maxWidth: 170, align: 'justify' });
            
            // Signatures
            doc.setFont('helvetica', 'normal');
            doc.text('_______________________', 40, 210);
            doc.text('Firma Trabajador', 45, 220);
            
            doc.text('_______________________', 130, 210);
            doc.text('Testigo 1', 145, 220);
            
            doc.setFontSize(10);
            doc.text(testigoNombre, 130, 227);
            doc.text(`RUT: ${testigoRut}`, 130, 232);
            doc.text(testigoCargo, 130, 237);

            // 3. Save as Blob and upload
            const pdfBlob = doc.output('blob');
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
