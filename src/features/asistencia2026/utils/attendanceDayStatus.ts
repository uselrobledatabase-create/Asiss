import {
    AttendanceLicense,
    AttendanceMark,
    AttendancePermission,
    IncidenceCode,
    ShiftType,
    StaffShiftOverride,
    StaffShiftSpecialTemplate,
    StaffWithShift,
} from '../types';
import {
    getFallbackShiftType,
    getSpecialShiftDetails,
    getTurnoFromHorario,
    isDateInRange,
    isOffDay,
} from './shiftEngine';

interface AttendanceIncidencesLike {
    noMarcaciones: Array<{ rut: string; date: string }>;
    sinCredenciales: Array<{ rut: string; date: string }>;
    cambiosDia: Array<{ rut: string; date: string }>;
    autorizaciones: Array<{ rut: string; date: string }>;
}

interface AttendanceDayStatusContext {
    marksMap: Map<string, AttendanceMark>;
    shiftTypesMap: Map<string, ShiftType>;
    specialTemplatesMap: Map<string, StaffShiftSpecialTemplate>;
    overridesMap: Map<string, StaffShiftOverride>;
    licenses: AttendanceLicense[];
    vacations: { staff_id: string; start_date: string; end_date: string }[];
    permissions: AttendancePermission[];
    incidences: AttendanceIncidencesLike;
}

export interface ResolvedAttendanceDayStatus {
    mark?: AttendanceMark;
    license?: AttendanceLicense;
    vacation?: { staff_id: string; start_date: string; end_date: string };
    permission?: AttendancePermission;
    isOff: boolean;
    horario: string;
    turno: 'DIA' | 'NOCHE';
    reducido: boolean;
    incidencies: IncidenceCode[];
}

export function getIncidencesForDate(
    incidences: AttendanceIncidencesLike,
    rut: string,
    date: string
): IncidenceCode[] {
    const codes: IncidenceCode[] = [];
    if (incidences.noMarcaciones.some((i) => i.rut === rut && i.date === date)) codes.push('NM');
    if (incidences.sinCredenciales.some((i) => i.rut === rut && i.date === date)) codes.push('NC');
    if (incidences.cambiosDia.some((i) => i.rut === rut && i.date === date)) codes.push('CD');
    if (incidences.autorizaciones.some((i) => i.rut === rut && i.date === date)) codes.push('AUT');
    return codes;
}

export function resolveAttendanceDayStatus(
    staff: StaffWithShift,
    date: string,
    ctx: AttendanceDayStatusContext
): ResolvedAttendanceDayStatus {
    const mark = ctx.marksMap.get(`${staff.id}-${date}`);
    const license = ctx.licenses.find(
        (item) => item.staff_id === staff.id && isDateInRange(date, item.start_date, item.end_date)
    );
    const vacation = ctx.vacations.find(
        (item) => item.staff_id === staff.id && isDateInRange(date, item.start_date, item.end_date)
    );
    const permission = ctx.permissions.find(
        (item) => item.staff_id === staff.id && isDateInRange(date, item.start_date, item.end_date)
    );
    const override = ctx.overridesMap.get(`${staff.id}-${date}`);
    const incidencies = getIncidencesForDate(ctx.incidences, staff.rut, date);

    let isOff = false;
    let horario = staff.horario;
    let turno = getTurnoFromHorario(staff.horario);
    const dayOfWeek = new Date(date + 'T12:00:00').getDay();

    if (staff.shift) {
        let shiftType = ctx.shiftTypesMap.get(staff.shift.shift_type_code);
        if (!shiftType?.pattern_json) {
            shiftType = getFallbackShiftType(staff.shift.shift_type_code);
        }

        if (shiftType?.pattern_json) {
            const specialTemplate = ctx.specialTemplatesMap.get(staff.id);
            isOff = isOffDay(
                date,
                staff.shift.shift_type_code,
                staff.shift.variant_code,
                shiftType.pattern_json,
                specialTemplate,
                override
            );
        } else {
            isOff = dayOfWeek === 0 || dayOfWeek === 6;
        }

        if (staff.shift.shift_type_code === 'ESPECIAL') {
            const specialTemplate = ctx.specialTemplatesMap.get(staff.id);
            if (specialTemplate) {
                const details = getSpecialShiftDetails(date, specialTemplate);
                if (details.type) {
                    turno = details.type;
                    const schedules = specialTemplate.settings_json?.custom_schedules;
                    if (schedules) {
                        if (turno === 'DIA' && schedules.dia) horario = schedules.dia;
                        else if (turno === 'NOCHE' && schedules.noche) horario = schedules.noche;
                    }
                }

                if (details.earlyExit && !isOff) {
                    const match = staff.horario?.match(/^(\d{1,2}:\d{2})/);
                    const startTime = match ? match[1] : '08:00';
                    horario = `${startTime}-${details.earlyExit}`;
                    return {
                        mark,
                        license,
                        vacation,
                        permission,
                        isOff,
                        horario,
                        turno,
                        reducido: true,
                        incidencies,
                    };
                }
            }
        }
    } else {
        isOff = dayOfWeek === 0 || dayOfWeek === 6;
    }

    if (!isOff && override?.override_type === 'WORK' && override.meta_json) {
        const meta = override.meta_json as { turno?: 'DIA' | 'NOCHE'; horario?: string };
        if (meta.turno === 'DIA' || meta.turno === 'NOCHE') turno = meta.turno;
        if (typeof meta.horario === 'string' && meta.horario) horario = meta.horario;
    }

    return {
        mark,
        license,
        vacation,
        permission,
        isOff,
        horario,
        turno,
        reducido: false,
        incidencies,
    };
}
