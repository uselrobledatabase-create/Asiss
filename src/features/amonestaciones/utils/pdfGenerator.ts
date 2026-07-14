import jsPDF from 'jspdf';
import { AmonestacionFormData } from '../types';
import { LOGO_RBU_BASE64 } from './logos';
import { formatRut, normalizeRut } from '../../personal/utils/rutUtils';

const formatDocumentRut = (rut?: string) => {
    if (!rut) return '';

    const rawRut = rut.trim();
    const normalizedRut = normalizeRut(rawRut);

    if (normalizedRut.length >= 2 && /^[0-9kK]+$/.test(normalizedRut)) {
        return formatRut(normalizedRut);
    }

    return rawRut.toUpperCase();
};

const fitTextToBox = (
    doc: jsPDF,
    text: string,
    width: number,
    height: number,
    initialFontSize: number,
    minFontSize: number,
    initialLineHeight: number,
    minLineHeight: number
) => {
    let fontSize = initialFontSize;
    let lineHeightFactor = initialLineHeight;
    doc.setFontSize(fontSize);
    let lines = doc.splitTextToSize(text, width) as string[];

    const getTextHeight = () => lines.length * fontSize * lineHeightFactor * 0.352778;

    while (getTextHeight() > height && fontSize > minFontSize) {
        fontSize -= 0.25;
        doc.setFontSize(fontSize);
        lines = doc.splitTextToSize(text, width) as string[];
    }

    while (getTextHeight() > height && lineHeightFactor > minLineHeight) {
        lineHeightFactor -= 0.05;
    }

    if (getTextHeight() > height) {
        while (getTextHeight() > height && fontSize > 4.5) {
            fontSize -= 0.1;
            doc.setFontSize(fontSize);
            lines = doc.splitTextToSize(text, width) as string[];
        }
    }

    return {
        fontSize,
        lineHeightFactor,
        lines
    };
};

export const generateAmonestacionPDF = (data: AmonestacionFormData, returnBlob: boolean = false): Blob | void => {
    // Letter Size: 215.9mm x 279.4mm
    const doc = new jsPDF({
        format: 'letter',
        unit: 'mm'
    });

    // --- CONFIG & STYLES ---
    const BLUE = [0, 74, 153] as [number, number, number];      // #004a99
    const BLUE_SOFT = [228, 238, 250] as [number, number, number];
    const GRAY_BORDER = 130;
    const GRAY_FILL = [235, 235, 235] as [number, number, number];
    const PAGE_W = 215.9;
    const PAGE_H = 279.4;
    const MARGIN_X = 14;
    const CONTENT_W = PAGE_W - (MARGIN_X * 2);
    const RIGHT_X = PAGE_W - MARGIN_X;

    let y = 12;

    // --- UTILS ---
    const drawSectionTitle = (title: string, yPos: number) => {
        // Soft blue band with dark blue accent bar on the left
        doc.setFillColor(...BLUE_SOFT);
        doc.rect(MARGIN_X, yPos, CONTENT_W, 5.2, 'F');
        doc.setFillColor(...BLUE);
        doc.rect(MARGIN_X, yPos, 1.4, 5.2, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...BLUE);
        doc.text(title, MARGIN_X + 3.5, yPos + 3.7);
        doc.setTextColor(0, 0, 0);
        return 7; // height consumed
    };

    // Plain value box (input cell)
    const drawBox = (x: number, yPos: number, w: number, h: number, value?: string, fill?: [number, number, number]) => {
        if (fill) {
            doc.setFillColor(...fill);
            doc.rect(x, yPos, w, h, 'FD');
        } else {
            doc.setDrawColor(GRAY_BORDER);
            doc.setLineWidth(0.15);
            doc.rect(x, yPos, w, h);
        }
        if (value) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(0);
            doc.text(value.toUpperCase(), x + 2, yPos + h - 1.6);
        }
    };

    // Label (left) + box (right)
    const drawLabeledBox = (label: string, value: string, x: number, yPos: number, totalW: number, labelW: number, boxH: number = 5.2) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(40);
        doc.text(label, x, yPos + boxH - 1.6);
        doc.setDrawColor(GRAY_BORDER);
        doc.setLineWidth(0.15);
        drawBox(x + labelW, yPos, totalW - labelW, boxH, value);
    };

    // Wide check cell + label (matches the Excel layout: rectangle then text)
    const drawCheckCell = (label: string, checked: boolean, x: number, yPos: number, cellW: number = 14) => {
        const cellH = 4.6;
        doc.setDrawColor(GRAY_BORDER);
        doc.setLineWidth(0.15);
        doc.rect(x, yPos, cellW, cellH);
        if (checked) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(...BLUE);
            doc.text('X', x + (cellW / 2), yPos + 3.5, { align: 'center' });
            doc.setTextColor(0);
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(30);
        doc.text(label, x + cellW + 2, yPos + 3.4);
    };

    // ============ HEADER ============
    // RBU logo (top right)
    const rbuLogoW = 32;
    const rbuLogoH = 11;
    const rbuX = RIGHT_X - rbuLogoW;
    doc.addImage(LOGO_RBU_BASE64, 'PNG', rbuX, y - 3, rbuLogoW, rbuLogoH, undefined, 'FAST');

    // Title
    const title = 'ACTA DE CONSTATACIÓN DE HECHOS';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    const titleCenterX = MARGIN_X + ((rbuX - MARGIN_X) / 2);
    doc.text(title, titleCenterX, y + 3, { align: 'center' });

    // Decorative blue line with circles at both ends (below title, as in the original)
    const lineY = y + 8.5;
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(1);
    doc.line(MARGIN_X + 3, lineY, rbuX - 3, lineY);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.6);
    doc.circle(MARGIN_X + 3, lineY, 1.6, 'FD');
    doc.circle(rbuX - 3, lineY, 1.6, 'FD');

    y += 15;

    // ============ FECHA / HORA ============
    drawLabeledBox('FECHA', data.date, MARGIN_X, y, 70, 14);
    drawLabeledBox('HORA', data.time, RIGHT_X - 55, y, 55, 12);
    y += 8.5;

    // ============ I. ANTECEDENTES PERSONALES ============
    y += drawSectionTitle('I. Antecedentes Personales del Infractor', y);

    const LABEL_W1 = 20;
    drawLabeledBox('Nombre', data.worker_name, MARGIN_X, y, CONTENT_W, LABEL_W1);
    y += 6.5;
    drawLabeledBox('Rut', formatDocumentRut(data.worker_rut), MARGIN_X, y, CONTENT_W, LABEL_W1);
    y += 6.5;
    drawLabeledBox('Cargo', data.worker_cargo, MARGIN_X, y, CONTENT_W, LABEL_W1);
    y += 9;

    // ============ II. ANTECEDENTES DE LA FALTA ============
    y += drawSectionTitle('II. Antecedentes de la Falta', y);

    const c = parseInt(data.sanction_code_id.toString());

    const isAbandono = c === 9 || c === 50;
    const isNegativa = c === 51;
    const isDesobedecer = c === 8;
    const isAgresionV = c === 1 || c === 32;
    const isAgresionF = c === 47;
    const isIncumplimiento = c === 10 || c === 2 || c === 5 || c === 29;
    const isDiaFalta = c === 24 || c === 11;
    const isAtraso = c === 4 || c === 18;

    const knownCodes = [9, 50, 51, 8, 1, 32, 47, 10, 2, 5, 29, 24, 11, 4, 18];
    const isOtro = !knownCodes.includes(c);

    // Three column groups, same order as the Excel form
    const col1X = MARGIN_X;
    const col2X = MARGIN_X + (CONTENT_W * 0.37);
    const col3X = MARGIN_X + (CONTENT_W * 0.74);

    let cy = y;
    drawCheckCell('Abandono de trabajo', isAbandono, col1X, cy);
    drawCheckCell('Agresión verbal', isAgresionV, col2X, cy);
    drawCheckCell('Día falta', isDiaFalta, col3X, cy);
    cy += 6;
    drawCheckCell('Negativa a trabajar', isNegativa, col1X, cy);
    drawCheckCell('Agresión física', isAgresionF, col2X, cy);
    drawCheckCell('Atrasos', isAtraso, col3X, cy);
    cy += 6;
    drawCheckCell('Desobedecer instrucción', isDesobedecer, col1X, cy);
    drawCheckCell('Incumplimiento', isIncumplimiento, col2X, cy);
    drawCheckCell('Otro', isOtro, col3X, cy);
    y = cy + 8;

    // ============ III. LUGAR DE LA FALTA O INCIDENTE ============
    y += drawSectionTitle('III. Antecedentes del Lugar de la Falta o Incidente', y);

    const LABEL_W3 = 34;
    const placeBoxX = MARGIN_X + LABEL_W3;
    const placeBoxW = CONTENT_W - LABEL_W3;

    const placeLabel = (label: string, yPos: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(40);
        doc.text(label, MARGIN_X, yPos + 3.6);
    };

    placeLabel('Cabezal o terminal', y);
    drawBox(placeBoxX, y, placeBoxW, 5.2, data.place_terminal || '');
    y += 6.5;

    placeLabel('Vía pública', y);
    drawBox(placeBoxX, y, placeBoxW, 5.2, data.place_public_way || '');
    y += 6.5;

    placeLabel('Vehículo', y);
    // Vehículo box | PPU label cell | PPU value box (same row, as in the Excel)
    const vehW = placeBoxW * 0.45;
    const ppuLabelW = 14;
    drawBox(placeBoxX, y, vehW, 5.2, data.place_vehicle || '');
    doc.setFillColor(...GRAY_FILL);
    doc.setDrawColor(GRAY_BORDER);
    doc.rect(placeBoxX + vehW + 3, y, ppuLabelW, 5.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(40);
    doc.text('PPU', placeBoxX + vehW + 3 + (ppuLabelW / 2), y + 3.6, { align: 'center' });
    drawBox(placeBoxX + vehW + 3 + ppuLabelW, y, placeBoxW - vehW - 3 - ppuLabelW, 5.2, data.place_ppu || '');
    y += 6.5;

    placeLabel('Detalle del lugar', y);
    drawBox(placeBoxX, y, placeBoxW, 5.2, data.place_detail || '');
    y += 9;

    // ============ IV. INVOLUCRADOS ============
    y += drawSectionTitle('IV. Antecedentes de los Involucrados en el Incidente', y);

    drawCheckCell('Jefatura', true, MARGIN_X, y);
    y += 6;
    drawCheckCell('Compañeros', !!data.involved_companeros, MARGIN_X, y);
    y += 6;
    drawCheckCell('Otro (esp)', !!data.involved_other, MARGIN_X, y);
    // Long specification box next to "Otro (esp)"
    const otroBoxX = MARGIN_X + 14 + 22;
    drawBox(otroBoxX, y, RIGHT_X - otroBoxX, 4.6, data.involved_other || '');
    y += 8.5;

    // ============ V. DESCRIPCIÓN ============
    y += drawSectionTitle('V. Descripción Detallada de los Hechos', y);

    const descH = 46;
    const descPaddingX = 4;
    const descPaddingTop = 5;
    const descPaddingBottom = 3;
    doc.setDrawColor(GRAY_BORDER);
    doc.setLineWidth(0.2);
    doc.rect(MARGIN_X, y, CONTENT_W, descH);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    const descriptionText = (data.description || '').toUpperCase();
    const fittedDescription = fitTextToBox(
        doc,
        descriptionText,
        CONTENT_W - (descPaddingX * 2),
        descH - descPaddingTop - descPaddingBottom,
        8.5,
        5.25,
        1.35,
        1.05
    );
    doc.setFontSize(fittedDescription.fontSize);
    doc.text(fittedDescription.lines, MARGIN_X + descPaddingX, y + descPaddingTop, {
        lineHeightFactor: fittedDescription.lineHeightFactor
    });
    y += descH + 3.5;

    // ============ VI. TESTIGOS PRESENCIALES ============
    y += drawSectionTitle('VI. Testigos Presenciales', y);

    const tRowH = 6.2;
    const tRows = 4; // Nombre, Rut, Cargo, Firma
    const tH = tRowH * tRows;
    const tColW = CONTENT_W / 2;

    // Outer frame + center divider + row lines
    doc.setDrawColor(60);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN_X, y, CONTENT_W, tH);
    doc.line(MARGIN_X + tColW, y, MARGIN_X + tColW, y + tH);
    doc.setDrawColor(GRAY_BORDER);
    doc.setLineWidth(0.15);
    for (let i = 1; i < tRows; i++) {
        doc.line(MARGIN_X, y + (tRowH * i), RIGHT_X, y + (tRowH * i));
    }

    const drawWitnessCol = (x: number, name: string, rut: string, cargo: string) => {
        const labelX = x + 2;
        const valueX = x + 18;
        const valueW = tColW - 20;
        let ry = y;

        const cellLabel = (label: string, yPos: number) => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(40);
            doc.text(label, labelX, yPos + 4.2);
        };
        const cellValue = (value: string, yPos: number) => {
            if (!value) return;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(0);
            doc.text(value.toUpperCase(), valueX, yPos + 4.2);
        };

        cellLabel('Nombre:', ry);
        cellValue(name, ry);
        ry += tRowH;

        cellLabel('Rut:', ry);
        // Grey RUT cell, as in the Excel form
        doc.setFillColor(...GRAY_FILL);
        doc.setDrawColor(GRAY_BORDER);
        doc.rect(valueX - 1, ry + 0.9, valueW, tRowH - 1.8, 'FD');
        cellValue(rut, ry);
        ry += tRowH;

        cellLabel('Cargo:', ry);
        cellValue(cargo, ry);
        ry += tRowH;

        cellLabel('Firma', ry);
    };

    drawWitnessCol(MARGIN_X, data.witness1_name, formatDocumentRut(data.witness1_rut), data.witness1_cargo);
    drawWitnessCol(MARGIN_X + tColW, data.witness2_name, formatDocumentRut(data.witness2_rut), data.witness2_cargo);
    y += tH + 4;

    // ============ VII. RESPONSABLE DE LA CONSTATACIÓN ============
    y += drawSectionTitle('VII. Responsable de la Constatación', y);

    drawLabeledBox('Nombre:', data.responsible_name, MARGIN_X, y, CONTENT_W, 18);
    y += 6.5;
    drawLabeledBox('Cargo:', data.responsible_cargo, MARGIN_X, y, CONTENT_W, 18);
    y += 6.5;

    // ============ FIRMA (bottom right) ============
    const sigLineW = 60;
    const sigY = Math.min(Math.max(y + 12, PAGE_H - 18), PAGE_H - 8);
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(RIGHT_X - sigLineW, sigY, RIGHT_X, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0);
    doc.text('FIRMA', RIGHT_X - (sigLineW / 2), sigY + 4.2, { align: 'center' });

    if (returnBlob) {
        return doc.output('blob');
    }
    doc.save(`Amonestacion_Acta_${normalizeRut(data.worker_rut || 'sin_rut')}.pdf`);
};
