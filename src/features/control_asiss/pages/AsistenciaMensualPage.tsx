/**
 * Control ASISS - Asistencia Mensual
 * Resumen del Q del personal y alertas de cobertura por terminal.
 * Regla: en cada terminal + cargo + turno debe haber al menos 1 persona
 * citada cada día. Si todos están libres/ausentes, alerta crítica.
 */

import { useMemo, useState } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import { LoadingState } from '../../../shared/components/common/LoadingState';
import { useControlAsissData } from '../hooks';
import { analyzeCoverage } from '../utils/coverageAnalysis';
import { getDateRange, monthName, formatDateCL, dayNameShort } from '../utils/scheduleEngine';
import { CONTROL_TERMINALS, CoverageGap } from '../types';
import { MonthlyProgrammingGrid } from '../components/MonthlyProgrammingGrid';
import { buildGapSuggestions, GapSuggestion } from '../utils/programmingRules';
import { ScheduleContext } from '../utils/scheduleEngine';
import { StaffWithShift } from '../../asistencia2026/types';

const YEARS = [2025, 2026, 2027];

function monthRange(year: number, month: number): { start: string; end: string } {
    const mm = String(month + 1).padStart(2, '0');
    const lastDay = new Date(year, month + 1, 0).getDate();
    return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

export const AsistenciaMensualPage = () => {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth());
    const [year, setYear] = useState(now.getFullYear());
    const [terminalFilter, setTerminalFilter] = useState<string>('ALL');
    const [tab, setTab] = useState<'resumen' | 'programacion'>('resumen');

    const { start, end } = monthRange(year, month);
    const { staff, scheduleContext, isLoading } = useControlAsissData(start, end);

    const analysis = useMemo(() => {
        if (isLoading || staff.length === 0) return null;
        const dates = getDateRange(start, end);
        return analyzeCoverage(staff, dates, scheduleContext);
    }, [staff, scheduleContext, isLoading, start, end]);

    const filteredGaps = useMemo(() => {
        if (!analysis) return [];
        if (terminalFilter === 'ALL') return analysis.gaps;
        return analysis.gaps.filter((g) => g.terminal === terminalFilter);
    }, [analysis, terminalFilter]);

    const criticalCount = analysis?.gaps.filter((g) => g.level === 'CRITICAL').length ?? 0;
    const warningCount = analysis?.gaps.filter((g) => g.level === 'WARNING').length ?? 0;
    const totalStaff = analysis?.headcounts.reduce((acc, h) => acc + h.total, 0) ?? 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Asistencia Mensual</h1>
                    <p className="text-sm text-slate-500">
                        Control ASISS · Revisión administrativa de programación y cobertura
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i}>{monthName(i)}</option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    >
                        {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* Pestañas */}
            <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1.5">
                <button
                    onClick={() => setTab('resumen')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${tab === 'resumen' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                    <Icon name="bar-chart" size={16} />
                    Resumen y Alertas
                </button>
                <button
                    onClick={() => setTab('programacion')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${tab === 'programacion' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                    <Icon name="calendar-range" size={16} />
                    Programación Mensual (editar)
                </button>
            </div>

            {tab === 'programacion' && <MonthlyProgrammingGrid year={year} month={month} />}

            {tab === 'resumen' && isLoading && <LoadingState label="Analizando programación del mes" />}

            {tab === 'resumen' && !isLoading && analysis && (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <KpiCard icon="users" label="Dotación activa" value={totalStaff} tone="blue" />
                        <KpiCard icon="alert-triangle" label="Alertas críticas" value={criticalCount} tone={criticalCount > 0 ? 'red' : 'green'} />
                        <KpiCard icon="alert-circle" label="Advertencias" value={warningCount} tone={warningCount > 0 ? 'amber' : 'green'} />
                        <KpiCard icon="check-circle" label="Grupos analizados" value={analysis.combosAnalyzed} tone="slate" />
                    </div>

                    {/* Q del personal por terminal */}
                    <section>
                        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-700">
                            <Icon name="bar-chart" size={20} className="text-blue-600" />
                            Q del Personal por Terminal
                        </h2>
                        <div className="grid gap-4 lg:grid-cols-3">
                            {analysis.headcounts.map((h) => (
                                <div key={h.terminal} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                    <div className="flex items-center justify-between bg-slate-800 px-4 py-3">
                                        <span className="font-bold text-white">{h.terminalLabel}</span>
                                        <span className="rounded-full bg-blue-600 px-3 py-0.5 text-sm font-bold text-white">
                                            {h.total}
                                        </span>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                                                <th className="px-4 py-2 text-left">Cargo</th>
                                                <th className="px-2 py-2 text-center">Día</th>
                                                <th className="px-2 py-2 text-center">Noche</th>
                                                <th className="px-4 py-2 text-center">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {h.cargos.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-3 text-center text-slate-400">
                                                        Sin personal activo
                                                    </td>
                                                </tr>
                                            )}
                                            {h.cargos.map((c) => (
                                                <tr key={c.cargo} className="border-b border-slate-100 last:border-0">
                                                    <td className="px-4 py-2 font-medium text-slate-700">{c.cargo}</td>
                                                    <td className="px-2 py-2 text-center text-slate-600">{c.dia}</td>
                                                    <td className="px-2 py-2 text-center text-slate-600">{c.noche}</td>
                                                    <td className="px-4 py-2 text-center font-bold text-slate-800">{c.total}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Alertas de cobertura */}
                    <section>
                        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-700">
                                <Icon name="alert-triangle" size={20} className="text-red-600" />
                                Alertas de Cobertura — {monthName(month)} {year}
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                <FilterChip
                                    label={`Todos (${analysis.gaps.length})`}
                                    active={terminalFilter === 'ALL'}
                                    onClick={() => setTerminalFilter('ALL')}
                                />
                                {CONTROL_TERMINALS.map((t) => {
                                    const count = analysis.gaps.filter((g) => g.terminal === t.code).length;
                                    return (
                                        <FilterChip
                                            key={t.code}
                                            label={`${t.label} (${count})`}
                                            active={terminalFilter === t.code}
                                            onClick={() => setTerminalFilter(t.code)}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        {filteredGaps.length === 0 ? (
                            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                                <Icon name="check-circle" size={24} className="text-emerald-600" />
                                <div>
                                    <p className="font-bold text-emerald-800">Cobertura completa</p>
                                    <p className="text-sm text-emerald-700">
                                        Todos los grupos (terminal + cargo + turno) tienen al menos 1 persona citada cada día del mes.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                                {filteredGaps.map((gap) => (
                                    <GapCard
                                        key={gap.id}
                                        gap={gap}
                                        getSuggestions={() =>
                                            buildGapSuggestions(
                                                { date: gap.date, terminal: gap.terminal, cargo: gap.cargo, turno: gap.turno },
                                                staff,
                                                scheduleContext,
                                                year,
                                                month
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    <p className="text-xs text-slate-400">
                        Regla aplicada: por cada terminal, cargo y turno (día/noche) con dotación, debe quedar al menos
                        1 persona citada cada día. La programación debe corregirse cuando aparezca una alerta crítica.
                    </p>
                </>
            )}

            {tab === 'resumen' && !isLoading && staff.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                    No se encontró personal activo. Verifica la conexión con la base de datos.
                </div>
            )}
        </div>
    );
};

// ==========================================
// Sub-componentes
// ==========================================

const KPI_TONES: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
};

const KpiCard = ({ icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) => (
    <div className={`flex items-center gap-3 rounded-xl border p-4 ${KPI_TONES[tone]}`}>
        <Icon name={icon} size={26} />
        <div>
            <p className="text-2xl font-bold leading-none">{value}</p>
            <p className="mt-1 text-xs font-medium opacity-80">{label}</p>
        </div>
    </div>
);

const FilterChip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${active
            ? 'bg-slate-800 text-white'
            : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
            }`}
    >
        {label}
    </button>
);

const GapCard = ({ gap, getSuggestions }: { gap: CoverageGap; getSuggestions?: () => GapSuggestion[] }) => {
    const isCritical = gap.level === 'CRITICAL';
    const [suggestions, setSuggestions] = useState<GapSuggestion[] | null>(null);
    const [expanded, setExpanded] = useState(false);

    const handleToggleSuggestions = () => {
        if (!expanded && suggestions === null && getSuggestions) {
            setSuggestions(getSuggestions());
        }
        setExpanded((v) => !v);
    };

    return (
        <div
            className={`rounded-xl border-l-4 p-4 shadow-sm ${isCritical
                ? 'border-l-red-500 border border-red-200 bg-red-50'
                : 'border-l-amber-500 border border-amber-200 bg-amber-50'
                }`}
        >
            <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-bold text-white ${isCritical ? 'bg-red-600' : 'bg-amber-500'}`}>
                    {isCritical ? 'CRÍTICA' : 'ADVERTENCIA'}
                </span>
                <span className="text-xs font-bold text-slate-700">
                    {dayNameShort(gap.date)} {formatDateCL(gap.date)}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                    {gap.cargo} · Turno {gap.turno} · {gap.disponibles}/{gap.dotacion} disponibles
                </span>
                {getSuggestions && (
                    <button
                        onClick={handleToggleSuggestions}
                        className={`ml-auto flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-colors ${expanded ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'}`}
                    >
                        <Icon name="sparkles" size={12} />
                        {expanded ? 'Ocultar sugerencias' : 'Ver sugerencias'}
                    </button>
                )}
            </div>
            <p className={`mt-1.5 text-sm font-medium ${isCritical ? 'text-red-800' : 'text-amber-800'}`}>
                {gap.message}
            </p>
            {(gap.libres.length > 0 || gap.ausentes.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
                    {gap.libres.length > 0 && (
                        <span><b>Libres:</b> {gap.libres.join(', ')}</span>
                    )}
                    {gap.ausentes.length > 0 && (
                        <span><b>Ausentes:</b> {gap.ausentes.join(', ')}</span>
                    )}
                </div>
            )}

            {/* Sugerencias de cobertura (cumplen todas las reglas) */}
            {expanded && suggestions && (
                <div className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Sugerencias que cumplen las reglas (máx. 6 días seguidos · 2 domingos libres · domingo de descanso intocable)
                    </p>
                    {suggestions.length === 0 ? (
                        <p className="text-xs text-slate-500">
                            No hay candidatos del mismo grupo que puedan cubrir este día sin violar reglas.
                            Considerar apoyo de otro terminal o redistribuir la modalidad de turnos en la
                            pestaña "Programación Mensual".
                        </p>
                    ) : (
                        suggestions.map((s, i) => (
                            <div key={i} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
                                <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${s.tipo === 'CAMBIO_DIA' ? 'bg-blue-600' : 'bg-orange-500'}`}>
                                    {s.tipo === 'CAMBIO_DIA' ? 'CAMBIO DE DÍA' : 'HORAS EXTRA'}
                                </span>
                                <div>
                                    <p className="text-xs font-bold text-slate-800">{s.nombre}</p>
                                    <p className="text-xs text-slate-600">{s.detail}</p>
                                </div>
                            </div>
                        ))
                    )}
                    <p className="pt-1 text-[10px] text-slate-400">
                        Aplica los cambios en la pestaña "Programación Mensual (editar)" — requiere clave de autorización.
                    </p>
                </div>
            )}
        </div>
    );
};
