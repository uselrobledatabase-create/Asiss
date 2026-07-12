import { useMemo, useState } from 'react';
import { useTerminalStore } from '../../../../shared/state/terminalStore';
import {
    useShiftTypes,
    useStaffWithShifts,
    useAllSpecialTemplates,
    useOverridesForWeek,
    useLicensesForWeek,
    useVacationsForWeek,
    useIncidencesForWeek,
    useMarksForWeek,
} from '../../../asistencia2026/hooks';
import {
    isOffDay,
    determineDailyShift,
    isPastDate,
} from '../../../asistencia2026/utils/shiftEngine';
import { TerminalCode } from '../../../../shared/types/terminal';
import { StaffWithShift } from '../../../asistencia2026/types';

export type EstadoTurno = 'TURNO' | 'LIBRE';
export type TurnoType = 'DIA' | 'NOCHE';

export interface DashboardFilters {
    date: string;
    terminal: TerminalCode | 'ALL';
    turno: TurnoType | 'TODOS';
    estado: EstadoTurno | 'TODOS';
}

export interface ProcessedStaff extends StaffWithShift {
    isOff: boolean;
    assignedTurno: TurnoType;
    offReason?: 'LICENCIA' | 'VACACIONES' | 'DESCANSO' | 'INCIDENCIA';
    mark?: string;
}

export const useDashboardTurnos = (date: string) => {
    // Force terminalContext to company level RBU so we get everyone
    const terminalContext = { type: 'COMPANY' as const, code: 'RBU', mode: 'ALL' as const };
    
    const { data: shiftTypes = [], isLoading: loadingShifts } = useShiftTypes();
    const { data: staffList = [], isLoading: loadingStaff } = useStaffWithShifts(terminalContext);

    const activeStaff = useMemo(() => {
        // filter out completely terminated staff
        return staffList.filter(s => s.status !== 'DESVINCULADO');
    }, [staffList, date]);

    const staffIds = useMemo(() => activeStaff.map(s => s.id), [activeStaff]);

    const { data: templates = [], isLoading: loadingTemplates } = useAllSpecialTemplates(staffIds);
    const { data: overrides = [], isLoading: loadingOverrides } = useOverridesForWeek(staffIds, date, date);
    const { data: licenses = [], isLoading: loadingLicenses } = useLicensesForWeek(staffIds, date, date);
    const { data: vacations = [], isLoading: loadingVacations } = useVacationsForWeek(staffIds, date, date);
    const { data: marks = [], isLoading: loadingMarks } = useMarksForWeek(staffIds, date, date);

    const isLoading = loadingShifts || loadingStaff || loadingTemplates || loadingOverrides || loadingLicenses || loadingVacations || loadingMarks;

    const processedData = useMemo(() => {
        if (isLoading) return [];

        return activeStaff.map((staff): ProcessedStaff => {
            const hasLicense = licenses.some(l => l.staff_id === staff.id);
            const hasVacation = vacations.some(v => v.staff_id === staff.id);
            const mark = marks.find(m => m.staff_id === staff.id);

            const isRegularOff = staff.shift ? isOffDay(
                date,
                staff.shift.shift_type_code,
                staff.shift.variant_code,
                shiftTypes.find(st => st.code === staff.shift?.shift_type_code)?.pattern_json || { type: 'rotating', description: '', cycleDays: 7, workDays: 5, offDays: 2 },
                templates.find(t => t.staff_id === staff.id),
                overrides.find(o => o.staff_id === staff.id)
            ) : false;

            const isOff = hasLicense || hasVacation || isRegularOff;
            
            let offReason: ProcessedStaff['offReason'] = undefined;
            if (hasLicense) offReason = 'LICENCIA';
            else if (hasVacation) offReason = 'VACACIONES';
            else if (isRegularOff) offReason = 'DESCANSO';

            const assignedTurno = determineDailyShift(
                staff.horario,
                staff.shift,
                date,
                templates,
                staff.id,
                shiftTypes
            );

            return {
                ...staff,
                isOff,
                assignedTurno,
                offReason,
                mark: mark?.mark
            };
        });
    }, [activeStaff, isLoading, licenses, vacations, templates, overrides, shiftTypes, date, marks]);

    return {
        data: processedData,
        isLoading
    };
};
