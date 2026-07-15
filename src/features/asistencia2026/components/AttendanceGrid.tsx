/**
 * AttendanceGrid - Weekly calendar grid component
 * Shows staff rows with horarios and calculates off days based on shift patterns
 * Implements Ley 40 horas (43 hrs in 2026 = 2 reduced days per week)
 */

import React, { useMemo, useState } from 'react';
import { DayCell } from './DayCell';
import { DayActionPanel } from './DayActionPanel';
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
    isOffDay,
    isDateInRange,
    getTurnoFromHorario,
    getSpecialShiftDetails,
} from '../utils/shiftEngine';
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

/**
 * Fallback shift patterns when DB doesn't have shift_types data
 */
function getFallbackShiftType(code: ShiftTypeCode): ShiftType | undefined {
    const fallbacks: Record<ShiftTypeCode, ShiftType> = {
        '5X2_FIJO': {
            id: '1',
            code: '5X2_FIJO',
            name: '5x2 Fijo',
            pattern_json: { type: 'fixed', description: 'Lun-Vie trabaja', offDays: [6, 0] },
            created_at: '',
        },
        '5X2_ROTATIVO': {
            id: '2',
            code: '5X2_ROTATIVO',
            name: '5x2 Rotativo',
            pattern_json: {
                type: 'rotating',
                description: 'Rotativo 2 semanas',
                cycle: 2,
                weeks: [{ offDays: [3, 0] }, { offDays: [5, 6] }],
            },
            created_at: '',
        },
        '5X2_SUPER': {
            id: '3',
            code: '5X2_SUPER',
            name: '5x2 Super',
            pattern_json: {
                type: 'rotating',
                description: 'Super 2 semanas',
                cycle: 2,
                weeks: [{ offDays: [3, 0] }, { offDays: [4, 5] }],
            },
            created_at: '',
        },
        'ESPECIAL': {
            id: '4',
            code: 'ESPECIAL',
            name: 'Especial',
            pattern_json: { type: 'manual', description: 'Manual 28 dias', cycleDays: 28 },
            created_at: '',
        },
        'SUPERVISOR_RELEVO': {
            id: '5',
            code: 'SUPERVISOR_RELEVO',
            name: 'Supervisor Relevo',
            pattern_json: {
                type: 'rotating',
                description: 'Sem1: Mié+Dom (2 libres), Sem2: Mié+Vie+Sáb (3 libres)',
                cycle: 2,
                weeks: [{ offDays: [3, 0] }, { offDays: [3, 5, 6] }],
            },
            created_at: '',
        },
    };
    return fallbacks[code];
}

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
    const getLicenseForDate = (staffId: string, date: string) => {
        return licenses.find(
            (l) => l.staff_id === staffId && isDateInRange(date, l.start_date, l.end_date)
        );
    };

    const getVacationForDate = (staffId: string, date: string) => {
        return vacations.find(
            (v) => v.staff_id === staffId && isDateInRange(date, v.start_date, v.end_date)
        );
    };

    const getPermissionForDate = (staffId: string, date: string) => {
        return permissions.find(
            (p) => p.staff_id === staffId && isDateInRange(date, p.start_date, p.end_date)
        );
    };

    const getIncidencesForDate = (rut: string, date: string): IncidenceCode[] => {
        const codes: IncidenceCode[] = [];
        if (incidences.noMarcaciones.some((i) => i.rut === rut && i.date === date)) codes.push('NM');
        if (incidences.sinCredenciales.some((i) => i.rut === rut && i.date === date)) codes.push('NC');
        if (incidences.cambiosDia.some((i) => i.rut === rut && i.date === date)) {
            codes.push('CD');
            console.log('🔄 CAMBIO DÍA detectado:', rut, date);
        }
        if (incidences.autorizaciones.some((i) => i.rut === rut && i.date === date)) codes.push('AUT');
        return codes;
    };

    /**
     * Get day status for a staff member on a given date
     * Calculates off days based on shift pattern (5x2, etc.)
     */
    const getDayStatus = (s: StaffWithShift, date: string) => {
        const mark = marksMap.get(`${s.id}-${date}`);
        const license = getLicenseForDate(s.id, date);
        const vacation = getVacationForDate(s.id, date);
        const permission = getPermissionForDate(s.id, date);
        const override = overridesMap.get(`${s.id}-${date}`);
        const inc = getIncidencesForDate(s.rut, date);

        // Calculate off day based on shift pattern
        let isOff = false;
        let horario = s.horario;
        let turno = getTurnoFromHorario(s.horario);
        const dayOfWeek = new Date(date + 'T12:00:00').getDay();

        if (s.shift) {
            // Get pattern from DB or use fallback
            let shiftType = shiftTypesMap.get(s.shift.shift_type_code);

            // Fallback patterns if DB doesn't have data
            if (!shiftType?.pattern_json) {
                shiftType = getFallbackShiftType(s.shift.shift_type_code);
            }

            if (shiftType?.pattern_json) {
                // Get special template for manual (ESPECIAL) shift types
                const specialTemplate = specialTemplatesMap.get(s.id);
                isOff = isOffDay(date, s.shift.shift_type_code, s.shift.variant_code, shiftType.pattern_json, specialTemplate, override);

                // Debug log for first date only (to avoid spam)
                if (date === weekDates[0]) {
                    console.log('getDayStatus -', s.nombre, 'shift:', s.shift.shift_type_code, 'variant:', s.shift.variant_code, 'pattern:', shiftType.pattern_json.type, 'isOff:', isOff);
                }
            } else {
                // Last resort fallback: Sat/Sun off
                isOff = dayOfWeek === 0 || dayOfWeek === 6;
                if (date === weekDates[0]) {
                    console.log('getDayStatus -', s.nombre, 'NO PATTERN FOUND, using default Sat/Sun');
                }
            }

            // [NEW] Override Turno (D/N) manually if 'ESPECIAL'
            if (s.shift.shift_type_code === 'ESPECIAL') {
                const specialTemplate = specialTemplatesMap.get(s.id);
                if (specialTemplate) {
                    const details = getSpecialShiftDetails(date, specialTemplate);
                    if (details.type) {
                        turno = details.type;

                        // [NEW] Apply custom schedule times
                        const schedules = specialTemplate.settings_json?.custom_schedules;
                        if (schedules) {
                            if (turno === 'DIA' && schedules.dia) {
                                horario = schedules.dia;
                            } else if (turno === 'NOCHE' && schedules.noche) {
                                horario = schedules.noche;
                            }
                        }
                    }

                    // Apply Early Exit
                    if (details.earlyExit && !isOff) {
                        const match = s.horario?.match(/^(\d{1,2}:\d{2})/);
                        // If original schedule has a start time, use it. Otherwise default to 08:00
                        const startTime = match ? match[1] : '08:00';
                        horario = `${startTime}-${details.earlyExit}`;

                        // Mark as reducido/modified to highlight in UI (amber color)
                        return {
                            mark,
                            license,
                            vacation,
                            permission,
                            isOff,
                            horario,
                            turno,
                            reducido: true, // Auto-enable styling for early exit
                            incidencies: inc,
                        };
                    }
                }
            }
        } else {
            // No shift assigned - use default 5x2 (Sat/Sun off)
            isOff = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
        }

        return {
            mark,
            license,
            vacation,
            permission,
            isOff,
            horario,
            turno,
            reducido: false, // Ley 40 removed
            incidencies: inc,
        };
    };

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
        setMassMarkOpen(false);
    };

    // Action handlers
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

                {/* Desktop View - Grid Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full border-collapse">
                        {/* Header with day names and dates */}
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="sticky left-0 z-20 bg-slate-100 border-b border-r px-3 py-2 text-left min-w-[220px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                                    <span className="text-slate-700 font-semibold text-sm">Personal</span>
                                </th>
                                {weekDates.map((date) => {
                                    const dayName = formatDayOfWeek(date);
                                    const dayNum = formatDayNumber(date);
                                    const isTodayDate = isToday(date);

                                    return (
                                        <th
                                            key={date}
                                            className={`border-b px-1 py-2 text-center min-w-[78px] ${isTodayDate ? 'bg-brand-50' : 'bg-slate-50'
                                                }`}
                                        >
                                            <div className="text-xs font-medium text-slate-500">{dayName}</div>
                                            <div className={`text-lg font-bold ${isTodayDate ? 'text-brand-600' : 'text-slate-700'}`}>
                                                {dayNum}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>

                        <tbody>
                            {CARGO_ORDER.map((cargo) => {
                                const staffInGroup = groupedStaff[cargo] || [];
                                if (staffInGroup.length === 0) return null;

                                return (
                                    <React.Fragment key={cargo}>
                                        {/* Cargo header */}
                                        <tr className={CARGO_COLORS[cargo]}>
                                            <td
                                                colSpan={weekDates.length + 1}
                                                className="sticky left-0 px-3 py-2 font-semibold text-sm text-slate-700 border-b"
                                            >
                                                {cargo} ({staffInGroup.length})
                                            </td>
                                        </tr>

                                        {/* Staff rows */}
                                        {staffInGroup.map((s) => {
                                            const isDesvinculado = s.status === 'DESVINCULADO';
                                            const shiftType = s.shift ? shiftTypesMap.get(s.shift.shift_type_code) : null;

                                            return (
                                                <tr
                                                    key={s.id}
                                                    className={`hover:bg-slate-50/50 transition-colors ${isDesvinculado ? 'bg-slate-50 opacity-60' : ''}`}
                                                >
                                                    {/* Staff info cell */}
                                                    <td className="sticky left-0 z-10 bg-white border-b border-r px-3 py-2 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className={`font-medium text-sm text-slate-800 truncate ${isDesvinculado ? 'line-through' : ''}`}>
                                                                    {s.nombre}
                                                                </div>
                                                                <div className="text-xs text-slate-500 truncate">
                                                                    {s.rut} | {s.horario || 'Sin horario'}
                                                                    {shiftType && <span className="ml-1 text-brand-600">({shiftType.name})</span>}
                                                                </div>
                                                            </div>
                                                            {onOpenShiftConfig && (
                                                                <button
                                                                    onClick={() => onOpenShiftConfig(s)}
                                                                    className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-brand-600 transition-colors"
                                                                    title="Configurar turno y días libres"
                                                                >
                                                                    <Icon name="settings" size={16} />
                                                                </button>
                                                            )}
                                                            {s.admonitionCount && s.admonitionCount > 0 && (
                                                                <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                                                                    {s.admonitionCount}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Day cells */}
                                                    {weekDates.map((date) => {
                                                        const status = getDayStatus(s, date);

                                                        return (
                                                            <td key={date} className="border-b p-0.5">
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
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
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
                incidencies={selectedCell ? getIncidencesForDate(selectedCell.staff.rut, selectedCell.date) : []}
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
