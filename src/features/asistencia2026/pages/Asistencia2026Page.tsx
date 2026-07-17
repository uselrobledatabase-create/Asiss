/**
 * Asistencia2026Page - Main page for 2026 attendance management
 * Weekly view with navigation, mass attendance, and shift configuration
 */

import { useState, useMemo } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import { useTerminalStore } from '../../../shared/state/terminalStore';
import { useSessionStore } from '../../../shared/state/sessionStore';
import { TerminalCode } from '../../../shared/types/terminal';
import { emailService } from '../../../shared/services/emailService';
import { formatDateDDMMYYYY } from '../../../shared/utils/dates';
import {
    useShiftTypes,
    useStaffWithShifts,
    useMarksForWeek,
    useLicensesForWeek,
    usePermissionsForWeek,
    useVacationsForWeek,
    useOverridesForWeek,
    useIncidencesForWeek,
    useAdmonitionsForWeek, // Added
    useAllSpecialTemplates,
    useCreateOffboardingRequest,
    useAsistencia2026Realtime,
} from '../hooks';
import { AttendanceGrid } from '../components/AttendanceGrid';
import { KpiBar } from '../components/KpiBar';
import { ShiftLegend } from '../components/ShiftLegend';
import { RutPdfExportModal } from '../components/RutPdfExportModal';
import { OffboardingRequestModal } from '../components/OffboardingRequestModal';
import { ShiftConfigModal } from '../components/ShiftConfigModal';
import { AdvancedReportModal } from '../components/AdvancedReportModal';
import { TERMINAL_COLORS, BUTTON_VARIANTS } from '../utils/colors';
import {
    getWeekStart,
    getWeekDates,
    getPreviousWeek,
    getNextWeek,
    formatWeekRange,
    getTurnoFromHorario,
    isPastDate,
    getLocalTodayStr,
    isOffDay,
    getFallbackShiftType,
    getSpecialShiftDetails,
} from '../utils/shiftEngine';
import { GridFilters, StaffWithShift, Asistencia2026KPIs } from '../types';
import * as XLSX from 'xlsx';
import { exportWeeklyAttendanceXlsx } from '../utils/weeklyXlsxExport';

const TERMINALS: { value: TerminalCode | 'ALL'; label: string }[] = [
    { value: 'ALL', label: 'Todos' },
    { value: 'EL_ROBLE', label: 'El Roble' },
    { value: 'LA_REINA', label: 'La Reina' },
    { value: 'MARIA_ANGELICA', label: 'María Angélica' },
    { value: 'EL_DESCANSO', label: 'El Descanso' },
];

const TURNO_OPTIONS = [
    { value: 'TODOS', label: 'Todos' },
    { value: 'DIA', label: 'Día' },
    { value: 'NOCHE', label: 'Noche' },
] as const;

export const Asistencia2026Page = () => {
    const terminalContext = useTerminalStore((s) => s.context);
    const session = useSessionStore((s) => s.session);

    // Week navigation - start with current week
    const today = getLocalTodayStr();
    const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
    const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

    // Derived dates for API fetching (RANGE BASED)
    const startDate = weekDates[0];
    const endDate = weekDates[6];

    // Get month/year only for PDF modal or legacy logic NOT for main grid anymore
    const weekMiddleDate = new Date(weekDates[3] + 'T12:00:00');
    const month = weekMiddleDate.getMonth();
    const year = weekMiddleDate.getFullYear();

    // Filters
    const [filters, setFilters] = useState<GridFilters>({
        month,
        year,
        terminal: 'ALL',
        turno: 'TODOS',
        search: '',
    });

    // Modals
    // Modals
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [isAdvancedReportOpen, setIsAdvancedReportOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [offboardingStaff, setOffboardingStaff] = useState<StaffWithShift | null>(null);
    const [shiftConfigStaff, setShiftConfigStaff] = useState<StaffWithShift | null>(null);

    // Realtime
    useAsistencia2026Realtime();

    // Data queries (Updated to use RANGE)
    const { data: shiftTypes = [], isLoading: loadingTypes } = useShiftTypes();
    const { data: staff = [], isLoading: loadingStaff } = useStaffWithShifts(terminalContext, filters);

    const staffIds = useMemo(() => staff.map((s) => s.id), [staff]);

    const { data: marks = [], isLoading: loadingMarks } = useMarksForWeek(staffIds, startDate, endDate);
    const { data: licenses = [], isLoading: loadingLicenses } = useLicensesForWeek(staffIds, startDate, endDate);
    const { data: permissions = [], isLoading: loadingPermissions } = usePermissionsForWeek(staffIds, startDate, endDate);
    const { data: vacations = [], isLoading: loadingVacations } = useVacationsForWeek(staffIds, startDate, endDate);
    const { data: overrides = [], isLoading: loadingOverrides } = useOverridesForWeek(staffIds, startDate, endDate);
    const { data: incidences, isLoading: loadingIncidences } = useIncidencesForWeek(terminalContext, startDate, endDate);
    const { data: admonitions = [], isLoading: loadingAdmonitions } = useAdmonitionsForWeek(terminalContext, startDate, endDate); // Added
    const { data: specialTemplates = [] } = useAllSpecialTemplates(staffIds);

    const offboardingMutation = useCreateOffboardingRequest();

    const isLoading = loadingTypes || loadingStaff || loadingMarks || loadingLicenses ||
        loadingPermissions || loadingVacations || loadingOverrides || loadingIncidences || loadingAdmonitions;

    // KPIs
    const kpis = useMemo<Asistencia2026KPIs>(() => {
        const byPosition = { SUPERVISOR: 0, INSPECTOR: 0, CONDUCTOR: 0, PLANILLERO: 0, CLEANER: 0 };
        let programmmedDay = 0, programmedNight = 0;
        let onLicense = 0, onVacation = 0, onPermission = 0, withIncidencies = 0, pendingMarks = 0;

        const todayStr = getLocalTodayStr();
        const activeIncidenceRuts = new Set<string>();

        if (incidences) {
            incidences.noMarcaciones.forEach((i) => activeIncidenceRuts.add(i.rut));
            incidences.sinCredenciales.forEach((i) => activeIncidenceRuts.add(i.rut));
            incidences.cambiosDia.forEach((i) => activeIncidenceRuts.add(i.rut));
            incidences.autorizaciones.forEach((i) => activeIncidenceRuts.add(i.rut));
        }
        admonitions.forEach(a => {
            const s = staff.find(st => st.id === a.staff_id);
            if (s) activeIncidenceRuts.add(s.rut);
        });

        for (const s of staff) {
            const cargoUpper = s.cargo.toUpperCase();
            if (cargoUpper.includes('SUPERVISOR')) byPosition.SUPERVISOR++;
            else if (cargoUpper.includes('INSPECTOR')) byPosition.INSPECTOR++;
            else if (cargoUpper.includes('CONDUCTOR')) byPosition.CONDUCTOR++;
            else if (cargoUpper.includes('PLANILLERO')) byPosition.PLANILLERO++;
            else byPosition.CLEANER++;

            const turno = getTurnoFromHorario(s.horario);
            if (turno === 'DIA') programmmedDay++;
            else programmedNight++;

            const hasLicenseToday = licenses.some((l) => l.staff_id === s.id && todayStr >= l.start_date && todayStr <= l.end_date);
            const hasVacationToday = vacations.some((v) => v.staff_id === s.id && todayStr >= v.start_date && todayStr <= v.end_date);
            const hasPermissionToday = permissions.some((p) => p.staff_id === s.id && todayStr >= p.start_date && todayStr <= p.end_date);

            if (hasLicenseToday) onLicense++;
            if (hasVacationToday) onVacation++;
            if (hasPermissionToday) onPermission++;
            if (activeIncidenceRuts.has(s.rut)) withIncidencies++;

            // Pending marks check
            const staffMarks = marks.filter((m) => m.staff_id === s.id);
            for (const date of weekDates) {
                if (!isPastDate(date)) continue;
                const hasMark = staffMarks.some((m) => m.mark_date === date);
                const hasAbsence = licenses.some((l) => l.staff_id === s.id && date >= l.start_date && date <= l.end_date) ||
                    vacations.some((v) => v.staff_id === s.id && date >= v.start_date && date <= v.end_date) ||
                    permissions.some((p) => p.staff_id === s.id && date >= p.start_date && date <= p.end_date);
                if (!hasMark && !hasAbsence) { pendingMarks++; break; }
            }
        }

        return { byPosition, programmmedDay, programmedNight, onLicense, onVacation, onPermission, withIncidencies, pendingMarks };
    }, [staff, marks, licenses, permissions, vacations, incidences, admonitions, weekDates]);

    // Week navigation
    const handlePrevWeek = () => setWeekStart(getPreviousWeek(weekStart));
    const handleNextWeek = () => setWeekStart(getNextWeek(weekStart));
    const handleGoToToday = () => setWeekStart(getWeekStart(today));

    // Terminal change
    const handleTerminalChange = (terminal: TerminalCode | 'ALL') => {
        setFilters((f) => ({ ...f, terminal }));
    };

    // Export XLSX - Reporte semanal oficial (ExcelJS, datos frescos incl. suspendidos)
    const handleExportXlsx = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            await exportWeeklyAttendanceXlsx(weekDates, session?.supervisorName || 'Sistema');
        } catch (error) {
            console.error('Error exportando asistencia semanal:', error);
            alert(error instanceof Error ? error.message : 'Error al generar el Excel de asistencia.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleDownloadIncidencesXlsx = () => {
        const wb = XLSX.utils.book_new();
        const weekRange = formatWeekRange(weekStart);

        const formatDate = (dateStr: string) => {
            if (!dateStr) return '';
            const parts = dateStr.split('-');
            if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
            return dateStr;
        };

        // SHEET 1: No Marcaciones
        const nmData = (incidences?.noMarcaciones || [])
            .filter(item => item.date >= startDate && item.date <= endDate)
            .map(item => ({
                'RUT': item.rut,
                'NOMBRE': item.nombre || 'N/A',
                'Área': item.area || 'N/A',
                'Cargo': item.cargo || 'N/A',
                'Jefe de Terminal': item.jefe_terminal || 'N/A',
                'Terminal': item.terminal_code || 'N/A',
                'Cabezal': item.cabezal || 'N/A',
                'Estado': item.incident_state || 'N/A',
                'MARCACION': item.schedule_in_out || 'N/A',
                'Fecha': formatDate(item.date),
                'Horario': item.time_range || 'N/A',
                'Observaciones': item.observations || 'N/A',
                'INFORMADO POR': item.informed_by || 'N/A',
            }));
        const wsNM = XLSX.utils.json_to_sheet(nmData.length > 0 ? nmData : [{ 'Status': 'Sin Registros' }]);
        wsNM['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 40 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, wsNM, 'No Marcacion');

        // SHEET 2: Sin Credenciales
        const ncData = (incidences?.sinCredenciales || [])
            .filter(item => item.date >= startDate && item.date <= endDate)
            .map(item => ({
                'RUT': item.rut,
                'NOMBRE': item.nombre || 'N/A',
                'TERMINAL': item.terminal_code || 'N/A',
                'CABEZAL': item.cabezal || 'N/A',
                'FECHA': formatDate(item.date),
                'HORA INICIO': item.start_time || 'N/A',
                'HORA FIN': item.end_time || 'N/A',
                'CARGO': item.cargo || 'N/A',
                'SUPERVISOR AUTORIZA': item.supervisor_autoriza || 'N/A',
                'Area': item.area || 'N/A',
                'Responsable': item.responsable || 'N/A',
                'Motivo': item.observacion || 'N/A',
            }));
        const wsNC = XLSX.utils.json_to_sheet(ncData.length > 0 ? ncData : [{ 'Status': 'Sin Registros' }]);
        wsNC['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, wsNC, 'Sin Credencial');

        // SHEET 3: Cambios de Dia
        const cdData = (incidences?.cambiosDia || [])
            .filter(item => item.date >= startDate && item.date <= endDate)
            .map(item => {
                const s = staff.find(st => st.rut === item.rut);
                return {
                    'RUT': item.rut,
                    'NOMBRE': item.nombre || s?.nombre || 'N/A',
                    'TERMINAL': item.terminal_code || s?.terminal_code || 'N/A',
                    'CABEZAL': item.cabezal || 'N/A',
                    'FECHA ORIGINAL': formatDate(item.day_off_date || ''),
                    'FECHA NUEVO': formatDate(item.day_on_date || ''),
                    'INICIO NUEVO': item.day_on_start || 'N/A',
                    'TÉRMINO NUEVO': item.day_on_end || 'N/A',
                    'CARGO': s?.cargo || 'N/A',
                    'Autoriza': 'CLM',
                    'Área': 'Logística',
                    'Responsable': session?.supervisorName || 'N/A',
                    'Motivo Cambio': '',
                };
            });
        const wsCD = XLSX.utils.json_to_sheet(cdData.length > 0 ? cdData : [{ 'Status': 'Sin Registros' }]);
        wsCD['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, wsCD, 'Cambios de Dia');

        // Save
        const fileName = `Incidencias_${weekRange.replace(/\s/g, '_').replace(/\//g, '-')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    // Offboarding
    const handleOffboardingRequest = async (reason: string) => {
        if (!offboardingStaff || !session) return;

        try {
            await offboardingMutation.mutateAsync({
                values: {
                    staff_id: offboardingStaff.id,
                    staff_rut: offboardingStaff.rut,
                    staff_name: offboardingStaff.nombre,
                    terminal_code: offboardingStaff.terminal_code,
                    reason,
                },
                requestedBy: session.supervisorName,
            });

            await emailService.sendEmail({
                audience: 'manual',
                manualRecipients: ['rrhh@empresa.cl'],
                subject: `Solicitud de Desvinculación - ${offboardingStaff.nombre}`,
                body: `Se ha solicitado la desvinculación del trabajador:\n\nNombre: ${offboardingStaff.nombre}\nRUT: ${offboardingStaff.rut}\nCargo: ${offboardingStaff.cargo}\nTerminal: ${offboardingStaff.terminal_code}\n\nMotivo:\n${reason}\n\nSolicitado por: ${session.supervisorName}\nFecha: ${new Date().toLocaleString('es-CL')}`,
                module: 'asistencia',
            });

            setOffboardingStaff(null);
        } catch (error) {
            console.error('Error creating offboarding request:', error);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header bar */}
            <div className="bg-white rounded-xl border shadow-sm p-4 space-y-4">
                {/* Row 0: Título de sección */}
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-brand">
                        <Icon name="clock" size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold leading-tight text-slate-800">Asistencia Semanal</h1>
                        <p className="text-xs text-slate-500">
                            Control de marcas, turnos e incidencias · Semana {formatWeekRange(weekStart)}
                        </p>
                    </div>
                </div>

                {/* Row 1: Week navigator + Terminal buttons */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {/* Week navigator */}
                    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                        <button
                            onClick={handlePrevWeek}
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white hover:text-slate-800 hover:shadow-sm"
                            title="Semana anterior"
                        >
                            <Icon name="chevron-left" size={18} />
                        </button>
                        <div className="min-w-[170px] text-center">
                            <div className="text-sm font-bold text-slate-800">
                                {formatWeekRange(weekStart)}
                            </div>
                        </div>
                        <button
                            onClick={handleNextWeek}
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white hover:text-slate-800 hover:shadow-sm"
                            title="Semana siguiente"
                        >
                            <Icon name="chevron-right" size={18} />
                        </button>
                        <button
                            onClick={handleGoToToday}
                            className="ml-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-brand-700"
                        >
                            Hoy
                        </button>
                    </div>

                    {/* Terminal buttons */}
                    <div className="flex flex-wrap gap-2">
                        {TERMINALS.map((t) => (
                            <button
                                key={t.value}
                                onClick={() => handleTerminalChange(t.value)}
                                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${filters.terminal === t.value
                                    ? TERMINAL_COLORS[t.value]
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Row 2: Turno filter + Search + Export buttons */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* Turno filter */}
                    <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                        {TURNO_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setFilters((f) => ({ ...f, turno: opt.value }))}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filters.turno === opt.value
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-800'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative flex-1 max-w-xs">
                        <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={filters.search}
                            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                            placeholder="Buscar RUT o nombre..."
                            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        />
                    </div>

                    {/* Export buttons */}
                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={handleDownloadIncidencesXlsx}
                            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors border border-amber-200`}
                            title="Descargar Incidencias (Excel)"
                        >
                            <Icon name="alert-triangle" size={16} />
                            Incidencias
                        </button>
                        <button
                            onClick={() => setIsPdfModalOpen(true)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 ${BUTTON_VARIANTS.secondary}`}
                        >
                            <Icon name="file-text" size={16} />
                            <span className="hidden sm:inline">PROGRAMACION MENSUAL PDF</span>
                        </button>
                        <button
                            onClick={handleExportXlsx}
                            disabled={isExporting}
                            className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-sm transition-all disabled:opacity-60 disabled:cursor-wait"
                            title="Descargar reporte semanal de asistencia (Excel oficial)"
                        >
                            <Icon name={isExporting ? 'loader' : 'download'} size={16} className={isExporting ? 'animate-spin' : ''} />
                            <span className="hidden sm:inline">{isExporting ? 'Generando…' : 'Descargar Asistencia'}</span>
                        </button>
                        <button
                            onClick={() => setIsAdvancedReportOpen(true)}
                            className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-sm"
                        >
                            <Icon name="sparkles" size={16} className="text-yellow-200" />
                            <span className="hidden sm:inline">Reporte Inteligente</span>
                        </button>
                    </div>
                </div>

                {/* Row 3: KPIs */}
                <KpiBar kpis={kpis} isLoading={isLoading} />
            </div>

            {/* Legend */}
            <div className="bg-white rounded-lg border p-3">
                <ShiftLegend />
            </div>

            {/* Grid */}
            <AttendanceGrid
                staff={staff}
                shiftTypes={shiftTypes}
                marks={marks}
                licenses={licenses}
                permissions={permissions}
                vacations={vacations}
                overrides={overrides}
                incidences={incidences || { noMarcaciones: [], sinCredenciales: [], cambiosDia: [], autorizaciones: [] }}
                specialTemplates={specialTemplates}
                weekDates={weekDates}
                isLoading={isLoading}
                onRequestOffboarding={(s) => setOffboardingStaff(s)}
                onOpenShiftConfig={(s) => setShiftConfigStaff(s)}
            />

            {/* PDF Export Modal */}
            <RutPdfExportModal
                isOpen={isPdfModalOpen}
                onClose={() => setIsPdfModalOpen(false)}
                staff={staff}
                year={year}
                month={month}
            />

            {/* Offboarding Modal */}
            <OffboardingRequestModal
                isOpen={offboardingStaff !== null}
                onClose={() => setOffboardingStaff(null)}
                staff={offboardingStaff}
                onSubmit={handleOffboardingRequest}
                isSubmitting={offboardingMutation.isPending}
            />

            {/* Shift Config Modal */}
            <ShiftConfigModal
                isOpen={shiftConfigStaff !== null}
                onClose={() => setShiftConfigStaff(null)}
                staff={shiftConfigStaff}
            />

            {/* Advanced Report Modal */}
            {isAdvancedReportOpen && (
                <AdvancedReportModal
                    isOpen={isAdvancedReportOpen}
                    onClose={() => setIsAdvancedReportOpen(false)}
                    staff={staff}
                    shiftTypes={shiftTypes}
                    weekDates={weekDates}
                    marks={marks}
                    licenses={licenses}
                    permissions={permissions}
                    vacations={vacations}
                    overrides={overrides}
                    incidences={incidences || { noMarcaciones: [], sinCredenciales: [], cambiosDia: [], autorizaciones: [] }}
                    specialTemplates={specialTemplates}
                />
            )}
        </div>
    );
};
