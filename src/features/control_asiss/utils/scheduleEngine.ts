/**
 * Control ASISS - Motor de programación
 * Resuelve el estado diario (trabaja/libre/licencia/vacaciones/permiso)
 * de cada trabajador reutilizando el shiftEngine de asistencia2026.
 */

import {
    StaffWithShift,
    ShiftType,
    StaffShiftSpecialTemplate,
    StaffShiftOverride,
    AttendanceLicense,
    AttendancePermission,
} from '../../asistencia2026/types';
import {
    getFallbackShiftType,
    isOffDay,
    getSpecialShiftDetails,
    determineDailyShift,
} from '../../asistencia2026/utils/shiftEngine';
import { ResolvedDay } from '../types';

export interface VacationRange {
    staff_id?: string;
    rut?: string;
    start_date: string;
    end_date: string;
}

export interface ScheduleContext {
    shiftTypes: ShiftType[];
    specialTemplates: StaffShiftSpecialTemplate[];
    overrides: StaffShiftOverride[];
    licenses: AttendanceLicense[];
    vacations: VacationRange[];
    permissions: AttendancePermission[];
}

/**
 * Resuelve el estado de un trabajador para una fecha dada.
 * Prioridad: Licencia > Vacaciones > Permiso > Libre (patrón/override) > Trabaja.
 */
export function resolveDay(
    staff: StaffWithShift,
    date: string,
    ctx: ScheduleContext
): ResolvedDay {
    const turno = determineDailyShift(
        staff.horario,
        staff.shift,
        date,
        ctx.specialTemplates,
        staff.id,
        ctx.shiftTypes
    );

    const hasLicense = ctx.licenses.some(
        (l) => l.staff_id === staff.id && date >= l.start_date && date <= l.end_date
    );
    if (hasLicense) return { date, status: 'LICENCIA', turno, horario: '' };

    const hasVacation = ctx.vacations.some(
        (v) =>
            (v.staff_id === staff.id || (v.rut && v.rut === staff.rut)) &&
            date >= v.start_date &&
            date <= v.end_date
    );
    if (hasVacation) return { date, status: 'VACACIONES', turno, horario: '' };

    const hasPermission = ctx.permissions.some(
        (p) => p.staff_id === staff.id && date >= p.start_date && date <= p.end_date
    );
    if (hasPermission) return { date, status: 'PERMISO', turno, horario: '' };

    return resolveDayPattern(staff, date, ctx);
}

/**
 * Resolución "limpia": SOLO patrón de turnos (LIBRE o TRABAJA + horario).
 * Ignora licencias, vacaciones y permisos. Se usa para la programación
 * mensual oficial, que debe ir sin incidencias.
 */
export function resolveDayPattern(
    staff: StaffWithShift,
    date: string,
    ctx: ScheduleContext
): ResolvedDay {
    const turno = determineDailyShift(
        staff.horario,
        staff.shift,
        date,
        ctx.specialTemplates,
        staff.id,
        ctx.shiftTypes
    );

    // Libre según patrón de turno (u override puntual)
    let isOff = false;
    if (staff.shift) {
        let shiftType = ctx.shiftTypes.find((st) => st.code === staff.shift!.shift_type_code);
        if (!shiftType?.pattern_json) {
            shiftType = getFallbackShiftType(staff.shift.shift_type_code);
        }
        if (shiftType?.pattern_json) {
            const specialTemplate = ctx.specialTemplates.find((t) => t.staff_id === staff.id);
            const override = ctx.overrides.find(
                (o) => o.staff_id === staff.id && o.override_date === date
            );
            isOff = isOffDay(
                date,
                staff.shift.shift_type_code,
                staff.shift.variant_code,
                shiftType.pattern_json,
                specialTemplate,
                override
            );
        } else {
            const dow = new Date(date + 'T12:00:00').getDay();
            isOff = dow === 0 || dow === 6;
        }
    } else {
        const dow = new Date(date + 'T12:00:00').getDay();
        isOff = dow === 0 || dow === 6;
    }

    if (isOff) return { date, status: 'LIBRE', turno, horario: '' };

    // Trabaja: determinar horario a mostrar
    let horario = staff.horario || '';
    if (staff.shift?.shift_type_code === 'ESPECIAL') {
        const specialTemplate = ctx.specialTemplates.find((t) => t.staff_id === staff.id);
        if (specialTemplate) {
            const details = getSpecialShiftDetails(date, specialTemplate);
            const schedules = specialTemplate.settings_json?.custom_schedules;
            if (schedules) {
                if (details.type === 'DIA' && schedules.dia) horario = schedules.dia;
                else if (details.type === 'NOCHE' && schedules.noche) horario = schedules.noche;
            }
            if (details.earlyExit) {
                const match = horario.match(/^(\d{1,2}:\d{2})/);
                const startTime = match ? match[1] : '08:00';
                horario = `${startTime}-${details.earlyExit}`;
            }
        }
    }

    return { date, status: 'TRABAJA', turno, horario };
}

// ==========================================
// RANGOS DE FECHAS
// ==========================================

function fmt(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

/**
 * Lista de fechas YYYY-MM-DD entre start y end (inclusive).
 */
export function getDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const end = new Date(endDate + 'T12:00:00');
    for (const d = new Date(startDate + 'T12:00:00'); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(fmt(d));
    }
    return dates;
}

/**
 * Rango mensual extendido a semanas completas Lun-Dom:
 * - si el día 1 no es lunes, retrocede al lunes de esa semana
 * - si el último día no es domingo, avanza al domingo de esa semana
 */
export function getExtendedMonthRange(
    year: number,
    month: number // 0-11
): { startDate: string; endDate: string; dates: string[] } {
    const first = new Date(year, month, 1, 12);
    const last = new Date(year, month + 1, 0, 12);

    const leadOffset = (first.getDay() + 6) % 7;       // días hacia atrás hasta lunes
    const trailOffset = 6 - ((last.getDay() + 6) % 7); // días hacia adelante hasta domingo

    const start = new Date(first);
    start.setDate(first.getDate() - leadOffset);
    const end = new Date(last);
    end.setDate(last.getDate() + trailOffset);

    const startDate = fmt(start);
    const endDate = fmt(end);
    return { startDate, endDate, dates: getDateRange(startDate, endDate) };
}

/**
 * Divide una lista de fechas (múltiplo de 7, iniciando lunes) en semanas.
 */
export function chunkIntoWeeks(dates: string[]): string[][] {
    const weeks: string[][] = [];
    for (let i = 0; i < dates.length; i += 7) {
        weeks.push(dates.slice(i, i + 7));
    }
    return weeks;
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function dayName(date: string): string {
    return DAY_NAMES[new Date(date + 'T12:00:00').getDay()];
}

export function dayNameShort(date: string): string {
    return DAY_NAMES_SHORT[new Date(date + 'T12:00:00').getDay()];
}

export function monthName(month: number): string {
    return MONTH_NAMES[month];
}

/** DD-MM-YYYY */
export function formatDateCL(date: string): string {
    return date.split('-').reverse().join('-');
}

/**
 * Formato oficial de horario para programación mensual: "22:00_08:00_"
 * Toma el horario del trabajador (ej: "22:00-08:00", "10:00 - 20:00")
 * y lo normaliza. Si no hay horario definido, usa el estándar del turno.
 */
export function formatHorarioOficial(horario: string, turno: 'DIA' | 'NOCHE'): string {
    const pad = (t: string) => (t.length === 4 ? `0${t}` : t);
    const times = (horario || '').match(/\d{1,2}:\d{2}/g);
    if (times && times.length >= 2) {
        return `${pad(times[0])}_${pad(times[1])}_`;
    }
    return turno === 'NOCHE' ? '22:00_08:00_' : '08:00_18:00_';
}
