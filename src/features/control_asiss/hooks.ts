/**
 * Control ASISS - Hook de datos
 * Carga dotación completa + todo lo necesario para resolver la
 * programación de un rango de fechas (turnos, plantillas, overrides,
 * licencias, vacaciones y permisos).
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TerminalContext } from '../../shared/types/terminal';
import {
    useShiftTypes,
    useStaffWithShifts,
    useAllSpecialTemplates,
    useOverridesForWeek,
    useLicensesForWeek,
    usePermissionsForWeek,
    useVacationsForWeek,
} from '../asistencia2026/hooks';
import { fetchStaffForExport } from './api';
import { ScheduleContext } from './utils/scheduleEngine';

const ALL_CONTEXT: TerminalContext = { mode: 'ALL' };

export function useControlAsissData(startDate: string, endDate: string) {
    const staffQuery = useStaffWithShifts(ALL_CONTEXT, undefined);
    const staff = useMemo(() => staffQuery.data ?? [], [staffQuery.data]);
    const staffIds = useMemo(() => staff.map((s) => s.id), [staff]);

    const shiftTypesQuery = useShiftTypes();
    const specialTemplatesQuery = useAllSpecialTemplates(staffIds);
    const overridesQuery = useOverridesForWeek(staffIds, startDate, endDate);
    const licensesQuery = useLicensesForWeek(staffIds, startDate, endDate);
    const permissionsQuery = usePermissionsForWeek(staffIds, startDate, endDate);
    const vacationsQuery = useVacationsForWeek(staffIds, startDate, endDate);

    const isLoading =
        staffQuery.isLoading ||
        shiftTypesQuery.isLoading ||
        (staffIds.length > 0 &&
            (specialTemplatesQuery.isLoading ||
                overridesQuery.isLoading ||
                licensesQuery.isLoading ||
                permissionsQuery.isLoading ||
                vacationsQuery.isLoading));

    const scheduleContext: ScheduleContext = useMemo(
        () => ({
            shiftTypes: shiftTypesQuery.data ?? [],
            specialTemplates: specialTemplatesQuery.data ?? [],
            overrides: overridesQuery.data ?? [],
            licenses: licensesQuery.data ?? [],
            vacations: vacationsQuery.data ?? [],
            permissions: permissionsQuery.data ?? [],
        }),
        [
            shiftTypesQuery.data,
            specialTemplatesQuery.data,
            overridesQuery.data,
            licensesQuery.data,
            permissionsQuery.data,
            vacationsQuery.data,
        ]
    );

    return {
        staff,
        scheduleContext,
        isLoading,
        isError: staffQuery.isError,
    };
}

/**
 * Variante para exportes: la dotación INCLUYE personal suspendido
 * (con sus horarios asignados), requerido por la programación mensual oficial.
 */
export function useControlAsissExportData(startDate: string, endDate: string) {
    const staffQuery = useQuery({
        queryKey: ['controlAsiss', 'staffExport'],
        queryFn: fetchStaffForExport,
    });
    const staff = useMemo(() => staffQuery.data ?? [], [staffQuery.data]);
    const staffIds = useMemo(() => staff.map((s) => s.id), [staff]);

    const shiftTypesQuery = useShiftTypes();
    const specialTemplatesQuery = useAllSpecialTemplates(staffIds);
    const overridesQuery = useOverridesForWeek(staffIds, startDate, endDate);
    const licensesQuery = useLicensesForWeek(staffIds, startDate, endDate);
    const permissionsQuery = usePermissionsForWeek(staffIds, startDate, endDate);
    const vacationsQuery = useVacationsForWeek(staffIds, startDate, endDate);

    const isLoading =
        staffQuery.isLoading ||
        shiftTypesQuery.isLoading ||
        (staffIds.length > 0 &&
            (specialTemplatesQuery.isLoading ||
                overridesQuery.isLoading ||
                licensesQuery.isLoading ||
                permissionsQuery.isLoading ||
                vacationsQuery.isLoading));

    const scheduleContext: ScheduleContext = useMemo(
        () => ({
            shiftTypes: shiftTypesQuery.data ?? [],
            specialTemplates: specialTemplatesQuery.data ?? [],
            overrides: overridesQuery.data ?? [],
            licenses: licensesQuery.data ?? [],
            vacations: vacationsQuery.data ?? [],
            permissions: permissionsQuery.data ?? [],
        }),
        [
            shiftTypesQuery.data,
            specialTemplatesQuery.data,
            overridesQuery.data,
            licensesQuery.data,
            permissionsQuery.data,
            vacationsQuery.data,
        ]
    );

    return {
        /** Dotación completa (incluye suspendidos) — para programación mensual */
        staff,
        /** Solo no suspendidos — para el export individual */
        activeStaff: useMemo(() => staff.filter((s) => !s.suspended), [staff]),
        scheduleContext,
        isLoading,
        isError: staffQuery.isError,
    };
}
