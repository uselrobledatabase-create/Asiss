/**
 * Control ASISS - Exportadores Excel (ExcelJS)
 *
 * 1) exportPersonScheduleXlsx: programación individual por rango de fechas
 *    (formato autorizado para enviar ante cambios de programación).
 * 2) exportMonthlyScheduleXlsx: programación mensual de todo el personal,
 *    en semanas completas Lun-Dom (extiende al lunes previo y domingo posterior).
 */

import ExcelJS from 'exceljs';
import { StaffWithShift } from '../../asistencia2026/types';
import { TERMINAL_LABELS, TerminalCode } from '../../../shared/types/terminal';
import { CONTROL_TERMINALS, ResolvedDayStatus, STATUS_LABELS } from '../types';
import {
    ScheduleContext,
    resolveDay,
    getDateRange,
    getExtendedMonthRange,
    dayName,
    dayNameShort,
    monthName,
    formatDateCL,
} from './scheduleEngine';

// ==========================================
// PALETA (ARGB)
// ==========================================

const C = {
    navy: 'FF0F172A',
    blue: 'FF2563EB',
    blueSoft: 'FFDBEAFE',
    white: 'FFFFFFFF',
    ink: 'FF1E293B',
    inkSoft: 'FF475569',
    inkFaint: 'FF94A3B8',
    line: 'FFCBD5E1',
    bgSoft: 'FFF8FAFC',
    libreBg: 'FFF1F5F9',
    libreTx: 'FF64748B',
    licBg: 'FFEDE9FE',
    licTx: 'FF6D28D9',
    vacBg: 'FFCCFBF1',
    vacTx: 'FF0F766E',
    perBg: 'FFFFEDD5',
    perTx: 'FFC2410C',
    weekendBg: 'FF334155',
    outMonthBg: 'FFF8FAFC',
    alertBg: 'FFFEE2E2',
    alertTx: 'FFB91C1C',
} as const;

const STATUS_STYLE: Record<ResolvedDayStatus, { bg: string; tx: string; label: string }> = {
    TRABAJA: { bg: C.white, tx: C.ink, label: 'Trabaja' },
    LIBRE: { bg: C.libreBg, tx: C.libreTx, label: 'LIBRE' },
    LICENCIA: { bg: C.licBg, tx: C.licTx, label: 'LICENCIA' },
    VACACIONES: { bg: C.vacBg, tx: C.vacTx, label: 'VACACIONES' },
    PERMISO: { bg: C.perBg, tx: C.perTx, label: 'PERMISO' },
};

// ==========================================
// HELPERS DE ESTILO
// ==========================================

type Cell = ExcelJS.Cell;

const fill = (argb: string): ExcelJS.Fill => ({
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb },
});

const thinBorder = (color: string = C.line): Partial<ExcelJS.Borders> => ({
    top: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } },
});

const center: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };
const left: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'middle' };

function styleHeaderCell(cell: Cell, bg: string = C.navy) {
    cell.fill = fill(bg);
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.white } };
    cell.alignment = center;
    cell.border = thinBorder(C.navy);
}

function downloadWorkbook(wb: ExcelJS.Workbook, fileName: string): Promise<void> {
    return wb.xlsx.writeBuffer().then((buffer) => {
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    });
}

function terminalLabel(code: string): string {
    return TERMINAL_LABELS[code as TerminalCode] || code;
}

/** Banner superior compartido: barra navy con título + subtítulo y sello ASISS */
function addBanner(
    ws: ExcelJS.Worksheet,
    lastCol: number,
    title: string,
    subtitle: string
) {
    const colLetter = ws.getColumn(lastCol).letter;

    ws.mergeCells(`A1:${colLetter}1`);
    const t = ws.getCell('A1');
    t.value = title;
    t.fill = fill(C.navy);
    t.font = { name: 'Calibri', size: 16, bold: true, color: { argb: C.white } };
    t.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    ws.getRow(1).height = 30;

    ws.mergeCells(`A2:${colLetter}2`);
    const s = ws.getCell('A2');
    s.value = subtitle;
    s.fill = fill(C.navy);
    s.font = { name: 'Calibri', size: 10, color: { argb: 'FFCBD5E1' } };
    s.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    ws.getRow(2).height = 16;

    // Línea de acento azul
    ws.mergeCells(`A3:${colLetter}3`);
    ws.getCell('A3').fill = fill(C.blue);
    ws.getRow(3).height = 3;
}

// ==========================================
// 1) PROGRAMACIÓN INDIVIDUAL POR RANGO
// ==========================================

export async function exportPersonScheduleXlsx(
    staff: StaffWithShift,
    startDate: string,
    endDate: string,
    ctx: ScheduleContext
): Promise<void> {
    const dates = getDateRange(startDate, endDate);
    const days = dates.map((d) => resolveDay(staff, d, ctx));

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Control ASISS';
    wb.created = new Date();

    const ws = wb.addWorksheet('Programación', {
        pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    ws.columns = [
        { width: 14 }, // Fecha
        { width: 12 }, // Día
        { width: 10 }, // Turno
        { width: 16 }, // Horario
        { width: 16 }, // Estado
        { width: 30 }, // Observación
    ];

    addBanner(
        ws,
        6,
        'PROGRAMACIÓN DE TURNOS — CAMBIO DE PROGRAMACIÓN',
        'Control ASISS · Documento con formato autorizado para envío'
    );

    // ---- Ficha del trabajador ----
    const info: [string, string][] = [
        ['Nombre', staff.nombre.toUpperCase()],
        ['RUT', staff.rut],
        ['Cargo', staff.cargo.toUpperCase()],
        ['Terminal', terminalLabel(staff.terminal_code)],
        ['Período', `${formatDateCL(startDate)}  al  ${formatDateCL(endDate)}`],
    ];

    let r = 5;
    for (const [label, value] of info) {
        const lc = ws.getCell(`A${r}`);
        lc.value = label;
        lc.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.inkSoft } };
        lc.fill = fill(C.bgSoft);
        lc.border = thinBorder();
        lc.alignment = left;

        ws.mergeCells(`B${r}:F${r}`);
        const vc = ws.getCell(`B${r}`);
        vc.value = value;
        vc.font = { name: 'Calibri', size: 11, bold: true, color: { argb: C.ink } };
        vc.border = thinBorder();
        vc.alignment = left;
        r++;
    }

    r++; // fila en blanco

    // ---- Encabezado de tabla ----
    const headers = ['FECHA', 'DÍA', 'TURNO', 'HORARIO', 'ESTADO', 'OBSERVACIÓN'];
    const headerRow = r;
    headers.forEach((h, i) => {
        const cell = ws.getCell(headerRow, i + 1);
        cell.value = h;
        styleHeaderCell(cell);
    });
    ws.getRow(headerRow).height = 20;
    r++;

    // ---- Filas de días ----
    const counts: Record<ResolvedDayStatus, number> = {
        TRABAJA: 0, LIBRE: 0, LICENCIA: 0, VACACIONES: 0, PERMISO: 0,
    };

    for (const day of days) {
        counts[day.status]++;
        const st = STATUS_STYLE[day.status];
        const isWeekend = ['Sábado', 'Domingo'].includes(dayName(day.date));

        const values = [
            formatDateCL(day.date),
            dayName(day.date),
            day.status === 'TRABAJA' ? day.turno : '—',
            day.status === 'TRABAJA' ? (day.horario || '—') : '—',
            day.status === 'TRABAJA' ? 'Trabaja' : st.label,
            '',
        ];

        values.forEach((v, i) => {
            const cell = ws.getCell(r, i + 1);
            cell.value = v;
            cell.border = thinBorder();
            cell.alignment = i === 5 ? left : center;
            cell.fill = fill(day.status === 'TRABAJA' ? (isWeekend ? C.bgSoft : C.white) : st.bg);
            cell.font = {
                name: 'Calibri',
                size: 10,
                bold: day.status !== 'TRABAJA' || i === 4,
                color: { argb: day.status === 'TRABAJA' ? C.ink : st.tx },
            };
        });
        ws.getRow(r).height = 17;
        r++;
    }

    r++; // separación

    // ---- Resumen ----
    ws.mergeCells(`A${r}:F${r}`);
    const sumTitle = ws.getCell(`A${r}`);
    sumTitle.value = 'RESUMEN DEL PERÍODO';
    styleHeaderCell(sumTitle);
    r++;

    const sumPairs: [string, number, string][] = [
        ['Días de trabajo', counts.TRABAJA, C.blueSoft],
        ['Días libres', counts.LIBRE, C.libreBg],
        ['Licencia', counts.LICENCIA, C.licBg],
        ['Vacaciones', counts.VACACIONES, C.vacBg],
        ['Permiso', counts.PERMISO, C.perBg],
        ['Total días', days.length, C.bgSoft],
    ];
    sumPairs.forEach(([label, value, bg], i) => {
        const row = r + Math.floor(i / 2);
        const col = (i % 2) * 3 + 1;
        const lc = ws.getCell(row, col);
        ws.mergeCells(row, col, row, col + 1);
        lc.value = label;
        lc.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.inkSoft } };
        lc.fill = fill(bg);
        lc.border = thinBorder();
        lc.alignment = left;
        const vc = ws.getCell(row, col + 2);
        vc.value = value;
        vc.font = { name: 'Calibri', size: 11, bold: true, color: { argb: C.ink } };
        vc.fill = fill(bg);
        vc.border = thinBorder();
        vc.alignment = center;
    });
    r += Math.ceil(sumPairs.length / 2) + 1;

    // ---- Pie ----
    ws.mergeCells(`A${r}:F${r}`);
    const foot = ws.getCell(`A${r}`);
    foot.value = `Generado por Control ASISS el ${new Date().toLocaleString('es-CL')} · Documento de programación oficial`;
    foot.font = { name: 'Calibri', size: 8, italic: true, color: { argb: C.inkFaint } };
    foot.alignment = left;

    ws.views = [{ state: 'frozen', ySplit: headerRow }];

    const cleanRut = staff.rut.replace(/\./g, '').replace(/-/g, '');
    await downloadWorkbook(
        wb,
        `Programacion_${cleanRut}_${startDate}_a_${endDate}.xlsx`
    );
}

// ==========================================
// 2) PROGRAMACIÓN MENSUAL COMPLETA (Lun-Dom)
// ==========================================

export async function exportMonthlyScheduleXlsx(
    staff: StaffWithShift[],
    year: number,
    month: number, // 0-11
    ctx: ScheduleContext
): Promise<void> {
    const { dates } = getExtendedMonthRange(year, month);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Control ASISS';
    wb.created = new Date();

    const activeStaff = staff.filter((s) => s.status === 'ACTIVO');

    for (const { code, label } of CONTROL_TERMINALS) {
        const inTerminal = activeStaff
            .filter((s) => s.terminal_code === code)
            .sort((a, b) => a.cargo.localeCompare(b.cargo) || a.nombre.localeCompare(b.nombre));

        if (inTerminal.length === 0) continue;

        const ws = wb.addWorksheet(label.toUpperCase(), {
            pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
        });

        const fixedCols = 3; // Nombre, RUT, Cargo
        const totalCols = fixedCols + dates.length;

        // Anchos
        ws.getColumn(1).width = 32;
        ws.getColumn(2).width = 13;
        ws.getColumn(3).width = 14;
        for (let i = 0; i < dates.length; i++) {
            ws.getColumn(fixedCols + 1 + i).width = 12;
        }

        addBanner(
            ws,
            totalCols,
            `PROGRAMACIÓN MENSUAL — ${monthName(month).toUpperCase()} ${year}`,
            `Terminal ${label} · Semanas completas de Lunes a Domingo (${formatDateCL(dates[0])} al ${formatDateCL(dates[dates.length - 1])}) · Control ASISS`
        );

        // ---- Encabezado de fechas (2 filas: día semana / fecha) ----
        const headRow1 = 5;
        const headRow2 = 6;

        (['NOMBRE', 'RUT', 'CARGO'] as const).forEach((h, i) => {
            ws.mergeCells(headRow1, i + 1, headRow2, i + 1);
            const cell = ws.getCell(headRow1, i + 1);
            cell.value = h;
            styleHeaderCell(cell);
        });

        dates.forEach((date, i) => {
            const col = fixedCols + 1 + i;
            const d = new Date(date + 'T12:00:00');
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const inMonth = d.getMonth() === month;

            const c1 = ws.getCell(headRow1, col);
            c1.value = dayNameShort(date).toUpperCase();
            styleHeaderCell(c1, isWeekend ? C.weekendBg : C.navy);
            if (!inMonth) c1.font = { ...c1.font, color: { argb: C.inkFaint } };

            const c2 = ws.getCell(headRow2, col);
            c2.value = formatDateCL(date).slice(0, 5); // DD-MM
            styleHeaderCell(c2, isWeekend ? C.weekendBg : C.navy);
            if (!inMonth) c2.font = { ...c2.font, color: { argb: C.inkFaint } };
        });
        ws.getRow(headRow1).height = 16;
        ws.getRow(headRow2).height = 16;

        // ---- Filas de personal (agrupadas por cargo) ----
        let r = headRow2 + 1;
        let lastCargo = '';

        for (const s of inTerminal) {
            const cargo = s.cargo.toUpperCase().trim();

            // Separador de grupo por cargo
            if (cargo !== lastCargo) {
                ws.mergeCells(r, 1, r, totalCols);
                const gc = ws.getCell(r, 1);
                gc.value = cargo;
                gc.fill = fill(C.blueSoft);
                gc.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E40AF' } };
                gc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                gc.border = thinBorder();
                ws.getRow(r).height = 16;
                r++;
                lastCargo = cargo;
            }

            const nameCell = ws.getCell(r, 1);
            nameCell.value = s.nombre.toUpperCase();
            nameCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: C.ink } };
            nameCell.alignment = left;
            nameCell.border = thinBorder();

            const rutCell = ws.getCell(r, 2);
            rutCell.value = s.rut;
            rutCell.font = { name: 'Calibri', size: 9, color: { argb: C.inkSoft } };
            rutCell.alignment = center;
            rutCell.border = thinBorder();

            const cargoCell = ws.getCell(r, 3);
            cargoCell.value = cargo;
            cargoCell.font = { name: 'Calibri', size: 8, color: { argb: C.inkSoft } };
            cargoCell.alignment = center;
            cargoCell.border = thinBorder();

            dates.forEach((date, i) => {
                const col = fixedCols + 1 + i;
                const day = resolveDay(s, date, ctx);
                const d = new Date(date + 'T12:00:00');
                const inMonth = d.getMonth() === month;
                const st = STATUS_STYLE[day.status];

                const cell = ws.getCell(r, col);
                if (day.status === 'TRABAJA') {
                    cell.value = day.horario || day.turno;
                    cell.fill = fill(inMonth ? C.white : C.outMonthBg);
                    cell.font = {
                        name: 'Calibri', size: 8,
                        color: { argb: inMonth ? C.ink : C.inkFaint },
                    };
                } else {
                    cell.value = st.label;
                    cell.fill = fill(inMonth ? st.bg : C.outMonthBg);
                    cell.font = {
                        name: 'Calibri', size: 8, bold: true,
                        color: { argb: inMonth ? st.tx : C.inkFaint },
                    };
                }
                cell.alignment = center;
                cell.border = thinBorder();
            });

            ws.getRow(r).height = 15;
            r++;
        }

        // ---- Leyenda ----
        r++;
        const legend: [string, string, string][] = [
            ['Horario', C.white, C.ink],
            ['LIBRE', C.libreBg, C.libreTx],
            ['LICENCIA', C.licBg, C.licTx],
            ['VACACIONES', C.vacBg, C.vacTx],
            ['PERMISO', C.perBg, C.perTx],
        ];
        const lt = ws.getCell(r, 1);
        lt.value = 'LEYENDA:';
        lt.font = { name: 'Calibri', size: 9, bold: true, color: { argb: C.inkSoft } };
        legend.forEach(([labelTxt, bg, tx], i) => {
            const cell = ws.getCell(r, 2 + i);
            cell.value = labelTxt;
            cell.fill = fill(bg);
            cell.font = { name: 'Calibri', size: 8, bold: true, color: { argb: tx } };
            cell.alignment = center;
            cell.border = thinBorder();
        });
        r += 2;

        ws.mergeCells(r, 1, r, Math.min(totalCols, 10));
        const foot = ws.getCell(r, 1);
        foot.value = `Generado por Control ASISS el ${new Date().toLocaleString('es-CL')} · Los días fuera del mes se muestran para completar semanas Lun-Dom`;
        foot.font = { name: 'Calibri', size: 8, italic: true, color: { argb: C.inkFaint } };

        // Congelar columnas fijas + encabezados
        ws.views = [{ state: 'frozen', xSplit: fixedCols, ySplit: headRow2 }];
    }

    if (wb.worksheets.length === 0) {
        throw new Error('No hay personal activo en los terminales para exportar.');
    }

    await downloadWorkbook(
        wb,
        `Programacion_Mensual_${monthName(month)}_${year}.xlsx`
    );
}
