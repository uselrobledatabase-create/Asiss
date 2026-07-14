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
import { ScheduleContext, resolveDay, dayNameShort, formatDateCL } from './scheduleEngine';

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
    // Turno base: el turno que la persona cubre habitualmente (mayoría del rango)
    const baseTurno = new Map<string, 'DIA' | 'NOCHE'>();
    const resolvedCache = new Map<string, ReturnType<typeof resolveDay>[]>();

    for (const s of activeStaff) {
        const days = dates.map((d) => resolveDay(s, d, ctx));
        resolvedCache.set(s.id, days);
        const nocheCount = days.filter((d) => d.turno === 'NOCHE').length;
        baseTurno.set(s.id, nocheCount > days.length / 2 ? 'NOCHE' : 'DIA');
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
    const gaps: CoverageGap[] = [];
    let combosAnalyzed = 0;

    for (const { code } of CONTROL_TERMINALS) {
        const inTerminal = activeStaff.filter((s) => s.terminal_code === code);
        if (inTerminal.length === 0) continue;

        // Combos existentes: cargo + turno con dotación en este terminal
        const combos = new Map<string, StaffWithShift[]>();
        for (const s of inTerminal) {
            const cargo = s.cargo.toUpperCase().trim();
            const turno = baseTurno.get(s.id)!;
            const key = `${cargo}|${turno}`;
            if (!combos.has(key)) combos.set(key, []);
            combos.get(key)!.push(s);
        }
        combosAnalyzed += combos.size;

        for (const [key, members] of combos) {
            const [cargo, turno] = key.split('|') as [string, 'DIA' | 'NOCHE'];

            for (let di = 0; di < dates.length; di++) {
                const date = dates[di];
                if (monthOnlyDates && !monthOnlyDates.has(date)) continue;

                const libres: string[] = [];
                const ausentes: string[] = [];
                let disponibles = 0;

                for (const m of members) {
                    const day = resolvedCache.get(m.id)![di];
                    if (day.status === 'TRABAJA') disponibles++;
                    else if (day.status === 'LIBRE') libres.push(m.nombre);
                    else ausentes.push(`${m.nombre} (${day.status.toLowerCase()})`);
                }

                if (disponibles === 0) {
                    const soloLibres = ausentes.length === 0;
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
                        message: soloLibres
                            ? members.length === 1
                                ? `${dayNameShort(date)} ${formatDateCL(date)} · ${terminalLabel(code)} · ${cargo} turno ${turno}: la única persona del grupo está LIBRE ese día. Debe quedar al menos 1 — corregir programación.`
                                : `${dayNameShort(date)} ${formatDateCL(date)} · ${terminalLabel(code)} · ${cargo} turno ${turno}: los ${members.length} del grupo están LIBRES ese día. Debe quedar al menos 1 — corregir programación.`
                            : `${dayNameShort(date)} ${formatDateCL(date)} · ${terminalLabel(code)} · ${cargo} turno ${turno}: sin cobertura (libres: ${libres.length}, ausentes: ${ausentes.length}). Debe quedar al menos 1 — corregir programación.`,
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
