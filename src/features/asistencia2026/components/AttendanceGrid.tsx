/**
 * AttendanceGrid - Weekly calendar grid component
 * Shows staff rows with horarios and calculates off days based on shift patterns
 * Implements Ley 40 horas (43 hrs in 2026 = 2 reduced days per week)
 */

import React, { useMemo, useState } from 'react';
import { DayCell } from './DayCell';
import { DayActionPanel } from './DayActionPanel';
import { broadcastActivity } from '../../../shared/services/activityFeed';
import { CARGO_COLORS } from '../utils/colors';
import {
    StaffWithShift,
    AttendanceMark,
    AttendanceLicense,
    AttendancePermission,
    ShiftType,
    ShiftTypeCode,
    StaffShiftOverride,
    StaffShiftSpecialTemplate,
    IncidenceCode,
    CARGO_ORDER,
} from '../types';
import {
    formatDayNumber,
    formatDayOfWeek,
    isToday,
    getFallbackShiftType,
} from '../utils/shiftEngine';
import { resolveAttendanceDayStatus } from '../utils/attendanceDayStatus';
import { useSessionStore } from '../../../shared/state/sessionStore';
import { isAuthorizedSupervisor } from '../../../shared/utils/authorizedSupervisors';
import {
    useCreateOrUpdateMark,
    useCreateLicense,
    useCreatePermission,
    useCreateVacationDirect,
    useBulkMarkPresent,
} from '../hooks';
import { Icon } from '../../../shared/components/common/Icon';

interface IncidenceMap {
    noMarcaciones: { rut: string; date: string }[];
    sinCredenciales: { rut: string; date: string }[];
    cambiosDia: { rut: string; date: string }[];
    autorizaciones: { rut: string; date: string }[];
}

interface AttendanceGridProps {
    staff: StaffWithShift[];
    shiftTypes: ShiftType[];
    marks: AttendanceMark[];
    licenses: AttendanceLicense[];
    permissions: AttendancePermission[];
    vacations: { staff_id: string; start_date: string; end_date: string }[];
    overrides: StaffShiftOverride[];
    incidences: IncidenceMap;
    specialTemplates: StaffShiftSpecialTemplate[];
    weekDates: string[];
    isLoading?: boolean;
    onRequestOffboarding?: (staff: StaffWithShift) => void;
    onOpenShiftConfig?: (staff: StaffWithShift) => void;
}

export const AttendanceGrid = ({
    staff,
    shiftTypes,
    marks,
    licenses,
    permissions,
    vacations,
    overrides,
    incidences,
    specialTemplates,
    weekDates,
    isLoading = false,
    onRequestOffboarding,
    onOpenShiftConfig,
}: AttendanceGridProps) => {
    const session = useSessionStore((s) => s.session);
    const [selectedCell, setSelectedCell] = useState<{
        staff: StaffWithShift;
        date: string;
    } | null>(null);

    // Presentes masivos: modal con selección de fecha (turnos de noche
    // cruzan medianoche y suelen marcarse al día siguiente)
    const [massMarkOpen, setMassMarkOpen] = useState(false);
    const [massMarkDate, setMassMarkDate] = useState('');

    const createMarkMutation = useCreateOrUpdateMark();
    const createLicenseMutation = useCreateLicense();
    const createPermissionMutation = useCreatePermission();
    const createVacationMutation = useCreateVacationDirect();
    const bulkMarkMutation = useBulkMarkPresent();

    // Group staff by cargo
    const groupedStaff = useMemo(() => {
        const groups: Record<string, StaffWithShift[]> = {};
        for (const cargo of CARGO_ORDER) {
            groups[cargo] = [];
        }

        for (const s of staff) {
            const cargoUpper = s.cargo.toUpperCase();
            let group = 'CLEANER';
            if (cargoUpper.includes('SUPERVISOR')) group = 'SUPERVISOR';
            else if (cargoUpper.includes('INSPECTOR')) group = 'INSPECTOR';
            else if (cargoUpper.includes('CONDUCTOR')) group = 'CONDUCTOR';
            else if (cargoUpper.includes('PLANILLERO')) group = 'PLANILLERO';

            if (groups[group]) {
                groups[group].push(s);
            }
        }

        return groups;
    }, [staff]);

    // Build lookup maps
    const marksMap = useMemo(() => {
        const map = new Map<string, AttendanceMark>();
        for (const m of marks) {
            map.set(`${m.staff_id}-${m.mark_date}`, m);
        }
        return map;
    }, [marks]);

    const shiftTypesMap = useMemo(() => {
        const map = new Map<string, ShiftType>();
        for (const st of shiftTypes) {
            map.set(st.code, st);
        }
        return map;
    }, [shiftTypes]);

    // Build special templates map for ESPECIAL (manual) shift types
    const specialTemplatesMap = useMemo(() => {
        const map = new Map<string, StaffShiftSpecialTemplate>();
        for (const t of specialTemplates) {
            map.set(t.staff_id, t);
        }
        return map;
    }, [specialTemplates]);

    const overridesMap = useMemo(() => {
        const map = new Map<string, StaffShiftOverride>();
        for (const o of overrides) {
            map.set(`${o.staff_id}-${o.override_date}`, o);
        }
        return map;
    }, [overrides]);

    // Helpers
    const dayStatusContext = useMemo(
        () => ({
            marksMap,
            shiftTypesMap,
            specialTemplatesMap,
            overridesMap,
            licenses,
            vacations,
            permissions,
            incidences,
        }),
        [
            marksMap,
            shiftTypesMap,
            specialTemplatesMap,
            overridesMap,
            licenses,
            vacations,
            permissions,
            incidences,
        ]
    );

    const getDayStatus = (s: StaffWithShift, date: string) =>
        resolveAttendanceDayStatus(s, date, dayStatusContext);

    // ---- Presentes masivos con fecha seleccionable ----
    const localDateStr = (offsetDays: number = 0): string => {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${m}-${dd}`;
    };

    /** Personal pendiente de marcar (citado, sin marca ni ausencia) para una fecha */
    const getPendingForDate = (date: string): StaffWithShift[] =>
        staff.filter((s) => {
            if (s.status === 'DESVINCULADO') return false;
            const status = getDayStatus(s, date);
            if (status.isOff || status.license || status.vacation || status.permission) return false;
            if (status.mark) return false; // no sobreescribir P/A existentes
            return true;
        });

    const openMassMark = () => {
        // Fecha por defecto: hoy si está en la semana visible, si no el último día visible
        const today = localDateStr();
        const defaultDate = weekDates.includes(today) ? today : weekDates[weekDates.length - 1];
        setMassMarkDate(defaultDate);
        setMassMarkOpen(true);
    };

    const executeMassMark = () => {
        if (!session || !massMarkDate) return;
        const staffToMark = getPendingForDate(massMarkDate);
        if (staffToMark.length === 0) return;

        bulkMarkMutation.mutate({
            staffIds: staffToMark.map((s) => s.id),
            date: massMarkDate,
            createdBy: session.supervisorName,
        });
        broadcastActivity({
            actor: session.supervisorName,
            accion: 'marcó PRESENTES MASIVOS a',
            objetivo: `${staffToMark.length} persona(s)`,
            seccion: 'Asistencia',
            detalle: massMarkDate.split('-').reverse().join('-'),
        });
        setMassMarkOpen(false);
    };

    // Action handlers
    const fmtCL = (d: string) => d.split('-').reverse().join('-');

    const handleMarkPresent = () => {
        if (!selectedCell || !session) return;
        createMarkMutation.mutate({
            values: {
                staff_id: selectedCell.staff.id,
                mark_date: selectedCell.date,
                mark: 'P',
            },
            createdBy: session.supervisorName,
        });
        broadcastActivity({
            actor: session.supervisorName,
            accion: 'puso PRESENTE a',
            objetivo: selectedCell.staff.nombre,
            seccion: 'Asistencia',
            detalle: fmtCL(selectedCell.date),
        });
        setSelectedCell(null);
    };

    const handleMarkAbsent = (note: string) => {
        if (!selectedCell || !session) return;
        createMarkMutation.mutate({
            values: {
                staff_id: selectedCell.staff.id,
                mark_date: selectedCell.date,
                mark: 'A',
                note,
            },
            createdBy: session.supervisorName,
        });
        broadcastActivity({
            actor: session.supervisorName,
            accion: 'puso AUSENTE a',
            objetivo: selectedCell.staff.nombre,
            seccion: 'Asistencia',
            detalle: `${fmtCL(selectedCell.date)}${note ? ` · ${note}` : ''}`,
        });
        setSelectedCell(null);
    };

    const handleRegisterLicense = (startDate: string, endDate: string, note?: string) => {
        if (!selectedCell || !session) return;
        createLicenseMutation.mutate({
            values: {
                staff_id: selectedCell.staff.id,
                start_date: startDate,
                end_date: endDate,
                note,
            },
            createdBy: session.supervisorName,
        });
        broadcastActivity({
            actor: session.supervisorName,
            accion: 'registró LICENCIA para',
            objetivo: selectedCell.staff.nombre,
            seccion: 'Asistencia',
            detalle: `${fmtCL(startDate)} al ${fmtCL(endDate)}`,
        });
        setSelectedCell(null);
    };

    const handleRegisterPermission = (startDate: string, endDate: string, type: string, note?: string) => {
        if (!selectedCell || !session) return;
        createPermissionMutation.mutate({
            values: {
                staff_id: selectedCell.staff.id,
                start_date: startDate,
                end_date: endDate,
                permission_type: type,
                note,
            },
            createdBy: session.supervisorName,
        });
        broadcastActivity({
            actor: session.supervisorName,
            accion: 'registró PERMISO para',
            objetivo: selectedCell.staff.nombre,
            seccion: 'Asistencia',
            detalle: `${fmtCL(startDate)} al ${fmtCL(endDate)}`,
        });
        setSelectedCell(null);
    };

    const handleRegisterVacation = (startDate: string, endDate: string) => {
        if (!selectedCell || !session) return;
        createVacationMutation.mutate({
            staff: {
                rut: selectedCell.staff.rut,
                nombre: selectedCell.staff.nombre,
                cargo: selectedCell.staff.cargo,
                terminal_code: selectedCell.staff.terminal_code,
                turno: selectedCell.staff.turno,
            },
            startDate,
            endDate,
            createdBy: session.supervisorName,
        });
        broadcastActivity({
            actor: session.supervisorName,
            accion: 'registró VACACIONES para',
            objetivo: selectedCell.staff.nombre,
            seccion: 'Asistencia',
            detalle: `${fmtCL(startDate)} al ${fmtCL(endDate)}`,
        });
        setSelectedCell(null);
    };

    const isManager = Boolean(session?.supervisorName && isAuthorizedSupervisor(session.supervisorName));

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Icon name="loader" size={24} className="animate-spin text-brand-600" />
                <span className="ml-2 text-slate-600">Cargando...</span>
            </div>
        );
    }

    const formatDayNameShort = (date: string) => {
        const d = new Date(date + 'T12:00:00');
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        return days[d.getDay()];
    };

    return (
        <>
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* Barra superior de la grilla */}
                <div className="flex flex-col gap-2 border-b bg-gradient-to-r from-slate-800 to-slate-700 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                            <Icon name="users" size={16} className="text-white" />
                        </span>
                        <div>
                            <p className="text-sm font-bold leading-tight text-white">Grilla Semanal de Asistencia</p>
                            <p className="text-[11px] text-slate-300">{staff.length} trabajadores en vista</p>
                        </div>
                    </div>
                    <button
                        onClick={openMassMark}
                        disabled={bulkMarkMutation.isPending}
                        className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                    >
                        <Icon name={bulkMarkMutation.isPending ? 'loader' : 'check-circle'} size={16} className={bulkMarkMutation.isPending ? 'animate-spin' : ''} />
                        {bulkMarkMutation.isPending ? 'Marcando…' : 'Presentes Masivos'}
                    </button>
                </div>

                {/* Mobile View - Cards */}
                <div className="md:hidden space-y-4 p-3 bg-slate-50">
                    {CARGO_ORDER.map((cargo) => {
                        const staffInGroup = groupedStaff[cargo] || [];
                        if (staffInGroup.length === 0) return null;

                        return (
                            <div key={cargo} className="space-y-3">
                                {/* Cargo Header */}
                                <div className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${CARGO_COLORS[cargo]}`}>
                                    {cargo}
                                </div>

                                {staffInGroup.map((s) => {
                                    const isDesvinculado = s.status === 'DESVINCULADO';
                                    const shiftType = s.shift ? shiftTypesMap.get(s.shift.shift_type_code) : null;

                                    return (
                                        <div key={s.id} className={`bg-white rounded-xl shadow-sm border p-4 ${isDesvinculado ? 'opacity-60' : ''}`}>
                                            {/* Card Header: Info + Config */}
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h3 className={`font-bold text-slate-800 ${isDesvinculado ? 'line-through' : ''}`}>
                                                        {s.nombre}
                                                    </h3>
                                                    <p className="text-xs text-slate-500 mt-0.5 font-mono">
                                                        {s.rut}
                                                    </p>
                                                    <div className="flex flex-wrap gap-2 mt-1.5">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                            {s.horario || 'S/H'}
                                                        </span>
                                                        {shiftType && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-brand-50 text-brand-700 border border-brand-100">
                                                                {shiftType.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    {onOpenShiftConfig && (
                                                        <button
                                                            onClick={() => onOpenShiftConfig(s)}
                                                            className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 hover:text-brand-600 transition-colors"
                                                        >
                                                            <Icon name="settings" size={20} />
                                                        </button>
                                                    )}
                                                    {s.admonitionCount && s.admonitionCount > 0 ? (
                                                        <span className="flex items-center justify-center h-6 w-6 text-xs font-bold bg-red-100 text-red-600 rounded-full">
                                                            {s.admonitionCount}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {/* Attendance Strip */}
                                            <div className="mt-4">
                                                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide snap-x">
                                                    {weekDates.map((date) => {
                                                        const status = getDayStatus(s, date);
                                                        const dayName = formatDayNameShort(date);
                                                        const dayNum = formatDayNumber(date);
                                                        const isTodayDate = isToday(date);

                                                        return (
                                                            <div key={date} className="flex-shrink-0 w-[74px] snap-center flex flex-col items-center gap-1">
                                                                <div className={`text-[10px] font-medium uppercase ${isTodayDate ? 'text-brand-600 font-bold' : 'text-slate-400'}`}>
                                                                    {dayName} {dayNum}
                                                                </div>
                                                                <div className="w-full">
                                                                    <DayCell
                                                                        date={date}
                                                                        isOff={status.isOff}
                                                                        horario={status.isOff ? undefined : status.horario}
                                                                        reducido={status.reducido}
                                                                        turno={status.turno}
                                                                        mark={status.mark}
                                                                        incidencies={status.incidencies}
                                                                        isToday={isTodayDate}
                                                                        isDisabled={isDesvinculado}
                                                                        licenseCode={status.license ? 'LIC' : undefined}
                                                                        vacationCode={status.vacation ? 'VAC' : undefined}
                                                                        permissionCode={status.permission ? 'PER' : undefined}
                                                                        onClick={() => setSelectedCell({ staff: s, date })}
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>

                {/* Desktop View - Tabla empresarial (mismo ADN que Programación Mensual) */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="border-collapse w-full">
                        {/* Encabezado oscuro con días de la semana */}
                        <thead>
                            <tr>
                                <th className="sticky left-0 z-20 min-w-[250px] border-b border-r bg-slate-800 px-3 py-2 text-left text-xs font-bold text-white">
                                    SEMANA — Trabajador
                                </th>
                                {weekDates.map((date) => {
                                    const d = new Date(date + 'T12:00:00');
                                    const dow = d.getDay();
                                    const isTodayDate = isToday(date);
                                    return (
                                        <th
                                            key={date}
                                            className={`min-w-[92px] border-b px-1 py-1.5 text-center ${dow === 0 ? 'bg-red-700 text-white' : dow === 6 ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-200'}`}
                                        >
                                            <div className="text-[9px] font-semibold uppercase">{formatDayOfWeek(date)}</div>
                                            <div className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${isTodayDate ? 'bg-brand-500 text-white' : ''}`}>
                                                {formatDayNumber(date)}
                                            </div>
                                        </th>
                                    );
                                })}
                                <th className="min-w-[86px] border-b border-l-2 border-l-slate-400 bg-slate-800 px-2 py-1.5 text-center text-[9px] font-bold text-slate-200">
                                    RESUMEN<br />P · A · Libres
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {CARGO_ORDER.map((cargo) => {
                                const staffInGroup = groupedStaff[cargo] || [];
                                if (staffInGroup.length === 0) return null;

                                return (
                                    <React.Fragment key={cargo}>
                                        {/* Título de cargo: FIJO al scroll horizontal */}
                                        <tr>
                                            <td className="sticky left-0 z-10 border-b border-r bg-blue-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-800">
                                                {cargo} ({staffInGroup.length})
                                            </td>
                                            <td colSpan={weekDates.length + 1} className="border-b bg-blue-50" />
                                        </tr>

                                        {/* Filas de personal */}
                                        {staffInGroup.map((s) => {
                                            const isDesvinculado = s.status === 'DESVINCULADO';
                                            const shiftType = s.shift ? shiftTypesMap.get(s.shift.shift_type_code) : null;
                                            const weekStatuses = weekDates.map((date) => getDayStatus(s, date));
                                            const sumP = weekStatuses.filter((st) => st.mark?.mark === 'P').length;
                                            const sumA = weekStatuses.filter((st) => st.mark?.mark === 'A').length;
                                            const sumL = weekStatuses.filter((st) => st.isOff).length;

                                            return (
                                                <tr
                                                    key={s.id}
                                                    className={`group transition-colors ${isDesvinculado ? 'bg-slate-50 opacity-60' : ''}`}
                                                >
                                                    {/* Ficha del trabajador (fija) */}
                                                    <td className={`sticky left-0 z-10 border-b border-r px-3 py-1 ${isDesvinculado ? 'bg-slate-50' : 'bg-white'} group-hover:bg-slate-50`}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <p className={`truncate text-xs font-bold text-slate-800 ${isDesvinculado ? 'line-through' : ''}`}>
                                                                    {s.nombre}
                                                                    {s.admonitionCount && s.admonitionCount > 0 ? (
                                                                        <span className="ml-1.5 rounded bg-red-100 px-1 text-[9px] font-bold text-red-700" title={`${s.admonitionCount} amonestación(es)`}>
                                                                            {s.admonitionCount}
                                                                        </span>
                                                                    ) : null}
                                                                </p>
                                                                <div className="mt-0.5 flex items-center gap-1.5">
                                                                    <span className="text-[10px] text-slate-400">{s.rut}</span>
                                                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                                                                        {s.horario || 'S/H'}
                                                                    </span>
                                                                    {shiftType && (
                                                                        <span className="truncate rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600">
                                                                            {shiftType.name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {onOpenShiftConfig && (
                                                                <button
                                                                    onClick={() => onOpenShiftConfig(s)}
                                                                    className="shrink-0 rounded p-1.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-brand-600"
                                                                    title="Configurar turno y días libres"
                                                                >
                                                                    <Icon name="settings" size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Celdas de día */}
                                                    {weekDates.map((date, di) => {
                                                        const status = weekStatuses[di];
                                                        return (
                                                            <td key={date} className="border-b border-r border-slate-100 p-0.5">
                                                                <DayCell
                                                                    date={date}
                                                                    isOff={status.isOff}
                                                                    horario={status.isOff ? undefined : status.horario}
                                                                    reducido={status.reducido}
                                                                    turno={status.turno}
                                                                    mark={status.mark}
                                                                    incidencies={status.incidencies}
                                                                    isToday={isToday(date)}
                                                                    isDisabled={isDesvinculado}
                                                                    licenseCode={status.license ? 'LIC' : undefined}
                                                                    vacationCode={status.vacation ? 'VAC' : undefined}
                                                                    permissionCode={status.permission ? 'PER' : undefined}
                                                                    onClick={() => setSelectedCell({ staff: s, date })}
                                                                />
                                                            </td>
                                                        );
                                                    })}

                                                    {/* Resumen semanal de la persona */}
                                                    <td className="border-b border-l-2 border-l-slate-400 px-1 py-1 text-center">
                                                        <div className="flex items-center justify-center gap-1 text-[10px] font-bold">
                                                            <span className={sumP > 0 ? 'text-emerald-600' : 'text-slate-300'}>{sumP}</span>
                                                            <span className="text-slate-300">·</span>
                                                            <span className={sumA > 0 ? 'rounded bg-red-100 px-1 text-red-700' : 'text-slate-300'}>{sumA}</span>
                                                            <span className="text-slate-300">·</span>
                                                            <span className="text-slate-500">{sumL}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {/* Cuadratura diaria del cargo: Día / Noche / Libres */}
                                        <tr>
                                            <td className="sticky left-0 z-10 border-b-2 border-r border-b-slate-300 bg-gradient-to-r from-slate-700 to-slate-600 px-3 py-1.5">
                                                <p className="text-[10px] font-bold uppercase text-white">Cuadratura</p>
                                                <div className="mt-0.5 flex gap-1.5 text-[9px] font-semibold">
                                                    <span className="rounded-full bg-sky-400/90 px-1.5 text-white">Día</span>
                                                    <span className="rounded-full bg-indigo-400/90 px-1.5 text-white">Noche</span>
                                                    <span className="rounded-full bg-slate-400/80 px-1.5 text-white">Libres</span>
                                                </div>
                                            </td>
                                            {weekDates.map((date) => {
                                                let dia = 0, noche = 0, libre = 0;
                                                for (const s of staffInGroup) {
                                                    if (s.status === 'DESVINCULADO') continue;
                                                    const st = getDayStatus(s, date);
                                                    if (st.isOff) libre++;
                                                    else if (st.license || st.vacation || st.permission) { /* ausencia */ }
                                                    else if (st.turno === 'NOCHE') noche++;
                                                    else dia++;
                                                }
                                                return (
                                                    <td key={date} className="border-b-2 border-r border-slate-100 border-b-slate-300 bg-slate-100/80 px-0.5 py-1 text-center align-middle">
                                                        <div className="mx-auto flex w-fit flex-col gap-0.5">
                                                            <span className={`flex min-w-[30px] items-center justify-between gap-0.5 rounded-full px-1.5 text-[9px] font-bold leading-4 ${dia === 0 ? 'bg-red-500 text-white shadow-sm' : 'bg-sky-100 text-sky-800'}`}>
                                                                <span className="opacity-70">D</span><span>{dia}</span>
                                                            </span>
                                                            <span className={`flex min-w-[30px] items-center justify-between gap-0.5 rounded-full px-1.5 text-[9px] font-bold leading-4 ${noche === 0 ? 'bg-red-500 text-white shadow-sm' : 'bg-indigo-100 text-indigo-800'}`}>
                                                                <span className="opacity-70">N</span><span>{noche}</span>
                                                            </span>
                                                            <span className="flex min-w-[30px] items-center justify-between gap-0.5 rounded-full bg-slate-200 px-1.5 text-[9px] font-bold leading-4 text-slate-500">
                                                                <span className="opacity-70">L</span><span>{libre}</span>
                                                            </span>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td className="border-b-2 border-l-2 border-b-slate-300 border-l-slate-400 bg-slate-100/80" />
                                        </tr>
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Leyenda integrada */}
                <div className="hidden flex-wrap items-center gap-x-4 gap-y-1 border-t bg-slate-50 px-4 py-2 text-[11px] text-slate-500 md:flex">
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-6 rounded bg-emerald-100 ring-1 ring-emerald-300 text-center text-[9px] font-bold leading-3 text-emerald-700">P</span> Presente</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-6 rounded bg-red-100 ring-1 ring-red-300 text-center text-[9px] font-bold leading-3 text-red-700">A</span> Ausente</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-6 rounded bg-slate-200 text-center text-[9px] font-bold leading-3 text-slate-600">L</span> Libre</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-6 rounded bg-blue-50 ring-1 ring-blue-200" /> Trabaja día</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-6 rounded bg-indigo-50 ring-1 ring-indigo-200" /> Trabaja noche</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-8 rounded bg-purple-100 text-center text-[8px] font-bold leading-3 text-purple-700">LIC</span> Licencia</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-8 rounded bg-teal-100 text-center text-[8px] font-bold leading-3 text-teal-700">VAC</span> Vacaciones</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-8 rounded bg-orange-100 text-center text-[8px] font-bold leading-3 text-orange-700">PER</span> Permiso</span>
                    <span className="ml-auto">Cuadratura por cargo: trabajando Día · Noche · Libres — rojo = turno sin nadie</span>
                </div>
            </div>

            {/* Action panel */}
            <DayActionPanel
                isOpen={selectedCell !== null}
                onClose={() => setSelectedCell(null)}
                staff={selectedCell?.staff ?? null}
                date={selectedCell?.date ?? ''}
                currentMark={selectedCell ? marksMap.get(`${selectedCell.staff.id}-${selectedCell.date}`)?.mark : undefined}
                currentNote={selectedCell ? marksMap.get(`${selectedCell.staff.id}-${selectedCell.date}`)?.note ?? undefined : undefined}
                incidencies={selectedCell ? getDayStatus(selectedCell.staff, selectedCell.date).incidencies : []}
                onMarkPresent={handleMarkPresent}
                onMarkAbsent={handleMarkAbsent}
                onRegisterLicense={handleRegisterLicense}
                onRegisterPermission={handleRegisterPermission}
                onRegisterVacation={handleRegisterVacation}
                onRequestOffboarding={
                    isManager && onRequestOffboarding && selectedCell
                        ? () => onRequestOffboarding(selectedCell.staff)
                        : undefined
                }
                isManager={isManager ?? false}
            />

            {/* Modal: Presentes Masivos con selección de fecha */}
            {massMarkOpen && (() => {
                const pending = massMarkDate ? getPendingForDate(massMarkDate) : [];
                const byTerminal = pending.reduce<Record<string, number>>((acc, s) => {
                    acc[s.terminal_code] = (acc[s.terminal_code] || 0) + 1;
                    return acc;
                }, {});
                const hoy = localDateStr();
                const ayer = localDateStr(-1);
                const dateLabel = massMarkDate
                    ? new Date(massMarkDate + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long' })
                    : '';

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                            {/* Header */}
                            <div className="flex items-center justify-between border-b bg-slate-800 px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500">
                                        <Icon name="check-circle" size={18} className="text-white" />
                                    </span>
                                    <div>
                                        <h3 className="font-bold text-white">Presentes Masivos</h3>
                                        <p className="text-xs text-slate-300">Selecciona la fecha a marcar</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setMassMarkOpen(false)}
                                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                                >
                                    <Icon name="x" size={18} />
                                </button>
                            </div>

                            <div className="space-y-4 p-5">
                                {/* Selección de fecha */}
                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        Fecha de la marca
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            value={massMarkDate}
                                            min={weekDates[0]}
                                            max={weekDates[weekDates.length - 1]}
                                            onChange={(e) => setMassMarkDate(e.target.value)}
                                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                                        />
                                        {weekDates.includes(ayer) && (
                                            <button
                                                onClick={() => setMassMarkDate(ayer)}
                                                className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${massMarkDate === ayer
                                                    ? 'bg-slate-800 text-white'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                            >
                                                Ayer
                                            </button>
                                        )}
                                        {weekDates.includes(hoy) && (
                                            <button
                                                onClick={() => setMassMarkDate(hoy)}
                                                className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${massMarkDate === hoy
                                                    ? 'bg-slate-800 text-white'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                            >
                                                Hoy
                                            </button>
                                        )}
                                    </div>
                                    <p className="mt-1.5 text-xs text-slate-400">
                                        Útil para turnos de noche que cruzan medianoche: puedes marcar el día anterior.
                                        Solo fechas de la semana visible ({weekDates[0].split('-').reverse().join('-')} al {weekDates[6].split('-').reverse().join('-')}).
                                    </p>
                                </div>

                                {/* Resumen de lo que se marcará */}
                                {massMarkDate && (
                                    pending.length > 0 ? (
                                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                            <p className="text-sm font-bold text-emerald-900">
                                                Se marcarán {pending.length} persona(s) como PRESENTE
                                            </p>
                                            <p className="mt-0.5 text-xs capitalize text-emerald-700">{dateLabel}</p>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {Object.entries(byTerminal).map(([term, count]) => (
                                                    <span key={term} className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                                                        {term}: {count}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="mt-2 text-[11px] text-emerald-600">
                                                Solo se marca al personal citado ese día que aún no tiene marca.
                                                No se sobreescriben presentes/ausentes ya registrados.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                                            No hay personal pendiente de marcar para esa fecha
                                            (todos ya tienen marca, están libres o con licencia/vacaciones/permiso).
                                        </div>
                                    )
                                )}
                            </div>

                            {/* Footer */}
                            <div className="flex justify-end gap-3 border-t bg-slate-50 px-5 py-4">
                                <button
                                    onClick={() => setMassMarkOpen(false)}
                                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={executeMassMark}
                                    disabled={!massMarkDate || pending.length === 0 || bulkMarkMutation.isPending}
                                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <Icon name="check" size={16} />
                                    Confirmar ({pending.length})
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </>
    );
};
