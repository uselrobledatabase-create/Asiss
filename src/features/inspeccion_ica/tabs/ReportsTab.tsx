import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { Icon } from '../../../shared/components/common/Icon';
import { IconName } from '../../../shared/components/common/Icon';
import { A18_CONDICIONES, CondicionId, InspeccionICARow } from '../types';
import { TERMINALS } from '../../../shared/utils/terminal';
import { TerminalCode } from '../../../shared/types/terminal';
import { useInspecciones, useAllInspecciones } from '../hooks';

// ── Color palette ─────────────────────────────────────────────────────────────
const CLR = {
    cumple: '#10b981',
    noCumple: '#ef4444',
    primary: '#3b82f6',
    muted: '#94a3b8',
    grid: '#f1f5f9',
};

const COND_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'];

// ── Date helpers ──────────────────────────────────────────────────────────────
const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
};

const formatDate = (iso: string) => {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
};

// ── Export ────────────────────────────────────────────────────────────────────
const exportReportXLSX = (data: InspeccionICARow[], label: string) => {
    const rows = data.map((row) => ({
        Fecha: row.fecha,
        PPU: row.ppu,
        Terminal: TERMINALS[row.terminal_code as TerminalCode] ?? row.terminal_code,
        Fiscalizador: row.fiscalizador,
        'C1': row.condiciones?.c1?.cumple ? 'CUMPLE' : 'NO CUMPLE',
        'C2': row.condiciones?.c2?.cumple ? 'CUMPLE' : 'NO CUMPLE',
        'C3': row.condiciones?.c3?.cumple ? 'CUMPLE' : 'NO CUMPLE',
        'C4': row.condiciones?.c4?.cumple ? 'CUMPLE' : 'NO CUMPLE',
        Score: `${row.score}/${row.total}`,
        Resultado: row.resultado,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 22 }, ...Array(6).fill({ wch: 12 })];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ICA Reportes');
    XLSX.writeFile(wb, `ica_reporte_${label}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

// ── Period selector ───────────────────────────────────────────────────────────
type Period = '7d' | '30d' | '90d';
const PERIODS: { id: Period; label: string; days: number }[] = [
    { id: '7d', label: '7 días', days: 7 },
    { id: '30d', label: '30 días', days: 30 },
    { id: '90d', label: '90 días', days: 90 },
];

// ── Custom tooltip ────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-sm">
            <p className="font-semibold text-slate-800 mb-1.5">{label}</p>
            {payload.map((p: any) => (
                <div key={p.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="text-slate-600">{p.name}:</span>
                    <span className="font-bold text-slate-900">{p.value}</span>
                </div>
            ))}
        </div>
    );
};

// ── Main ReportsTab ───────────────────────────────────────────────────────────
export const ReportsTab = () => {
    const [period, setPeriod] = useState<Period>('30d');
    const days = PERIODS.find((p) => p.id === period)!.days;

    const { data = [], isLoading, error } = useInspecciones({
        fechaDesde: daysAgo(days),
    });

    const allQuery = useAllInspecciones();

    // ── Derived stats ────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const total = data.length;
        const cumple = data.filter((r) => r.resultado === 'CUMPLE').length;
        const noCumple = total - cumple;
        const pct = total > 0 ? Math.round((cumple / total) * 100) : 0;

        // Daily trend
        const dailyMap: Record<string, { fecha: string; CUMPLE: number; 'NO CUMPLE': number }> = {};
        for (let i = Math.min(days - 1, 29); i >= 0; i--) {
            const key = daysAgo(i);
            dailyMap[key] = { fecha: formatDate(key), CUMPLE: 0, 'NO CUMPLE': 0 };
        }
        data.forEach((r) => {
            if (dailyMap[r.fecha]) {
                if (r.resultado === 'CUMPLE') dailyMap[r.fecha].CUMPLE++;
                else dailyMap[r.fecha]['NO CUMPLE']++;
            }
        });
        const dailyData = Object.values(dailyMap);

        // By terminal
        const terminalMap: Record<string, { terminal: string; code: string; CUMPLE: number; 'NO CUMPLE': number; total: number }> = {};
        Object.entries(TERMINALS).forEach(([code, name]) => {
            terminalMap[code] = { code, terminal: name.split(' ').at(-1) ?? name, CUMPLE: 0, 'NO CUMPLE': 0, total: 0 };
        });
        data.forEach((r) => {
            if (terminalMap[r.terminal_code]) {
                terminalMap[r.terminal_code].total++;
                if (r.resultado === 'CUMPLE') terminalMap[r.terminal_code].CUMPLE++;
                else terminalMap[r.terminal_code]['NO CUMPLE']++;
            }
        });
        const terminalData = Object.values(terminalMap).filter((t) => t.total > 0);

        // Best / worst terminal
        const withPct = terminalData.map((t) => ({
            ...t,
            pct: t.total > 0 ? Math.round((t.CUMPLE / t.total) * 100) : 0,
        }));
        const bestTerminal = withPct.sort((a, b) => b.pct - a.pct)[0];
        const worstTerminal = [...withPct].sort((a, b) => a.pct - b.pct)[0];

        // Condition failure stats
        const condStats = A18_CONDICIONES.map((c, i) => {
            const fails = data.filter((r) => r.condiciones?.[c.id as CondicionId]?.cumple === false).length;
            return {
                id: c.id,
                label: `C${i + 1}`,
                fullLabel: c.label,
                fails,
                pct: total > 0 ? Math.round((fails / total) * 100) : 0,
                color: COND_COLORS[i],
            };
        });

        const worstCondicion = [...condStats].sort((a, b) => b.fails - a.fails)[0];

        // Pie data
        const pieData = [
            { name: 'CUMPLE', value: cumple, color: CLR.cumple },
            { name: 'NO CUMPLE', value: noCumple, color: CLR.noCumple },
        ].filter((d) => d.value > 0);

        // Avg per day
        const avgPerDay = total > 0 ? (total / Math.max(days, 1)).toFixed(1) : '0';

        return { total, cumple, noCumple, pct, dailyData, terminalData: withPct, condStats, worstCondicion, bestTerminal, worstTerminal, pieData, avgPerDay };
    }, [data, days]);

    const handleExport = () => {
        const allData = allQuery.data ?? [];
        exportReportXLSX(allData, period);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-20">
                <Icon name="loader" size={28} className="animate-spin text-blue-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white border border-red-200 rounded-2xl p-10 text-center shadow-sm">
                <Icon name="alert-circle" size={36} className="text-red-400 mx-auto mb-3" />
                <p className="font-semibold text-red-600 text-base mb-1">No se pueden cargar los reportes</p>
                <p className="text-sm text-slate-500">
                    Ejecuta la migración <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">supabase/migrations/inspeccion_ica.sql</code> en el dashboard de Supabase.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-base font-bold text-slate-900">Panel de Control ICA</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Norma A18 · Análisis avanzado de cumplimiento</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Period selector */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        {PERIODS.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => setPeriod(p.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {/* Export button */}
                    <button
                        onClick={handleExport}
                        disabled={allQuery.isLoading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50"
                    >
                        <Icon name="download" size={14} />
                        Exportar XLSX
                    </button>
                </div>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon="clipboard" iconBg="bg-blue-50" iconColor="text-blue-600"
                    label="Inspecciones" value={String(stats.total)} sub={`${stats.avgPerDay}/día promedio`} />
                <KpiCard icon="check-circle" iconBg="bg-emerald-50" iconColor="text-emerald-600"
                    label="Cumplimiento" value={`${stats.pct}%`}
                    sub={`${stats.cumple} CUMPLE · ${stats.noCumple} NO CUMPLE`}
                    highlight={stats.pct >= 80 ? 'green' : stats.pct >= 60 ? 'yellow' : 'red'} />
                <KpiCard icon="building" iconBg="bg-violet-50" iconColor="text-violet-600"
                    label="Mejor terminal" value={stats.bestTerminal?.terminal ?? '—'}
                    sub={stats.bestTerminal ? `${stats.bestTerminal.pct}% cumplimiento` : 'Sin datos'} />
                <KpiCard icon="alert-triangle" iconBg="bg-red-50" iconColor="text-red-600"
                    label="Condición crítica"
                    value={stats.worstCondicion ? `C${A18_CONDICIONES.findIndex((c) => c.id === stats.worstCondicion?.id) + 1}` : '—'}
                    sub={stats.worstCondicion ? `${stats.worstCondicion.fails} incumplimientos (${stats.worstCondicion.pct}%)` : 'Sin incumplimientos'} />
            </div>

            {/* Charts row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily trend (2/3) */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <ChartHeader title="Tendencia Diaria" sub="Inspecciones CUMPLE vs NO CUMPLE" />
                    <div className="p-5">
                        {stats.dailyData.every((d) => d.CUMPLE + d['NO CUMPLE'] === 0) ? (
                            <EmptyChart label="Sin inspecciones en este período" />
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={stats.dailyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gCumple" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={CLR.cumple} stopOpacity={0.15} />
                                            <stop offset="95%" stopColor={CLR.cumple} stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gNoCumple" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={CLR.noCumple} stopOpacity={0.15} />
                                            <stop offset="95%" stopColor={CLR.noCumple} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CLR.grid} />
                                    <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Area type="monotone" dataKey="CUMPLE" stroke={CLR.cumple} strokeWidth={2} fill="url(#gCumple)" dot={false} />
                                    <Area type="monotone" dataKey="NO CUMPLE" stroke={CLR.noCumple} strokeWidth={2} fill="url(#gNoCumple)" dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Pie chart (1/3) */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <ChartHeader title="Distribución Global" sub="CUMPLE vs NO CUMPLE" />
                    <div className="p-5">
                        {stats.pieData.length === 0 ? (
                            <EmptyChart label="Sin datos" />
                        ) : (
                            <>
                                <ResponsiveContainer width="100%" height={180}>
                                    <PieChart>
                                        <Pie
                                            data={stats.pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={80}
                                            paddingAngle={3}
                                            dataKey="value"
                                        >
                                            {stats.pieData.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<ChartTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex flex-col gap-2 mt-1">
                                    {stats.pieData.map((d) => (
                                        <div key={d.name} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                                                <span className="text-slate-600">{d.name}</span>
                                            </div>
                                            <span className="font-bold text-slate-800">
                                                {d.value} ({stats.total > 0 ? Math.round((d.value / stats.total) * 100) : 0}%)
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Charts row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Incumplimiento por condición */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <ChartHeader title="Incumplimientos por Condición" sub="Número de veces que cada condición falló" />
                    <div className="p-5">
                        {stats.condStats.every((c) => c.fails === 0) ? (
                            <EmptyChart label="Sin incumplimientos en el período" positive />
                        ) : (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={stats.condStats} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CLR.grid} horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} tickLine={false} axisLine={false} width={28} />
                                    <Tooltip content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const c = stats.condStats.find((x) => x.label === payload[0].payload.label);
                                        return (
                                            <div className="bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-sm max-w-xs">
                                                <p className="font-bold text-slate-800 mb-1">{c?.label}</p>
                                                <p className="text-slate-500 text-xs mb-2 leading-snug">{c?.fullLabel}</p>
                                                <p className="text-red-600 font-bold">{payload[0].value} incumplimientos ({c?.pct}%)</p>
                                            </div>
                                        );
                                    }} />
                                    <Bar dataKey="fails" radius={[0, 6, 6, 0]}>
                                        {stats.condStats.map((entry, i) => (
                                            <Cell key={i} fill={entry.fails > 0 ? CLR.noCumple : CLR.muted} fillOpacity={entry.fails > 0 ? 1 : 0.3} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                        {/* Condition legend */}
                        <div className="mt-4 space-y-1.5">
                            {A18_CONDICIONES.map((c, i) => (
                                <div key={c.id} className="flex items-start gap-2 text-xs text-slate-500">
                                    <span className="font-bold text-slate-700 flex-shrink-0">C{i + 1}:</span>
                                    <span className="leading-snug">{c.label}{c.descripcion ? ` ${c.descripcion}` : ''}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Inspecciones por terminal */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <ChartHeader title="Rendimiento por Terminal" sub="Inspecciones CUMPLE y NO CUMPLE" />
                    <div className="p-5">
                        {stats.terminalData.length === 0 ? (
                            <EmptyChart label="Sin datos de terminales en el período" />
                        ) : (
                            <>
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={stats.terminalData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={CLR.grid} />
                                        <XAxis dataKey="terminal" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                                        <Bar dataKey="CUMPLE" fill={CLR.cumple} radius={[4, 4, 0, 0]} maxBarSize={32} />
                                        <Bar dataKey="NO CUMPLE" fill={CLR.noCumple} radius={[4, 4, 0, 0]} maxBarSize={32} />
                                    </BarChart>
                                </ResponsiveContainer>

                                {/* Terminal ranking */}
                                <div className="mt-5 space-y-2">
                                    {[...stats.terminalData]
                                        .sort((a, b) => b.pct - a.pct)
                                        .map((t) => (
                                            <div key={t.code} className="flex items-center gap-3">
                                                <span className="text-xs text-slate-600 w-20 flex-shrink-0 truncate">{t.terminal}</span>
                                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-700"
                                                        style={{
                                                            width: `${t.pct}%`,
                                                            background: t.pct >= 80 ? CLR.cumple : t.pct >= 60 ? '#f59e0b' : CLR.noCumple,
                                                        }}
                                                    />
                                                </div>
                                                <span className={`text-xs font-bold w-10 text-right flex-shrink-0 ${t.pct >= 80 ? 'text-emerald-600' : t.pct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                                                    {t.pct}%
                                                </span>
                                                <span className="text-xs text-slate-400 w-12 text-right flex-shrink-0">{t.total} insp.</span>
                                            </div>
                                        ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Summary table */}
            {stats.total > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <ChartHeader title="Resumen Ejecutivo" sub={`Período: últimos ${days} días`} />
                    <div className="p-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <SummaryBox label="Total Inspecciones" value={String(stats.total)} color="text-blue-600" />
                            <SummaryBox label="% Cumplimiento" value={`${stats.pct}%`} color={stats.pct >= 80 ? 'text-emerald-600' : stats.pct >= 60 ? 'text-amber-600' : 'text-red-600'} />
                            <SummaryBox label="Mejor Terminal" value={stats.bestTerminal?.terminal ?? '—'} sub={`${stats.bestTerminal?.pct ?? 0}% cumplimiento`} color="text-violet-600" />
                            <SummaryBox label="Condición Crítica" value={stats.worstCondicion ? `Condición ${A18_CONDICIONES.findIndex((c) => c.id === stats.worstCondicion?.id) + 1}` : 'Ninguna'} sub={stats.worstCondicion ? `${stats.worstCondicion.pct}% de fallas` : 'Sin incumplimientos'} color={stats.worstCondicion && stats.worstCondicion.pct > 0 ? 'text-red-600' : 'text-emerald-600'} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Helper components ─────────────────────────────────────────────────────────

const ChartHeader = ({ title, sub }: { title: string; sub: string }) => (
    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
    </div>
);

const EmptyChart = ({ label, positive }: { label: string; positive?: boolean }) => (
    <div className={`h-44 flex flex-col items-center justify-center gap-2 rounded-xl ${positive ? 'bg-emerald-50' : 'bg-slate-50'}`}>
        <Icon name={positive ? 'check-circle' : 'bar-chart'} size={28} className={positive ? 'text-emerald-400' : 'text-slate-300'} />
        <p className="text-sm text-slate-500">{label}</p>
    </div>
);

interface KpiCardProps {
    icon: IconName; iconBg: string; iconColor: string;
    label: string; value: string; sub?: string;
    highlight?: 'green' | 'yellow' | 'red';
}

const KpiCard = ({ icon, iconBg, iconColor, label, value, sub, highlight }: KpiCardProps) => {
    const valueColor = highlight === 'green' ? 'text-emerald-600' : highlight === 'red' ? 'text-red-600' : highlight === 'yellow' ? 'text-amber-600' : 'text-slate-900';
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${iconBg}`}>
                <Icon name={icon} size={18} className={iconColor} />
            </div>
            <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
            <div className="text-xs font-semibold text-slate-600 mt-0.5">{label}</div>
            {sub && <div className="text-xs text-slate-400 mt-0.5 leading-tight">{sub}</div>}
        </div>
    );
};

const SummaryBox = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) => (
    <div className="bg-slate-50 rounded-xl p-4 text-center">
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        <p className="text-xs font-semibold text-slate-600 mt-1">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
);
