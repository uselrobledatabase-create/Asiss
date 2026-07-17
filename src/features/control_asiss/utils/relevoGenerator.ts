/**
 * Control ASISS - Generador automático de programación para
 * SUPERVISOR RELEVO (solo El Roble y La Reina).
 *
 * El relevo debe cubrir SÍ O SÍ los días en que los supervisores fijos
 * están libres: trabaja de DÍA cuando los fijos de día libran, y de
 * NOCHE cuando los fijos de noche libran.
 *
 * REGLAS (en orden de aplicación):
 * 1. Transición NOCHE → DÍA prohibida: tras una noche debe haber un
 *    libre antes de entrar de día. (Día → Noche al día siguiente SÍ se
 *    puede, sin libre de por medio.)
 * 2. Máximo 6 días seguidos de trabajo: jamás un día 7.
 * 3. Mínimo 2 domingos libres al mes, sí o sí.
 *
 * El plan se calcula sobre el ciclo de 28 días (4 semanas Lun-Dom,
 * alineado al lunes de referencia del motor) y se guarda como plantilla
 * ESPECIAL, por lo que se replica al infinito y queda editable día a
 * día como cualquier otra programación. Cuando cubrir un día violaría
 * una regla, ese día queda LIBRE y se reporta la brecha con su motivo.
 */

import { StaffWithShift } from '../../asistencia2026/types';
import { getDayInCycle } from '../../asistencia2026/utils/shiftEngine';
import { ScheduleContext, resolveDayPattern, formatDateCL, dayNameShort } from './scheduleEngine';
import { turnoDeFicha } from './coverageAnalysis';

export type RelevoAssign = 'LIBRE' | 'DIA' | 'NOCHE';

export interface RelevoDay {
    idx: number;            // 0-27 (0 = lunes semana 1)
    date: string;           // fecha de referencia del ciclo mostrado
    assign: RelevoAssign;
    needDia: boolean;       // todos los fijos de día libran
    needNoche: boolean;     // todos los fijos de noche libran
    /** brecha: se necesitaba cubrir pero una regla lo impidió */
    gap?: 'DIA' | 'NOCHE' | 'AMBOS';
    motivo?: string;
}

export interface RelevoResult {
    days: RelevoDay[];                    // 28 días
    offDays: number[];                    // índices libres para la plantilla
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

function shiftDate(date: string, days: number): string {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** true si la persona ya es un relevo automático (marcado en su plantilla) */
export function esRelevoAsignado(staff: StaffWithShift, ctx: ScheduleContext): boolean {
    if (staff.shift?.shift_type_code === 'SUPERVISOR_RELEVO') return true;
    if (staff.shift?.shift_type_code !== 'ESPECIAL') return false;
    const tpl = ctx.specialTemplates.find((t) => t.staff_id === staff.id);
    return Boolean(tpl?.settings_json?.es_relevo);
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
            // Un relevo no cubre a otro relevo
            !esRelevoAsignado(s, ctx)
    );
    return {
        fijosDia: peers.filter((s) => turnoDeFicha(s.turno, s.horario) === 'DIA'),
        fijosNoche: peers.filter((s) => turnoDeFicha(s.turno, s.horario) === 'NOCHE'),
    };
}

/** Índices de los 4 domingos del ciclo de 28 días (día 0 = lunes) */
const SUNDAY_IDX = [6, 13, 20, 27];

const trabaja = (a: RelevoAssign) => a !== 'LIBRE';

/** Racha máxima de trabajo considerando que el ciclo se repite (envolvente) */
function maxRunCyclic(assigns: RelevoAssign[]): number {
    if (assigns.every(trabaja)) return Infinity;
    // Duplicar para capturar rachas que cruzan el borde del ciclo
    const doble = [...assigns, ...assigns];
    let max = 0, run = 0;
    for (const a of doble) {
        if (trabaja(a)) { run++; max = Math.max(max, run); }
        else run = 0;
    }
    return Math.min(max, assigns.length);
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
        warnings.push('No se encontraron supervisores fijos en el terminal: no hay a quién cubrir.');
    }

    // Ancla: lunes con índice 0 del ciclo de 28 días
    let anchor = aroundDate;
    for (let i = 0; i < 28 && getDayInCycle(anchor) !== 0; i++) {
        anchor = shiftDate(anchor, -1);
    }

    // Patrón base de los fijos SIN ajustes puntuales (las necesidades cíclicas
    // salen del patrón; los ajustes de días puntuales no son periódicos)
    const baseCtx: ScheduleContext = {
        ...ctx,
        overrides: [],
    };

    // ---- 1. Detectar necesidades por día del ciclo ----
    const days: RelevoDay[] = [];
    for (let i = 0; i < 28; i++) {
        const date = shiftDate(anchor, i);
        const needDia =
            fijosDia.length > 0 &&
            fijosDia.every((s) => resolveDayPattern(s, date, baseCtx).status !== 'TRABAJA');
        const needNoche =
            fijosNoche.length > 0 &&
            fijosNoche.every((s) => resolveDayPattern(s, date, baseCtx).status !== 'TRABAJA');
        days.push({ idx: i, date, assign: 'LIBRE', needDia, needNoche });
    }

    // ---- 2. Asignación inicial (consciente de la transición noche→día) ----
    for (let i = 0; i < 28; i++) {
        const d = days[i];
        if (!d.needDia && !d.needNoche) continue;

        if (d.needDia && d.needNoche) {
            // Conflicto: ambos fijos libran el mismo día y el relevo es uno solo.
            // Elegir el turno que continúa mejor la secuencia (evita transiciones).
            const prev = days[(i + 27) % 28].assign;
            d.assign = prev === 'NOCHE' ? 'NOCHE' : 'DIA';
            d.gap = d.assign === 'DIA' ? 'NOCHE' : 'DIA';
            d.motivo = 'Fijos de día y de noche libran a la vez: el relevo solo puede cubrir un turno.';
            warnings.push(
                `${dayNameShort(d.date)} ${formatDateCL(d.date)}: fijos de DÍA y NOCHE libres a la vez — el relevo cubre ${d.assign} y queda brecha de ${d.gap}.`
            );
        } else {
            d.assign = d.needDia ? 'DIA' : 'NOCHE';
        }
    }

    // ---- 3. Regla 1: NOCHE → DÍA prohibido sin libre de por medio (cíclico) ----
    for (let pass = 0; pass < 2; pass++) { // 2 pasadas por el borde envolvente
        for (let i = 0; i < 28; i++) {
            const prev = days[(i + 27) % 28];
            const cur = days[i];
            if (prev.assign === 'NOCHE' && cur.assign === 'DIA') {
                if (cur.needNoche) {
                    // Cambiar a NOCHE resuelve la transición y cubre la otra brecha
                    cur.assign = 'NOCHE';
                    cur.gap = 'DIA';
                    cur.motivo = 'Se asignó NOCHE para evitar la transición noche→día.';
                } else {
                    cur.assign = 'LIBRE';
                    cur.gap = 'DIA';
                    cur.motivo = 'Transición noche→día prohibida: se necesita un libre después de la noche.';
                    warnings.push(
                        `${dayNameShort(cur.date)} ${formatDateCL(cur.date)}: brecha de DÍA — venía de turno NOCHE y la regla exige un libre de por medio.`
                    );
                }
            }
        }
    }

    // ---- 4. Regla 2: máximo 6 días seguidos (cíclico) ----
    let guard = 0;
    while (maxRunCyclic(days.map((d) => d.assign)) > 6 && guard++ < 28) {
        // Encontrar la primera racha >6 (en la vista duplicada) y liberar su 7º día
        const doble = [...days, ...days];
        let run = 0;
        for (let i = 0; i < doble.length; i++) {
            if (trabaja(doble[i].assign)) {
                run++;
                if (run === 7) {
                    const d = days[doble[i].idx];
                    const dropped = d.assign as 'DIA' | 'NOCHE';
                    d.assign = 'LIBRE';
                    d.gap = d.gap === undefined ? dropped : 'AMBOS';
                    d.motivo = 'Liberado para no superar los 6 días seguidos de trabajo.';
                    warnings.push(
                        `${dayNameShort(d.date)} ${formatDateCL(d.date)}: brecha de ${dropped} — se liberó para respetar el máximo de 6 días seguidos.`
                    );
                    break;
                }
            } else {
                run = 0;
            }
        }
    }

    // ---- 5. Regla 3: mínimo 2 domingos libres por ciclo/mes ----
    const workedSundays = () => SUNDAY_IDX.filter((i) => trabaja(days[i].assign));
    while (SUNDAY_IDX.length - workedSundays().length < 2) {
        // Liberar el domingo trabajado cuya cobertura sea menos crítica:
        // preferir uno con brecha ya existente; si no, el último del ciclo
        const candidatos = workedSundays();
        const target = candidatos[candidatos.length - 1];
        const d = days[target];
        const dropped = d.assign as 'DIA' | 'NOCHE';
        d.assign = 'LIBRE';
        d.gap = d.gap === undefined ? dropped : 'AMBOS';
        d.motivo = 'Domingo liberado para cumplir los 2 domingos libres obligatorios.';
        warnings.push(
            `${dayNameShort(d.date)} ${formatDateCL(d.date)}: brecha de ${dropped} — domingo liberado para cumplir los 2 domingos libres del mes.`
        );
    }

    // ---- 6. Verificación final de transición (por si las liberaciones abrieron algo) ----
    for (let i = 0; i < 28; i++) {
        const prev = days[(i + 27) % 28];
        const cur = days[i];
        if (prev.assign === 'NOCHE' && cur.assign === 'DIA') {
            cur.assign = 'LIBRE';
            cur.gap = 'DIA';
            cur.motivo = 'Transición noche→día prohibida.';
        }
    }

    // ---- Salida ----
    const offDays = days.filter((d) => d.assign === 'LIBRE').map((d) => d.idx);
    const dailyShifts: Record<number, 'DIA' | 'NOCHE'> = {};
    for (const d of days) {
        if (d.assign === 'NOCHE') dailyShifts[d.idx] = 'NOCHE';
    }

    const customSchedules = {
        dia: fijosDia[0]?.horario || relevo.horario || '08:00-20:00',
        noche: fijosNoche[0]?.horario || '20:00-08:00',
    };

    const necesidadesDia = days.filter((d) => d.needDia).length;
    const necesidadesNoche = days.filter((d) => d.needNoche).length;
    const cubiertosDia = days.filter((d) => d.needDia && d.assign === 'DIA').length;
    const cubiertosNoche = days.filter((d) => d.needNoche && d.assign === 'NOCHE').length;
    const brechas = days.filter((d) => d.gap).length;
    const domingosLibres = SUNDAY_IDX.filter((i) => days[i].assign === 'LIBRE').length;
    const rachaMaxima = maxRunCyclic(days.map((d) => d.assign));

    return {
        days,
        offDays,
        dailyShifts,
        customSchedules,
        warnings,
        stats: {
            necesidadesDia,
            necesidadesNoche,
            cubiertosDia,
            cubiertosNoche,
            brechas,
            domingosLibres,
            rachaMaxima: rachaMaxima === Infinity ? 28 : rachaMaxima,
        },
        fijosDia: fijosDia.map((s) => s.nombre),
        fijosNoche: fijosNoche.map((s) => s.nombre),
    };
}
