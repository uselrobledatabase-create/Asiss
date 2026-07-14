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

/** Estado según el límite de 40 hrs semanales del período consultado */
export type HHEEEstado = 'OK' | 'PROXIMO' | 'SOBRE_LIMITE' | 'CRITICO';

export interface HHEEPersonRow {
    rut: string;
    nombre: string;
    cargo: string;                // cargo canónico (de la lista autorizada)
    terminal: string;             // resuelto contra dotación si es posible
    totalHoras: number;           // columna S del archivo
    estado: HHEEEstado;
}

export interface HHEECargoSummary {
    cargo: string;
    personas: number;
    totalHoras: number;
    promedio: number;
    maximo: number;
    maxPersona: string;
    sobreLimite: number;          // personas con >= 40 hrs
    proximos: number;             // personas con 30-39.9 hrs
    people: HHEEPersonRow[];      // ordenadas por horas desc
}

export interface HHEEAnalysis {
    fileName: string;
    sheetName: string;
    rowsRead: number;             // filas con RUT válido desde la fila 15
    excludedCargos: { cargo: string; count: number }[]; // cargos fuera de la lista
    people: HHEEPersonRow[];      // todas, ordenadas por horas desc
    cargos: HHEECargoSummary[];   // ordenados por total desc
    totalHoras: number;
    promedioPersona: number;
    sobreLimiteCount: number;
    criticoCount: number;
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
