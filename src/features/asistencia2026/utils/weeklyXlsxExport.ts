/**
 * Exportación semanal de asistencia (ExcelJS) — formato oficial:
 *
 * HOJA 1 "ASISTENCIA SEMANAL": todo el personal (activos Y suspendidos),
 * ordenado por terminal (El Roble → La Reina → María Angélica) y dentro
 * por familia de cargo (Supervisores → Inspectores → Conductores →
 * Planilleros → Cleaners). Columnas: # RUT NOMBRE Cargo TERMINAL,
 * los 7 días de la semana consultada (LU-DO con fecha) con el código
 * real registrado (P/A/L/V/LIC/PCGS/PSGS) y el informe lateral con el
 * conteo por persona (P L V PCGS LIC A PSGS Desv, Días Trabajados y
 * Repetidos).
 *
 * HOJAS 2-4: Sin Credencial, No Marcaciones y Cambios de Turno de la
 * semana consultada.
 *
 * La exportación consulta datos FRESCOS al momento del clic (no depende
 * de los filtros de la pantalla).
 */

import ExcelJS from 'exceljs';
import {
    fetchShiftTypes,
    fetchAllSpecialTemplates,
    fetchOverridesForRange,
    fetchMarksForRange,
    fetchLicensesForRange,
    fetchPermissionsForRange,
    fetchVacationsForRange,
    fetchIncidencesForRange,
} from '../api/asistencia2026Api';
import { fetchStaffForExport, ExportStaff } from '../../control_asiss/api';
import { resolveDay, ScheduleContext, formatDateCL } from '../../control_asiss/utils/scheduleEngine';
import { AttendancePermission } from '../types';
import { NoMarcacion, SinCredencial, CambioDia } from '../../asistencia/types';

// ==========================================
// CÓDIGOS DE DÍA Y PALETA (formato oficial)
// ==========================================

type DayCode = 'P' | 'A' | 'L' | 'V' | 'LIC' | 'PCGS' | 'PSGS' | '';

const C = {
    headerBlue: 'FF8EA9DB',   // encabezados fijos (periwinkle)
    dayLight: 'FFB4C6E7',     // LU-VI
    saDark: 'FF2F5496',       // SA azul oscuro
    doRed: 'FFFF0000',        // DO rojo
    navy: 'FF1F3864',
    white: 'FFFFFFFF',
    black: 'FF000000',
    ink: 'FF1E293B',
    line: 'FF9CA3AF',
    lineSoft: 'FFD1D5DB',
    green: 'FF92D050',
    orange: 'FFF4A63C',
    salmon: 'FFF4B8A0',
    red: 'FFFF0000',
    grayBg: 'FFF3F4F6',
    suspBg: 'FFFFF3C4',
} as const;

// Estilo por código: [fill, textColor, bold]
const CODE_STYLE: Record<Exclude<DayCode, ''>, [string, string, boolean]> = {
    P: [C.white, C.ink, false],
    A: [C.red, C.white, true],
    L: [C.black, C.white, true],
    V: [C.green, C.ink, true],
    LIC: [C.salmon, C.ink, true],
    PCGS: [C.orange, C.ink, true],
    PSGS: [C.white, C.ink, true],
};

// Columnas del informe lateral: [código, etiqueta, fill, textColor]
const COUNTER_COLS: { key: DayCode | 'DESV'; label: string; fill: string; tx: string }[] = [
    { key: 'P', label: 'P', fill: C.dayLight, tx: C.ink },
    { key: 'L', label: 'L', fill: C.black, tx: C.white },
    { key: 'V', label: 'V', fill: C.green, tx: C.ink },
    { key: 'PCGS', label: 'PCGS', fill: C.orange, tx: C.ink },
    { key: 'LIC', label: 'LIC', fill: C.salmon, tx: C.ink },
    { key: 'A', label: 'A', fill: C.red, tx: C.white },
    { key: 'PSGS', label: 'PSGS', fill: C.white, tx: C.ink },
    { key: 'DESV', label: 'Desv', fill: C.red, tx: C.white },
];

const TERMINAL_ORDER = ['EL_ROBLE', 'LA_REINA', 'MARIA_ANGELICA'];
const TERMINAL_ABBR: Record<string, string> = {
    EL_ROBLE: 'ER',
    LA_REINA: 'LR',
    MARIA_ANGELICA: 'MA',
};

const CARGO_SORT = ['SUPERVISOR', 'INSPECTOR', 'CONDUCTOR', 'PLANILLERO', 'CLEANER'];
const cargoOrder = (cargo: string): number => {
    const idx = CARGO_SORT.findIndex((c) => cargo.toUpperCase().includes(c));
    return idx === -1 ? CARGO_SORT.length : idx;
};

const DAY_ABBR = ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'];

function rutConGuion(rut: string): string {
    const clean = String(rut).replace(/[.\s-]/g, '').toUpperCase();
    if (clean.length < 2) return rut;
    return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}

const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const border = (color: string = C.lineSoft): Partial<ExcelJS.Borders> => ({
    top: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } },
});
const center: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };

// ==========================================
// EXPORT PRINCIPAL
// ==========================================

export async function exportWeeklyAttendanceXlsx(
    weekDates: string[],
    generatedBy: string
): Promise<void> {
    const startDate = weekDates[0];
    const endDate = weekDates[weekDates.length - 1];

    // ---- Datos frescos (incluye personal suspendido) ----
    const allStaff = await fetchStaffForExport();
    const staff = allStaff
        .filter((s) => TERMINAL_ORDER.includes(s.terminal_code))
        .sort((a, b) => {
            const ta = TERMINAL_ORDER.indexOf(a.terminal_code);
            const tb = TERMINAL_ORDER.indexOf(b.terminal_code);
            if (ta !== tb) return ta - tb;
            const ca = cargoOrder(a.cargo);
            const cb = cargoOrder(b.cargo);
            if (ca !== cb) return ca - cb;
            return a.nombre.localeCompare(b.nombre);
        });

    if (staff.length === 0) throw new Error('No hay personal para exportar.');

    const staffIds = staff.map((s) => s.id);
    const [shiftTypes, specialTemplates, overrides, marks, licenses, permissions, vacations, incidences] =
        await Promise.all([
            fetchShiftTypes(),
            fetchAllSpecialTemplates(staffIds),
            fetchOverridesForRange(staffIds, startDate, endDate),
            fetchMarksForRange(staffIds, startDate, endDate),
            fetchLicensesForRange(staffIds, startDate, endDate),
            fetchPermissionsForRange(staffIds, startDate, endDate),
            fetchVacationsForRange(staffIds, startDate, endDate),
            fetchIncidencesForRange(TERMINAL_ORDER, startDate, endDate),
        ]);

    const ctx: ScheduleContext = {
        shiftTypes, specialTemplates, overrides, licenses, vacations, permissions,
    };

    // ---- Código real del día por persona ----
    const permTipo = (p: AttendancePermission): DayCode =>
        (p.permission_type || '').toUpperCase().includes('SIN') ? 'PSGS' : 'PCGS';

    const dayCode = (s: ExportStaff, date: string): DayCode => {
        const day = resolveDay(s, date, ctx);
        if (day.status === 'LICENCIA') return 'LIC';
        if (day.status === 'VACACIONES') return 'V';
        if (day.status === 'PERMISO') {
            const p = permissions.find(
                (x) => x.staff_id === s.id && date >= x.start_date && date <= x.end_date
            );
            return p ? permTipo(p) : 'PCGS';
        }
        const mark = marks.find((m) => m.staff_id === s.id && m.mark_date === date);
        if (mark) return mark.mark as DayCode; // P o A registrado
        if (day.status === 'LIBRE') return 'L';
        return ''; // día de trabajo sin marca registrada
    };

    // ==========================================
    // WORKBOOK
    // ==========================================
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ASISS';
    wb.created = new Date();

    // ==========================================
    // HOJA 1: ASISTENCIA SEMANAL
    // ==========================================
    const ws = wb.addWorksheet('ASISTENCIA SEMANAL', {
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    const FIXED = ['#', 'RUT', 'NOMBRE', 'Cargo', 'TERMINAL'];
    const fixedCols = FIXED.length;
    const dayCols = weekDates.length;
    const counterStart = fixedCols + dayCols + 1; // 1-indexed
    const totalCols = fixedCols + dayCols + COUNTER_COLS.length + 2; // + Días Trabajados + Repetidos

    // Anchos
    const widths = [5, 13, 38, 22, 10, ...Array(dayCols).fill(5.5), ...Array(COUNTER_COLS.length).fill(6), 12, 11];
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    // ---- Banner ----
    const lastColLetter = ws.getColumn(totalCols).letter;
    ws.mergeCells(`A1:${lastColLetter}1`);
    const t = ws.getCell('A1');
    t.value = 'REPORTE SEMANAL DE ASISTENCIA';
    t.fill = fill(C.navy);
    t.font = { name: 'Calibri', size: 15, bold: true, color: { argb: C.white } };
    t.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    ws.getRow(1).height = 26;

    ws.mergeCells(`A2:${lastColLetter}2`);
    const st = ws.getCell('A2');
    st.value =
        `Semana ${formatDateCL(startDate)} al ${formatDateCL(endDate)} · ` +
        `Personal activo y suspendido · Generado por ${generatedBy} el ${new Date().toLocaleString('es-CL')}`;
    st.fill = fill(C.navy);
    st.font = { name: 'Calibri', size: 9, color: { argb: 'FFB7C4E0' } };
    st.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    ws.getRow(2).height = 15;

    // ---- Encabezados (2 filas: 4 y 5) ----
    const h1 = 4;
    const h2 = 5;

    FIXED.forEach((h, i) => {
        ws.mergeCells(h1, i + 1, h2, i + 1);
        const cell = ws.getCell(h1, i + 1);
        cell.value = h;
        cell.fill = fill(C.headerBlue);
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.ink } };
        cell.alignment = center;
        cell.border = border(C.line);
    });

    weekDates.forEach((date, i) => {
        const col = fixedCols + 1 + i;
        const dow = new Date(date + 'T12:00:00').getDay();
        const headFill = dow === 0 ? C.doRed : dow === 6 ? C.saDark : C.dayLight;
        const headTx = dow === 0 || dow === 6 ? C.white : C.ink;

        const c1 = ws.getCell(h1, col);
        c1.value = DAY_ABBR[dow];
        c1.fill = fill(headFill);
        c1.font = { name: 'Calibri', size: 9, bold: true, color: { argb: headTx } };
        c1.alignment = center;
        c1.border = border(C.line);

        const c2 = ws.getCell(h2, col);
        c2.value = formatDateCL(date).replace(/-/g, '/');
        c2.fill = fill(headFill);
        c2.font = { name: 'Calibri', size: 8, bold: true, color: { argb: headTx } };
        c2.alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
        c2.border = border(C.line);
    });

    COUNTER_COLS.forEach((cc, i) => {
        const col = counterStart + i;
        ws.mergeCells(h1, col, h2, col);
        const cell = ws.getCell(h1, col);
        cell.value = cc.label;
        cell.fill = fill(cc.fill);
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: cc.tx } };
        cell.alignment = { ...center, textRotation: cc.label.length > 2 ? 90 : 0 };
        cell.border = border(C.line);
    });

    const diasCol = counterStart + COUNTER_COLS.length;
    const repCol = diasCol + 1;
    ws.mergeCells(h1, diasCol, h2, diasCol);
    const dtc = ws.getCell(h1, diasCol);
    dtc.value = 'Días Trabajados';
    dtc.fill = fill(C.headerBlue);
    dtc.font = { name: 'Calibri', size: 9, bold: true, color: { argb: C.ink } };
    dtc.alignment = { ...center, wrapText: true };
    dtc.border = border(C.line);

    ws.mergeCells(h1, repCol, h2, repCol);
    const rpc = ws.getCell(h1, repCol);
    rpc.value = 'REPETIDOS';
    rpc.fill = fill(C.white);
    rpc.font = { name: 'Calibri', size: 9, bold: true, color: { argb: C.ink } };
    rpc.alignment = { ...center, wrapText: true };
    rpc.border = border(C.line);

    ws.getRow(h1).height = 16;
    ws.getRow(h2).height = 56; // fechas rotadas

    // ---- Conteo de RUTs repetidos ----
    const rutCount = new Map<string, number>();
    for (const s of staff) {
        const key = rutConGuion(s.rut);
        rutCount.set(key, (rutCount.get(key) || 0) + 1);
    }

    // ---- Filas de personal ----
    let r = h2 + 1;
    let n = 1;
    let lastTerminal = '';

    for (const s of staff) {
        // Separador por terminal
        if (s.terminal_code !== lastTerminal) {
            ws.mergeCells(r, 1, r, totalCols);
            const sep = ws.getCell(r, 1);
            sep.value = s.terminal_code === 'EL_ROBLE' ? 'TERMINAL EL ROBLE'
                : s.terminal_code === 'LA_REINA' ? 'TERMINAL LA REINA'
                    : 'TERMINAL MARÍA ANGÉLICA';
            sep.fill = fill(C.navy);
            sep.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.white } };
            sep.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            sep.border = border(C.line);
            ws.getRow(r).height = 16;
            r++;
            lastTerminal = s.terminal_code;
        }

        const codes = weekDates.map((d) => dayCode(s, d));
        const counts: Record<string, number> = { P: 0, A: 0, L: 0, V: 0, LIC: 0, PCGS: 0, PSGS: 0, DESV: 0 };
        codes.forEach((c) => { if (c) counts[c] = (counts[c] || 0) + 1; });

        const zebra = n % 2 === 0 ? C.grayBg : C.white;

        // Fijas
        const fixedValues: (string | number)[] = [
            n,
            rutConGuion(s.rut),
            s.nombre.toUpperCase() + (s.suspended ? '  (SUSPENDIDO)' : ''),
            s.cargo,
            TERMINAL_ABBR[s.terminal_code] || s.terminal_code,
        ];
        fixedValues.forEach((v, i) => {
            const cell = ws.getCell(r, i + 1);
            cell.value = v;
            cell.border = border();
            cell.alignment = i === 2 || i === 3 ? { horizontal: 'left', vertical: 'middle', indent: 1 } : center;
            cell.fill = fill(s.suspended ? C.suspBg : zebra);
            cell.font = { name: 'Calibri', size: 9, bold: i === 2, color: { argb: C.ink } };
        });

        // Días
        codes.forEach((code, i) => {
            const cell = ws.getCell(r, fixedCols + 1 + i);
            cell.value = code;
            cell.border = border();
            cell.alignment = center;
            if (code) {
                const [bg, tx, bold] = CODE_STYLE[code];
                cell.fill = fill(bg === C.white ? zebra : bg);
                cell.font = { name: 'Calibri', size: 9, bold, color: { argb: tx } };
            } else {
                cell.fill = fill(zebra);
            }
        });

        // Informe lateral (conteos)
        COUNTER_COLS.forEach((cc, i) => {
            const cell = ws.getCell(r, counterStart + i);
            cell.value = counts[cc.key] ?? 0;
            cell.border = border();
            cell.alignment = center;
            const has = (counts[cc.key] ?? 0) > 0;
            cell.fill = fill(has ? cc.fill : zebra);
            cell.font = {
                name: 'Calibri', size: 9, bold: has,
                color: { argb: has ? cc.tx : 'FFB0B7C3' },
            };
        });

        // Días trabajados + repetidos
        const dt = ws.getCell(r, diasCol);
        dt.value = counts.P;
        dt.border = border();
        dt.alignment = center;
        dt.fill = fill(zebra);
        dt.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.ink } };

        const reps = rutCount.get(rutConGuion(s.rut)) || 1;
        const rp = ws.getCell(r, repCol);
        rp.value = reps;
        rp.border = border();
        rp.alignment = center;
        rp.fill = fill(reps > 1 ? C.red : zebra);
        rp.font = { name: 'Calibri', size: 9, bold: reps > 1, color: { argb: reps > 1 ? C.white : 'FFB0B7C3' } };

        ws.getRow(r).height = 15;
        r++;
        n++;
    }

    // ---- Leyenda ----
    r += 1;
    const legend: [string, string, string][] = [
        ['P = Presente', C.white, C.ink],
        ['A = Ausente', C.red, C.white],
        ['L = Libre', C.black, C.white],
        ['V = Vacaciones', C.green, C.ink],
        ['LIC = Licencia', C.salmon, C.ink],
        ['PCGS = Permiso c/goce', C.orange, C.ink],
        ['PSGS = Permiso s/goce', C.white, C.ink],
        ['(vacío) = Sin marca registrada', C.grayBg, C.ink],
    ];
    const lg = ws.getCell(r, 1);
    lg.value = 'LEYENDA:';
    lg.font = { name: 'Calibri', size: 9, bold: true, color: { argb: C.ink } };
    legend.forEach(([label, bg, tx], i) => {
        const c0 = 2 + i * 3;
        ws.mergeCells(r, c0, r, c0 + 2);
        const cell = ws.getCell(r, c0);
        cell.value = label;
        cell.fill = fill(bg);
        cell.font = { name: 'Calibri', size: 8, bold: true, color: { argb: tx } };
        cell.alignment = center;
        cell.border = border();
    });

    ws.views = [{ state: 'frozen', xSplit: fixedCols, ySplit: h2 }];

    // ==========================================
    // HOJAS DE INCIDENCIAS
    // ==========================================
    addIncidenceSheet(wb, 'SIN CREDENCIAL', startDate, endDate, generatedBy,
        ['Fecha', 'RUT', 'Nombre', 'Terminal', 'Cargo', 'Desde', 'Hasta', 'Autoriza', 'Responsable', 'Observación', 'Estado'],
        [12, 13, 36, 12, 18, 9, 9, 22, 22, 40, 13],
        (incidences.sinCredenciales as SinCredencial[]).map((x) => [
            formatDateCL(x.date), rutConGuion(x.rut), x.nombre, TERMINAL_ABBR[x.terminal_code] || x.terminal_code,
            x.cargo || '', x.start_time || '', x.end_time || '', x.supervisor_autoriza || '',
            x.responsable || '', x.observacion || '', x.auth_status,
        ])
    );

    addIncidenceSheet(wb, 'NO MARCACIONES', startDate, endDate, generatedBy,
        ['Fecha', 'RUT', 'Nombre', 'Terminal', 'Cargo', 'Estado Incidencia', 'Horario E/S', 'Rango', 'Observaciones', 'Informado por', 'Estado'],
        [12, 13, 36, 12, 18, 18, 14, 14, 40, 20, 13],
        (incidences.noMarcaciones as NoMarcacion[]).map((x) => [
            formatDateCL(x.date), rutConGuion(x.rut), x.nombre, TERMINAL_ABBR[x.terminal_code] || x.terminal_code,
            x.cargo || '', x.incident_state || '', x.schedule_in_out || '', x.time_range || '',
            x.observations || '', x.informed_by || '', x.auth_status,
        ])
    );

    addIncidenceSheet(wb, 'CAMBIOS DE TURNO', startDate, endDate, generatedBy,
        ['Fecha', 'RUT', 'Nombre', 'Terminal', 'Prog. Original', 'Reprogramado', 'Día que Libera', 'Día que Trabaja', 'Estado'],
        [12, 13, 36, 12, 16, 16, 16, 16, 13],
        (incidences.cambiosDia as CambioDia[]).map((x) => [
            formatDateCL(x.date), rutConGuion(x.rut), x.nombre, TERMINAL_ABBR[x.terminal_code] || x.terminal_code,
            [x.prog_start, x.prog_end].filter(Boolean).join(' - '),
            [x.reprogram_start, x.reprogram_end].filter(Boolean).join(' - '),
            x.day_off_date ? formatDateCL(x.day_off_date) : '',
            x.day_on_date ? formatDateCL(x.day_on_date) : '',
            x.auth_status,
        ])
    );

    // ---- Descargar ----
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Asistencia_Semanal_${startDate}_a_${endDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}

// ==========================================
// Hoja de incidencias genérica
// ==========================================

function addIncidenceSheet(
    wb: ExcelJS.Workbook,
    name: string,
    startDate: string,
    endDate: string,
    generatedBy: string,
    headers: string[],
    widths: number[],
    rows: (string | number)[][]
): void {
    const ws = wb.addWorksheet(name, {
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    const lastCol = ws.getColumn(headers.length).letter;

    // Banner
    ws.mergeCells(`A1:${lastCol}1`);
    const t = ws.getCell('A1');
    t.value = name;
    t.fill = fill(C.navy);
    t.font = { name: 'Calibri', size: 14, bold: true, color: { argb: C.white } };
    t.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    ws.getRow(1).height = 24;

    ws.mergeCells(`A2:${lastCol}2`);
    const s = ws.getCell('A2');
    s.value = `Semana ${formatDateCL(startDate)} al ${formatDateCL(endDate)} · ${rows.length} registro(s) · Generado por ${generatedBy}`;
    s.fill = fill(C.navy);
    s.font = { name: 'Calibri', size: 9, color: { argb: 'FFB7C4E0' } };
    s.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    ws.getRow(2).height = 15;

    // Encabezado
    const hr = 4;
    headers.forEach((h, i) => {
        const cell = ws.getCell(hr, i + 1);
        cell.value = h;
        cell.fill = fill(C.headerBlue);
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.ink } };
        cell.alignment = center;
        cell.border = border(C.line);
    });
    ws.getRow(hr).height = 18;

    // Filas
    if (rows.length === 0) {
        ws.mergeCells(hr + 1, 1, hr + 1, headers.length);
        const empty = ws.getCell(hr + 1, 1);
        empty.value = 'Sin registros en la semana consultada';
        empty.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF9CA3AF' } };
        empty.alignment = center;
        empty.border = border();
        ws.getRow(hr + 1).height = 20;
    } else {
        rows.forEach((row, ri) => {
            const zebra = ri % 2 === 1 ? C.grayBg : C.white;
            row.forEach((v, ci) => {
                const cell = ws.getCell(hr + 1 + ri, ci + 1);
                cell.value = v;
                cell.border = border();
                cell.fill = fill(zebra);
                cell.alignment = ci === 2 || headers[ci].startsWith('Observa')
                    ? { horizontal: 'left', vertical: 'middle', indent: 1 }
                    : center;
                cell.font = { name: 'Calibri', size: 9, bold: ci === 2, color: { argb: C.ink } };
            });
            ws.getRow(hr + 1 + ri).height = 15;
        });
    }

    ws.views = [{ state: 'frozen', ySplit: hr }];
}
