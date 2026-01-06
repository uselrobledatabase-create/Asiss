import jsPDF from 'jspdf';
import { AmonestacionFormData } from '../types';

export const generateAmonestacionPDF = (data: AmonestacionFormData) => {
    const doc = new jsPDF();

    // Layout Config
    const PAGE_WIDTH = doc.internal.pageSize.getWidth(); // 210mm
    const PAGE_HEIGHT = doc.internal.pageSize.getHeight(); // 297mm
    const MARGIN = 15;
    const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
    const LINE_HEIGHT = 7;

    let currentY = 20;

    // --- UTILS ---
    const addY = (amount: number) => currentY += amount;

    // Draw a cell in a grid
    const drawCell = (label: string, value: string, x: number, y: number, w: number, h: number = 8, labelWidth: number = 0) => {
        // Box
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.setFillColor(255, 255, 255);
        doc.rect(x, y, w, h);

        // Label
        if (label) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(50);
            doc.text(label.toUpperCase(), x + 2, y + (h / 2) + 1.5); // Vertically centered approx
        }

        // Value
        if (value) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(0);
            const valX = labelWidth > 0 ? x + labelWidth + 2 : x + 2; // If label width set, offset value

            // Allow wrapping if value is long? For simple cells, just print.
            // If label is present inline:
            if (labelWidth > 0) {
                doc.text(value.toUpperCase(), valX, y + (h / 2) + 1.5);
            } else {
                // Label was just a title above? No, this function assumes inline or block. 
                // If no labelWidth provided, assume Value Only or Label is printed diff.
                // Let's assume this is a value cell.
                doc.text(value.toUpperCase(), x + 2, y + (h / 2) + 1.5);
            }
        }
    };

    // Draw Section Header
    const drawSectionHeader = (title: string, y: number) => {
        doc.setFillColor(230, 230, 230); // Light Gray
        doc.setDrawColor(0);
        doc.rect(MARGIN, y, CONTENT_WIDTH, 6, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text(title.toUpperCase(), MARGIN + 2, y + 4);
        return 6;
    };

    // --- HEADER ---
    // Logo Left
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bolditalic');
    doc.setTextColor(200, 0, 0);
    doc.text('RBU', MARGIN, 20);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('SANTIAGO', MARGIN, 24);

    // Title Center
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ACTA DE CONSTATACIÓN', PAGE_WIDTH / 2, 28, { align: 'center' });
    doc.setFontSize(10);
    doc.text('DE HECHOS', PAGE_WIDTH / 2, 33, { align: 'center' });

    // Date/Time Box Top Right? Or just inline?
    // Let's make a mini grid for context below title
    currentY = 45;

    // --- CONTEXTO ---
    const rowH = 8;
    const wDate = 35;
    const wTime = 25;
    const wPlace = CONTENT_WIDTH - wDate - wTime;

    // Row 1: FECHA | HORA | LUGAR
    // We draw borders explicitly for a "Table" look
    drawCell('FECHA:', data.date, MARGIN, currentY, wDate, rowH, 12);
    drawCell('HORA:', data.time, MARGIN + wDate, currentY, wTime, rowH, 10);
    drawCell('LUGAR:', data.place_terminal, MARGIN + wDate + wTime, currentY, wPlace, rowH, 12);

    addY(rowH); // 53

    // --- I. ANTECEDENTES TRABAJADOR ---
    addY(2);
    addY(drawSectionHeader('I. ANTECEDENTES DEL TRABAJADOR', currentY));

    // Name
    drawCell('NOMBRE:', data.worker_name, MARGIN, currentY, CONTENT_WIDTH, rowH, 15);
    addY(rowH);
    // RUT | Cargo
    const wRut = 45;
    const wTurno = 40;
    const wCargo = CONTENT_WIDTH - wRut - wTurno;

    drawCell('RUT:', data.worker_rut, MARGIN, currentY, wRut, rowH, 10);
    drawCell('CARGO:', data.worker_cargo, MARGIN + wRut, currentY, wCargo, rowH, 14);
    drawCell('TURNO:', data.shift_schedule || '', MARGIN + wRut + wCargo, currentY, wTurno, rowH, 12);
    addY(rowH);

    // --- II. FALTA ---
    addY(2);
    addY(drawSectionHeader('II. TIPIFICACIÓN DE LA FALTA', currentY));

    drawCell('CÓDIGO:', data.sanction_code_id.toString(), MARGIN, currentY, 30, rowH, 15);
    drawCell('GRAVEDAD:', 'GRAVE / MENOS GRAVE', MARGIN + 30, currentY, CONTENT_WIDTH - 30, rowH, 20);
    addY(rowH);

    // --- III. RELATO ---
    addY(2);
    addY(drawSectionHeader('III. RELATO CIRCUNSTANCIADO (HECHOS)', currentY));

    // Big Box for Narrative
    // Calculate text size
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const textLines = doc.splitTextToSize(data.description.toUpperCase(), CONTENT_WIDTH - 4);
    const textH = (textLines.length * 4.5) + 10;
    const boxH = Math.max(textH, 80); // Min height 80mm

    doc.setDrawColor(0);
    doc.rect(MARGIN, currentY, CONTENT_WIDTH, boxH);
    doc.text(textLines, MARGIN + 2, currentY + 6);

    addY(boxH);

    // --- IV. TESTIGOS ---
    addY(4);
    addY(drawSectionHeader('IV. TESTIGOS PRESENCIALES', currentY));

    const halfW = CONTENT_WIDTH / 2;
    // Headers for witnesses
    doc.setFontSize(8);
    doc.text('TESTIGO 1', MARGIN + 2, currentY - 7); // Inside grey header usually, but we already drew it.

    // W1
    drawCell('NOMBRE:', data.witness1_name, MARGIN, currentY, halfW, rowH, 15);
    drawCell('NOMBRE:', data.witness2_name || '---', MARGIN + halfW, currentY, halfW, rowH, 15);
    addY(rowH);

    drawCell('RUT:', data.witness1_rut, MARGIN, currentY, halfW, rowH, 10);
    drawCell('RUT:', data.witness2_rut || '---', MARGIN + halfW, currentY, halfW, rowH, 10);
    addY(rowH);

    drawCell('CARGO:', data.witness1_cargo, MARGIN, currentY, halfW, rowH, 12);
    drawCell('CARGO:', data.witness2_cargo || '---', MARGIN + halfW, currentY, halfW, rowH, 12);
    addY(rowH);

    // FIRMA BOXES
    const signH = 25;
    doc.rect(MARGIN, currentY, halfW, signH); // W1
    doc.rect(MARGIN + halfW, currentY, halfW, signH); // W2

    doc.setFontSize(7);
    doc.text('FIRMA TESTIGO 1', MARGIN + (halfW / 2), currentY + signH - 2, { align: 'center' });
    doc.text('FIRMA TESTIGO 2 (OPCIONAL)', MARGIN + halfW + (halfW / 2), currentY + signH - 2, { align: 'center' });

    addY(signH);

    // --- V. RESPONSABLE ---
    // Bottom of page ?
    const bottomY = 250; // Fixed footer area

    // Check if we overlap
    if (currentY > bottomY) {
        doc.addPage();
        currentY = 20;
    } else {
        currentY = bottomY;
    }

    addY(drawSectionHeader('V. RESPONSABLE DE LA CONSTATACIÓN (JEFE DE TERMINAL)', currentY));

    // Info Line
    drawCell('NOMBRE:', data.responsible_name.toUpperCase(), MARGIN, currentY, CONTENT_WIDTH * 0.7, rowH, 15);
    // Signature placeholder box next to it? Or below?
    // Let's put info on left, signature box on right.
    // Actually, usually signature is center or right.

    // Re-do this row
    // Clear the cell I just drew? No, just overwrite or simpler:
    // We already moved Y by header (6).

    // Name Row
    // drawCell('NOMBRE:', data.responsible_name.toUpperCase(), MARGIN, currentY, CONTENT_WIDTH, rowH, 15);
    // addY(rowH);
    // drawCell('CARGO:', data.responsible_cargo.toUpperCase(), MARGIN, currentY, CONTENT_WIDTH, rowH, 15);
    // addY(rowH);

    // Signature Box Big
    const sigBoxH = 35;
    doc.rect(MARGIN, currentY, CONTENT_WIDTH, sigBoxH);

    doc.text(`NOMBRE: ${data.responsible_name.toUpperCase()}`, MARGIN + 4, currentY + 6);
    doc.text(`CARGO:   ${data.responsible_cargo.toUpperCase()}`, MARGIN + 4, currentY + 12);

    doc.line(PAGE_WIDTH / 2, currentY + 25, PAGE_WIDTH - 40, currentY + 25);
    doc.text('FIRMA Y TIMBRE', (PAGE_WIDTH / 2) + 40, currentY + 29, { align: 'center' });

    doc.save(`Amonestacion_${data.worker_rut}_${data.date}.pdf`);
};
