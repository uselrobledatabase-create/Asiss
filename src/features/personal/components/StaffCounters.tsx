/**
 * StaffCounters - Q del personal, claro y accionable:
 * DISPONIBLES HOY (contratados − suspendidos − licencias) versus el
 * CUPO CONTRATABLE (dotación autorizada), con el cupo libre por cargo
 * para conocer la necesidad operativa real de contratación.
 * Incluye detalle nominal de licencias y suspendidos. 100% responsivo.
 */

import { useState } from 'react';
import { useStaffCounts } from '../hooks';
import { TerminalContext } from '../../../shared/types/terminal';
import { STAFF_CARGOS, StaffCargo } from '../types';
import { displayTerminal } from '../../../shared/utils/terminal';
import { Icon, IconName } from '../../../shared/components/common/Icon';

interface Props {
    terminalContext: TerminalContext;
}

const getCargoIcon = (cargo: StaffCargo): IconName => {
    const icons: Record<StaffCargo, IconName> = {
        conductor: 'truck',
        inspector_patio: 'clipboard',
        cleaner: 'spray',
        planillero: 'layers',
        supervisor: 'users',
    };
    return icons[cargo] || 'users';
};

const getCargoLabel = (cargo: StaffCargo): string => {
    return STAFF_CARGOS.find((c) => c.value === cargo)?.label || cargo;
};

export const StaffCounters = ({ terminalContext }: Props) => {
    const { data: counts, isLoading } = useStaffCounts(terminalContext);
    const [showDetail, setShowDetail] = useState(false);

    if (isLoading) {
        return (
            <div className="mb-6 space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="card h-24 animate-pulse bg-slate-100" />
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="card h-40 animate-pulse bg-slate-100" />
                    ))}
                </div>
            </div>
        );
    }

    if (!counts) return null;

    const showErLr = terminalContext.mode === 'ALL' || terminalContext.mode === 'GROUP';

    // ---- Totales globales ----
    const totContratados = counts.total;
    const totSuspendidos = counts.byCargo.reduce((a, c) => a + c.suspended, 0);
    const totLicencias = counts.byCargo.reduce((a, c) => a + c.with_licenses, 0);
    const totDisponibles = totContratados - totSuspendidos - totLicencias;
    const conCupo = counts.byCargo.filter((c) => c.max_q !== null);
    const totCupo = conCupo.reduce((a, c) => a + (c.max_q || 0), 0);
    const totContratadosConCupo = conCupo.reduce((a, c) => a + c.count, 0);
    const cupoLibre = totCupo - totContratadosConCupo;

    return (
        <div className="mb-6 w-full min-w-0 space-y-4">
            {/* ===== RESUMEN GLOBAL ===== */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <GlobalCard
                    icon="users"
                    label="Contratados"
                    value={totContratados}
                    sub="dotación activa total"
                    tone="slate"
                />
                <GlobalCard
                    icon="check-circle"
                    label="Disponibles hoy"
                    value={totDisponibles}
                    sub="descontando licencias y suspendidos"
                    tone="green"
                />
                <GlobalCard
                    icon="file-text"
                    label="Con licencia hoy"
                    value={totLicencias}
                    sub="no disponibles temporalmente"
                    tone={totLicencias > 0 ? 'purple' : 'slate'}
                />
                <GlobalCard
                    icon="x-circle"
                    label="Suspendidos"
                    value={totSuspendidos}
                    sub="activos sin operar"
                    tone={totSuspendidos > 0 ? 'amber' : 'slate'}
                />
                <GlobalCard
                    icon="gauge"
                    label="Cupo contratable"
                    value={totCupo}
                    sub="dotación autorizada (ER-LR)"
                    tone="blue"
                />
                <GlobalCard
                    icon="plus"
                    label={cupoLibre >= 0 ? 'Cupo libre' : 'Sobre cupo'}
                    value={Math.abs(cupoLibre)}
                    sub={cupoLibre > 0 ? 'necesidad real de contratación' : cupoLibre === 0 ? 'dotación completa' : 'excede lo autorizado'}
                    tone={cupoLibre > 0 ? 'red' : cupoLibre === 0 ? 'green' : 'amber'}
                />
            </div>

            {/* ===== Q POR CARGO: disponibles vs cupo ===== */}
            <div>
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                        Q por Cargo — Disponibles vs Cupo Contratable{showErLr ? ' · ER-LR' : ''}
                    </h3>
                    {(totLicencias > 0 || totSuspendidos > 0) && (
                        <button
                            onClick={() => setShowDetail((v) => !v)}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${showDetail ? 'bg-slate-800 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'}`}
                        >
                            <Icon name="eye" size={12} />
                            {showDetail ? 'Ocultar detalle' : `Ver detalle (${totLicencias + totSuspendidos})`}
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {counts.byCargo.map((item) => {
                        const contratados = item.count;
                        const disponibles = contratados - item.suspended - item.with_licenses;
                        const hasQuota = item.max_q !== null && item.max_q > 0;
                        const cupo = item.max_q || 0;
                        const libre = hasQuota ? cupo - contratados : 0;
                        const overQ = hasQuota && libre < 0;
                        const pctDisp = hasQuota ? Math.min((disponibles / cupo) * 100, 100) : 0;
                        const pctNoDisp = hasQuota
                            ? Math.min(((contratados - disponibles) / cupo) * 100, 100 - pctDisp)
                            : 0;

                        return (
                            <div
                                key={item.cargo}
                                className={`card flex flex-col gap-2.5 p-4 ${overQ ? 'border-red-200 bg-red-50/50' : ''}`}
                            >
                                {/* Cargo */}
                                <div className="flex min-w-0 items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                                            <Icon name={getCargoIcon(item.cargo)} size={15} className="text-slate-500" />
                                        </div>
                                        <span className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                            {getCargoLabel(item.cargo)}
                                        </span>
                                    </div>
                                    {hasQuota && (
                                        <span
                                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${libre > 0
                                                ? 'bg-red-100 text-red-700'
                                                : libre === 0
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-amber-100 text-amber-800'
                                                }`}
                                            title={libre > 0 ? 'Cupo libre: necesidad real de contratación' : libre === 0 ? 'Dotación completa' : 'Sobre el cupo autorizado'}
                                        >
                                            {libre > 0 ? `Faltan ${libre}` : libre === 0 ? 'Completo' : `+${-libre} sobre cupo`}
                                        </span>
                                    )}
                                </div>

                                {/* Disponibles vs cupo */}
                                <div className="flex items-baseline gap-1.5">
                                    <span className={`text-3xl font-extrabold leading-none tabular-nums ${disponibles < contratados ? 'text-slate-800' : 'text-emerald-600'}`}>
                                        {disponibles}
                                    </span>
                                    <span className="text-xs font-semibold text-slate-400">
                                        disponibles{hasQuota ? ` / ${cupo} contratables` : ''}
                                    </span>
                                </div>

                                {/* Barra: disponibles (verde) + no disponibles (ámbar) sobre el cupo */}
                                <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100" title={hasQuota ? `Disponibles ${disponibles} · No disponibles ${contratados - disponibles} · Cupo ${cupo}` : 'Sin cupo definido'}>
                                    {hasQuota ? (
                                        <>
                                            <div className="h-full bg-emerald-500" style={{ width: `${pctDisp}%` }} />
                                            <div className="h-full bg-amber-400" style={{ width: `${pctNoDisp}%` }} />
                                        </>
                                    ) : (
                                        <div className="h-full w-full bg-slate-200" />
                                    )}
                                </div>

                                {/* Desglose */}
                                <div className="flex flex-col gap-1 text-[11px]">
                                    <div className="flex justify-between text-slate-500">
                                        <span>Contratados</span>
                                        <span className="font-semibold tabular-nums text-slate-700">{contratados}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-500">
                                        <span>Licencia hoy</span>
                                        <span className={`font-semibold tabular-nums ${item.with_licenses > 0 ? 'text-purple-600' : 'text-slate-300'}`}>
                                            {item.with_licenses}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-slate-500">
                                        <span>Suspendidos</span>
                                        <span className={`font-semibold tabular-nums ${item.suspended > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                                            {item.suspended}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ===== DETALLE NOMINAL: licencias y suspendidos ===== */}
            {showDetail && (
                <div className="grid gap-3 lg:grid-cols-2">
                    <div className="card p-4">
                        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-purple-700">
                            <Icon name="file-text" size={14} />
                            Con licencia hoy ({counts.detail.licencias.length})
                        </p>
                        {counts.detail.licencias.length === 0 ? (
                            <p className="text-xs text-slate-400">Nadie con licencia hoy.</p>
                        ) : (
                            <div className="flex flex-wrap gap-1.5">
                                {counts.detail.licencias.map((p, i) => (
                                    <span key={i} className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-800">
                                        {p.nombre}
                                        <span className="ml-1 font-normal text-purple-500">
                                            · {p.cargo} · {displayTerminal(p.terminal_code as never)}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="card p-4">
                        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-700">
                            <Icon name="x-circle" size={14} />
                            Suspendidos ({counts.detail.suspendidos.length})
                        </p>
                        {counts.detail.suspendidos.length === 0 ? (
                            <p className="text-xs text-slate-400">Nadie suspendido.</p>
                        ) : (
                            <div className="flex flex-wrap gap-1.5">
                                {counts.detail.suspendidos.map((p, i) => (
                                    <span key={i} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                                        {p.nombre}
                                        <span className="ml-1 font-normal text-amber-500">
                                            · {p.cargo} · {displayTerminal(p.terminal_code as never)}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ===== POR TERMINAL ===== */}
            <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                    Personal por Terminal
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                    {counts.byTerminal.map((item) => (
                        <div key={item.terminal_code} className="card flex items-center gap-3 px-4 py-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                                <Icon name="building" size={16} className="text-slate-500" />
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-[11px] font-medium text-slate-500">
                                    {displayTerminal(item.terminal_code)}
                                </p>
                                <p className="text-xl font-bold leading-tight tabular-nums text-slate-800">
                                    {item.count}
                                </p>
                            </div>
                        </div>
                    ))}
                    <div className="card flex items-center gap-3 border-brand-200 bg-brand-50 px-4 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100">
                            <Icon name="users" size={16} className="text-brand-600" />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-brand-600">Total</p>
                            <p className="text-xl font-bold leading-tight tabular-nums text-brand-700">
                                {counts.total}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// Tarjeta de resumen global
// ==========================================

const GLOBAL_TONES: Record<string, { card: string; icon: string }> = {
    slate: { card: 'border-slate-200', icon: 'bg-slate-100 text-slate-500' },
    green: { card: 'border-emerald-200 bg-emerald-50/50', icon: 'bg-emerald-100 text-emerald-600' },
    blue: { card: 'border-blue-200 bg-blue-50/50', icon: 'bg-blue-100 text-blue-600' },
    purple: { card: 'border-purple-200 bg-purple-50/50', icon: 'bg-purple-100 text-purple-600' },
    amber: { card: 'border-amber-200 bg-amber-50/50', icon: 'bg-amber-100 text-amber-600' },
    red: { card: 'border-red-200 bg-red-50/50', icon: 'bg-red-100 text-red-600' },
};

const GlobalCard = ({ icon, label, value, sub, tone }: {
    icon: IconName; label: string; value: number; sub: string; tone: string;
}) => {
    const t = GLOBAL_TONES[tone] || GLOBAL_TONES.slate;
    return (
        <div className={`card flex flex-col gap-1.5 p-3.5 ${t.card}`}>
            <div className="flex items-center gap-2">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${t.icon}`}>
                    <Icon name={icon} size={14} />
                </div>
                <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {label}
                </span>
            </div>
            <p className="text-2xl font-extrabold leading-none tabular-nums text-slate-800">{value}</p>
            <p className="truncate text-[10px] text-slate-400">{sub}</p>
        </div>
    );
};
