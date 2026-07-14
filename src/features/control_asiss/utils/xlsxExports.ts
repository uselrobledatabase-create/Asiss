/**
 * Control ASISS - Exportadores Excel (ExcelJS)
 *
 * Ambos exportes usan el MISMO formato oficial autorizado, LIMPIO de
 * incidencias (sin licencias/vacaciones/permisos): cada celda es un
 * horario en formato HH:MM_HH:MM_ o "LIBRE".
 *
 * Columnas fijas: Nº | NOMBRE | RUT | AREA | CARGO | ZONA |
 * Tiempo de Colación (minutos) | Régimen de Turno | JORNADA | Feriados
 *
 * 1) exportScheduleChangeXlsx: cambio de programación para 1 o más
 *    personas seleccionadas, por rango de fechas libre.
 * 2) exportMonthlyScheduleXlsx: todo el personal (incluye suspendidos),
 *    mes en semanas completas Lun-Dom.
 *
 * Régimen detectado desde el patrón real (ventana de 4 semanas):
 * - Lun-Vie trabajando y TODOS los Sáb+Dom libres → "5X2 FIJO_42"
 * - Cualquier otro patrón → "5X2 ROT_42"
 * La opción `feriadosLibres` (botón en la UI) controla si los feriados
 * legales de Chile se muestran LIBRES para los 5X2 FIJO_42.
 */

import ExcelJS from 'exceljs';
import { StaffWithShift } from '../../asistencia2026/types';
import { CONTROL_TERMINALS } from '../types';
import {
    ScheduleContext,
    resolveDayPattern,
    getDateRange,
    getExtendedMonthRange,
    dayNameShort,
    monthName,
    formatDateCL,
    formatHorarioOficial,
} from './scheduleEngine';
import { isFeriado } from './feriados';
import { turnoDeFicha } from './coverageAnalysis';

// ==========================================
// PALETA (ARGB)
// ==========================================

const C = {
    navy: 'FF0F172A',
    blue: 'FF2563EB',
    white: 'FFFFFFFF',
    ink: 'FF1E293B',
    inkSoft: 'FF475569',
    inkFaint: 'FF94A3B8',
    line: 'FFCBD5E1',
    bgSoft: 'FFF8FAFC',
    libreBg: 'FFF1F5F9',
    libreTx: 'FF64748B',
    weekendBg: 'FF334155',
    outMonthBg: 'FFF8FAFC',
} as const;

// ==========================================
// CONSTANTES DE FORMATO OFICIAL
// ==========================================

const COLACION_MINUTOS = 60;

const ZONA_BY_TERMINAL: Record<string, string> = {
    EL_ROBLE: 'ER',
    LA_REINA: 'LR',
    MARIA_ANGELICA: 'LR', // MA se considera como LR
};

const CARGO_SORT = ['SUPERVISOR', 'INSPECTOR', 'CONDUCTOR', 'PLANILLERO', 'CLEANER'];
const cargoOrder = (cargo: string): number => {
    const idx = CARGO_SORT.findIndex((c) => cargo.toUpperCase().includes(c));
    return idx === -1 ? CARGO_SORT.length : idx;
};

const FIXED_HEADERS = [
    'Nº', 'NOMBRE', 'RUT', 'AREA', 'CARGO', 'ZONA',
    'Tiempo de Colación (minutos)', 'Régimen de Turno', 'JORNADA', 'Feriados',
];
const FIXED_WIDTHS = [5, 34, 13, 11, 14, 7, 13, 14, 11, 10];

/** RUT con guión: 12345678-9 */
function rutConGuion(rut: string): string {
    const clean = String(rut).replace(/[.\s-]/g, '').toUpperCase();
    if (clean.length < 2) return rut;
    return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}

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

/** Banner superior: barra navy con título + subtítulo y línea de acento */
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

    ws.mergeCells(`A3:${colLetter}3`);
    ws.getCell('A3').fill = fill(C.blue);
    ws.getRow(3).height = 3;
}

// ==========================================
// DETECCIÓN DE RÉGIMEN (ventana fija de 4 semanas)
// ==========================================

/** Lunes de la semana de una fecha */
function mondayOf(date: string): string {
    const d = new Date(date + 'T12:00:00');
    const offset = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - offset);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dd}`;
}

/**
 * Detecta si la persona es 5X2 FIJO_42: trabaja Lun-Vie y descansa TODOS
 * los Sáb+Dom. Se evalúa sobre 4 semanas completas ancladas al inicio del
 * rango exportado, para que rangos cortos no clasifiquen mal.
 */
function esFijo42(staff: StaffWithShift, anchorDate: string, ctx: ScheduleContext): boolean {
    const start = mondayOf(anchorDate);
    const startD = new Date(start + 'T12:00:00');
    for (let i = 0; i < 28; i++) {
        const d = new Date(startD);
        d.setDate(startD.getDate() + i);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${d.getFullYear()}-${m}-${dd}`;
        const day = resolveDayPattern(staff, dateStr, ctx);
        const dow = d.getDay();
        const weekend = dow === 0 || dow === 6;
        if (weekend && day.status !== 'LIBRE') return false;
        if (!weekend && day.status !== 'TRABAJA') return false;
    }
    return true;
}

// ==========================================
// RENDERIZADOR OFICIAL COMPARTIDO
// ==========================================

export interface OfficialExportOptions {
    /** Si true, los 5X2 FIJO_42 muestran LIBRE en feriados legales de Chile */
    feriadosLibres: boolean;
}

interface RenderConfig {
    sheetName: string;
    title: string;
    subtitle: string;
    dates: string[];
    /** Mes 0-11 para atenuar días vecinos; null = sin atenuar (rango libre) */
    dimOutsideMonth: number | null;
    footerNote: string;
}

function renderOfficialSheet(
    wb: ExcelJS.Workbook,
    staffList: StaffWithShift[],
    ctx: ScheduleContext,
    options: OfficialExportOptions,
    cfg: RenderConfig
): void {
    const { dates } = cfg;

    const sorted = [...staffList].sort((a, b) => {
        const za = ZONA_BY_TERMINAL[a.terminal_code] || 'ZZ';
        const zb = ZONA_BY_TERMINAL[b.terminal_code] || 'ZZ';
        if (za !== zb) return za.localeCompare(zb);
        const ca = cargoOrder(a.cargo);
        const cb = cargoOrder(b.cargo);
        if (ca !== cb) return ca - cb;
        return a.nombre.localeCompare(b.nombre);
    });

    // Programación limpia (solo patrón) pre-resuelta
    const resolved = new Map<string, ReturnType<typeof resolveDayPattern>[]>();
    const fijoMap = new Map<string, boolean>();
    for (const s of sorted) {
        resolved.set(s.id, dates.map((d) => resolveDayPattern(s, d, ctx)));
        fijoMap.set(s.id, esFijo42(s, dates[0], ctx));
    }

    // Jornada según la asignación de la ficha del trabajador (Mañana/Noche)
    const jornadaDe = (s: StaffWithShift): 'DIURNA' | 'NOCTURNA' =>
        turnoDeFicha(s.turno, s.horario) === 'NOCHE' ? 'NOCTURNA' : 'DIURNA';

    const ws = wb.addWorksheet(cfg.sheetName, {
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    const fixedCols = FIXED_HEADERS.length;
    const totalCols = fixedCols + dates.length;

    FIXED_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    for (let i = 0; i < dates.length; i++) {
        ws.getColumn(fixedCols + 1 + i).width = 12.5;
    }

    addBanner(ws, totalCols, cfg.title, cfg.subtitle);

    // ---- Encabezados (2 filas: fijas fusionadas + día/fecha) ----
    const headRow1 = 5;
    const headRow2 = 6;

    FIXED_HEADERS.forEach((h, i) => {
        ws.mergeCells(headRow1, i + 1, headRow2, i + 1);
        const cell = ws.getCell(headRow1, i + 1);
        cell.value = h;
        styleHeaderCell(cell);
        cell.alignment = { ...center, wrapText: true };
    });

    dates.forEach((date, i) => {
        const col = fixedCols + 1 + i;
        const d = new Date(date + 'T12:00:00');
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const inMonth = cfg.dimOutsideMonth === null || d.getMonth() === cfg.dimOutsideMonth;

        const c1 = ws.getCell(headRow1, col);
        c1.value = dayNameShort(date).toUpperCase();
        styleHeaderCell(c1, isWeekend ? C.weekendBg : C.navy);
        if (!inMonth) c1.font = { ...c1.font, color: { argb: C.inkFaint } };

        const c2 = ws.getCell(headRow2, col);
        c2.value = formatDateCL(date).slice(0, 5); // DD-MM
        styleHeaderCell(c2, isWeekend ? C.weekendBg : C.navy);
        if (!inMonth) c2.font = { ...c2.font, color: { argb: C.inkFaint } };
    });
    ws.getRow(headRow1).height = 26;
    ws.getRow(headRow2).height = 16;

    // ---- Filas de personal ----
    let r = headRow2 + 1;
    let n = 1;

    for (const s of sorted) {
        const fijo = fijoMap.get(s.id)!;
        const days = resolved.get(s.id)!;
        const feriadoLibre = fijo && options.feriadosLibres;

        const fixedValues: (string | number)[] = [
            n,
            s.nombre.toUpperCase(),
            rutConGuion(s.rut),
            'LOGISTICA',
            s.cargo.toUpperCase().trim(),
            ZONA_BY_TERMINAL[s.terminal_code] || '',
            COLACION_MINUTOS,
            fijo ? '5X2 FIJO_42' : '5X2 ROT_42',
            jornadaDe(s),
            feriadoLibre ? 'LIBRE' : 'TRABAJA',
        ];

        fixedValues.forEach((v, i) => {
            const cell = ws.getCell(r, i + 1);
            cell.value = v;
            cell.border = thinBorder();
            cell.alignment = i === 1 ? left : center;
            cell.fill = fill(n % 2 === 0 ? C.bgSoft : C.white);
            cell.font = {
                name: 'Calibri',
                size: 9,
                bold: i === 1,
                color: { argb: i === 1 ? C.ink : C.inkSoft },
            };
        });

        dates.forEach((date, i) => {
            const col = fixedCols + 1 + i;
            const day = days[i];
            const d = new Date(date + 'T12:00:00');
            const inMonth = cfg.dimOutsideMonth === null || d.getMonth() === cfg.dimOutsideMonth;

            const esLibre = day.status !== 'TRABAJA' || (feriadoLibre && isFeriado(date));

            const cell = ws.getCell(r, col);
            if (esLibre) {
                cell.value = 'LIBRE';
                cell.fill = fill(inMonth ? C.libreBg : C.outMonthBg);
                cell.font = {
                    name: 'Calibri', size: 8, bold: true,
                    color: { argb: inMonth ? C.libreTx : C.inkFaint },
                };
            } else {
                cell.value = formatHorarioOficial(day.horario, day.turno);
                cell.fill = fill(inMonth ? C.white : C.outMonthBg);
                cell.font = {
                    name: 'Calibri', size: 8,
                    color: { argb: inMonth ? C.ink : C.inkFaint },
                };
            }
            cell.alignment = center;
            cell.border = thinBorder();
        });

        ws.getRow(r).height = 15;
        r++;
        n++;
    }

    // ---- Pie ----
    r += 1;
    ws.mergeCells(r, 1, r, Math.min(totalCols, 12));
    const foot = ws.getCell(r, 1);
    const feriadosNote = options.feriadosLibres
        ? 'Régimen 5X2 FIJO_42 con feriados libres'
        : 'Feriados NO aplicados (todos según patrón de turno)';
    foot.value =
        `Generado por Control ASISS el ${new Date().toLocaleString('es-CL')} · ` +
        `Programación limpia (solo horarios y libres) · ${feriadosNote}` +
        (cfg.footerNote ? ` · ${cfg.footerNote}` : '');
    foot.font = { name: 'Calibri', size: 8, italic: true, color: { argb: C.inkFaint } };

    // Congelar Nº + NOMBRE + RUT y encabezados
    ws.views = [{ state: 'frozen', xSplit: 3, ySplit: headRow2 }];
}

// ==========================================
// 1) CAMBIO DE PROGRAMACIÓN (1 O MÁS PERSONAS)
// ==========================================

export async function exportScheduleChangeXlsx(
    staffList: StaffWithShift[],
    startDate: string,
    endDate: string,
    ctx: ScheduleContext,
    options: OfficialExportOptions = { feriadosLibres: true }
): Promise<void> {
    if (staffList.length === 0) {
        throw new Error('Selecciona al menos 1 persona para exportar.');
    }

    const dates = getDateRange(startDate, endDate);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Control ASISS';
    wb.created = new Date();

    renderOfficialSheet(wb, staffList, ctx, options, {
        sheetName: 'CAMBIO PROGRAMACION',
        title: 'CAMBIO DE PROGRAMACIÓN',
        subtitle:
            `Área Logística · ${staffList.length} trabajador(es) · ` +
            `Período ${formatDateCL(startDate)} al ${formatDateCL(endDate)} · ` +
            `Documento con formato autorizado · Control ASISS`,
        dates,
        dimOutsideMonth: null,
        footerNote: '',
    });

    const fileName = staffList.length === 1
        ? `Cambio_Programacion_${rutConGuion(staffList[0].rut).replace('-', '')}_${startDate}_a_${endDate}.xlsx`
        : `Cambio_Programacion_${staffList.length}_personas_${startDate}_a_${endDate}.xlsx`;

    await downloadWorkbook(wb, fileName);
}

// ==========================================
// 2) PROGRAMACIÓN MENSUAL COMPLETA (Lun-Dom)
// ==========================================

export async function exportMonthlyScheduleXlsx(
    staff: StaffWithShift[],
    year: number,
    month: number, // 0-11
    ctx: ScheduleContext,
    options: OfficialExportOptions = { feriadosLibres: true }
): Promise<void> {
    const { dates } = getExtendedMonthRange(year, month);

    const controlCodes = CONTROL_TERMINALS.map((t) => t.code as string);
    const exportStaff = staff.filter(
        (s) => s.status === 'ACTIVO' && controlCodes.includes(s.terminal_code)
    );

    if (exportStaff.length === 0) {
        throw new Error('No hay personal activo en los terminales para exportar.');
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Control ASISS';
    wb.created = new Date();

    renderOfficialSheet(wb, exportStaff, ctx, options, {
        sheetName: 'PROGRAMACION',
        title: `PROGRAMACIÓN MENSUAL — ${monthName(month).toUpperCase()} ${year}`,
        subtitle:
            `Área Logística · Zonas ER / LR · Semanas completas Lun-Dom ` +
            `(${formatDateCL(dates[0])} al ${formatDateCL(dates[dates.length - 1])}) · Control ASISS`,
        dates,
        dimOutsideMonth: month,
        footerNote: 'Los días fuera del mes completan semanas Lun-Dom',
    });

    await downloadWorkbook(
        wb,
        `Programacion_Mensual_${monthName(month)}_${year}.xlsx`
    );
}
