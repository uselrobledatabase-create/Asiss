/**
 * Control ASISS - Analizador de Excel de Horas Extra (HHEE)
 *
 * Lee un archivo Excel flexible: detecta automáticamente la fila de
 * encabezados y las columnas de RUT / Nombre / Fecha / Horas.
 * Soporta horas en decimal (1.5), texto HH:MM (01:30) y serial Excel.
 */

import * as XLSX from 'xlsx';
import { StaffWithShift } from '../../asistencia2026/types';
import { TERMINAL_LABELS, TerminalCode } from '../../../shared/types/terminal';
import { HHEEAnalysis, HHEEPersonSummary, HHEERecord } from '../types';

const RUT_HEADER = /rut/i;
const NAME_HEADER = /nombre|trabajador|funcionario|empleado/i;
const DATE_HEADER = /fecha|d[ií]a/i;
const HOURS_HEADER = /hh\s*\.?\s*ee|hora|extra|50\s*%|100\s*%|cantidad|total/i;

const DAILY_LEGAL_LIMIT = 2; // hrs extra máximas por día (referencia legal Chile)

export function normalizeRutKey(rut: string): string {
    return String(rut).replace(/[.\s-]/g, '').toUpperCase();
}

function cellText(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v).trim();
}

/** Convierte un valor de celda a horas decimales. Retorna null si no es interpretable. */
function parseHours(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;

    if (typeof v === 'number') {
        if (!isFinite(v) || v < 0) return null;
        // Serial de tiempo Excel: fracción de día (0.0625 = 1:30)
        if (v > 0 && v < 1) return Math.round(v * 24 * 100) / 100;
        // Números grandes no son horas (probablemente otra columna)
        if (v > 400) return null;
        return Math.round(v * 100) / 100;
    }

    const s = cellText(v).replace(',', '.');
    if (!s) return null;

    // Formato HH:MM
    const hm = s.match(/^(\d{1,3}):(\d{2})$/);
    if (hm) {
        return Math.round((parseInt(hm[1], 10) + parseInt(hm[2], 10) / 60) * 100) / 100;
    }

    const num = parseFloat(s);
    if (!isNaN(num) && num >= 0 && num <= 400) return Math.round(num * 100) / 100;
    return null;
}

/** Convierte celda a fecha YYYY-MM-DD si es posible. */
function parseDate(v: unknown): string | null {
    if (v === null || v === undefined || v === '') return null;

    if (typeof v === 'number' && v > 20000 && v < 70000) {
        // Serial de fecha Excel
        const parsed = XLSX.SSF.parse_date_code(v);
        if (parsed) {
            const mm = String(parsed.m).padStart(2, '0');
            const dd = String(parsed.d).padStart(2, '0');
            return `${parsed.y}-${mm}-${dd}`;
        }
    }

    const s = cellText(v);
    // DD-MM-YYYY o DD/MM/YYYY
    let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (m) {
        return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    // YYYY-MM-DD
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
        return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    }
    return null;
}

function looksLikeRut(s: string): boolean {
    return /^\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]$/.test(s.trim()) || /^\d{7,8}-?[\dkK]$/.test(s.trim());
}

export async function analyzeHHEEFile(
    file: File,
    staff: StaffWithShift[]
): Promise<HHEEAnalysis> {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false });

    const warnings: string[] = [];

    // Elegir la primera hoja con datos
    let sheetName = wb.SheetNames[0];
    let rows: unknown[][] = [];
    for (const name of wb.SheetNames) {
        const sheet = wb.Sheets[name];
        const parsed = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
        if (parsed.length > 1) {
            sheetName = name;
            rows = parsed;
            break;
        }
    }
    if (rows.length === 0) {
        throw new Error('El archivo no tiene datos legibles.');
    }

    // ---- Detectar fila de encabezados ----
    let headerRowIdx = -1;
    let rutCol = -1;
    let nameCol = -1;
    let dateCol = -1;
    let hourCols: number[] = [];
    let hourColNames: string[] = [];

    const scanLimit = Math.min(rows.length, 25);
    for (let i = 0; i < scanLimit; i++) {
        const row = rows[i] || [];
        const rutIdx = row.findIndex((c) => RUT_HEADER.test(cellText(c)));
        if (rutIdx === -1) continue;

        const hIdxs: number[] = [];
        const hNames: string[] = [];
        row.forEach((c, idx) => {
            const txt = cellText(c);
            if (idx !== rutIdx && txt && HOURS_HEADER.test(txt) && !NAME_HEADER.test(txt) && !DATE_HEADER.test(txt)) {
                hIdxs.push(idx);
                hNames.push(txt);
            }
        });

        if (hIdxs.length > 0) {
            headerRowIdx = i;
            rutCol = rutIdx;
            hourCols = hIdxs;
            hourColNames = hNames;
            nameCol = row.findIndex((c) => NAME_HEADER.test(cellText(c)));
            dateCol = row.findIndex((c) => DATE_HEADER.test(cellText(c)));
            break;
        }
    }

    if (headerRowIdx === -1) {
        throw new Error(
            'No se encontró una fila de encabezados con columnas RUT y HORAS/HHEE. ' +
            'Verifica que el Excel tenga una columna "RUT" y al menos una columna de horas (ej: "HHEE", "Horas Extra", "50%", "100%").'
        );
    }

    // ---- Mapa de dotación por RUT ----
    const staffByRut = new Map<string, StaffWithShift>();
    for (const s of staff) {
        staffByRut.set(normalizeRutKey(s.rut), s);
    }

    // ---- Leer registros ----
    const records: HHEERecord[] = [];
    const rutsNoEncontrados = new Set<string>();

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i] || [];
        const rutRaw = cellText(row[rutCol]);
        if (!rutRaw) continue;
        if (!looksLikeRut(rutRaw)) {
            // filas de totales u otros textos
            continue;
        }

        let totalRow = 0;
        let anyHours = false;
        for (const hc of hourCols) {
            const h = parseHours(row[hc]);
            if (h !== null) {
                totalRow += h;
                anyHours = true;
            }
        }
        if (!anyHours || totalRow <= 0) continue;

        const rutKey = normalizeRutKey(rutRaw);
        const matched = staffByRut.get(rutKey);
        if (!matched) rutsNoEncontrados.add(rutRaw);

        records.push({
            rut: rutRaw,
            nombre: matched?.nombre || (nameCol >= 0 ? cellText(row[nameCol]) : '') || rutRaw,
            fecha: dateCol >= 0 ? parseDate(row[dateCol]) : null,
            horas: Math.round(totalRow * 100) / 100,
            origen: `Fila ${i + 1}`,
        });
    }

    if (records.length === 0) {
        warnings.push('Se detectaron los encabezados pero ninguna fila con RUT válido y horas > 0.');
    }

    // ---- Resumen por persona ----
    const byPerson = new Map<string, HHEEPersonSummary & { _dayHours: Map<string, number> }>();

    for (const rec of records) {
        const key = normalizeRutKey(rec.rut);
        const matched = staffByRut.get(key);

        if (!byPerson.has(key)) {
            byPerson.set(key, {
                rut: matched?.rut || rec.rut,
                nombre: matched?.nombre || rec.nombre,
                terminal: matched
                    ? (TERMINAL_LABELS[matched.terminal_code as TerminalCode] || matched.terminal_code)
                    : 'No encontrado',
                cargo: matched?.cargo?.toUpperCase() || '—',
                totalHoras: 0,
                registros: 0,
                diasConExceso: 0,
                maxHorasDia: 0,
                _dayHours: new Map(),
            });
        }

        const p = byPerson.get(key)!;
        p.totalHoras = Math.round((p.totalHoras + rec.horas) * 100) / 100;
        p.registros++;
        if (rec.fecha) {
            const acc = (p._dayHours.get(rec.fecha) || 0) + rec.horas;
            p._dayHours.set(rec.fecha, acc);
        } else {
            // sin fecha: tratar el registro como un "día" individual
            p.maxHorasDia = Math.max(p.maxHorasDia, rec.horas);
            if (rec.horas > DAILY_LEGAL_LIMIT) p.diasConExceso++;
        }
    }

    const people: HHEEPersonSummary[] = Array.from(byPerson.values()).map((p) => {
        for (const h of p._dayHours.values()) {
            p.maxHorasDia = Math.max(p.maxHorasDia, h);
            if (h > DAILY_LEGAL_LIMIT) p.diasConExceso++;
        }
        const { _dayHours, ...rest } = p;
        void _dayHours;
        return rest;
    });

    people.sort((a, b) => b.totalHoras - a.totalHoras);

    const totalHoras = Math.round(people.reduce((acc, p) => acc + p.totalHoras, 0) * 100) / 100;

    if (rutsNoEncontrados.size > 0) {
        warnings.push(
            `${rutsNoEncontrados.size} RUT(s) del Excel no están en la dotación activa (se incluyen igual en el análisis).`
        );
    }

    return {
        fileName: file.name,
        sheetName,
        headerRow: headerRowIdx + 1,
        columns: {
            rut: `Col ${rutCol + 1}`,
            nombre: nameCol >= 0 ? `Col ${nameCol + 1}` : undefined,
            fecha: dateCol >= 0 ? `Col ${dateCol + 1}` : undefined,
            horas: hourColNames,
        },
        records,
        people,
        totalHoras,
        rutsNoEncontrados: Array.from(rutsNoEncontrados),
        warnings,
    };
}

export { DAILY_LEGAL_LIMIT };
