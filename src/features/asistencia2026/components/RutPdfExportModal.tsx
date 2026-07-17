/**
 * RutPdfExportModal - Professional PDF generator for worker monthly schedule
 * Enterprise Edition - PRINTER FRIENDLY (B&W) - SINGLE PAGE COMPACT
 * Optimized for Black & White printing, single page layout, and high information density.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { jsPDF } from 'jspdf';
import { Icon } from '../../../shared/components/common/Icon';
import {
    StaffWithShift,
    ShiftType,
    AttendanceIncidences,
} from '../types';
import {
    getMonthDates,
    getMonthName,
} from '../utils/shiftEngine';
import {
    useShiftTypes,
    useAllSpecialTemplates,
    useOverridesForWeek,
    useMarksForWeek,
    useLicensesForWeek,
    usePermissionsForWeek,
    useVacationsForWeek,
} from '../hooks';
import { fetchIncidencesForRange } from '../api/asistencia2026Api';
import { resolveAttendanceDayStatus } from '../utils/attendanceDayStatus';

interface RutPdfExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    staff: StaffWithShift[];
    year: number;
    month: number;
}

export const RutPdfExportModal = ({
    isOpen,
    onClose,
    staff,
    year,
    month,
}: RutPdfExportModalProps) => {
    const [selectedRut, setSelectedRut] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState(month);
    const [selectedYear, setSelectedYear] = useState(year);
    const [isGenerating, setIsGenerating] = useState(false);

    const { data: shiftTypes = [] } = useShiftTypes();

    const shiftTypesMap = useMemo(() => {
        const map = new Map<string, ShiftType>();
        for (const st of shiftTypes) {
            map.set(st.code, st);
        }
        return map;
    }, [shiftTypes]);

    const selectedStaff = staff.find((s) => s.rut === selectedRut);
    const selectedStaffIds = useMemo(
        () => (selectedStaff ? [selectedStaff.id] : []),
        [selectedStaff]
    );
    const { data: specialTemplates = [] } = useAllSpecialTemplates(selectedStaffIds);

    const specialTemplatesMap = useMemo(() => {
        const map = new Map<string, any>();
        for (const template of specialTemplates) {
            map.set(template.staff_id, template);
        }
        return map;
    }, [specialTemplates]);

    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const monthGrid = useMemo(() => {
        const monthDates = getMonthDates(selectedYear, selectedMonth);
        const fmt = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
        };

        const firstDate = new Date(monthDates[0] + 'T12:00:00');
        const lastDate = new Date(monthDates[monthDates.length - 1] + 'T12:00:00');
        const leadOffset = (firstDate.getDay() + 6) % 7;
        const trailOffset = 6 - ((lastDate.getDay() + 6) % 7);
        const gridStart = new Date(firstDate);
        gridStart.setDate(firstDate.getDate() - leadOffset);
        const gridEnd = new Date(lastDate);
        gridEnd.setDate(lastDate.getDate() + trailOffset);

        const weeks: string[][] = [];
        let currentWeek: string[] = [];
        for (const d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
            currentWeek.push(fmt(d));
            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        }

        return {
            monthDates,
            weeks,
            startDate: fmt(gridStart),
            endDate: fmt(gridEnd),
        };
    }, [selectedMonth, selectedYear]);

    const { data: monthMarks = [], isLoading: loadingMarks } = useMarksForWeek(
        selectedStaffIds,
        monthGrid.startDate,
        monthGrid.endDate
    );
    const { data: monthLicenses = [], isLoading: loadingLicenses } = useLicensesForWeek(
        selectedStaffIds,
        monthGrid.startDate,
        monthGrid.endDate
    );
    const { data: monthPermissions = [], isLoading: loadingPermissions } = usePermissionsForWeek(
        selectedStaffIds,
        monthGrid.startDate,
        monthGrid.endDate
    );
    const { data: monthVacations = [], isLoading: loadingVacations } = useVacationsForWeek(
        selectedStaffIds,
        monthGrid.startDate,
        monthGrid.endDate
    );
    const { data: monthOverrides = [], isLoading: loadingOverrides } = useOverridesForWeek(
        selectedStaffIds,
        monthGrid.startDate,
        monthGrid.endDate
    );
    const {
        data: monthIncidences = { noMarcaciones: [], sinCredenciales: [], cambiosDia: [], autorizaciones: [] },
        isLoading: loadingIncidences,
    } = useQuery<AttendanceIncidences>({
        queryKey: ['asistencia2026', 'pdfIncidences', selectedStaff?.terminal_code || '', monthGrid.startDate, monthGrid.endDate],
        queryFn: async () => {
            if (!selectedStaff) {
                return { noMarcaciones: [], sinCredenciales: [], cambiosDia: [], autorizaciones: [] };
            }
            return fetchIncidencesForRange([selectedStaff.terminal_code], monthGrid.startDate, monthGrid.endDate);
        },
        enabled: isOpen && Boolean(selectedStaff),
    });

    const marksMap = useMemo(() => {
        const map = new Map<string, any>();
        for (const item of monthMarks) {
            map.set(`${item.staff_id}-${item.mark_date}`, item);
        }
        return map;
    }, [monthMarks]);

    const overridesMap = useMemo(() => {
        const map = new Map<string, any>();
        for (const item of monthOverrides) {
            map.set(`${item.staff_id}-${item.override_date}`, item);
        }
        return map;
    }, [monthOverrides]);

    const monthDataLoading = Boolean(selectedStaff) && (
        loadingMarks ||
        loadingLicenses ||
        loadingPermissions ||
        loadingVacations ||
        loadingOverrides ||
        loadingIncidences
    );

    if (!isOpen) return null;

    const generatePdf = async () => {
        if (!selectedStaff) return;

        setIsGenerating(true);

        try {
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'letter', // 279.4 x 215.9 mm
            });

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 12;

            // Rounded rect helper (jsPDF sometimes throws on radius > half-size)
            const rrect = (
                x: number, y: number, w: number, h: number,
                r: number, style: 'F' | 'S' | 'FD'
            ) => {
                const rad = Math.min(r, w / 2, h / 2);
                doc.roundedRect(x, y, w, h, rad, rad, style);
            };

            // --- Professional color palette (light, print-friendly tints) ---
            type RGB = [number, number, number];
            const ink: RGB = [15, 23, 42];        // slate-900
            const inkSoft: RGB = [71, 85, 105];    // slate-600
            const inkFaint: RGB = [148, 163, 184]; // slate-400
            const lineCol: RGB = [226, 232, 240];  // slate-200
            const white: RGB = [255, 255, 255];

            interface Palette { bg: RGB; accent: RGB; text: RGB; }
            const CAT: Record<string, Palette> = {
                trabajo:    { bg: [255, 255, 255], accent: [37, 99, 235],  text: [30, 64, 175] },   // blue
                presente:   { bg: [240, 253, 244], accent: [22, 163, 74],  text: [21, 128, 61] },   // green
                ausente:    { bg: [254, 242, 242], accent: [220, 38, 38],  text: [185, 28, 28] },   // red
                nomarca:    { bg: [254, 242, 242], accent: [220, 38, 38],  text: [185, 28, 28] },   // red
                sincred:    { bg: [255, 251, 235], accent: [217, 119, 6],  text: [180, 83, 9] },    // amber
                licencia:   { bg: [239, 246, 255], accent: [37, 99, 235],  text: [29, 78, 216] },   // blue
                vacaciones: { bg: [236, 254, 255], accent: [8, 145, 178],  text: [14, 116, 144] },  // cyan
                permiso:    { bg: [250, 245, 255], accent: [147, 51, 234], text: [126, 34, 206] },  // purple
                cambio:     { bg: [238, 242, 255], accent: [79, 70, 229],  text: [67, 56, 202] },   // indigo
                libre:      { bg: [241, 245, 249], accent: [148, 163, 184], text: [100, 116, 139] },// slate
            };

            // ============ HEADER BANNER ============
            const headerH = 20;
            doc.setFillColor(...ink);
            doc.rect(0, 0, pageWidth, headerH, 'F');
            // Accent underline
            doc.setFillColor(37, 99, 235);
            doc.rect(0, headerH, pageWidth, 1.2, 'F');

            doc.setTextColor(...white);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('PROGRAMACIÓN MENSUAL', margin, 9);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(203, 213, 225);
            doc.text('Calendario oficial de asistencia  ·  Ley 40 Horas', margin, 15);

            doc.setTextColor(...white);
            doc.setFontSize(15);
            doc.setFont('helvetica', 'bold');
            doc.text(`${getMonthName(selectedMonth).toUpperCase()} ${selectedYear}`, pageWidth - margin, 10, { align: 'right' });

            // ============ WORKER INFO CARD ============
            const shiftType = selectedStaff.shift ? shiftTypesMap.get(selectedStaff.shift.shift_type_code) : null;
            const infoY = headerH + 5;
            const infoH = 17;
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(...lineCol);
            doc.setLineWidth(0.3);
            rrect(margin, infoY, pageWidth - 2 * margin, infoH, 2, 'FD');

            // Name (prominent)
            doc.setTextColor(...ink);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(selectedStaff.nombre.toUpperCase(), margin + 5, infoY + 7);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...inkSoft);
            doc.text(`RUT ${selectedStaff.rut}`, margin + 5, infoY + 13);

            // Detail fields (label above value)
            const field = (label: string, value: string, fx: number) => {
                doc.setFontSize(6.5);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...inkFaint);
                doc.text(label, fx, infoY + 6);
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...ink);
                doc.text(value || '—', fx, infoY + 12);
            };
            const usableW = pageWidth - 2 * margin;
            field('CARGO', (selectedStaff.cargo || '—').substring(0, 22), margin + usableW * 0.42);
            field('TERMINAL', selectedStaff.terminal_code || '—', margin + usableW * 0.62);
            field('TURNO', shiftType?.name || 'Base', margin + usableW * 0.74);
            field('HORARIO BASE', selectedStaff.horario || 'N/A', margin + usableW * 0.88);

            // ============ DATA PREP ============
            const { monthDates, weeks } = monthGrid;

            interface DayInfo {
                inMonth: boolean;    // false = date belongs to prev/next month
                dayNum: number;
                dateLabel: string;   // DD-MM-AAAA
                horario: string;     // '' when not working
                status: string;      // short badge label
                note: string;        // secondary line (e.g. AUTORIZADO / target day)
                category: keyof typeof CAT;
            }

            const dayStatusContext = {
                marksMap,
                shiftTypesMap,
                specialTemplatesMap,
                overridesMap,
                licenses: monthLicenses,
                vacations: monthVacations,
                permissions: monthPermissions,
                incidences: monthIncidences,
            };

            const weeksData: DayInfo[][] = [];
            const stats = { trabajo: 0, libre: 0, ausencia: 0, licencia: 0, vacaciones: 0, permiso: 0 };

            for (const week of weeks) {
                const rowData: DayInfo[] = [];
                for (const dateStr of week) {
                    const date = new Date(dateStr + 'T12:00:00');
                    const dayNum = date.getDate();
                    const dateLabel = dateStr.split('-').reverse().join('-');
                    const inMonth = date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
                    const resolved = resolveAttendanceDayStatus(selectedStaff, dateStr, dayStatusContext);
                    const dayChange = monthIncidences.cambiosDia.find(
                        (item) => item.rut === selectedStaff.rut && item.date === dateStr
                    );
                    const horarioFmt = !resolved.mark && !resolved.license && !resolved.vacation && !resolved.permission && !resolved.isOff
                        ? resolved.horario.split('-').map(s => s.trim()).join(' - ')
                        : '';

                    let category: keyof typeof CAT = 'trabajo';
                    let status = '';
                    let note = '';
                    if (resolved.license) {
                        category = 'licencia';
                        status = 'LICENCIA';
                    } else if (resolved.vacation) {
                        category = 'vacaciones';
                        status = 'VACACIONES';
                    } else if (resolved.permission) {
                        category = 'permiso';
                        status = 'PERMISO';
                    } else if (resolved.mark?.mark === 'P') {
                        category = 'presente';
                        status = 'PRESENTE';
                    } else if (resolved.mark?.mark === 'A') {
                        category = 'ausente';
                        status = 'AUSENTE';
                    } else if (resolved.isOff) {
                        category = 'libre';
                        status = 'LIBRE';
                    } else {
                        category = resolved.turno === 'NOCHE' ? 'trabajo' : 'trabajo';
                        status = 'PROGRAMADO';
                    }

                    const incidenceNotes: string[] = [];
                    if (resolved.incidencies.includes('NM')) incidenceNotes.push('NM');
                    if (resolved.incidencies.includes('NC')) incidenceNotes.push('NC');
                    if (resolved.incidencies.includes('AUT')) incidenceNotes.push('AUT');
                    if (dayChange?.day_on_date) {
                        incidenceNotes.push(
                            `CD→${new Date(dayChange.day_on_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit' })}`
                        );
                    } else if (resolved.incidencies.includes('CD')) {
                        incidenceNotes.push('CD');
                    }
                    note = incidenceNotes.join(' · ');

                    // Summary counters reflect ONLY the current month (adjacent-month
                    // days are shown for context but excluded from the totals).
                    if (inMonth) {
                        const bucket: Record<keyof typeof CAT, keyof typeof stats> = {
                            trabajo: 'trabajo', presente: 'trabajo', sincred: 'trabajo', cambio: 'trabajo',
                            libre: 'libre', ausente: 'ausencia', nomarca: 'ausencia',
                            licencia: 'licencia', vacaciones: 'vacaciones', permiso: 'permiso',
                        };
                        stats[bucket[category]]++;
                    }

                    rowData.push({
                        inMonth,
                        dayNum,
                        dateLabel,
                        horario: horarioFmt,
                        status,
                        note,
                        category,
                    });
                }
                weeksData.push(rowData);
            }

            // ============ CALENDAR GRID ============
            const dayNames = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'];
            const gridTop = infoY + infoH + 5;
            const gridW = pageWidth - 2 * margin;
            const colW = gridW / 7;
            const dowH = 8;
            const bottomReserve = 15; // footer only (color legend removed)
            const availH = pageHeight - bottomReserve - (gridTop + dowH);
            const rowH = availH / weeksData.length;

            // Day-of-week header
            for (let c = 0; c < 7; c++) {
                const x = margin + c * colW;
                const weekend = c >= 5;
                doc.setFillColor(weekend ? 51 : 30, weekend ? 65 : 41, weekend ? 85 : 59);
                doc.rect(x, gridTop, colW, dowH, 'F');
                doc.setTextColor(...white);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.text(dayNames[c], x + colW / 2, gridTop + dowH / 2 + 1.2, { align: 'center' });
            }

            // Cells
            const cellTop = gridTop + dowH;
            for (let r = 0; r < weeksData.length; r++) {
                for (let c = 0; c < 7; c++) {
                    const cell = weeksData[r][c];
                    const x = margin + c * colW;
                    const y = cellTop + r * rowH;

                    const pal = CAT[cell.category];
                    const dim = !cell.inMonth; // adjacent-month day -> recessed styling
                    const bgCol: RGB = dim ? [250, 250, 251] : pal.bg;
                    const accentCol: RGB = dim ? [203, 213, 225] : pal.accent;
                    const numCol: RGB = dim ? inkFaint : ink;
                    const pillCol: RGB = dim ? inkFaint : pal.accent;

                    // background
                    doc.setFillColor(...bgCol);
                    doc.rect(x, y, colW, rowH, 'F');
                    // top accent strip
                    doc.setFillColor(...accentCol);
                    doc.rect(x, y, colW, 1.6, 'F');
                    // border
                    doc.setDrawColor(...lineCol);
                    doc.setLineWidth(0.2);
                    doc.rect(x, y, colW, rowH, 'S');

                    // Day number (big, top-left)
                    doc.setTextColor(...numCol);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(16);
                    doc.text(String(cell.dayNum), x + 3.5, y + 9);

                    // Full date (small, top-right)
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(6.5);
                    doc.setTextColor(...inkFaint);
                    doc.text(cell.dateLabel, x + colW - 2.5, y + 6, { align: 'right' });

                    const cx = x + colW / 2;

                    if (cell.category === 'libre') {
                        // Free day: one big, centered word so it never blends with worked days.
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(20);
                        doc.setTextColor(...(dim ? inkFaint : inkSoft));
                        doc.text('LIBRE', cx, y + rowH / 2 + 4.5, { align: 'center' });
                    } else {
                        // Horario (centered, prominent) when working.
                        // Anchor to the free zone between the day-number row (~y+11) and the badge (~y+rowH-9).
                        const midY = y + (11 + (rowH - 9)) / 2;
                        if (cell.horario) {
                            doc.setFontSize(5.5);
                            doc.setFont('helvetica', 'normal');
                            doc.setTextColor(...inkFaint);
                            doc.text('HORARIO', cx, midY - 3, { align: 'center' });
                            doc.setFontSize(10);
                            doc.setFont('helvetica', 'bold');
                            doc.setTextColor(...numCol);
                            doc.text(cell.horario, cx, midY + 2, { align: 'center' });
                        }

                        // Note line (authorized / target)
                        if (cell.note) {
                            doc.setFontSize(5.5);
                            doc.setFont('helvetica', 'italic');
                            doc.setTextColor(...inkSoft);
                            doc.text(cell.note, cx, y + rowH - 8.5, { align: 'center' });
                        }

                        // Status badge (bottom, pill)
                        if (cell.status) {
                            doc.setFontSize(7);
                            doc.setFont('helvetica', 'bold');
                            const tw = doc.getTextWidth(cell.status);
                            const pillW = Math.min(tw + 6, colW - 4);
                            const pillH = 5;
                            const px = cx - pillW / 2;
                            const py = y + rowH - pillH - 2;
                            doc.setFillColor(...pillCol);
                            rrect(px, py, pillW, pillH, 2.5, 'F');
                            doc.setTextColor(...white);
                            doc.text(cell.status, cx, py + 3.4, { align: 'center' });
                        }
                    }
                }
            }

            // ============ FOOTER ============
            const footY = pageHeight - 9;
            doc.setDrawColor(...lineCol);
            doc.setLineWidth(0.3);
            doc.line(margin, footY - 5, pageWidth - margin, footY - 5);

            const summary = `RESUMEN DEL MES   Trabajo ${stats.trabajo}   ·   Libres ${stats.libre}   ·   Ausencias ${stats.ausencia}   ·   Licencia ${stats.licencia}   ·   Vacaciones ${stats.vacaciones}   ·   Permiso ${stats.permiso}`;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...ink);
            doc.text(summary, margin, footY);

            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...inkFaint);
            doc.text(`Generado: ${new Date().toLocaleString('es-CL')}`, pageWidth - margin, footY, { align: 'right' });

            // Save
            const fileName = `Programacion_${selectedStaff.rut.replace(/\./g, '')}_${months[selectedMonth]}_${selectedYear}.pdf`;
            doc.save(fileName);

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error al generar el PDF');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Exportar PROGRAMACIÓN MENSUAL</h2>
                        <p className="text-sm text-slate-500">Reporte Compacto (1 Hoja)</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500">
                        <Icon name="x" size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Staff selector */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Trabajador
                        </label>
                        <select
                            value={selectedRut}
                            onChange={(e) => setSelectedRut(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        >
                            <option value="">-- Seleccionar Trabajador --</option>
                            {staff.map((s) => (
                                <option key={s.rut} value={s.rut}>
                                    {s.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Month/Year selectors */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Mes</label>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            >
                                {months.map((m, i) => (
                                    <option key={i} value={i}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Año</label>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            >
                                <option value={2025}>2025</option>
                                <option value={2026}>2026</option>
                                <option value={2027}>2027</option>
                            </select>
                        </div>
                    </div>

                    {/* Preview info card */}
                    {selectedStaff && (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                            <div className="text-sm font-medium text-center text-gray-600 mb-2">
                                Vista Previa de Datos
                            </div>
                            <div className="grid grid-cols-2 gap-y-2 text-xs">
                                <div><span className="font-bold">Incidencias:</span> {monthIncidences.noMarcaciones.filter(i => i.rut === selectedStaff.rut).length + monthIncidences.sinCredenciales.filter(i => i.rut === selectedStaff.rut).length + monthIncidences.cambiosDia.filter(i => i.rut === selectedStaff.rut).length}</div>
                                <div><span className="font-bold">Licencias:</span> {monthLicenses.filter(l => l.staff_id === selectedStaff.id).length}</div>
                                <div><span className="font-bold">Marcas:</span> {monthMarks.filter(m => m.staff_id === selectedStaff.id).length}</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t bg-slate-50">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={generatePdf}
                        disabled={!selectedRut || isGenerating || monthDataLoading}
                        className="px-5 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all flex items-center gap-2"
                    >
                        {isGenerating ? (
                            <>
                                <Icon name="loader" size={18} className="animate-spin" />
                                Generando...
                            </>
                        ) : (
                            <>
                                <Icon name="download" size={18} />
                                Generar PDF
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
