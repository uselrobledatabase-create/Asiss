/**
 * Control ASISS - Exportes Excel
 * Ambos exportes usan el MISMO formato oficial autorizado (limpio de incidencias):
 * 1) Cambio de programación: 1 o más personas seleccionadas, rango de fechas libre.
 * 2) Programación mensual: todo el personal, semanas completas Lun-Dom.
 * El switch "Feriados libres" condiciona si los 5X2 FIJO_42 muestran LIBRE
 * en los feriados legales de Chile.
 */

import { useMemo, useState } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import { TERMINAL_LABELS } from '../../../shared/types/terminal';
import { useControlAsissExportData } from '../hooks';
import { exportScheduleChangeXlsx, exportMonthlyScheduleXlsx } from '../utils/xlsxExports';
import { getExtendedMonthRange, monthName, formatDateCL } from '../utils/scheduleEngine';

const YEARS = [2025, 2026, 2027];

function toDateStr(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dd}`;
}

export const ExportesPage = () => {
    const now = new Date();

    // ---- Cambio de programación (multi-persona) ----
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [fromDate, setFromDate] = useState(() => toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)));
    const [toDate, setToDate] = useState(() => toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    const [personBusy, setPersonBusy] = useState(false);

    // ---- Programación mensual ----
    const [month, setMonth] = useState(now.getMonth());
    const [year, setYear] = useState(now.getFullYear());
    const [monthlyBusy, setMonthlyBusy] = useState(false);

    // ---- Feriados libres (condiciona ambos exportes) ----
    const [feriadosLibres, setFeriadosLibres] = useState(true);

    const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

    // Rango unificado de datos: cubre ambos exportes
    const extRange = useMemo(() => getExtendedMonthRange(year, month), [year, month]);
    const dataStart = fromDate < extRange.startDate ? fromDate : extRange.startDate;
    const dataEnd = toDate > extRange.endDate ? toDate : extRange.endDate;

    const { staff, scheduleContext, isLoading } = useControlAsissExportData(dataStart, dataEnd);

    const selectedStaff = useMemo(
        () => staff.filter((s) => selectedIds.includes(s.id)),
        [staff, selectedIds]
    );

    const availableStaff = useMemo(() => {
        const q = search.trim().toLowerCase();
        return staff.filter((s) => {
            if (selectedIds.includes(s.id)) return false;
            if (!q) return true;
            return s.nombre.toLowerCase().includes(q) || s.rut.toLowerCase().includes(q);
        });
    }, [staff, search, selectedIds]);

    const rangeDays = useMemo(() => {
        if (!fromDate || !toDate || fromDate > toDate) return 0;
        const ms = new Date(toDate + 'T12:00:00').getTime() - new Date(fromDate + 'T12:00:00').getTime();
        return Math.round(ms / 86400000) + 1;
    }, [fromDate, toDate]);

    const addPerson = (id: string) => {
        if (id && !selectedIds.includes(id)) {
            setSelectedIds((prev) => [...prev, id]);
        }
    };

    const removePerson = (id: string) => {
        setSelectedIds((prev) => prev.filter((x) => x !== id));
    };

    const handleChangeExport = async () => {
        if (selectedStaff.length === 0 || rangeDays === 0) return;
        setPersonBusy(true);
        setFeedback(null);
        try {
            await exportScheduleChangeXlsx(selectedStaff, fromDate, toDate, scheduleContext, { feriadosLibres });
            setFeedback({
                type: 'ok',
                text: `Cambio de programación descargado: ${selectedStaff.length} persona(s), ${rangeDays} días.`,
            });
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
            await exportMonthlyScheduleXlsx(staff, year, month, scheduleContext, { feriadosLibres });
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
                    Control ASISS · Descargables de programación con formato oficial autorizado
                </p>
            </div>

            {/* Switch de feriados: condiciona ambos exportes */}
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                        <Icon name="sparkles" size={20} className="text-amber-600" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-800">Feriados libres para 5X2 FIJO_42</p>
                        <p className="text-xs text-slate-500">
                            Si está activado, el personal que trabaja Lunes a Viernes (Sáb+Dom siempre libres)
                            aparece <b>LIBRE</b> en los feriados legales de Chile. Si está desactivado, los
                            feriados se muestran según el patrón normal de turno.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setFeriadosLibres((v) => !v)}
                    className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${feriadosLibres
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                >
                    <span
                        className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${feriadosLibres ? 'bg-emerald-400' : 'bg-slate-400'
                            }`}
                    >
                        <span
                            className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${feriadosLibres ? 'translate-x-4' : 'translate-x-0'
                                }`}
                        />
                    </span>
                    {feriadosLibres ? 'Feriados LIBRES' : 'Feriados desactivados'}
                </button>
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
                {/* ============ CAMBIO DE PROGRAMACIÓN (1 O MÁS PERSONAS) ============ */}
                <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-800 px-5 py-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
                            <Icon name="users" size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-white">Cambio de Programación</h2>
                            <p className="text-xs text-slate-300">
                                1 o más personas · mismo formato oficial que la programación mensual
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-4 p-5">
                        {/* Buscador + agregar */}
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                1. Buscar y agregar personas (nombre o RUT)
                            </label>
                            <div className="relative mb-2">
                                <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Ej: 12.345.678-9 o Juan Pérez"
                                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <select
                                value=""
                                onChange={(e) => {
                                    addPerson(e.target.value);
                                    e.target.value = '';
                                }}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">
                                    — Agregar persona ({availableStaff.length} disponibles) —
                                </option>
                                {availableStaff.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.nombre} · {s.rut} · {TERMINAL_LABELS[s.terminal_code] || s.terminal_code}
                                        {s.suspended ? ' · SUSPENDIDO' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Seleccionados */}
                        <div>
                            <div className="mb-1.5 flex items-center justify-between">
                                <label className="text-sm font-semibold text-slate-700">
                                    2. Seleccionados ({selectedStaff.length})
                                </label>
                                {selectedStaff.length > 0 && (
                                    <button
                                        onClick={() => setSelectedIds([])}
                                        className="text-xs font-medium text-red-600 hover:text-red-800"
                                    >
                                        Limpiar todo
                                    </button>
                                )}
                            </div>
                            {selectedStaff.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center text-xs text-slate-400">
                                    Aún no agregas personas. Puedes seleccionar una o varias.
                                </div>
                            ) : (
                                <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                                    {selectedStaff.map((s) => (
                                        <span
                                            key={s.id}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 py-1 pl-3 pr-1.5 text-xs font-semibold text-blue-800"
                                        >
                                            {s.nombre}
                                            {s.suspended && (
                                                <span className="rounded bg-amber-200 px-1 text-[10px] font-bold text-amber-800">SUSP</span>
                                            )}
                                            <button
                                                onClick={() => removePerson(s.id)}
                                                className="flex h-5 w-5 items-center justify-center rounded-full p-0.5 text-blue-500 hover:bg-blue-200 hover:text-blue-800"
                                                title="Quitar"
                                            >
                                                <Icon name="x" size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
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
                            {fromDate > toDate ? (
                                <p className="mt-1.5 text-xs font-medium text-red-600">
                                    La fecha "desde" no puede ser posterior a "hasta".
                                </p>
                            ) : (
                                <p className="mt-1.5 text-xs text-slate-500">
                                    {formatDateCL(fromDate)} al {formatDateCL(toDate)} · {rangeDays} días
                                </p>
                            )}
                        </div>

                        <div className="mt-auto">
                            <button
                                onClick={handleChangeExport}
                                disabled={selectedStaff.length === 0 || rangeDays === 0 || personBusy || isLoading}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {personBusy ? (
                                    <><Icon name="loader" size={18} className="animate-spin" /> Generando…</>
                                ) : (
                                    <>
                                        <Icon name="download" size={18} />
                                        Descargar Cambio de Programación
                                        {selectedStaff.length > 0 && ` (${selectedStaff.length})`}
                                    </>
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
                                Todo el personal · formato oficial · semanas completas Lun-Dom
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
                                Formato oficial: Nº, Nombre, RUT (con guión), Área, Cargo, Zona (ER/LR),
                                Colación, Régimen de Turno, Jornada y Feriados
                            </li>
                            <li className="flex items-center gap-2">
                                <Icon name="check" size={14} className="text-emerald-600" />
                                Programación limpia: solo horarios (formato 22:00_08:00_) y LIBRE — sin incidencias
                            </li>
                            <li className="flex items-center gap-2">
                                <Icon name="check" size={14} className="text-emerald-600" />
                                Detecta 5X2 FIJO_42 (Lun-Vie) vs 5X2 ROT_42 — feriados según el switch superior
                            </li>
                            <li className="flex items-center gap-2">
                                <Icon name="check" size={14} className="text-emerald-600" />
                                Incluye personal suspendido con sus horarios asignados
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
