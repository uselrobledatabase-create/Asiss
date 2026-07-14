/**
 * Control ASISS - Exportes Excel
 * 1) Cambio de programación: programación individual por rango de fechas (XLSX formato autorizado).
 * 2) Programación mensual: todo el personal, semanas completas Lun-Dom (XLSX por terminal).
 */

import { useMemo, useState } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import { TERMINAL_LABELS } from '../../../shared/types/terminal';
import { useControlAsissData } from '../hooks';
import { exportPersonScheduleXlsx, exportMonthlyScheduleXlsx } from '../utils/xlsxExports';
import { getExtendedMonthRange, monthName, formatDateCL } from '../utils/scheduleEngine';

const YEARS = [2025, 2026, 2027];

function toDateStr(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dd}`;
}

export const ExportesPage = () => {
    const now = new Date();

    // ---- Export individual ----
    const [search, setSearch] = useState('');
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [fromDate, setFromDate] = useState(() => toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)));
    const [toDate, setToDate] = useState(() => toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    const [personBusy, setPersonBusy] = useState(false);

    // ---- Export mensual ----
    const [month, setMonth] = useState(now.getMonth());
    const [year, setYear] = useState(now.getFullYear());
    const [monthlyBusy, setMonthlyBusy] = useState(false);

    const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

    // Rango unificado de datos: cubre ambos exportes
    const extRange = useMemo(() => getExtendedMonthRange(year, month), [year, month]);
    const dataStart = fromDate < extRange.startDate ? fromDate : extRange.startDate;
    const dataEnd = toDate > extRange.endDate ? toDate : extRange.endDate;

    const { staff, scheduleContext, isLoading } = useControlAsissData(dataStart, dataEnd);

    const filteredStaff = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return staff;
        return staff.filter(
            (s) => s.nombre.toLowerCase().includes(q) || s.rut.toLowerCase().includes(q)
        );
    }, [staff, search]);

    const selectedStaff = staff.find((s) => s.id === selectedStaffId);

    const rangeDays = useMemo(() => {
        if (!fromDate || !toDate || fromDate > toDate) return 0;
        const ms = new Date(toDate + 'T12:00:00').getTime() - new Date(fromDate + 'T12:00:00').getTime();
        return Math.round(ms / 86400000) + 1;
    }, [fromDate, toDate]);

    const handlePersonExport = async () => {
        if (!selectedStaff || rangeDays === 0) return;
        setPersonBusy(true);
        setFeedback(null);
        try {
            await exportPersonScheduleXlsx(selectedStaff, fromDate, toDate, scheduleContext);
            setFeedback({ type: 'ok', text: `Programación de ${selectedStaff.nombre} descargada (${rangeDays} días).` });
        } catch (e) {
            setFeedback({ type: 'error', text: e instanceof Error ? e.message : 'Error al generar el Excel.' });
        } finally {
            setPersonBusy(false);
        }
    };

    const handleMonthlyExport = async () => {
        setMonthlyBusy(true);
        setFeedback(null);
        try {
            await exportMonthlyScheduleXlsx(staff, year, month, scheduleContext);
            setFeedback({ type: 'ok', text: `Programación mensual de ${monthName(month)} ${year} descargada.` });
        } catch (e) {
            setFeedback({ type: 'error', text: e instanceof Error ? e.message : 'Error al generar el Excel.' });
        } finally {
            setMonthlyBusy(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Exportes Excel</h1>
                <p className="text-sm text-slate-500">
                    Control ASISS · Descargables de programación con formato autorizado
                </p>
            </div>

            {feedback && (
                <div
                    className={`flex items-center gap-3 rounded-xl border px-5 py-3.5 ${feedback.type === 'ok'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-red-200 bg-red-50 text-red-800'
                        }`}
                >
                    <Icon name={feedback.type === 'ok' ? 'check-circle' : 'x-circle'} size={20} />
                    <p className="text-sm font-medium">{feedback.text}</p>
                </div>
            )}

            <div className="grid gap-6 xl:grid-cols-2">
                {/* ============ CAMBIO DE PROGRAMACIÓN (INDIVIDUAL) ============ */}
                <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-800 px-5 py-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
                            <Icon name="user" size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-white">Cambio de Programación</h2>
                            <p className="text-xs text-slate-300">
                                Programación individual por rango de fechas · formato autorizado para enviar
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-4 p-5">
                        {/* Buscador */}
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                1. Buscar trabajador (nombre o RUT)
                            </label>
                            <div className="relative">
                                <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Ej: 12.345.678-9 o Juan Pérez"
                                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Selector */}
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                2. Seleccionar persona
                            </label>
                            <select
                                value={selectedStaffId}
                                onChange={(e) => setSelectedStaffId(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">— Seleccionar ({filteredStaff.length} resultados) —</option>
                                {filteredStaff.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.nombre} · {s.rut} · {TERMINAL_LABELS[s.terminal_code] || s.terminal_code}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Rango */}
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                3. Rango de fechas
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <span className="mb-1 block text-xs text-slate-500">Desde</span>
                                    <input
                                        type="date"
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <span className="mb-1 block text-xs text-slate-500">Hasta</span>
                                    <input
                                        type="date"
                                        value={toDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            {fromDate > toDate && (
                                <p className="mt-1.5 text-xs font-medium text-red-600">
                                    La fecha "desde" no puede ser posterior a "hasta".
                                </p>
                            )}
                        </div>

                        {/* Vista previa */}
                        {selectedStaff && rangeDays > 0 && (
                            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm">
                                <p className="font-bold text-blue-900">{selectedStaff.nombre.toUpperCase()}</p>
                                <p className="mt-0.5 text-xs text-blue-700">
                                    {selectedStaff.rut} · {selectedStaff.cargo.toUpperCase()} ·{' '}
                                    {TERMINAL_LABELS[selectedStaff.terminal_code] || selectedStaff.terminal_code}
                                </p>
                                <p className="mt-1 text-xs text-blue-700">
                                    Período: <b>{formatDateCL(fromDate)}</b> al <b>{formatDateCL(toDate)}</b> ({rangeDays} días)
                                </p>
                            </div>
                        )}

                        <div className="mt-auto">
                            <button
                                onClick={handlePersonExport}
                                disabled={!selectedStaff || rangeDays === 0 || personBusy || isLoading}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {personBusy ? (
                                    <><Icon name="loader" size={18} className="animate-spin" /> Generando…</>
                                ) : (
                                    <><Icon name="download" size={18} /> Descargar Programación (XLSX)</>
                                )}
                            </button>
                        </div>
                    </div>
                </section>

                {/* ============ PROGRAMACIÓN MENSUAL (TODOS) ============ */}
                <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-800 px-5 py-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600">
                            <Icon name="calendar-range" size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-white">Programación Mensual</h2>
                            <p className="text-xs text-slate-300">
                                Todo el personal · una hoja por terminal · semanas completas Lun-Dom
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-4 p-5">
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                1. Mes a exportar
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <select
                                    value={month}
                                    onChange={(e) => setMonth(Number(e.target.value))}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500"
                                >
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i} value={i}>{monthName(i)}</option>
                                    ))}
                                </select>
                                <select
                                    value={year}
                                    onChange={(e) => setYear(Number(e.target.value))}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500"
                                >
                                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Explicación del rango Lun-Dom */}
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                            <p className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                                <Icon name="info" size={16} />
                                Rango real del archivo
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                                {monthName(month)} {year} se exporta desde el <b>lunes {formatDateCL(extRange.startDate)}</b> hasta
                                el <b>domingo {formatDateCL(extRange.endDate)}</b> ({extRange.dates.length} días,{' '}
                                {extRange.dates.length / 7} semanas completas). Los días de meses vecinos se incluyen
                                para que cada semana quede completa de Lunes a Domingo.
                            </p>
                        </div>

                        <ul className="space-y-1.5 text-xs text-slate-500">
                            <li className="flex items-center gap-2">
                                <Icon name="check" size={14} className="text-emerald-600" />
                                Una hoja por terminal: El Roble, La Reina y María Angélica
                            </li>
                            <li className="flex items-center gap-2">
                                <Icon name="check" size={14} className="text-emerald-600" />
                                Personal agrupado por cargo, con horario por día o estado (LIBRE, LICENCIA…)
                            </li>
                            <li className="flex items-center gap-2">
                                <Icon name="check" size={14} className="text-emerald-600" />
                                Colores, leyenda y paneles congelados para revisión rápida
                            </li>
                        </ul>

                        <div className="mt-auto">
                            <button
                                onClick={handleMonthlyExport}
                                disabled={monthlyBusy || isLoading || staff.length === 0}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {monthlyBusy ? (
                                    <><Icon name="loader" size={18} className="animate-spin" /> Generando…</>
                                ) : (
                                    <><Icon name="download" size={18} /> Descargar Mes Completo (XLSX)</>
                                )}
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            {isLoading && (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                    <Icon name="loader" size={16} className="animate-spin" />
                    Cargando datos de programación…
                </p>
            )}
        </div>
    );
};
