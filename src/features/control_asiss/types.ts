/**
 * Control ASISS - Tipos
 * Módulo de revisión administrativa de asistencia (Leonel Cayuqueo)
 */

import { TerminalCode } from '../../shared/types/terminal';

// ==========================================
// PROGRAMACIÓN RESUELTA POR DÍA
// ==========================================

export type ResolvedDayStatus =
    | 'TRABAJA'
    | 'LIBRE'
    | 'LICENCIA'
    | 'VACACIONES'
    | 'PERMISO';

export interface ResolvedDay {
    date: string;                 // YYYY-MM-DD
    status: ResolvedDayStatus;
    turno: 'DIA' | 'NOCHE';
    horario: string;              // '' cuando no trabaja
}

// ==========================================
// COBERTURA / ALERTAS
// ==========================================

export type CoverageAlertLevel = 'CRITICAL' | 'WARNING';

export interface CoverageGap {
    id: string;
    date: string;
    terminal: string;
    cargo: string;
    turno: 'DIA' | 'NOCHE';
    level: CoverageAlertLevel;
    disponibles: number;
    dotacion: number;
    libres: string[];             // nombres en libre ese día
    ausentes: string[];           // nombres con licencia/vacaciones/permiso
    message: string;
}

export interface HeadcountCell {
    cargo: string;
    dia: number;
    noche: number;
    total: number;
}

export interface TerminalHeadcount {
    terminal: string;
    terminalLabel: string;
    cargos: HeadcountCell[];
    total: number;
}

export interface CoverageAnalysis {
    headcounts: TerminalHeadcount[];
    gaps: CoverageGap[];
    daysAnalyzed: number;
    combosAnalyzed: number;
}

// ==========================================
// HHEE (HORAS EXTRA)
// ==========================================

export interface HHEERecord {
    rut: string;
    nombre: string;
    fecha: string | null;         // YYYY-MM-DD si se pudo interpretar
    horas: number;
    origen: string;               // referencia fila del excel
}

export interface HHEEPersonSummary {
    rut: string;
    nombre: string;
    terminal: string;             // resuelto contra dotación si es posible
    cargo: string;
    totalHoras: number;
    registros: number;
    diasConExceso: number;        // días con más de 2 hrs (límite legal diario)
    maxHorasDia: number;
}

export interface HHEEAnalysis {
    fileName: string;
    sheetName: string;
    headerRow: number;
    columns: { rut: string; nombre?: string; fecha?: string; horas: string[] };
    records: HHEERecord[];
    people: HHEEPersonSummary[];
    totalHoras: number;
    rutsNoEncontrados: string[];  // ruts del excel que no están en la dotación
    warnings: string[];
}

// ==========================================
// CONSTANTES
// ==========================================

export const CONTROL_TERMINALS: { code: TerminalCode; label: string }[] = [
    { code: 'EL_ROBLE', label: 'El Roble' },
    { code: 'LA_REINA', label: 'La Reina' },
    { code: 'MARIA_ANGELICA', label: 'María Angélica' },
];

export const STATUS_LABELS: Record<ResolvedDayStatus, string> = {
    TRABAJA: 'Trabaja',
    LIBRE: 'Libre',
    LICENCIA: 'Licencia',
    VACACIONES: 'Vacaciones',
    PERMISO: 'Permiso',
};
