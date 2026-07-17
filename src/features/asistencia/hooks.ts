import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { TerminalContext } from '../../shared/types/terminal';
import { broadcastActivity } from '../../shared/services/activityFeed';
import {
    fetchNoMarcaciones,
    fetchSinCredenciales,
    fetchCambiosDia,
    fetchAutorizaciones,
    fetchVacaciones,
    createNoMarcacion,
    createSinCredencial,
    createCambioDia,
    createAutorizacion,
    createVacacion,
    updateNoMarcacion,
    updateSinCredencial,
    updateCambioDia,
    updateAutorizacion,
    updateVacacion,
    authorizeRecord,
    rejectRecord,
    fetchKPIs,
    subscribeToAttendanceChanges,
    sendAuthorizationEmail,
} from './api';
import {
    AttendanceFilters,
    NoMarcacionFormValues,
    SinCredencialFormValues,
    CambioDiaFormValues,
    AutorizacionFormValues,
    VacacionFormValues,
    AttendanceSubsection,
    SUBSECTION_LABELS,
} from './types';

// ==========================================
// QUERY KEYS
// ==========================================

export const attendanceKeys = {
    all: ['attendance'] as const,
    noMarcaciones: (ctx: TerminalContext, filters?: AttendanceFilters) =>
        [...attendanceKeys.all, 'no-marcaciones', ctx, filters] as const,
    sinCredenciales: (ctx: TerminalContext, filters?: AttendanceFilters) =>
        [...attendanceKeys.all, 'sin-credenciales', ctx, filters] as const,
    cambiosDia: (ctx: TerminalContext, filters?: AttendanceFilters) =>
        [...attendanceKeys.all, 'cambios-dia', ctx, filters] as const,
    autorizaciones: (ctx: TerminalContext, filters?: AttendanceFilters) =>
        [...attendanceKeys.all, 'autorizaciones', ctx, filters] as const,
    vacaciones: (ctx: TerminalContext, filters?: AttendanceFilters) =>
        [...attendanceKeys.all, 'vacaciones', ctx, filters] as const,
    kpis: (subsection: AttendanceSubsection, ctx: TerminalContext) =>
        [...attendanceKeys.all, 'kpis', subsection, ctx] as const,
};

// ==========================================
// LIST QUERIES
// ==========================================

export const useNoMarcaciones = (ctx: TerminalContext, filters?: AttendanceFilters) =>
    useQuery({
        queryKey: attendanceKeys.noMarcaciones(ctx, filters),
        queryFn: () => fetchNoMarcaciones(ctx, filters),
    });

export const useSinCredenciales = (ctx: TerminalContext, filters?: AttendanceFilters) =>
    useQuery({
        queryKey: attendanceKeys.sinCredenciales(ctx, filters),
        queryFn: () => fetchSinCredenciales(ctx, filters),
    });

export const useCambiosDia = (ctx: TerminalContext, filters?: AttendanceFilters) =>
    useQuery({
        queryKey: attendanceKeys.cambiosDia(ctx, filters),
        queryFn: () => fetchCambiosDia(ctx, filters),
    });

export const useAutorizaciones = (ctx: TerminalContext, filters?: AttendanceFilters) =>
    useQuery({
        queryKey: attendanceKeys.autorizaciones(ctx, filters),
        queryFn: () => fetchAutorizaciones(ctx, filters),
    });

export const useVacaciones = (ctx: TerminalContext, filters?: AttendanceFilters) =>
    useQuery({
        queryKey: attendanceKeys.vacaciones(ctx, filters),
        queryFn: () => fetchVacaciones(ctx, filters),
    });

// ==========================================
// KPI QUERIES
// ==========================================

const TABLE_NAMES: Record<AttendanceSubsection, string> = {
    'asistencia-2026': 'attendance_marks', // Not used for KPIs, but needed for type
    'no-marcaciones': 'attendance_no_marcaciones',
    'sin-credenciales': 'attendance_sin_credenciales',
    'cambios-dia': 'attendance_cambios_dia',
    'autorizaciones': 'attendance_autorizaciones',
    'vacaciones': 'attendance_vacaciones',
};

const DATE_COLUMNS: Record<AttendanceSubsection, string> = {
    'asistencia-2026': 'mark_date', // Not used for KPIs, but needed for type
    'no-marcaciones': 'date',
    'sin-credenciales': 'date',
    'cambios-dia': 'date',
    'autorizaciones': 'authorization_date',
    'vacaciones': 'start_date',
};

export const useAttendanceKPIs = (subsection: AttendanceSubsection, ctx: TerminalContext) =>
    useQuery({
        queryKey: attendanceKeys.kpis(subsection, ctx),
        queryFn: () => fetchKPIs(TABLE_NAMES[subsection] as any, ctx, DATE_COLUMNS[subsection]),
    });

// ==========================================
// CREATE MUTATIONS
// ==========================================

export const useCreateNoMarcacion = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ values, createdBy }: { values: NoMarcacionFormValues; createdBy: string }) =>
            createNoMarcacion(values, createdBy),
        onSuccess: (_data, { values, createdBy }) => {
            qc.invalidateQueries({ queryKey: attendanceKeys.all });
            broadcastActivity({
                actor: createdBy,
                accion: 'registró NO MARCACIÓN para',
                objetivo: values.nombre,
                seccion: 'Asistencia',
                detalle: values.date.split('-').reverse().join('-'),
            });
        },
    });
};

export const useCreateSinCredencial = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ values, createdBy }: { values: SinCredencialFormValues; createdBy: string }) =>
            createSinCredencial(values, createdBy),
        onSuccess: (_data, { values, createdBy }) => {
            qc.invalidateQueries({ queryKey: attendanceKeys.all });
            broadcastActivity({
                actor: createdBy,
                accion: 'registró SIN CREDENCIAL para',
                objetivo: values.nombre,
                seccion: 'Asistencia',
                detalle: values.date.split('-').reverse().join('-'),
            });
        },
    });
};

export const useCreateCambioDia = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ values, createdBy }: { values: CambioDiaFormValues; createdBy: string }) =>
            createCambioDia(values, createdBy),
        onSuccess: (_data, { values, createdBy }) => {
            qc.invalidateQueries({ queryKey: attendanceKeys.all });
            broadcastActivity({
                actor: createdBy,
                accion: 'registró CAMBIO DE DÍA para',
                objetivo: values.nombre,
                seccion: 'Asistencia',
                detalle: values.day_on_date ? `trabaja el ${values.day_on_date.split('-').reverse().join('-')}` : undefined,
            });
        },
    });
};

export const useCreateAutorizacion = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ values, createdBy }: { values: AutorizacionFormValues; createdBy: string }) =>
            createAutorizacion(values, createdBy),
        onSuccess: (_data, { values, createdBy }) => {
            qc.invalidateQueries({ queryKey: attendanceKeys.all });
            broadcastActivity({
                actor: createdBy,
                accion: 'registró AUTORIZACIÓN para',
                objetivo: values.nombre,
                seccion: 'Asistencia',
            });
        },
    });
};

export const useCreateVacacion = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ values, createdBy }: { values: VacacionFormValues; createdBy: string }) =>
            createVacacion(values, createdBy),
        onSuccess: (_data, { values, createdBy }) => {
            qc.invalidateQueries({ queryKey: attendanceKeys.all });
            broadcastActivity({
                actor: createdBy,
                accion: 'registró VACACIONES para',
                objetivo: values.nombre,
                seccion: 'Asistencia',
                detalle: `${values.start_date.split('-').reverse().join('-')} al ${values.end_date.split('-').reverse().join('-')}`,
            });
        },
    });
};

// ==========================================
// UPDATE MUTATIONS
// ==========================================

export const useUpdateNoMarcacion = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, values }: { id: string; values: Partial<NoMarcacionFormValues> }) =>
            updateNoMarcacion(id, values),
        onSuccess: () => qc.invalidateQueries({ queryKey: attendanceKeys.all }),
    });
};

export const useUpdateSinCredencial = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, values }: { id: string; values: Partial<SinCredencialFormValues> }) =>
            updateSinCredencial(id, values),
        onSuccess: () => qc.invalidateQueries({ queryKey: attendanceKeys.all }),
    });
};

export const useUpdateCambioDia = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, values }: { id: string; values: Partial<CambioDiaFormValues> }) =>
            updateCambioDia(id, values),
        onSuccess: () => qc.invalidateQueries({ queryKey: attendanceKeys.all }),
    });
};

export const useUpdateAutorizacion = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, values }: { id: string; values: Partial<AutorizacionFormValues> }) =>
            updateAutorizacion(id, values),
        onSuccess: () => qc.invalidateQueries({ queryKey: attendanceKeys.all }),
    });
};

export const useUpdateVacacion = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, values }: { id: string; values: Partial<VacacionFormValues> }) =>
            updateVacacion(id, values),
        onSuccess: () => qc.invalidateQueries({ queryKey: attendanceKeys.all }),
    });
};

// ==========================================
// AUTHORIZATION MUTATIONS
// ==========================================

export const useAuthorize = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({
            subsection,
            id,
            authorizedBy,
            rut,
            nombre,
            terminal,
            date,
        }: {
            subsection: AttendanceSubsection;
            id: string;
            authorizedBy: string;
            rut: string;
            nombre: string;
            terminal: string;
            date: string;
        }) => {
            await authorizeRecord(TABLE_NAMES[subsection] as any, id, authorizedBy);
            await sendAuthorizationEmail('AUTORIZADO', SUBSECTION_LABELS[subsection], rut, nombre, terminal, date);
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: attendanceKeys.all }),
    });
};

export const useReject = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({
            subsection,
            id,
            authorizedBy,
            reason,
            rut,
            nombre,
            terminal,
            date,
        }: {
            subsection: AttendanceSubsection;
            id: string;
            authorizedBy: string;
            reason: string;
            rut: string;
            nombre: string;
            terminal: string;
            date: string;
        }) => {
            await rejectRecord(TABLE_NAMES[subsection] as any, id, authorizedBy, reason);
            await sendAuthorizationEmail('RECHAZADO', SUBSECTION_LABELS[subsection], rut, nombre, terminal, date, reason);
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: attendanceKeys.all }),
    });
};

// ==========================================
// REALTIME HOOK
// ==========================================

export const useAttendanceRealtime = () => {
    const qc = useQueryClient();

    useEffect(() => {
        const unsubscribe = subscribeToAttendanceChanges(
            () => qc.invalidateQueries({ queryKey: attendanceKeys.all }),
            () => qc.invalidateQueries({ queryKey: attendanceKeys.all })
        );
        return () => {
            unsubscribe();
        };
    }, [qc]);
};

