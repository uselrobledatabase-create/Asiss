/**
 * Control ASISS - Análisis de cobertura mensual
 *
 * Regla principal (solicitada por administración de asistencia):
 * para cada TERMINAL + CARGO + TURNO (DIA/NOCHE) que tenga dotación,
 * cada día del mes debe haber AL MENOS 1 persona citada a trabajar.
 * Si todos están libres (o ausentes por licencia/vacaciones/permiso),
 * se genera una alerta para obligar a corregir la programación.
 */

import { StaffWithShift } from '../../asistencia2026/types';
import { TERMINAL_LABELS, TerminalCode } from '../../../shared/types/terminal';
import {
    CoverageAnalysis,
    CoverageGap,
    HeadcountCell,
    TerminalHeadcount,
    CONTROL_TERMINALS,
} from '../types';
import { getTurnoFromHorario } from '../../asistencia2026/utils/shiftEngine';
import { ScheduleContext, resolveDay, dayNameShort, formatDateCL } from './scheduleEngine';

/**
 * Turno según la ASIGNACIÓN DE LA FICHA del trabajador (campo `turno`):
 * "Mañana"/"Tarde"/"Rotativo" → DIA · "Noche" → NOCHE.
 * Solo si la ficha no tiene turno se deduce del horario.
 */
export function turnoDeFicha(turno: string | undefined, horario?: string): 'DIA' | 'NOCHE' {
    const t = (turno || '').trim().toUpperCase();
    if (t.includes('NOCHE') || t.includes('NIGHT')) return 'NOCHE';
    if (t.length > 0) return 'DIA'; // Mañana, Tarde, Rotativo, Día
    return getTurnoFromHorario(horario || '');
}

const CARGO_SORT = ['SUPERVISOR', 'INSPECTOR', 'CONDUCTOR', 'PLANILLERO', 'CLEANER'];

function cargoOrder(cargo: string): number {
    const idx = CARGO_SORT.findIndex((c) => cargo.toUpperCase().includes(c));
    return idx === -1 ? CARGO_SORT.length : idx;
}

function terminalLabel(code: string): string {
    return TERMINAL_LABELS[code as TerminalCode] || code;
}

export function analyzeCoverage(
    staff: StaffWithShift[],
    dates: string[],
    ctx: ScheduleContext,
    monthOnlyDates?: Set<string> // si se entrega, solo alerta sobre estas fechas
): CoverageAnalysis {
    const terminals = CONTROL_TERMINALS.map((t) => t.code as string);
    const activeStaff = staff.filter(
        (s) => s.status === 'ACTIVO' && terminals.includes(s.terminal_code)
    );

    // ---------- Q del personal (dotación) ----------
    // Turno: SIEMPRE según la asignación de la ficha del trabajador
    // (Mañana = DIA, Noche = NOCHE), nunca deducido de la programación.
    const baseTurno = new Map<string, 'DIA' | 'NOCHE'>();
    const resolvedCache = new Map<string, ReturnType<typeof resolveDay>[]>();

    for (const s of activeStaff) {
        resolvedCache.set(s.id, dates.map((d) => resolveDay(s, d, ctx)));
        baseTurno.set(s.id, turnoDeFicha(s.turno, s.horario));
    }

    const headcounts: TerminalHeadcount[] = CONTROL_TERMINALS.map(({ code, label }) => {
        const inTerminal = activeStaff.filter((s) => s.terminal_code === code);
        const byCargo = new Map<string, HeadcountCell>();

        for (const s of inTerminal) {
            const cargo = s.cargo.toUpperCase().trim();
            if (!byCargo.has(cargo)) {
                byCargo.set(cargo, { cargo, dia: 0, noche: 0, total: 0 });
            }
            const cell = byCargo.get(cargo)!;
            if (baseTurno.get(s.id) === 'NOCHE') cell.noche++;
            else cell.dia++;
            cell.total++;
        }

        const cargos = Array.from(byCargo.values()).sort(
            (a, b) => cargoOrder(a.cargo) - cargoOrder(b.cargo) || a.cargo.localeCompare(b.cargo)
        );

        return {
            terminal: code,
            terminalLabel: label,
            cargos,
            total: inTerminal.length,
        };
    });

    // ---------- Alertas de cobertura ----------
    // La cobertura se evalúa por el TURNO RESUELTO de cada día (no por la
    // ficha): un rotativo/relevo que cubre la noche un martes cuenta en
    // NOCHE ese martes. Así se eliminan las falsas alertas.
    const gaps: CoverageGap[] = [];
    let combosAnalyzed = 0;

    for (const { code } of CONTROL_TERMINALS) {
        const inTerminal = activeStaff.filter((s) => s.terminal_code === code);
        if (inTerminal.length === 0) continue;

        const cargosSet = Array.from(new Set(inTerminal.map((s) => s.cargo.toUpperCase().trim())));

        const combos: { cargo: string; turno: 'DIA' | 'NOCHE'; members: StaffWithShift[] }[] = [];
        for (const cargo of cargosSet) {
            const delCargo = inTerminal.filter((s) => s.cargo.toUpperCase().trim() === cargo);
            for (const turno of ['DIA', 'NOCHE'] as const) {
                // El combo existe solo si alguien del cargo TRABAJA ese turno
                // al menos un día del período (dotación dinámica real)
                const cubre = delCargo.filter((m) =>
                    resolvedCache.get(m.id)!.some((d) => d.status === 'TRABAJA' && d.turno === turno)
                );
                if (cubre.length === 0) continue;
                combos.push({ cargo, turno, members: delCargo });
            }
        }
        combosAnalyzed += combos.length;

        for (const { cargo, turno, members } of combos) {
            for (let di = 0; di < dates.length; di++) {
                const date = dates[di];
                if (monthOnlyDates && !monthOnlyDates.has(date)) continue;

                const libres: string[] = [];
                const ausentes: string[] = [];
                let disponibles = 0;

                for (const m of members) {
                    const day = resolvedCache.get(m.id)![di];
                    if (day.status === 'TRABAJA' && day.turno === turno) disponibles++;
                    else if (day.status === 'TRABAJA') { /* trabaja el otro turno */ }
                    else if (day.status === 'LIBRE') libres.push(m.nombre);
                    else ausentes.push(`${m.nombre} (${day.status.toLowerCase()})`);
                }

                if (disponibles === 0) {
                    gaps.push({
                        id: `${date}-${code}-${cargo}-${turno}`,
                        date,
                        terminal: code,
                        cargo,
                        turno,
                        level: 'CRITICAL',
                        disponibles: 0,
                        dotacion: members.length,
                        libres,
                        ausentes,
                        message: `${dayNameShort(date)} ${formatDateCL(date)} · ${terminalLabel(code)} · ${cargo}: NADIE cubre el turno ${turno} ese día (libres: ${libres.length}${ausentes.length ? ` · ausentes: ${ausentes.length}` : ''}). Debe quedar al menos 1 — corregir programación.`,
                    });
                } else if (disponibles === 1 && members.length > 1 && ausentes.length > 0) {
                    // Cobertura mínima sostenida solo por 1 persona con ausencias en el grupo
                    gaps.push({
                        id: `${date}-${code}-${cargo}-${turno}-W`,
                        date,
                        terminal: code,
                        cargo,
                        turno,
                        level: 'WARNING',
                        disponibles: 1,
                        dotacion: members.length,
                        libres,
                        ausentes,
                        message: `${dayNameShort(date)} ${formatDateCL(date)} · ${terminalLabel(code)} · ${cargo} turno ${turno}: queda solo 1 disponible (dotación ${members.length}, con ausencias). Revisar respaldo.`,
                    });
                }
            }
        }
    }

    gaps.sort((a, b) => {
        if (a.level !== b.level) return a.level === 'CRITICAL' ? -1 : 1;
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.terminal !== b.terminal) return a.terminal.localeCompare(b.terminal);
        return cargoOrder(a.cargo) - cargoOrder(b.cargo);
    });

    return {
        headcounts,
        gaps,
        daysAnalyzed: monthOnlyDates ? monthOnlyDates.size : dates.length,
        combosAnalyzed,
    };
}
