/**
 * Control ASISS - Grilla de Programación Mensual (editable)
 *
 * Vista mensual masiva del TURNO del personal (solo horarios y LIBRE,
 * aquí no se pasa asistencia). Activos y suspendidos, separada por
 * terminal, ordenada por cargo, con filtros de terminal/turno/búsqueda.
 *
 * Permite modificar la programación con visual amplia:
 * - Cambio de modalidad de turno (5x2 Fijo/Rotativo/Super/Relevo/Especial)
 * - Ajustes puntuales por día (cambio de día: forzar LIBRE o TRABAJA)
 *
 * REGLAS ABSOLUTAS validadas antes de guardar: máx. 6 días seguidos,
 * mínimo 2 domingos libres al mes, y jamás trabajar un domingo de
 * descanso. Todo cambio exige la clave de autorización.
 * Los cambios se reflejan de inmediato en la sección Asistencia.
 */

import { Fragment, useMemo, useState } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import { StaffWithShift, ShiftTypeCode, VariantCode } from '../../asistencia2026/types';
import {
    useControlAsissExportData,
    useUpsertShiftControl,
    useUpsertOverrideControl,
    useDeleteOverrideControl,
} from '../hooks';
import { ExportStaff } from '../api';
import { getDateRange, dayNameShort, formatDateCL, monthName } from '../utils/scheduleEngine';
import { turnoDeFicha } from '../utils/coverageAnalysis';
import {
    buildPlan,
    checkRules,
    checkDayOverride,
    validarClaveTurnos,
    DayPlan,
    RuleCheck,
} from '../utils/programmingRules';
import { CONTROL_TERMINALS } from '../types';
import { buildShiftRecommendation } from '../../asistencia2026/utils/shiftRecommendation';

const CARGO_SORT = ['SUPERVISOR', 'INSPECTOR', 'CONDUCTOR', 'PLANILLERO', 'CLEANER'];
const cargoOrder = (cargo: string): number => {
    const idx = CARGO_SORT.findIndex((c) => cargo.toUpperCase().includes(c));
    return idx === -1 ? CARGO_SORT.length : idx;
};

const MODALIDADES: { code: ShiftTypeCode; label: string; desc: string }[] = [
    { code: '5X2_SUPER', label: '5x2 Super', desc: 'Sem 1: Mié+Dom · Sem 2: Jue+Vie libre' },
    { code: '5X2_ROTATIVO', label: '5x2 Rotativo', desc: 'Sem 1: Mié+Dom · Sem 2: Vie+Sáb libre' },
    { code: '5X2_FIJO', label: '5x2 Fijo', desc: 'Lun-Vie trabaja · Sáb+Dom libre (casos especiales)' },
    { code: 'SUPERVISOR_RELEVO', label: 'Supervisor Relevo', desc: 'Sem 1: Mié+Dom · Sem 2: Mié+Vie+Sáb libre' },
];

function shiftDateStr(date: string, days: number): string {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
    year: number;
    month: number; // 0-11
}

export const MonthlyProgrammingGrid = ({ year, month }: Props) => {
    const mm = String(month + 1).padStart(2, '0');
    const lastDay = new Date(year, month + 1, 0).getDate();
    const monthStart = `${year}-${mm}-01`;
    const monthEnd = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
    const monthDates = useMemo(() => getDateRange(monthStart, monthEnd), [monthStart, monthEnd]);

    // Rango de datos extendido ±6 días para validar rachas entre meses
    const { staff, scheduleContext, isLoading } = useControlAsissExportData(
        shiftDateStr(monthStart, -6),
        shiftDateStr(monthEnd, 6)
    );

    const [terminalFilter, setTerminalFilter] = useState<string>('EL_ROBLE');
    const [turnoFilter, setTurnoFilter] = useState<'TODOS' | 'DIA' | 'NOCHE'>('TODOS');
    const [search, setSearch] = useState('');

    const [dayEdit, setDayEdit] = useState<{ staff: ExportStaff; date: string } | null>(null);
    const [modalityEdit, setModalityEdit] = useState<ExportStaff | null>(null);

    const visibleStaff = useMemo(() => {
        const q = search.trim().toLowerCase();
        return staff
            .filter((s) => s.terminal_code === terminalFilter)
            .filter((s) => turnoFilter === 'TODOS' || turnoDeFicha(s.turno, s.horario) === turnoFilter)
            .filter((s) => !q || s.nombre.toLowerCase().includes(q) || s.rut.toLowerCase().includes(q))
            .sort((a, b) => cargoOrder(a.cargo) - cargoOrder(b.cargo) || a.nombre.localeCompare(b.nombre));
    }, [staff, terminalFilter, turnoFilter, search]);

    // Planes + validación por persona (memo por dependencias de datos)
    const plans = useMemo(() => {
        const map = new Map<string, { plan: DayPlan[]; rules: RuleCheck }>();
        for (const s of visibleStaff) {
            map.set(s.id, {
                plan: buildPlan(s, scheduleContext, monthDates),
                rules: checkRules(s, scheduleContext, year, month),
            });
        }
        return map;
    }, [visibleStaff, scheduleContext, monthDates, year, month]);

    return (
        <div className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 lg:flex-row lg:items-center">
                <div className="flex flex-wrap gap-2">
                    {CONTROL_TERMINALS.map((t) => (
                        <button
                            key={t.code}
                            onClick={() => setTerminalFilter(t.code)}
                            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${terminalFilter === t.code
                                ? 'bg-slate-800 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                    {(['TODOS', 'DIA', 'NOCHE'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTurnoFilter(t)}
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${turnoFilter === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                                }`}
                        >
                            {t === 'TODOS' ? 'Todos' : t === 'DIA' ? 'Día' : 'Noche'}
                        </button>
                    ))}
                </div>
                <div className="relative flex-1 lg:max-w-xs">
                    <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar nombre o RUT…"
                        className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <p className="text-xs text-slate-400 lg:ml-auto">
                    {visibleStaff.length} persona(s) · clic en una celda para cambio de día · clic en la modalidad para cambiarla
                </p>
            </div>

            {/* Reglas */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
                <span className="font-bold">REGLAS ABSOLUTAS:</span>
                <span>• Máximo 6 días seguidos de trabajo</span>
                <span>• Mínimo 2 domingos libres al mes</span>
                <span>• Jamás trabajar un domingo de descanso</span>
                <span className="ml-auto flex items-center gap-1 text-red-600">
                    <Icon name="key" size={12} /> Todo cambio requiere clave de autorización
                </span>
            </div>

            {/* Grilla */}
            {isLoading ? (
                <div className="flex h-48 items-center justify-center rounded-xl border bg-white text-slate-500">
                    <Icon name="loader" size={20} className="mr-2 animate-spin" /> Cargando programación…
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="border-collapse">
                            <thead>
                                <tr>
                                    <th className="sticky left-0 z-20 min-w-[230px] border-b border-r bg-slate-800 px-3 py-2 text-left text-xs font-bold text-white">
                                        {monthName(month).toUpperCase()} {year} — Turno / Trabajador
                                    </th>
                                    {monthDates.map((d) => {
                                        const dow = new Date(d + 'T12:00:00').getDay();
                                        return (
                                            <th
                                                key={d}
                                                className={`min-w-[46px] border-b px-0.5 py-1.5 text-center ${dow === 0 ? 'bg-red-700 text-white' : dow === 6 ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-200'
                                                    }`}
                                            >
                                                <div className="text-[9px] font-semibold">{dayNameShort(d).toUpperCase()}</div>
                                                <div className="text-xs font-bold">{parseInt(d.slice(-2), 10)}</div>
                                            </th>
                                        );
                                    })}
                                    <th className="min-w-[104px] border-b bg-slate-800 px-2 py-1.5 text-center text-[9px] font-bold text-slate-200">
                                        RESUMEN<br />T · L · DomL · Racha
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleStaff.length === 0 && (
                                    <tr>
                                        <td colSpan={monthDates.length + 2} className="px-4 py-8 text-center text-sm text-slate-400">
                                            Sin personal para el filtro aplicado
                                        </td>
                                    </tr>
                                )}
                                {visibleStaff.map((s, idx) => {
                                    const entry = plans.get(s.id);
                                    if (!entry) return null;
                                    const { plan, rules } = entry;
                                    const cargoPrev = idx > 0 ? visibleStaff[idx - 1].cargo.toUpperCase() : '';
                                    const showCargo = s.cargo.toUpperCase() !== cargoPrev;
                                    const trabaja = plan.filter((p) => p.status === 'TRABAJA').length;
                                    const libres = plan.filter((p) => p.status === 'LIBRE').length;
                                    const modalidad = s.shift
                                        ? `${MODALIDADES.find((m) => m.code === s.shift!.shift_type_code)?.label || s.shift.shift_type_code}${s.shift.variant_code === 'CONTRATURNO' ? ' · Contra' : ''}`
                                        : 'Sin turno';

                                    return (
                                        <Fragment key={s.id}>
                                            {showCargo && (
                                                <tr>
                                                    <td
                                                        colSpan={monthDates.length + 2}
                                                        className="border-b bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-800"
                                                    >
                                                        {s.cargo.toUpperCase()}
                                                    </td>
                                                </tr>
                                            )}
                                            <tr className="group">
                                                {/* Persona + modalidad */}
                                                <td className={`sticky left-0 z-10 border-b border-r px-3 py-1 ${s.suspended ? 'bg-amber-50' : 'bg-white'} group-hover:bg-slate-50`}>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-xs font-bold text-slate-800">
                                                                {s.nombre}
                                                                {s.suspended && <span className="ml-1.5 rounded bg-amber-200 px-1 text-[9px] font-bold text-amber-800">SUSP</span>}
                                                            </p>
                                                            <button
                                                                onClick={() => setModalityEdit(s)}
                                                                className="mt-0.5 flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                                                                title="Cambiar modalidad de turno (requiere clave)"
                                                            >
                                                                <Icon name="settings" size={10} />
                                                                {modalidad}
                                                                {s.shift?.start_date && s.shift.start_date > monthStart && (
                                                                    <span className="text-indigo-400">· desde {formatDateCL(s.shift.start_date).slice(0, 5)}</span>
                                                                )}
                                                            </button>
                                                        </div>
                                                        {!rules.ok && (
                                                            <span title={rules.violations.join(' ')}>
                                                                <Icon name="alert-triangle" size={14} className="shrink-0 text-red-500" />
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Días */}
                                                {plan.map((p) => (
                                                    <td key={p.date} className="border-b p-0.5">
                                                        <DayCellBtn plan={p} onClick={() => setDayEdit({ staff: s, date: p.date })} />
                                                    </td>
                                                ))}

                                                {/* Resumen */}
                                                <td className="border-b px-1 py-1 text-center">
                                                    <div className="flex items-center justify-center gap-1 text-[10px] font-bold">
                                                        <span className="text-slate-700">{trabaja}</span>
                                                        <span className="text-slate-300">·</span>
                                                        <span className="text-slate-500">{libres}</span>
                                                        <span className="text-slate-300">·</span>
                                                        <span className={rules.sundaysLibres < rules.sundaysRequired ? 'rounded bg-red-100 px-1 text-red-700' : 'text-emerald-600'}>
                                                            {rules.sundaysLibres}D
                                                        </span>
                                                        <span className="text-slate-300">·</span>
                                                        <span className={rules.maxRun > 6 ? 'rounded bg-red-100 px-1 text-red-700' : 'text-slate-500'}>
                                                            {rules.maxRun}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Leyenda */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded bg-blue-50 ring-1 ring-blue-200" /> Trabaja (horario)</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded bg-slate-800" /> Libre</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded bg-slate-100 ring-1 ring-slate-200" /> — antes de la fecha de inicio</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> ajuste manual (cambio de día)</span>
                        <span className="ml-auto">Resumen: Trabajados · Libres · Domingos libres · Racha máxima</span>
                    </div>
                </div>
            )}

            {/* Editores */}
            {dayEdit && (
                <DayEditModal
                    staff={dayEdit.staff}
                    date={dayEdit.date}
                    year={year}
                    month={month}
                    ctx={scheduleContext}
                    onClose={() => setDayEdit(null)}
                />
            )}
            {modalityEdit && (
                <ModalityEditModal
                    staff={modalityEdit}
                    year={year}
                    month={month}
                    ctx={scheduleContext}
                    allStaff={staff}
                    onClose={() => setModalityEdit(null)}
                />
            )}
        </div>
    );
};

// ==========================================
// Celda de día
// ==========================================

const DayCellBtn = ({ plan, onClick }: { plan: DayPlan; onClick: () => void }) => {
    if (plan.status === 'PRE_INICIO') {
        return (
            <div className="flex h-9 w-full items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-300" title="Antes de la fecha de inicio">
                -
            </div>
        );
    }

    const times = plan.horario.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);

    return (
        <button
            onClick={onClick}
            className={`relative flex h-9 w-full flex-col items-center justify-center rounded transition-all hover:ring-2 hover:ring-blue-400 ${plan.status === 'LIBRE'
                ? 'bg-slate-800 text-white'
                : plan.isSunday
                    ? 'bg-red-50 text-red-900 ring-1 ring-red-200'
                    : plan.turno === 'NOCHE'
                        ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200'
                        : 'bg-blue-50 text-blue-900 ring-1 ring-blue-200'
                }`}
            title={`${dayNameShort(plan.date)} ${formatDateCL(plan.date)} · ${plan.status === 'LIBRE' ? 'LIBRE' : plan.horario || 'Trabaja'}${plan.overridden ? ' · AJUSTE MANUAL' : ''}`}
        >
            {plan.status === 'LIBRE' ? (
                <span className="text-[10px] font-bold">L</span>
            ) : times ? (
                <>
                    <span className="text-[8px] font-bold leading-none">{times[1]}</span>
                    <span className="text-[8px] leading-tight opacity-70">{times[2]}</span>
                </>
            ) : (
                <span className="text-[9px] font-bold">{plan.turno === 'NOCHE' ? 'N' : 'D'}</span>
            )}
            {plan.overridden && (
                <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
            )}
        </button>
    );
};

// ==========================================
// Modal: cambio de día (con clave)
// ==========================================

const DayEditModal = ({
    staff, date, year, month, ctx, onClose,
}: {
    staff: ExportStaff; date: string; year: number; month: number;
    ctx: Parameters<typeof checkDayOverride>[1]; onClose: () => void;
}) => {
    const upsertOverride = useUpsertOverrideControl();
    const removeOverride = useDeleteOverrideControl();

    const currentOverride = ctx.overrides.find(
        (o) => o.staff_id === staff.id && o.override_date === date
    );
    const [action, setAction] = useState<'OFF' | 'WORK' | null | undefined>(undefined);
    const [clave, setClave] = useState('');
    const [claveError, setClaveError] = useState(false);

    const check = useMemo(
        () => (action === undefined ? null : checkDayOverride(staff, ctx, year, month, date, action)),
        [staff, ctx, year, month, date, action]
    );

    const isSunday = new Date(date + 'T12:00:00').getDay() === 0;
    const busy = upsertOverride.isPending || removeOverride.isPending;

    const handleConfirm = async () => {
        if (action === undefined || !check?.ok) return;
        if (!validarClaveTurnos(clave)) {
            setClaveError(true);
            return;
        }
        try {
            if (action === null) {
                await removeOverride.mutateAsync({ staffId: staff.id, date });
            } else {
                await upsertOverride.mutateAsync({ staffId: staff.id, date, type: action });
            }
            onClose();
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Error al guardar el cambio.');
        }
    };

    const options: { value: 'OFF' | 'WORK' | null; label: string; desc: string; disabled?: boolean }[] = [
        { value: 'WORK', label: 'Forzar TRABAJA', desc: isSunday ? 'Prohibido sobre domingo de descanso' : 'La persona trabaja este día (cambio de día)', disabled: false },
        { value: 'OFF', label: 'Forzar LIBRE', desc: 'La persona queda libre este día (cambio de día)' },
        ...(currentOverride ? [{ value: null as null, label: 'Quitar ajuste manual', desc: 'Volver al patrón normal del turno' }] : []),
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="bg-slate-800 px-5 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-white">Cambio de Día</h3>
                            <p className="text-xs text-slate-300">
                                {staff.nombre} · {dayNameShort(date)} {formatDateCL(date)}
                                {currentOverride && ' · tiene ajuste manual'}
                            </p>
                        </div>
                        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                            <Icon name="x" size={18} />
                        </button>
                    </div>
                </div>

                <div className="space-y-4 p-5">
                    <div className="space-y-2">
                        {options.map((opt) => (
                            <button
                                key={String(opt.value)}
                                onClick={() => setAction(opt.value)}
                                className={`w-full rounded-xl border-2 px-4 py-2.5 text-left transition-all ${action === opt.value
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <p className="text-sm font-bold text-slate-800">{opt.label}</p>
                                <p className="text-xs text-slate-500">{opt.desc}</p>
                            </button>
                        ))}
                    </div>

                    {/* Validación de reglas */}
                    {check && (
                        check.ok ? (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
                                <p className="font-bold">✓ Cumple todas las reglas</p>
                                <p>Racha máx: {check.maxRun} días · Domingos libres: {check.sundaysLibres}/{check.sundaysRequired}</p>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-xs text-red-800">
                                <p className="font-bold">✕ BLOQUEADO — viola reglas absolutas:</p>
                                {check.violations.map((v, i) => <p key={i}>• {v}</p>)}
                            </div>
                        )
                    )}

                    {/* Clave */}
                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                            Clave de autorización de cambio de turno
                        </label>
                        <input
                            type="password"
                            value={clave}
                            onChange={(e) => { setClave(e.target.value); setClaveError(false); }}
                            placeholder="••••••••"
                            className={`w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 ${claveError ? 'border-red-400 ring-2 ring-red-200' : 'border-slate-300 focus:ring-blue-500'}`}
                        />
                        {claveError && <p className="mt-1 text-xs font-bold text-red-600">Clave incorrecta.</p>}
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-3.5">
                    <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={action === undefined || !check?.ok || !clave || busy}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {busy && <Icon name="loader" size={14} className="animate-spin" />}
                        Aplicar cambio
                    </button>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// Modal: cambio de modalidad de turno (con clave)
// ==========================================

const ModalityEditModal = ({
    staff, year, month, ctx, allStaff, onClose,
}: {
    staff: ExportStaff; year: number; month: number;
    ctx: Parameters<typeof checkRules>[1];
    allStaff: StaffWithShift[];
    onClose: () => void;
}) => {
    const upsertShift = useUpsertShiftControl();

    const [type, setType] = useState<ShiftTypeCode>(staff.shift?.shift_type_code || '5X2_SUPER');
    const [variant, setVariant] = useState<VariantCode>(staff.shift?.variant_code || 'PRINCIPAL');
    const [startDate, setStartDate] = useState(staff.shift?.start_date || '');
    const [clave, setClave] = useState('');
    const [claveError, setClaveError] = useState(false);

    const recommendation = useMemo(
        () => buildShiftRecommendation(staff, allStaff),
        [staff, allStaff]
    );

    // Simular reglas con la nueva modalidad
    const check = useMemo(() => {
        const simulated: StaffWithShift = {
            ...staff,
            shift: {
                id: staff.shift?.id || 'sim',
                staff_id: staff.id,
                shift_type_code: type,
                variant_code: variant,
                start_date: startDate || '2026-01-01',
                created_at: '',
            },
        };
        return checkRules(simulated, ctx, year, month);
    }, [staff, type, variant, startDate, ctx, year, month]);

    const handleConfirm = async () => {
        if (!check.ok) return;
        if (!validarClaveTurnos(clave)) {
            setClaveError(true);
            return;
        }
        try {
            await upsertShift.mutateAsync({
                staff_id: staff.id,
                shift_type_code: type,
                variant_code: variant,
                start_date: startDate || undefined,
            });
            onClose();
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Error al guardar la modalidad.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="bg-slate-800 px-5 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-white">Modalidad de Turno</h3>
                            <p className="text-xs text-slate-300">{staff.nombre} · {staff.cargo}</p>
                        </div>
                        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                            <Icon name="x" size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                    {/* Recomendación */}
                    {recommendation.recommended && (
                        <button
                            onClick={() => {
                                setType(recommendation.recommended!.shiftType);
                                setVariant(recommendation.recommended!.variant);
                            }}
                            className="flex w-full items-center justify-between rounded-xl border-2 border-indigo-300 bg-indigo-50 px-4 py-2.5 text-left transition-colors hover:bg-indigo-100"
                        >
                            <div>
                                <p className="flex items-center gap-1.5 text-xs font-bold text-indigo-800">
                                    <Icon name="sparkles" size={13} />
                                    Recomendado (más descubierto): {recommendation.recommended.label}
                                </p>
                                <p className="text-[11px] text-indigo-600">
                                    {recommendation.recommended.count} persona(s) en el grupo · clic para aplicar
                                </p>
                            </div>
                            <Icon name="chevron-right" size={16} className="text-indigo-400" />
                        </button>
                    )}

                    {/* Modalidades */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {MODALIDADES.map((m) => (
                            <button
                                key={m.code}
                                onClick={() => setType(m.code)}
                                className={`rounded-xl border-2 p-3 text-left transition-all ${type === m.code ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                            >
                                <p className="text-sm font-bold text-slate-800">{m.label}</p>
                                <p className="text-[11px] text-slate-500">{m.desc}</p>
                            </button>
                        ))}
                    </div>

                    {/* Variante */}
                    {(type === '5X2_ROTATIVO' || type === '5X2_SUPER') && (
                        <div className="flex gap-2">
                            {(['PRINCIPAL', 'CONTRATURNO'] as VariantCode[]).map((v) => (
                                <button
                                    key={v}
                                    onClick={() => setVariant(v)}
                                    className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all ${variant === v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'}`}
                                >
                                    {v === 'PRINCIPAL' ? 'Turno Normal' : 'Contraturno'}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Fecha de inicio */}
                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                            Fecha de inicio (los días anteriores quedan con “-”)
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Validación */}
                    {check.ok ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
                            <p className="font-bold">✓ La modalidad cumple las reglas del mes</p>
                            <p>Racha máx: {check.maxRun} días · Domingos libres: {check.sundaysLibres}/{check.sundaysRequired}</p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-xs text-red-800">
                            <p className="font-bold">✕ BLOQUEADO — viola reglas absolutas:</p>
                            {check.violations.map((v, i) => <p key={i}>• {v}</p>)}
                        </div>
                    )}

                    {/* Clave */}
                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                            Clave de autorización de cambio de turno
                        </label>
                        <input
                            type="password"
                            value={clave}
                            onChange={(e) => { setClave(e.target.value); setClaveError(false); }}
                            placeholder="••••••••"
                            className={`w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 ${claveError ? 'border-red-400 ring-2 ring-red-200' : 'border-slate-300 focus:ring-blue-500'}`}
                        />
                        {claveError && <p className="mt-1 text-xs font-bold text-red-600">Clave incorrecta.</p>}
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-3.5">
                    <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!check.ok || !clave || upsertShift.isPending}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {upsertShift.isPending && <Icon name="loader" size={14} className="animate-spin" />}
                        Guardar modalidad
                    </button>
                </div>
            </div>
        </div>
    );
};
