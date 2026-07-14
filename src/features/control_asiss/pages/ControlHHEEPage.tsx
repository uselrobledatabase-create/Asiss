/**
 * Control ASISS - Control HHEE
 * Análisis de horas extra desde el Excel oficial:
 * datos desde la fila 15 · A=RUT · B=Nombre · C=Cargo · S=Total HHEE.
 * La columna S viene como DURACIÓN de Excel (días + fracción de día),
 * el analizador la convierte correctamente a horas (días × 24 + hh:mm:ss).
 * Límite de referencia: 40 hrs semanales, superable solo por necesidad
 * operacional justificada.
 */

import { useMemo, useRef, useState } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import { useStaffWithShifts } from '../../asistencia2026/hooks';
import {
    analyzeHHEEFile,
    formatHorasHM,
    HHEE_LIMITE_SEMANAL,
    HHEE_UMBRAL_PROXIMO,
    HHEE_UMBRAL_CRITICO,
} from '../utils/hheeAnalyzer';
import { HHEEAnalysis, HHEEEstado, HHEEPersonRow } from '../types';

const ESTADO_META: Record<HHEEEstado, { label: string; badge: string; bar: string }> = {
    CRITICO: { label: `CRÍTICO ≥${HHEE_UMBRAL_CRITICO}h`, badge: 'bg-red-600 text-white', bar: 'bg-red-600' },
    SOBRE_LIMITE: { label: `SOBRE LÍMITE ≥${HHEE_LIMITE_SEMANAL}h`, badge: 'bg-orange-500 text-white', bar: 'bg-orange-500' },
    PROXIMO: { label: `Próximo ≥${HHEE_UMBRAL_PROXIMO}h`, badge: 'bg-amber-100 text-amber-800', bar: 'bg-amber-400' },
    OK: { label: 'OK', badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
};

export const ControlHHEEPage = () => {
    const { data: staff = [] } = useStaffWithShifts({ mode: 'ALL' }, undefined);

    const [analysis, setAnalysis] = useState<HHEEAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [cargoFilter, setCargoFilter] = useState('ALL');
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const resetAll = () => {
        setAnalysis(null);
        setError(null);
        setSearch('');
        setCargoFilter('ALL');
    };

    const handleFile = async (file: File | undefined) => {
        if (!file) return;
        if (!/\.(xlsx|xls)$/i.test(file.name)) {
            setError('El archivo debe ser Excel (.xlsx o .xls).');
            return;
        }
        setIsAnalyzing(true);
        setError(null);
        try {
            const result = await analyzeHHEEFile(file, staff);
            setAnalysis(result);
            setSearch('');
            setCargoFilter('ALL');
        } catch (e) {
            setAnalysis(null);
            setError(e instanceof Error ? e.message : 'Error al analizar el archivo.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const visibleCargos = useMemo(() => {
        if (!analysis) return [];
        const q = search.trim().toLowerCase();
        return analysis.cargos
            .filter((c) => cargoFilter === 'ALL' || c.cargo === cargoFilter)
            .map((c) => ({
                ...c,
                people: q
                    ? c.people.filter(
                        (p) => p.nombre.toLowerCase().includes(q) || p.rut.toLowerCase().includes(q)
                    )
                    : c.people,
            }))
            .filter((c) => c.people.length > 0);
    }, [analysis, cargoFilter, search]);

    const alertados = useMemo(
        () => (analysis ? analysis.people.filter((p) => p.totalHoras >= HHEE_LIMITE_SEMANAL) : []),
        [analysis]
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Control HHEE</h1>
                    <p className="text-sm text-slate-500">
                        Control ASISS · Análisis de horas extra por cargo · Límite {HHEE_LIMITE_SEMANAL} hrs semanales
                    </p>
                </div>
                {analysis && (
                    <button
                        onClick={resetAll}
                        className="flex items-center gap-2 self-start rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-colors hover:bg-slate-700"
                    >
                        <Icon name="upload" size={16} />
                        Analizar otro archivo
                    </button>
                )}
            </div>

            {/* Zona de carga: SOLO visible cuando no hay análisis */}
            {!analysis && (
                <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        handleFile(e.dataTransfer.files?.[0]);
                    }}
                    onClick={() => inputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 transition-colors ${dragOver
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50'
                        }`}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={(e) => {
                            handleFile(e.target.files?.[0]);
                            e.target.value = '';
                        }}
                    />
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100">
                        <Icon name="upload" size={32} className="text-blue-600" />
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-slate-700">
                            {isAnalyzing ? 'Analizando archivo…' : 'Arrastra aquí el Excel oficial de HHEE'}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">o haz clic para seleccionarlo</p>
                        <p className="mt-3 text-xs text-slate-400">
                            Formato: datos desde la <b>fila 15</b> · Col <b>A</b> RUT · Col <b>B</b> Nombre ·
                            Col <b>C</b> Cargo · Col <b>S</b> Total HHEE (duración Excel)
                        </p>
                    </div>
                </div>
            )}

            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
                    <Icon name="x-circle" size={22} className="mt-0.5 shrink-0 text-red-600" />
                    <div>
                        <p className="font-bold text-red-800">No se pudo analizar el archivo</p>
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                </div>
            )}

            {analysis && (
                <>
                    {/* ======== DENUNCIA: LO QUE ESTÁ PASANDO ======== */}
                    {alertados.length > 0 ? (
                        <div className="overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-r from-red-600 to-orange-500 shadow-lg">
                            <div className="flex flex-col gap-2 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                                        <Icon name="alert-triangle" size={26} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold text-white">
                                            {alertados.length} persona(s) SUPERAN el límite de {HHEE_LIMITE_SEMANAL} hrs semanales
                                        </p>
                                        <p className="text-sm text-red-100">
                                            {analysis.criticoCount > 0 && (
                                                <b>{analysis.criticoCount} en nivel CRÍTICO (≥{HHEE_UMBRAL_CRITICO}h). </b>
                                            )}
                                            Superar el límite es condicional según necesidad operacional — cada caso debe estar justificado.
                                        </p>
                                    </div>
                                </div>
                                <div className="shrink-0 rounded-xl bg-white/15 px-4 py-2 text-center">
                                    <p className="text-2xl font-bold text-white">{formatHorasHM(analysis.totalHoras)}</p>
                                    <p className="text-[11px] font-semibold uppercase text-red-100">Total HHEE período</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 bg-black/10 px-6 py-3">
                                {alertados.slice(0, 8).map((p) => (
                                    <span key={p.rut} className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-red-700">
                                        {p.nombre.split(' ').slice(0, 2).join(' ')} · {formatHorasHM(p.totalHoras)}
                                    </span>
                                ))}
                                {alertados.length > 8 && (
                                    <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-bold text-red-800">
                                        +{alertados.length - 8} más
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4">
                            <Icon name="check-circle" size={26} className="text-emerald-600" />
                            <div>
                                <p className="font-bold text-emerald-800">Sin excesos en el período</p>
                                <p className="text-sm text-emerald-700">
                                    Nadie supera las {HHEE_LIMITE_SEMANAL} hrs del límite semanal.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* KPIs */}
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                        <HheeKpi label="Total HHEE" value={formatHorasHM(analysis.totalHoras)} sub={`${analysis.totalHoras.toFixed(1)} hrs`} tone="blue" icon="clock" />
                        <HheeKpi label="Personas analizadas" value={String(analysis.people.length)} sub={`${analysis.cargos.length} cargos`} tone="slate" icon="users" />
                        <HheeKpi label="Promedio por persona" value={formatHorasHM(analysis.promedioPersona)} sub={`${analysis.promedioPersona.toFixed(1)} hrs`} tone="slate" icon="bar-chart" />
                        <HheeKpi label={`Sobre límite (≥${HHEE_LIMITE_SEMANAL}h)`} value={String(analysis.sobreLimiteCount)} sub="requieren justificación" tone={analysis.sobreLimiteCount > 0 ? 'orange' : 'green'} icon="alert-triangle" />
                        <HheeKpi label={`Críticos (≥${HHEE_UMBRAL_CRITICO}h)`} value={String(analysis.criticoCount)} sub="revisión inmediata" tone={analysis.criticoCount > 0 ? 'red' : 'green'} icon="alert-circle" />
                    </div>

                    {/* Filtros */}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap gap-2">
                            <CargoChip
                                label={`Todos (${analysis.people.length})`}
                                active={cargoFilter === 'ALL'}
                                onClick={() => setCargoFilter('ALL')}
                            />
                            {analysis.cargos.map((c) => (
                                <CargoChip
                                    key={c.cargo}
                                    label={`${c.cargo} (${c.personas})`}
                                    active={cargoFilter === c.cargo}
                                    alert={c.sobreLimite > 0}
                                    onClick={() => setCargoFilter(cargoFilter === c.cargo ? 'ALL' : c.cargo)}
                                />
                            ))}
                        </div>
                        <div className="relative max-w-md">
                            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por nombre o RUT…"
                                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* ======== ANÁLISIS COMPLETO POR CARGO (mayores HHEE primero) ======== */}
                    <div className="space-y-5">
                        {visibleCargos.length === 0 && (
                            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">
                                Sin resultados para el filtro aplicado
                            </div>
                        )}
                        {visibleCargos.map((c) => {
                            const pct = analysis.totalHoras > 0 ? (c.totalHoras / analysis.totalHoras) * 100 : 0;
                            return (
                                <section key={c.cargo} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                    {/* Header del cargo */}
                                    <div className={`border-b px-5 py-4 ${c.sobreLimite > 0 ? 'bg-gradient-to-r from-slate-800 to-red-900' : 'bg-slate-800'}`}>
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-base font-bold text-white">{c.cargo}</h3>
                                                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-slate-200">
                                                    {c.personas} persona(s)
                                                </span>
                                                {c.sobreLimite > 0 && (
                                                    <span className="animate-pulse rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white">
                                                        ⚠ {c.sobreLimite} sobre límite
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-slate-300">
                                                <Stat label="Total" value={formatHorasHM(c.totalHoras)} />
                                                <Stat label="Promedio" value={formatHorasHM(c.promedio)} />
                                                <Stat label="Máximo" value={formatHorasHM(c.maximo)} />
                                                <Stat label="% del total" value={`${pct.toFixed(1)}%`} />
                                            </div>
                                        </div>
                                        {/* Barra de participación del cargo */}
                                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                                            <div className="h-full rounded-full bg-blue-400" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>

                                    {/* Personas del cargo (mayores horas primero) */}
                                    <div className="divide-y divide-slate-100">
                                        {c.people.map((p, i) => (
                                            <PersonRow key={p.rut} person={p} rank={i + 1} />
                                        ))}
                                    </div>
                                </section>
                            );
                        })}
                    </div>

                    {/* Leyenda */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="font-bold text-slate-600">Leyenda:</span>
                        {(['OK', 'PROXIMO', 'SOBRE_LIMITE', 'CRITICO'] as HHEEEstado[]).map((e) => (
                            <span key={e} className={`rounded-full px-2.5 py-0.5 font-semibold ${ESTADO_META[e].badge}`}>
                                {ESTADO_META[e].label}
                            </span>
                        ))}
                        <span className="ml-auto text-slate-400">
                            Horas en formato H:MM · barra relativa a {HHEE_UMBRAL_CRITICO}h · línea roja = límite {HHEE_LIMITE_SEMANAL}h
                        </span>
                    </div>
                </>
            )}
        </div>
    );
};

// ==========================================
// Sub-componentes
// ==========================================

const Stat = ({ label, value }: { label: string; value: string }) => (
    <span className="text-slate-300">
        {label} <b className="text-white">{value}</b>
    </span>
);

const PersonRow = ({ person: p, rank }: { person: HHEEPersonRow; rank: number }) => {
    const meta = ESTADO_META[p.estado];
    const barPct = Math.min(p.totalHoras / HHEE_UMBRAL_CRITICO, 1) * 100;
    const limitPct = (HHEE_LIMITE_SEMANAL / HHEE_UMBRAL_CRITICO) * 100;
    const excede = p.totalHoras >= HHEE_LIMITE_SEMANAL;

    return (
        <div className={`flex items-center gap-4 px-5 py-2.5 ${excede ? 'bg-red-50/60' : 'hover:bg-slate-50'}`}>
            <span className={`w-7 shrink-0 text-center text-xs font-bold ${rank <= 3 ? 'text-slate-700' : 'text-slate-300'}`}>
                {rank}
            </span>
            {/* Nombre completo: usa todo el espacio disponible */}
            <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold text-slate-800">{p.nombre}</p>
                <p className="text-xs text-slate-400">{p.rut} · {p.cargo} · {p.terminal}</p>
            </div>

            {/* Barra vs límite (marca roja en 40h) */}
            <div className="relative hidden h-3 w-64 shrink-0 overflow-hidden rounded-full bg-slate-100 lg:block xl:w-80">
                <div className={`h-full rounded-full ${meta.bar} transition-all`} style={{ width: `${barPct}%` }} />
                <div
                    className="absolute top-0 h-full w-0.5 bg-red-600"
                    style={{ left: `${limitPct}%` }}
                    title={`Límite ${HHEE_LIMITE_SEMANAL}h`}
                />
            </div>

            <div className="w-20 shrink-0 text-right">
                <p className="text-sm font-bold text-slate-800">{formatHorasHM(p.totalHoras)}</p>
                {excede && (
                    <p className="text-[10px] font-bold text-red-600">
                        +{formatHorasHM(p.totalHoras - HHEE_LIMITE_SEMANAL)} exceso
                    </p>
                )}
            </div>
            <div className="w-44 shrink-0 text-right">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.badge}`}>
                    {meta.label}
                </span>
            </div>
        </div>
    );
};

const KPI_TONES: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
};

const HheeKpi = ({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone: string; icon: any }) => (
    <div className={`flex items-center gap-3 rounded-xl border p-4 ${KPI_TONES[tone]}`}>
        <Icon name={icon} size={24} />
        <div className="min-w-0">
            <p className="text-xl font-bold leading-none">{value}</p>
            <p className="mt-1 truncate text-xs font-medium opacity-80">{label}</p>
            {sub && <p className="truncate text-[10px] opacity-60">{sub}</p>}
        </div>
    </div>
);

const CargoChip = ({ label, active, alert, onClick }: { label: string; active: boolean; alert?: boolean; onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${active
            ? 'bg-slate-800 text-white'
            : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
            }`}
    >
        {alert && <span className={`h-2 w-2 rounded-full ${active ? 'bg-red-400' : 'bg-red-500'}`} />}
        {label}
    </button>
);
