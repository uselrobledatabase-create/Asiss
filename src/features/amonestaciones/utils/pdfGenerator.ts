import jsPDF from 'jspdf';
import { AmonestacionFormData } from '../types';

export const generateAmonestacionPDF = (data: AmonestacionFormData) => {
    const doc = new jsPDF();

    // Constants for layout
    const PAGE_WIDTH = doc.internal.pageSize.getWidth(); // 210mm
    const PAGE_HEIGHT = doc.internal.pageSize.getHeight(); // 297mm
    const MARGIN = 15;
    const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

    let currentY = 20;

    // Helper: Move Y and check validation
    const addY = (amount: number) => {
        currentY += amount;
        // Basic page check could go here if needed, but for single page form we assume it fits or user edits text.
    };

    // Helper: Draw Text with wrapping
    const drawText = (text: string, x: number, y: number, fontSize: number = 10, font: string = 'normal', color: string = '#000000', align: 'left' | 'center' | 'right' = 'left') => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', font);
        doc.setTextColor(color);
        doc.text(text, x, y, { align });
    };

    // Helper: Boxed Field
    const drawField = (label: string, value: string, x: number, y: number, w: number, h: number = 7) => {
        // Label
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100);
        doc.text(label.toUpperCase(), x, y - 1);

        // Box
        doc.setDrawColor(200);
        doc.setLineWidth(0.1);
        doc.setFillColor(255, 255, 255);
        doc.lines([[w, 0], [0, h], [-w, 0], [0, -h]], x, y, [1, 1], 'S', true);

        // Value
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);

        // Truncate or fit? let's fit
        const cleanValue = value || '';
        doc.text(cleanValue, x + 2, y + 4.5);
    };

    // --- HEADER ---
    drawText('ACTA DE CONSTATACION DE HECHOS', PAGE_WIDTH / 2, currentY, 14, 'bold', '#000000', 'center');
    addY(6);

    // Decoration lines
    doc.setDrawColor(0, 50, 150);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, currentY, PAGE_WIDTH - MARGIN, currentY);
    addY(2);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, currentY, PAGE_WIDTH - MARGIN, currentY);

    // Logo (Simulated)
    doc.setTextColor(200, 0, 0);
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(18);
    doc.text('RBU', PAGE_WIDTH - MARGIN - 15, 20);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('Santiago', PAGE_WIDTH - MARGIN - 15, 24);

    addY(10);

    // --- DATE / TIME / PLACE ROW ---
    const thirdW = CONTENT_WIDTH / 3;
    drawField('Fecha', data.date, MARGIN, currentY, thirdW - 2);
    drawField('Hora', data.time, MARGIN + thirdW, currentY, thirdW - 2);
    drawField('Base / Terminal', data.worker_base, MARGIN + (thirdW * 2), currentY, thirdW);

    addY(12);

    // --- SECTION I: INFRACTOR ---
    drawText('I. ANTECEDENTES DEL TRABAJADOR (INFRACTOR)', MARGIN, currentY, 10, 'bold', '#000080'); // Navy blue
    addY(5);

    const halfW = CONTENT_WIDTH / 2;
    drawField('Nombre Completo', data.worker_name, MARGIN, currentY, CONTENT_WIDTH);
    addY(10);
    // Row 2: RUT | Cargo | Turno
    const colW = CONTENT_WIDTH / 3;
    drawField('RUT', data.worker_rut, MARGIN, currentY, colW - 2);
    drawField('Cargo', data.worker_cargo, MARGIN + colW, currentY, colW - 2);
    drawField('Turno', data.shift_schedule || '', MARGIN + (colW * 2), currentY, colW);

    addY(14);

    // --- SECTION II: FALTA ---
    drawText('II. TIPIFICACIÓN DE LA FALTA', MARGIN, currentY, 10, 'bold', '#000080');
    addY(5);

    drawField('Código de Falta', `${data.sanction_code_id}`, MARGIN, currentY, 20);
    drawField('Gravedad', 'GRAVE / MENOS GRAVE', MARGIN + 22, currentY, 60); // Could accept severity dynamic

    // Custom Checkboxes row
    const checkY = currentY + 3;
    const checkX = MARGIN + 90;

    // Simple visual indicators instead of full interactive checkboxes
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`[ ${data.sanction_code_id === 8 ? 'X' : ' '} ] Desobediencia`, checkX, checkY);
    doc.text(`[ ${[4, 18].includes(data.sanction_code_id) ? 'X' : ' '} ] Atrasos`, checkX + 35, checkY);
    doc.text(`[ ${data.sanction_code_id === 50 ? 'X' : ' '} ] Abandono`, checkX + 65, checkY);

    addY(12);

    // --- SECTION III: LUGAR DETALLADO ---
    drawText('III. LUGAR DE LOS HECHOS', MARGIN, currentY, 10, 'bold', '#000080');
    addY(5);

    drawField('Terminal / Cabezal', data.place_terminal, MARGIN, currentY, halfW - 2);
    drawField('Vía Pública (Calle/Lugar)', data.place_public_way, MARGIN + halfW, currentY, halfW);
    addY(10);
    drawField('PPU Bus (Opcional)', data.place_ppu, MARGIN, currentY, 30);
    drawField('Detalle Específico', data.place_detail, MARGIN + 32, currentY, CONTENT_WIDTH - 32);

    addY(14);

    // --- SECTION IV: RELATO (The core part) ---
    drawText('IV. RELATO CIRCUNSTANCIADO DE LOS HECHOS', MARGIN, currentY, 10, 'bold', '#000080');
    addY(5);

    // Measure text height
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);

    const textLines = doc.splitTextToSize(data.description.toUpperCase(), CONTENT_WIDTH - 6);
    const textHeight = textLines.length * 4.5;
    const boxHeight = Math.max(textHeight + 10, 60); // Min height 60mm

    // Draw flexible box
    doc.setDrawColor(200);
    doc.setFillColor(250, 250, 255); // Very light blue bg
    doc.rect(MARGIN, currentY, CONTENT_WIDTH, boxHeight, 'FD');

    doc.text(textLines, MARGIN + 3, currentY + 6);

    addY(boxHeight + 8);

    // --- SECTION V: TESTIGOS ---
    drawText('V. TESTIGOS PRESENCIALES', MARGIN, currentY, 10, 'bold', '#000080');
    addY(5);

    // Determine how many witness boxes
    const hasWitness2 = !!(data.witness2_name || data.witness2_rut);
    const wBoxW = hasWitness2 ? (CONTENT_WIDTH / 2) - 3 : (CONTENT_WIDTH / 2); // Center single box?

    // Witness 1
    const drawWitnessBox = (wName: string, wRut: string, wCargo: string, x: number, y: number, w: number) => {
        doc.setDrawColor(180);
        doc.rect(x, y, w, 22);

        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('NOMBRE:', x + 2, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.text(wName || '', x + 15, y + 5);

        doc.setFont('helvetica', 'bold');
        doc.text('RUT:', x + 2, y + 10);
        doc.setFont('helvetica', 'normal');
        doc.text(wRut || '', x + 15, y + 10);

        doc.setFont('helvetica', 'bold');
        doc.text('CARGO:', x + 2, y + 15);
        doc.setFont('helvetica', 'normal');
        doc.text(wCargo || '', x + 15, y + 15);

        doc.setFontSize(6);
        doc.setTextColor(150);
        doc.text('FIRMA TESTIGO', x + w - 30, y + 18);
        doc.setTextColor(0);
    };

    // If single witness, center it potentially, or just left align.
    // User asked "testigos pueden ser uno". Let's place W1 left.
    drawWitnessBox(data.witness1_name, data.witness1_rut, data.witness1_cargo, MARGIN, currentY, wBoxW);

    if (hasWitness2) {
        drawWitnessBox(data.witness2_name, data.witness2_rut, data.witness2_cargo, MARGIN + wBoxW + 6, currentY, wBoxW);
    }

    addY(30);

    // --- FOOTER: RESPONSABLE / JEFE DE TERMINAL ---
    // User wants this fixed at bottom
    // We check space. If not enough, add page? usually fits.

    const footerY = PAGE_HEIGHT - 45; // Fixed position at bottom

    // Draw line
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, footerY, PAGE_WIDTH - MARGIN, footerY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('RESPONSABLE DE LA CONSTATACIÓN (JEFE DE TERMINAL / SUPERVISOR)', MARGIN, footerY + 5);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`NOMBRE:  ${data.responsible_name.toUpperCase()}`, MARGIN, footerY + 12);
    doc.text(`CARGO:    ${data.responsible_cargo.toUpperCase()}`, MARGIN, footerY + 18);

    // Signature space
    doc.setFontSize(8);
    doc.text('FIRMA Y TIMBRE', PAGE_WIDTH - 50, footerY + 25);
    doc.setDrawColor(150);
    doc.rect(PAGE_WIDTH - 60, footerY + 5, 45, 25); // Signature box

    doc.save(`Amonestacion_${data.worker_rut}_${data.date}.pdf`);
};
