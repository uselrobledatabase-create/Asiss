/**
 * Control ASISS - Hook de datos
 * Carga dotación completa + todo lo necesario para resolver la
 * programación de un rango de fechas (turnos, plantillas, overrides,
 * licencias, vacaciones y permisos).
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TerminalContext } from '../../shared/types/terminal';
import { upsertStaffShift, upsertOverride } from '../asistencia2026/api/asistencia2026Api';
import { StaffShiftFormValues } from '../asistencia2026/types';
import { deleteOverride } from './api';
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

/** Invalida tanto las queries de asistencia como la dotación de Control ASISS */
function useInvalidateProgramming() {
    const queryClient = useQueryClient();
    return () => {
        queryClient.invalidateQueries({ queryKey: ['asistencia2026'] });
        queryClient.invalidateQueries({ queryKey: ['controlAsiss', 'staffExport'] });
    };
}

/** Cambio de modalidad de turno desde Control ASISS (refleja en Asistencia) */
export function useUpsertShiftControl() {
    const invalidate = useInvalidateProgramming();
    return useMutation({
        mutationFn: (values: StaffShiftFormValues) => upsertStaffShift(values),
        onSuccess: invalidate,
    });
}

/** Ajuste puntual de un día (cambio de día) desde Control ASISS */
export function useUpsertOverrideControl() {
    const invalidate = useInvalidateProgramming();
    return useMutation({
        mutationFn: ({ staffId, date, type }: { staffId: string; date: string; type: 'OFF' | 'WORK' }) =>
            upsertOverride(staffId, date, type),
        onSuccess: invalidate,
    });
}

/** Quitar un ajuste puntual, volviendo al patrón normal */
export function useDeleteOverrideControl() {
    const invalidate = useInvalidateProgramming();
    return useMutation({
        mutationFn: ({ staffId, date }: { staffId: string; date: string }) =>
            deleteOverride(staffId, date),
        onSuccess: invalidate,
    });
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
