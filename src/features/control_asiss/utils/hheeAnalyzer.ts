/**
 * Control ASISS - Analizador de Excel de Horas Extra (HHEE)
 *
 * Layout fijo del archivo oficial:
 * - Los datos parten en la FILA 15 hacia abajo
 * - Columna A: RUT · Columna B: Nombre · Columna C: Cargo
 * - Columna S: Total de HHEE del período consultado
 *
 * Solo se analizan los cargos autorizados (lista CARGOS_HHEE). El resto
 * se reporta como excluido para transparencia.
 *
 * Límite de referencia: 40 horas semanales. Puede superarse solo de
 * forma condicional según necesidad operacional, por eso se alerta
 * desde las 40 hrs.
 */

import * as XLSX from 'xlsx';
import { StaffWithShift } from '../../asistencia2026/types';
import { TERMINAL_LABELS, TerminalCode } from '../../../shared/types/terminal';
import { HHEEAnalysis, HHEECargoSummary, HHEEEstado, HHEEPersonRow } from '../types';

// ---- Layout fijo ----
const DATA_START_ROW = 14;  // índice 0-based → fila 15 del Excel
const COL_RUT = 0;          // A
const COL_NOMBRE = 1;       // B
const COL_CARGO = 2;        // C
const COL_TOTAL = 18;       // S

// ---- Límites (horas del período consultado) ----
export const HHEE_LIMITE_SEMANAL = 40;  // límite semanal — superable solo por necesidad operacional
export const HHEE_UMBRAL_PROXIMO = 30;  // aviso preventivo
export const HHEE_UMBRAL_CRITICO = 60;  // exceso severo

/** Cargos autorizados para el análisis (orden oficial de presentación) */
export const CARGOS_HHEE = [
    'SUPERVISOR DE PATIO 1',
    'SUPERVISOR DE PATIO 2',
    'SUPERVISOR DE PATIO 3',
    'INSPECTOR DE PATIO 1',
    'INSPECTOR DE PATIO 2',
    'INSPECTOR DE PATIO 3',
    'PLANILLERO',
    'CLEANER',
    'MOVILIZADOR DE PATIO 3',
    'CONDUCTOR DE PATIO 1',
    'CONDUCTOR DE PATIO 2',
] as const;

export function normalizeRutKey(rut: string): string {
    return String(rut).replace(/[.\s-]/g, '').toUpperCase();
}

function cellText(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v).trim();
}

/** Normaliza cargo: mayúsculas, sin tildes, espacios colapsados, sin "DE" */
function normalizeCargo(cargo: string): string {
    return cellText(cargo)
        .toUpperCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w && w !== 'DE' && w !== 'DEL')
        .join(' ');
}

const CARGO_CANONICO = new Map<string, string>(
    CARGOS_HHEE.map((c) => [normalizeCargo(c), c])
);

function matchCargo(cargoRaw: string): string | null {
    return CARGO_CANONICO.get(normalizeCargo(cargoRaw)) ?? null;
}

function looksLikeRut(s: string): boolean {
    return /^\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]$/.test(s.trim()) || /^\d{7,8}-?[\dkK]$/.test(s.trim());
}

/**
 * Convierte la celda de Total HHEE (columna S) a horas decimales.
 *
 * CLAVE: Excel guarda duraciones como serial numérico donde la parte
 * ENTERA son DÍAS y la parte decimal es la fracción del día. Por eso
 * "41:14:16" se almacena como ~1.7182 (1 día = 24 hrs + 17:14:16).
 * Cuando la celda tiene formato de tiempo se debe leer el valor
 * numérico ORIGINAL y multiplicarlo por 24 (cada día suma 24 horas),
 * NUNCA interpretarlo como fecha ni como horas decimales directas.
 */
function parseDurationCell(cell: XLSX.CellObject | undefined): number | null {
    if (!cell || cell.v === null || cell.v === undefined || cell.v === '') return null;

    // Celda numérica: decidir por el FORMATO si es duración serial o decimal
    if (cell.t === 'n' && typeof cell.v === 'number') {
        const v = cell.v;
        if (!isFinite(v) || v < 0) return null;

        const fmt = String(cell.z ?? '');
        const shown = String(cell.w ?? '');
        // Formato de tiempo: [h]:mm:ss, hh:mm, h:mm:ss, etc. — o el texto
        // visible parece duración H:MM
        const isTimeFormat =
            (/[hH]/.test(fmt) && fmt.includes(':')) ||
            /^\d{1,4}:\d{2}(:\d{2})?$/.test(shown);

        if (isTimeFormat) {
            // Serial de duración: días completos × 24 + fracción del día en horas
            const horas = v * 24;
            if (horas > 744) return null; // más de un mes: dato corrupto
            return Math.round(horas * 100) / 100;
        }

        // Sin formato de tiempo: horas decimales directas
        if (v <= 744) return Math.round(v * 100) / 100;
        return null;
    }

    // Celda fecha (si el archivo se leyó con cellDates): convertir desde epoca 1900
    if (cell.t === 'd' && cell.v instanceof Date) {
        const epoch = Date.UTC(1899, 11, 30); // día 0 de Excel
        const dias = (cell.v.getTime() - epoch) / 86400000;
        if (dias < 0 || dias * 24 > 744) return null;
        return Math.round(dias * 24 * 100) / 100;
    }

    // Texto: "41:14:16", "42:30" o decimal
    const s = cellText(cell.v).replace(',', '.');
    if (!s) return null;

    const hms = s.match(/^(\d{1,4}):(\d{2})(?::(\d{2}))?$/);
    if (hms) {
        const horas = parseInt(hms[1], 10) + parseInt(hms[2], 10) / 60 + (hms[3] ? parseInt(hms[3], 10) / 3600 : 0);
        return Math.round(horas * 100) / 100;
    }

    const num = parseFloat(s);
    if (!isNaN(num) && num >= 0 && num <= 744) return Math.round(num * 100) / 100;
    return null;
}

/** Formatea horas decimales como duración H:MM (ej: 41.24 → "41:14") */
export function formatHorasHM(horas: number): string {
    const h = Math.floor(horas);
    const m = Math.round((horas - h) * 60);
    if (m === 60) return `${h + 1}:00`;
    return `${h}:${String(m).padStart(2, '0')}`;
}

function estadoDe(horas: number): HHEEEstado {
    if (horas >= HHEE_UMBRAL_CRITICO) return 'CRITICO';
    if (horas >= HHEE_LIMITE_SEMANAL) return 'SOBRE_LIMITE';
    if (horas >= HHEE_UMBRAL_PROXIMO) return 'PROXIMO';
    return 'OK';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function analyzeHHEEFile(
    file: File,
    staff: StaffWithShift[]
): Promise<HHEEAnalysis> {
    const buffer = await file.arrayBuffer();
    // cellNF: true para leer el formato de cada celda y detectar duraciones
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false, cellNF: true });

    const warnings: string[] = [];

    // Elegir la primera hoja que tenga datos más allá de la fila 15
    let sheetName = wb.SheetNames[0];
    let rows: unknown[][] = [];
    let sheet: XLSX.WorkSheet = wb.Sheets[sheetName];
    for (const name of wb.SheetNames) {
        const parsed = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '' });
        if (parsed.length > DATA_START_ROW) {
            sheetName = name;
            rows = parsed;
            sheet = wb.Sheets[name];
            break;
        }
    }
    if (rows.length <= DATA_START_ROW) {
        throw new Error(
            `El archivo no tiene datos desde la fila ${DATA_START_ROW + 1}. ` +
            'Verifica que sea el Excel oficial de HHEE (datos desde la fila 15: A=RUT, B=Nombre, C=Cargo, S=Total HHEE).'
        );
    }

    // ---- Dotación por RUT (para terminal) ----
    const staffByRut = new Map<string, StaffWithShift>();
    for (const s of staff) {
        staffByRut.set(normalizeRutKey(s.rut), s);
    }

    // ---- Leer filas desde la fila 15 ----
    const people: HHEEPersonRow[] = [];
    const excludedMap = new Map<string, number>();
    const rutsNoEncontrados = new Set<string>();
    const seenRuts = new Map<string, number>(); // rut → índice en people (consolida duplicados)
    let rowsRead = 0;

    for (let i = DATA_START_ROW; i < rows.length; i++) {
        const row = rows[i] || [];
        const rutRaw = cellText(row[COL_RUT]);
        if (!rutRaw || !looksLikeRut(rutRaw)) continue; // filas vacías, totales o texto

        rowsRead++;

        const cargoRaw = cellText(row[COL_CARGO]);
        const cargo = matchCargo(cargoRaw);
        if (!cargo) {
            const key = cargoRaw ? cargoRaw.toUpperCase() : '(SIN CARGO)';
            excludedMap.set(key, (excludedMap.get(key) || 0) + 1);
            continue;
        }

        // Leer la celda CRUDA de la columna S (con su formato) para
        // interpretar correctamente las duraciones seriales de Excel
        const totalCell = sheet[XLSX.utils.encode_cell({ r: i, c: COL_TOTAL })] as XLSX.CellObject | undefined;
        const horas = parseDurationCell(totalCell) ?? 0;

        const rutKey = normalizeRutKey(rutRaw);
        const matched = staffByRut.get(rutKey);
        if (!matched) rutsNoEncontrados.add(rutRaw);

        const nombre = matched?.nombre || cellText(row[COL_NOMBRE]) || rutRaw;
        const terminal = matched
            ? (TERMINAL_LABELS[matched.terminal_code as TerminalCode] || matched.terminal_code)
            : '—';

        // Duplicado del mismo RUT: sumar horas (algunas planillas repiten fila)
        if (seenRuts.has(rutKey)) {
            const idx = seenRuts.get(rutKey)!;
            people[idx].totalHoras = round2(people[idx].totalHoras + horas);
            people[idx].estado = estadoDe(people[idx].totalHoras);
            continue;
        }

        seenRuts.set(rutKey, people.length);
        people.push({
            rut: matched?.rut || rutRaw,
            nombre,
            cargo,
            terminal,
            totalHoras: round2(horas),
            estado: estadoDe(horas),
        });
    }

    if (people.length === 0) {
        throw new Error(
            'No se encontró ninguna fila con RUT válido y cargo autorizado desde la fila 15. ' +
            'Revisa que la columna C tenga los cargos oficiales (ej: SUPERVISOR DE PATIO 1, PLANILLERO, CLEANER…).'
        );
    }

    people.sort((a, b) => b.totalHoras - a.totalHoras);

    // ---- Resumen por cargo (orden oficial, luego por total desc) ----
    const cargos: HHEECargoSummary[] = CARGOS_HHEE
        .map((cargo): HHEECargoSummary | null => {
            const del = people.filter((p) => p.cargo === cargo);
            if (del.length === 0) return null;
            const total = round2(del.reduce((acc, p) => acc + p.totalHoras, 0));
            const top = del[0]; // ya vienen ordenadas desc
            return {
                cargo,
                personas: del.length,
                totalHoras: total,
                promedio: round2(total / del.length),
                maximo: top.totalHoras,
                maxPersona: top.nombre,
                sobreLimite: del.filter((p) => p.totalHoras >= HHEE_LIMITE_SEMANAL).length,
                proximos: del.filter((p) => p.estado === 'PROXIMO').length,
                people: del,
            };
        })
        .filter((c): c is HHEECargoSummary => c !== null)
        .sort((a, b) => b.totalHoras - a.totalHoras);

    const totalHoras = round2(people.reduce((acc, p) => acc + p.totalHoras, 0));
    const sobreLimiteCount = people.filter((p) => p.totalHoras >= HHEE_LIMITE_SEMANAL).length;
    const criticoCount = people.filter((p) => p.estado === 'CRITICO').length;

    if (rutsNoEncontrados.size > 0) {
        warnings.push(
            `${rutsNoEncontrados.size} RUT(s) del archivo no están en la dotación activa (se analizan igual, sin terminal).`
        );
    }

    const excludedCargos = Array.from(excludedMap.entries())
        .map(([cargo, count]) => ({ cargo, count }))
        .sort((a, b) => b.count - a.count);

    if (excludedCargos.length > 0) {
        const totalExcluded = excludedCargos.reduce((acc, e) => acc + e.count, 0);
        warnings.push(
            `${totalExcluded} fila(s) excluida(s) por cargo fuera de la lista autorizada.`
        );
    }

    return {
        fileName: file.name,
        sheetName,
        rowsRead,
        excludedCargos,
        people,
        cargos,
        totalHoras,
        promedioPersona: round2(totalHoras / people.length),
        sobreLimiteCount,
        criticoCount,
        rutsNoEncontrados: Array.from(rutsNoEncontrados),
        warnings,
    };
}
