/**
 * Control ASISS - Reglas de programación mensual y sugerencias de cobertura
 *
 * REGLAS ABSOLUTAS (no negociables):
 * 1. Nadie puede trabajar MÁS DE 6 DÍAS SEGUIDOS, por ningún motivo.
 * 2. Mínimo 2 DOMINGOS LIBRES al mes, obligatorio.
 * 3. Un cambio de día JAMÁS puede caer sobre un domingo que el
 *    trabajador tenga de descanso.
 *
 * Además: si el colaborador tiene fecha de inicio (start_date del
 * turno), la programación parte desde ese día; los anteriores van "-".
 */

import { StaffWithShift, StaffShiftOverride } from '../../asistencia2026/types';
import { ScheduleContext, resolveDay, resolveDayPattern, getDateRange, formatDateCL, dayNameShort } from './scheduleEngine';
import { turnoDeFicha } from './coverageAnalysis';

// ---- Clave de autorización de cambios de turno (oculta) ----
const CLAVE_B64 = 'QUxGQUJFVDIwMjY=';
export function validarClaveTurnos(input: string): boolean {
    try {
        return input.trim() === atob(CLAVE_B64);
    } catch {
        return false;
    }
}

// ==========================================
// PLAN MENSUAL POR PERSONA
// ==========================================

export type PlanStatus = 'TRABAJA' | 'LIBRE' | 'PRE_INICIO';

export interface DayPlan {
    date: string;
    status: PlanStatus;
    horario: string;
    turno: 'DIA' | 'NOCHE';
    /** true si hay un ajuste manual (override) aplicado ese día */
    overridden: boolean;
    isSunday: boolean;
}

export type OverridePatch = Map<string, 'OFF' | 'WORK' | null>; // date → forzado (null = quitar ajuste)

/** Contexto con overrides parchados para simulaciones */
function patchContext(ctx: ScheduleContext, staffId: string, patch?: OverridePatch): ScheduleContext {
    if (!patch || patch.size === 0) return ctx;

    const overrides: StaffShiftOverride[] = ctx.overrides.filter(
        (o) => !(o.staff_id === staffId && patch.has(o.override_date))
    );
    for (const [date, type] of patch) {
        if (type !== null) {
            overrides.push({
                id: `patch-${staffId}-${date}`,
                staff_id: staffId,
                override_date: date,
                override_type: type,
                meta_json: {},
                created_at: '',
            });
        }
    }
    return { ...ctx, overrides };
}

/** Programación limpia (solo turno) de un rango, respetando fecha de inicio */
export function buildPlan(
    staff: StaffWithShift,
    ctx: ScheduleContext,
    dates: string[],
    patch?: OverridePatch
): DayPlan[] {
    const pctx = patchContext(ctx, staff.id, patch);
    const startDate = staff.shift?.start_date || '';

    return dates.map((date) => {
        const isSunday = new Date(date + 'T12:00:00').getDay() === 0;
        if (startDate && date < startDate) {
            return { date, status: 'PRE_INICIO' as const, horario: '', turno: 'DIA' as const, overridden: false, isSunday };
        }
        const day = resolveDayPattern(staff, date, pctx);
        const overridden = pctx.overrides.some(
            (o) => o.staff_id === staff.id && o.override_date === date
        );
        return {
            date,
            status: day.status === 'TRABAJA' ? 'TRABAJA' as const : 'LIBRE' as const,
            horario: day.horario,
            turno: day.turno,
            overridden,
            isSunday,
        };
    });
}

// ==========================================
// VALIDACIÓN DE REGLAS
// ==========================================

export interface RuleCheck {
    ok: boolean;
    maxRun: number;            // racha máxima de días seguidos trabajando
    sundaysLibres: number;     // domingos libres del mes (desde el inicio)
    sundaysRequired: number;   // domingos libres exigidos
    violations: string[];      // reglas absolutas violadas
}

function monthBounds(year: number, month: number): { start: string; end: string } {
    const mm = String(month + 1).padStart(2, '0');
    const last = new Date(year, month + 1, 0).getDate();
    return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(last).padStart(2, '0')}` };
}

function shiftDate(date: string, days: number): string {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Valida las reglas absolutas del mes para una persona, con un parche
 * de ajustes opcional (para simular antes de guardar). Analiza una
 * ventana extendida (±6 días) para detectar rachas que cruzan de mes.
 */
export function checkRules(
    staff: StaffWithShift,
    ctx: ScheduleContext,
    year: number,
    month: number,
    patch?: OverridePatch
): RuleCheck {
    const { start, end } = monthBounds(year, month);
    const extDates = getDateRange(shiftDate(start, -6), shiftDate(end, 6));
    const plan = buildPlan(staff, ctx, extDates, patch);

    // Regla 1: racha máxima de trabajo que TOQUE el mes
    let maxRun = 0;
    let run = 0;
    let runTouchesMonth = false;
    for (const day of plan) {
        if (day.status === 'TRABAJA') {
            run++;
            if (day.date >= start && day.date <= end) runTouchesMonth = true;
        } else {
            if (runTouchesMonth) maxRun = Math.max(maxRun, run);
            run = 0;
            runTouchesMonth = false;
        }
    }
    if (runTouchesMonth) maxRun = Math.max(maxRun, run);

    // Regla 2: domingos libres del mes (considerando fecha de inicio)
    const startDate = staff.shift?.start_date || '';
    const monthPlan = plan.filter((d) => d.date >= start && d.date <= end);
    const sundays = monthPlan.filter((d) => d.isSunday && (!startDate || d.date >= startDate));
    const sundaysLibres = sundays.filter((d) => d.status === 'LIBRE').length;
    const sundaysRequired = Math.min(2, sundays.length);

    const violations: string[] = [];
    if (maxRun > 6) {
        violations.push(`Quedaría con ${maxRun} días seguidos de trabajo (máximo absoluto: 6).`);
    }
    if (sundaysLibres < sundaysRequired) {
        violations.push(`Quedaría con ${sundaysLibres} domingo(s) libre(s) en el mes (mínimo obligatorio: ${sundaysRequired}).`);
    }

    return { ok: violations.length === 0, maxRun, sundaysLibres, sundaysRequired, violations };
}

/**
 * Valida un ajuste puntual de día (cambio de día). Aplica además la
 * regla 3: prohibido forzar TRABAJO sobre un domingo de descanso.
 */
export function checkDayOverride(
    staff: StaffWithShift,
    ctx: ScheduleContext,
    year: number,
    month: number,
    date: string,
    type: 'OFF' | 'WORK' | null
): RuleCheck {
    const isSunday = new Date(date + 'T12:00:00').getDay() === 0;

    if (type === 'WORK' && isSunday) {
        const natural = resolveDayPattern(staff, date, {
            ...ctx,
            overrides: ctx.overrides.filter(
                (o) => !(o.staff_id === staff.id && o.override_date === date)
            ),
        });
        if (natural.status !== 'TRABAJA') {
            return {
                ok: false,
                maxRun: 0,
                sundaysLibres: 0,
                sundaysRequired: 0,
                violations: [
                    `El ${formatDateCL(date)} es un DOMINGO DE DESCANSO del trabajador: un cambio de día jamás puede caer sobre él.`,
                ],
            };
        }
    }

    const patch: OverridePatch = new Map([[date, type]]);
    return checkRules(staff, ctx, year, month, patch);
}

// ==========================================
// SUGERENCIAS DE COBERTURA PARA BRECHAS
// ==========================================

export interface GapSuggestion {
    staffId: string;
    nombre: string;
    tipo: 'CAMBIO_DIA' | 'HORAS_EXTRA';
    trabajaDate: string;
    liberaDate?: string;
    detail: string;
}

const cargoKey = (c: string) => c.toUpperCase().trim();

/**
 * Para una brecha (fecha + terminal + cargo + turno sin cobertura),
 * propone candidatos del mismo grupo que están LIBRES ese día y que
 * pueden cubrirlo SIN violar ninguna regla absoluta:
 * - CAMBIO_DIA: trabaja la fecha de la brecha y libera otro día de la
 *   misma semana donde el grupo quede con cobertura.
 * - HORAS_EXTRA: si no hay día liberable, cubrir con horas extra.
 */
export function buildGapSuggestions(
    gap: { date: string; terminal: string; cargo: string; turno: 'DIA' | 'NOCHE' },
    staff: StaffWithShift[],
    ctx: ScheduleContext,
    year: number,
    month: number
): GapSuggestion[] {
    const group = staff.filter(
        (s) =>
            s.status === 'ACTIVO' &&
            s.terminal_code === gap.terminal &&
            cargoKey(s.cargo) === cargoKey(gap.cargo) &&
            turnoDeFicha(s.turno, s.horario) === gap.turno
    );

    // Semana Lun-Dom de la brecha
    const gapD = new Date(gap.date + 'T12:00:00');
    const monday = shiftDate(gap.date, -((gapD.getDay() + 6) % 7));
    const weekDates = getDateRange(monday, shiftDate(monday, 6));

    // Disponibilidad del grupo por día de la semana (estado real con ausencias)
    const availability = new Map<string, number>();
    for (const d of weekDates) {
        availability.set(
            d,
            group.filter((s) => resolveDay(s, d, ctx).status === 'TRABAJA').length
        );
    }

    const suggestions: GapSuggestion[] = [];

    for (const cand of group) {
        // Debe estar LIBRE (por patrón, sin ausencias) el día de la brecha
        if (resolveDay(cand, gap.date, ctx).status !== 'LIBRE') continue;

        // Regla 3: nunca sobre su domingo de descanso
        const workCheck = checkDayOverride(cand, ctx, year, month, gap.date, 'WORK');
        if (gapD.getDay() === 0 || !workCheck.ok) {
            continue; // domingo de descanso o rompe reglas: no es candidato
        }

        // Buscar día de la semana para liberar: trabaja ese día, el grupo
        // queda con ≥1 disponible sin él, y liberar no rompe sus reglas
        let bestLibera: { date: string; remaining: number } | null = null;
        for (const d of weekDates) {
            if (d === gap.date) continue;
            if (resolveDay(cand, d, ctx).status !== 'TRABAJA') continue;
            const remaining = (availability.get(d) || 0) - 1;
            if (remaining < 1) continue;
            const patch: OverridePatch = new Map<string, 'OFF' | 'WORK' | null>([[gap.date, 'WORK'], [d, 'OFF']]);
            if (!checkRules(cand, ctx, year, month, patch).ok) continue;
            if (!bestLibera || remaining > bestLibera.remaining) {
                bestLibera = { date: d, remaining };
            }
        }

        if (bestLibera) {
            suggestions.push({
                staffId: cand.id,
                nombre: cand.nombre,
                tipo: 'CAMBIO_DIA',
                trabajaDate: gap.date,
                liberaDate: bestLibera.date,
                detail: `Cambio de día: trabaja el ${dayNameShort(gap.date)} ${formatDateCL(gap.date)} y libera el ${dayNameShort(bestLibera.date)} ${formatDateCL(bestLibera.date)} (ese día el grupo queda con ${bestLibera.remaining} disponible(s)).`,
            });
        } else {
            suggestions.push({
                staffId: cand.id,
                nombre: cand.nombre,
                tipo: 'HORAS_EXTRA',
                trabajaDate: gap.date,
                detail: `Horas extra: cubre el ${dayNameShort(gap.date)} ${formatDateCL(gap.date)} como día adicional (no hay día liberable en la semana sin dejar otra brecha).`,
            });
        }
    }

    // Cambios de día primero (no generan sobrecosto), luego horas extra
    suggestions.sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'CAMBIO_DIA' ? -1 : 1));
    return suggestions.slice(0, 4);
}
