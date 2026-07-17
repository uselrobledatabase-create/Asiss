/**
 * Control ASISS - Generador automático de programación para
 * SUPERVISOR RELEVO (solo El Roble y La Reina).
 *
 * El relevo trabaja una semana NORMAL de 5 días con EXACTAMENTE 2
 * LIBRES por semana (jamás 3 o 4): sus días de trabajo se ubican con
 * PRIORIDAD donde los supervisores fijos libran (ahí cubre día o noche
 * según a quién reemplaza) y el resto de sus días trabaja de apoyo en
 * su turno por defecto. Los 2 libres semanales se colocan donde NO se
 * le necesita.
 *
 * REGLAS DURAS:
 * 1. Transición NOCHE → DÍA prohibida sin un libre de por medio
 *    (DÍA → NOCHE al día siguiente SÍ se puede).
 * 2. Máximo 6 días seguidos de trabajo (jamás un día 7).
 * 3. Mínimo 2 domingos libres por ciclo (mes), sí o sí.
 *
 * Implementación: para cada una de las 4 semanas del ciclo se evalúan
 * TODAS las combinaciones de par de libres (21 por semana → 21⁴ ≈ 194k
 * combinaciones) y se elige la de menor penalización: cobertura perdida,
 * transiciones ilegales, rachas >6 y domingos, todo verificado
 * CÍCLICAMENTE (el ciclo se repite al infinito).
 */

import { StaffWithShift } from '../../asistencia2026/types';
import { getDayInCycle, getTurnoFromHorario } from '../../asistencia2026/utils/shiftEngine';
import { ScheduleContext, resolveDayPattern, formatDateCL, dayNameShort } from './scheduleEngine';
import { turnoDeFicha } from './coverageAnalysis';

export type RelevoAssign = 'LIBRE' | 'DIA' | 'NOCHE';

export interface RelevoDay {
    idx: number;            // 0-27 (0 = lunes semana 1)
    date: string;
    assign: RelevoAssign;
    horario: string;
    needDia: boolean;
    needNoche: boolean;
    /** true = trabaja de apoyo (nadie libra ese día, pero completa sus 5 días) */
    apoyo?: boolean;
    gap?: 'DIA' | 'NOCHE' | 'AMBOS';
    motivo?: string;
}

export interface RelevoResult {
    days: RelevoDay[];
    offDays: number[];
    dailyShifts: Record<number, 'DIA' | 'NOCHE'>;
    customSchedules: { dia: string; noche: string };
    warnings: string[];
    stats: {
        necesidadesDia: number;
        necesidadesNoche: number;
        cubiertosDia: number;
        cubiertosNoche: number;
        brechas: number;
        domingosLibres: number;
        rachaMaxima: number;
        libresPorSemana: number[];
    };
    fijosDia: string[];
    fijosNoche: string[];
}

const TERMINALES_RELEVO = ['EL_ROBLE', 'LA_REINA'];

export function esElegibleRelevo(staff: Pick<StaffWithShift, 'cargo' | 'terminal_code'>): boolean {
    return (
        staff.cargo.toUpperCase().includes('SUPERVISOR') &&
        TERMINALES_RELEVO.includes(staff.terminal_code)
    );
}

/** true si la persona ya es un relevo automático (marcado en su plantilla) */
export function esRelevoAsignado(staff: StaffWithShift, ctx: ScheduleContext): boolean {
    if (staff.shift?.shift_type_code === 'SUPERVISOR_RELEVO') return true;
    if (staff.shift?.shift_type_code !== 'ESPECIAL') return false;
    const tpl = ctx.specialTemplates.find((t) => t.staff_id === staff.id);
    return Boolean(tpl?.settings_json?.es_relevo);
}

function shiftDate(date: string, days: number): string {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Fijos del terminal que el relevo debe cubrir (excluye otros relevos) */
export function findFixedSupervisors(
    relevo: StaffWithShift,
    allStaff: StaffWithShift[],
    ctx: ScheduleContext
): { fijosDia: StaffWithShift[]; fijosNoche: StaffWithShift[] } {
    const peers = allStaff.filter(
        (s) =>
            s.id !== relevo.id &&
            s.status === 'ACTIVO' &&
            s.terminal_code === relevo.terminal_code &&
            s.cargo.toUpperCase().includes('SUPERVISOR') &&
            !esRelevoAsignado(s, ctx)
    );
    return {
        fijosDia: peers.filter((s) => turnoDeFicha(s.turno, s.horario) === 'DIA'),
        fijosNoche: peers.filter((s) => turnoDeFicha(s.turno, s.horario) === 'NOCHE'),
    };
}

const SUNDAY_IDX = [6, 13, 20, 27];
const trabaja = (a: RelevoAssign) => a !== 'LIBRE';

function maxRunCyclic(assigns: RelevoAssign[]): number {
    if (assigns.every(trabaja)) return assigns.length * 2;
    const doble = [...assigns, ...assigns];
    let max = 0, run = 0;
    for (const a of doble) {
        if (trabaja(a)) { run++; max = Math.max(max, run); }
        else run = 0;
    }
    return Math.min(max, assigns.length);
}

function normalizeSchedule(horario: string | undefined, turno: 'DIA' | 'NOCHE'): string {
    const times = (horario || '').match(/\d{1,2}:\d{2}/g);
    if (times && times.length >= 2) {
        return `${times[0]}-${times[1]}`;
    }
    return turno === 'NOCHE' ? '22:00-08:00' : '10:00-20:00';
}

function pickRepresentativeSchedule(
    staff: StaffWithShift[],
    turno: 'DIA' | 'NOCHE',
    fallback?: string
): string {
    const exactMatch = staff.find((s) => s.horario && getTurnoFromHorario(s.horario) === turno);
    if (exactMatch?.horario) return normalizeSchedule(exactMatch.horario, turno);

    const withHorario = staff.find((s) => s.horario && s.horario.trim().length > 0);
    if (withHorario?.horario) return normalizeSchedule(withHorario.horario, turno);

    return normalizeSchedule(fallback, turno);
}

/** Pares de libres posibles en una semana (21 combinaciones) */
const LIBRE_PAIRS: [number, number][] = [];
for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) LIBRE_PAIRS.push([a, b]);

interface Needs {
    dia: boolean[];
    noche: boolean[];
}

/**
 * Construye la asignación de 28 días para una combinación de libres:
 * - libres fijados por el par de cada semana
 * - necesidades cubiertas con su turno (conflicto día+noche → elige uno)
 * - resto: APOYO, privilegiando NOCHE para evitar regalar libres y para
 *   no provocar transiciones NOCHE → DÍA ilegales.
 *
 * Se resuelve con una pasada dinámica sobre el ciclo linealizado desde un
 * día posterior a un libre; así la restricción NOCHE → DÍA queda satisfecha
 * sin tener que "parchar" el resultado liberando días extra.
 */
function buildAssign(
    pairs: number[],          // índice de LIBRE_PAIRS por semana (4)
    needs: Needs,
    defaultTurno: 'DIA' | 'NOCHE'
): RelevoAssign[] {
    const libre = new Array<boolean>(28).fill(false);
    for (let w = 0; w < 4; w++) {
        const [a, b] = LIBRE_PAIRS[pairs[w]];
        libre[w * 7 + a] = true;
        libre[w * 7 + b] = true;
    }

    const start = libre.findIndex(Boolean);
    const startIdx = start === -1 ? 0 : (start + 1) % 28;
    const order = Array.from({ length: 28 }, (_, offset) => (startIdx + offset) % 28);
    const states: RelevoAssign[] = ['LIBRE', 'DIA', 'NOCHE'];
    const INF = Number.POSITIVE_INFINITY;

    const penaltyFor = (idx: number, choice: RelevoAssign): number => {
        if (choice === 'LIBRE') return libre[idx] ? 0 : INF;

        const needDia = needs.dia[idx];
        const needNoche = needs.noche[idx];
        let penalty = 0;

        if (needDia && choice !== 'DIA') penalty += 1000;
        if (needNoche && choice !== 'NOCHE') penalty += 1000;

        if (!needDia && !needNoche) {
            // En apoyo neutro preferimos dejarlo TRABAJANDO de NOCHE antes
            // que regalar un libre o volver a DIA por costumbre.
            penalty += choice === 'DIA' ? 5 : 0;
            if (defaultTurno === 'NOCHE' && choice === 'DIA') penalty += 1;
        } else if (needDia && needNoche && choice === 'DIA') {
            // Si cubre solo uno de los dos turnos, inclinamos el empate a NOCHE.
            penalty += 1;
        }

        return penalty;
    };

    const canFollow = (prev: RelevoAssign, next: RelevoAssign): boolean =>
        !(prev === 'NOCHE' && next === 'DIA');

    const dp: Array<Record<RelevoAssign, number>> = [];
    const parent: Array<Record<RelevoAssign, RelevoAssign | null>> = [];

    for (let step = 0; step < order.length; step++) {
        const idx = order[step];
        dp[step] = { LIBRE: INF, DIA: INF, NOCHE: INF };
        parent[step] = { LIBRE: null, DIA: null, NOCHE: null };

        for (const choice of states) {
            const choicePenalty = penaltyFor(idx, choice);
            if (!Number.isFinite(choicePenalty)) continue;

            if (step === 0) {
                // El ciclo se linealiza después de un libre, así que el primer
                // día no arrastra transición desde el cierre anterior.
                dp[step][choice] = choicePenalty;
                continue;
            }

            for (const prev of states) {
                const prevScore = dp[step - 1][prev];
                if (!Number.isFinite(prevScore) || !canFollow(prev, choice)) continue;

                const score = prevScore + choicePenalty;
                if (score < dp[step][choice]) {
                    dp[step][choice] = score;
                    parent[step][choice] = prev;
                }
            }
        }
    }

    const assign = new Array<RelevoAssign>(28).fill('LIBRE');
    let bestFinal: RelevoAssign = 'LIBRE';
    for (const choice of states) {
        if (dp[order.length - 1][choice] < dp[order.length - 1][bestFinal]) {
            bestFinal = choice;
        }
    }

    let current: RelevoAssign | null = bestFinal;
    for (let step = order.length - 1; step >= 0; step--) {
        const idx = order[step];
        assign[idx] = current || 'LIBRE';
        current = parent[step][assign[idx]];
    }

    return assign;
}

function scoreAssign(assign: RelevoAssign[], needs: Needs): number {
    let penalty = 0;

    // Transiciones ilegales (solo posibles con necesidades DIA tras noche)
    for (let i = 0; i < 28; i++) {
        if (assign[(i + 27) % 28] === 'NOCHE' && assign[i] === 'DIA') penalty += 100000;
    }
    // Racha máxima
    const run = maxRunCyclic(assign);
    if (run > 6) penalty += 100000 * (run - 6);
    // Domingos libres (mínimo 2 por ciclo)
    const domLibres = SUNDAY_IDX.filter((i) => assign[i] === 'LIBRE').length;
    if (domLibres < 2) penalty += 100000 * (2 - domLibres);
    // Cobertura perdida (prioridad de los libres: donde NO se necesita)
    for (let i = 0; i < 28; i++) {
        if (needs.dia[i] && assign[i] !== 'DIA') penalty += 500;
        if (needs.noche[i] && assign[i] !== 'NOCHE') penalty += 500;
    }
    return penalty;
}

export function generateRelevoTemplate(
    relevo: StaffWithShift,
    allStaff: StaffWithShift[],
    ctx: ScheduleContext,
    aroundDate: string
): RelevoResult {
    const { fijosDia, fijosNoche } = findFixedSupervisors(relevo, allStaff, ctx);
    const warnings: string[] = [];

    if (fijosDia.length === 0 && fijosNoche.length === 0) {
        warnings.push('No se encontraron supervisores fijos en el terminal: el relevo trabajará de apoyo en su turno por defecto.');
    }

    // Ancla: lunes índice 0 del ciclo
    let anchor = aroundDate;
    for (let i = 0; i < 28 && getDayInCycle(anchor) !== 0; i++) {
        anchor = shiftDate(anchor, -1);
    }

    const baseCtx: ScheduleContext = { ...ctx, overrides: [] };

    // ---- Necesidades por día del ciclo ----
    const dates: string[] = [];
    const needs: Needs = { dia: new Array(28).fill(false), noche: new Array(28).fill(false) };
    for (let i = 0; i < 28; i++) {
        const date = shiftDate(anchor, i);
        dates.push(date);
        needs.dia[i] =
            fijosDia.length > 0 &&
            fijosDia.every((s) => resolveDayPattern(s, date, baseCtx).status !== 'TRABAJA');
        needs.noche[i] =
            fijosNoche.length > 0 &&
            fijosNoche.every((s) => resolveDayPattern(s, date, baseCtx).status !== 'TRABAJA');
    }

    const defaultTurno = turnoDeFicha(relevo.turno, relevo.horario);

    // ---- Búsqueda exhaustiva del mejor par de libres por semana ----
    let bestPairs = [0, 0, 0, 0];
    let bestScore = Infinity;
    let bestAssign: RelevoAssign[] | null = null;
    const pairs = [0, 0, 0, 0];
    busqueda:
    for (pairs[0] = 0; pairs[0] < 21; pairs[0]++)
        for (pairs[1] = 0; pairs[1] < 21; pairs[1]++)
            for (pairs[2] = 0; pairs[2] < 21; pairs[2]++)
                for (pairs[3] = 0; pairs[3] < 21; pairs[3]++) {
                    const assign = buildAssign(pairs, needs, defaultTurno);
                    if (maxRunCyclic(assign) > 6) continue;
                    if (SUNDAY_IDX.filter((i) => assign[i] === 'LIBRE').length < 2) continue;
                    const score = scoreAssign(assign, needs);
                    if (score < bestScore) {
                        bestScore = score;
                        bestPairs = [...pairs];
                        bestAssign = assign;
                        if (score === 0) break busqueda;
                    }
                }

    const assign = bestAssign ?? buildAssign(bestPairs, needs, defaultTurno);

    const customSchedules = {
        dia: pickRepresentativeSchedule(fijosDia, 'DIA', relevo.horario),
        noche: pickRepresentativeSchedule(fijosNoche, 'NOCHE', relevo.horario),
    };

    if (
        maxRunCyclic(assign) > 6 ||
        SUNDAY_IDX.filter((i) => assign[i] === 'LIBRE').length < 2 ||
        assign.some((a, i) => assign[(i + 27) % 28] === 'NOCHE' && a === 'DIA')
    ) {
        warnings.push(
            'No se encontró una combinación perfecta con la estrategia principal; revisa la programación manualmente antes de guardar.'
        );
    }

    // ---- Días y brechas ----
    const days: RelevoDay[] = [];
    for (let i = 0; i < 28; i++) {
        const d: RelevoDay = {
            idx: i,
            date: dates[i],
            assign: assign[i],
            horario:
                assign[i] === 'LIBRE'
                    ? ''
                    : assign[i] === 'NOCHE'
                        ? customSchedules.noche
                        : customSchedules.dia,
            needDia: needs.dia[i],
            needNoche: needs.noche[i],
        };
        if (trabaja(assign[i]) && !needs.dia[i] && !needs.noche[i]) d.apoyo = true;

        const gapDia = needs.dia[i] && assign[i] !== 'DIA';
        const gapNoche = needs.noche[i] && assign[i] !== 'NOCHE';
        if (gapDia && gapNoche) d.gap = 'AMBOS';
        else if (gapDia) d.gap = 'DIA';
        else if (gapNoche) d.gap = 'NOCHE';

        if (d.gap) {
            d.motivo = needs.dia[i] && needs.noche[i] && trabaja(assign[i])
                ? 'Fijos de día y noche libran a la vez: el relevo solo cubre un turno.'
                : assign[i] === 'NOCHE' && needs.dia[i]
                    ? 'Se deja al relevo trabajando de noche para respetar la transición NOCHE→DÍA sin regalar un libre extra.'
                    : assign[i] === 'DIA' && needs.noche[i]
                        ? 'Se priorizó la cobertura de día; la noche requiere refuerzo adicional.'
                        : 'La cobertura completa exige refuerzo adicional de otro supervisor.';
            warnings.push(
                `${dayNameShort(d.date)} ${formatDateCL(d.date)}: brecha de ${d.gap} — ${d.motivo}`
            );
        }
        days.push(d);
    }

    // ---- Salida ----
    const offDays = days.filter((d) => d.assign === 'LIBRE').map((d) => d.idx);
    const dailyShifts: Record<number, 'DIA' | 'NOCHE'> = {};
    for (const d of days) if (d.assign === 'NOCHE') dailyShifts[d.idx] = 'NOCHE';

    const libresPorSemana = [0, 1, 2, 3].map(
        (w) => days.slice(w * 7, w * 7 + 7).filter((d) => d.assign === 'LIBRE').length
    );

    return {
        days,
        offDays,
        dailyShifts,
        customSchedules,
        warnings,
        stats: {
            necesidadesDia: needs.dia.filter(Boolean).length,
            necesidadesNoche: needs.noche.filter(Boolean).length,
            cubiertosDia: days.filter((d) => d.needDia && d.assign === 'DIA').length,
            cubiertosNoche: days.filter((d) => d.needNoche && d.assign === 'NOCHE').length,
            brechas: days.filter((d) => d.gap).length,
            domingosLibres: SUNDAY_IDX.filter((i) => assign[i] === 'LIBRE').length,
            rachaMaxima: maxRunCyclic(assign),
            libresPorSemana,
        },
        fijosDia: fijosDia.map((s) => s.nombre),
        fijosNoche: fijosNoche.map((s) => s.nombre),
    };
}
