/**
 * Control ASISS - Grilla de Programación Mensual (editable)
 *
 * El juego de turnos SIEMPRE es cada 2 semanas (sem 1 = sem 3, sem 2 =
 * sem 4, replicado al infinito). Modalidades disponibles:
 *  - Lunes a Viernes (5x2 Fijo)
 *  - Turno Normal:   Sem A Jue+Vie libres · Sem B Mié+Dom libres
 *  - Contraturno:    Sem A Mié+Dom libres · Sem B Jue+Vie libres
 *    (complementarios: siempre hay alguien)
 *  - Manual (2 semanas): se marcan los libres en el calendario y el
 *    juego se replica al infinito
 *
 * Orden dentro de cada cargo: Fijos → Normal → Contraturno → Manuales,
 * reordenado automáticamente tras cada modificación.
 * Cuadratura diaria por cargo según el filtro de turno activo.
 * Alertas con diseño propio (toasts), nada de alert() del navegador.
 */

import { Fragment, useMemo, useState } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import { StaffWithShift, ShiftTypeCode, VariantCode } from '../../asistencia2026/types';
import { useUpsertSpecialTemplate } from '../../asistencia2026/hooks';
import { showSuccessToast, showWarningToast, showErrorToast } from '../../../shared/state/toastStore';
import { broadcastActivity } from '../../../shared/services/activityFeed';
import { useSessionStore } from '../../../shared/state/sessionStore';

/** Nombre del supervisor logeado para el feed de actividad */
function sessionActor(): string {
    return useSessionStore.getState().session?.supervisorName || 'Alguien';
}
import {
    useControlAsissExportData,
    useUpsertShiftControl,
    useUpsertOverrideControl,
    useDeleteOverrideControl,
} from '../hooks';
import { ExportStaff, deleteAllOverridesForStaff } from '../api';
import { getExtendedMonthRange, dayNameShort, formatDateCL, monthName } from '../utils/scheduleEngine';
import { turnoDeFicha } from '../utils/coverageAnalysis';
import {
    buildPlan,
    checkRules,
    checkDayOverride,
    validarClaveTurnos,
    seedTwoWeekPattern,
    twoWeekToTemplate,
    twoWeekIndex,
    DayPlan,
    RuleCheck,
} from '../utils/programmingRules';
import { CONTROL_TERMINALS } from '../types';
import { buildShiftRecommendation } from '../../asistencia2026/utils/shiftRecommendation';
import { generateRelevoTemplate, esElegibleRelevo, RelevoResult } from '../utils/relevoGenerator';

const CARGO_SORT = ['SUPERVISOR', 'INSPECTOR', 'CONDUCTOR', 'PLANILLERO', 'CLEANER'];
const cargoOrder = (cargo: string): number => {
    const idx = CARGO_SORT.findIndex((c) => cargo.toUpperCase().includes(c));
    return idx === -1 ? CARGO_SORT.length : idx;
};

// ==========================================
// MODALIDADES (el juego siempre es de 2 semanas)
// ==========================================

type ModalidadKey = 'FIJO' | 'NORMAL' | 'CONTRA' | 'MANUAL' | 'RELEVO';

/** Turno especial de cobertura para supervisores de El Roble y La Reina */
const RELEVO_OPTION = {
    key: 'RELEVO' as ModalidadKey,
    label: 'Relevo Automático (Supervisores)',
    desc: 'Genera la programación automática para cubrir SÍ O SÍ los libres de los supervisores fijos de día y de noche, respetando todas las reglas',
    code: 'ESPECIAL' as ShiftTypeCode,
    variant: 'RELEVO' as VariantCode,
};

const MODALIDAD_OPTIONS: {
    key: ModalidadKey;
    label: string;
    desc: string;
    code: ShiftTypeCode;
    variant: VariantCode;
}[] = [
        {
            key: 'FIJO',
            label: 'Lunes a Viernes',
            desc: '5x2 Fijo · Sábado y Domingo siempre libres (casos especiales)',
            code: '5X2_FIJO',
            variant: 'PRINCIPAL',
        },
        {
            key: 'NORMAL',
            label: 'Turno Normal',
            desc: 'Sem A: Jue+Vie libres · Sem B: Mié+Dom libres (se repite cada 2 semanas)',
            code: '5X2_SUPER',
            variant: 'CONTRATURNO',
        },
        {
            key: 'CONTRA',
            label: 'Contraturno',
            desc: 'Sem A: Mié+Dom libres · Sem B: Jue+Vie libres — complementa al Normal: siempre hay alguien',
            code: '5X2_SUPER',
            variant: 'PRINCIPAL',
        },
        {
            key: 'MANUAL',
            label: 'Manual (2 semanas)',
            desc: 'Marca en el calendario los días libres del juego de 2 semanas; se replica al infinito',
            code: 'ESPECIAL',
            variant: 'ESPECIAL',
        },
    ];

/** Orden dentro del cargo: Fijos → Normal → Contraturno → Relevo → Sin turno → Manuales */
function modalityRank(s: StaffWithShift): number {
    const code = s.shift?.shift_type_code;
    const variant = s.shift?.variant_code;
    if (!code) return 4;
    if (code === '5X2_FIJO') return 0;
    if (code === 'ESPECIAL') return variant === 'RELEVO' ? 3 : 5;
    if (code === 'SUPERVISOR_RELEVO') return 3;
    // Rotativos de 2 semanas: Normal (CONTRATURNO) antes que Contraturno (PRINCIPAL)
    return variant === 'CONTRATURNO' ? 1 : 2;
}

function modalityLabel(s: StaffWithShift): string {
    const code = s.shift?.shift_type_code;
    const variant = s.shift?.variant_code;
    if (!code) return 'Sin turno';
    if (code === '5X2_FIJO') return 'Lun-Vie';
    if (code === 'ESPECIAL') return variant === 'RELEVO' ? 'Relevo Auto' : 'Manual 2 sem';
    if (code === 'SUPERVISOR_RELEVO') return 'Relevo';
    if (code === '5X2_SUPER') return variant === 'CONTRATURNO' ? 'Turno Normal' : 'Contraturno';
    // Legacy 5X2_ROTATIVO
    return variant === 'CONTRATURNO' ? 'Normal (Rot)' : 'Contra (Rot)';
}

const AUTH_SESSION_KEY = 'controlAsiss.programacion.autorizada';

function shiftDateStr(date: string, days: number): string {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const isMonday = (date: string) => new Date(date + 'T12:00:00').getDay() === 1;

interface Props {
    year: number;
    month: number; // 0-11
}

export const MonthlyProgrammingGrid = ({ year, month }: Props) => {
    const [authorized, setAuthorized] = useState(
        () => sessionStorage.getItem(AUTH_SESSION_KEY) === '1'
    );

    if (!authorized) {
        return <AuthGate onAuthorized={() => {
            sessionStorage.setItem(AUTH_SESSION_KEY, '1');
            setAuthorized(true);
        }} />;
    }

    return <ProgrammingGridInner year={year} month={month} />;
};

// ==========================================
// Puerta de clave
// ==========================================

const AuthGate = ({ onAuthorized }: { onAuthorized: () => void }) => {
    const [clave, setClave] = useState('');
    const [error, setError] = useState(false);

    const handleSubmit = () => {
        if (validarClaveTurnos(clave)) {
            showSuccessToast('Edición autorizada', 'Ya tienes autoridad para modificar la programación.');
            onAuthorized();
        } else {
            setError(true);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-14 shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800">
                <Icon name="key" size={30} className="text-amber-400" />
            </div>
            <div className="text-center">
                <h3 className="text-lg font-bold text-slate-800">Zona protegida de programación</h3>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                    Editar la programación del personal es delicado. Ingresa la clave de
                    autorización de cambio de turno para obtener la autoridad de edición.
                </p>
            </div>
            <div className="flex w-full max-w-xs gap-2">
                <input
                    type="password"
                    value={clave}
                    autoFocus
                    onChange={(e) => { setClave(e.target.value); setError(false); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="Clave de autorización"
                    className={`flex-1 rounded-xl border px-4 py-2.5 text-sm focus:ring-2 ${error ? 'border-red-400 ring-2 ring-red-200' : 'border-slate-300 focus:ring-blue-500'}`}
                />
                <button
                    onClick={handleSubmit}
                    disabled={!clave}
                    className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40"
                >
                    Entrar
                </button>
            </div>
            {error && <p className="text-xs font-bold text-red-600">Clave incorrecta.</p>}
        </div>
    );
};

// ==========================================
// Grilla (ya autorizada)
// ==========================================

const ProgrammingGridInner = ({ year, month }: Props) => {
    // Semanas completas Lun-Dom
    const ext = useMemo(() => getExtendedMonthRange(year, month), [year, month]);
    const monthDates = ext.dates;
    const inMonth = (d: string) => new Date(d + 'T12:00:00').getMonth() === month;

    // Rango de datos extendido ±6 días para validar rachas entre meses
    const { staff, scheduleContext, isLoading } = useControlAsissExportData(
        shiftDateStr(ext.startDate, -6),
        shiftDateStr(ext.endDate, 6)
    );

    const [terminalFilter, setTerminalFilter] = useState<string>('EL_ROBLE');
    const [turnoFilter, setTurnoFilter] = useState<'TODOS' | 'DIA' | 'NOCHE'>('TODOS');
    const [search, setSearch] = useState('');

    const [dayEdit, setDayEdit] = useState<{ staff: ExportStaff; date: string } | null>(null);
    const [modalityEdit, setModalityEdit] = useState<ExportStaff | null>(null);

    // Orden: cargo → modalidad (Fijo, Normal, Contra, Manual) → nombre.
    // Se recalcula automáticamente tras cada modificación (datos reactivos).
    const visibleStaff = useMemo(() => {
        const q = search.trim().toLowerCase();
        return staff
            .filter((s) => s.terminal_code === terminalFilter)
            .filter((s) => turnoFilter === 'TODOS' || turnoDeFicha(s.turno, s.horario) === turnoFilter)
            .filter((s) => !q || s.nombre.toLowerCase().includes(q) || s.rut.toLowerCase().includes(q))
            .sort((a, b) =>
                cargoOrder(a.cargo) - cargoOrder(b.cargo) ||
                modalityRank(a) - modalityRank(b) ||
                a.nombre.localeCompare(b.nombre)
            );
    }, [staff, terminalFilter, turnoFilter, search]);

    const groups = useMemo(() => {
        const list: { cargo: string; members: ExportStaff[] }[] = [];
        for (const s of visibleStaff) {
            const key = s.cargo.toUpperCase().trim();
            const last = list[list.length - 1];
            if (last && last.cargo === key) last.members.push(s);
            else list.push({ cargo: key, members: [s] });
        }
        return list;
    }, [visibleStaff]);

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

    // Contadores según el filtro de turno activo (evita rojos confusos)
    const showDia = turnoFilter !== 'NOCHE';
    const showNoche = turnoFilter !== 'DIA';

    const groupCounters = (members: ExportStaff[], dateIdx: number): { dia: number; noche: number; libre: number } => {
        let dia = 0, noche = 0, libre = 0;
        for (const m of members) {
            const p = plans.get(m.id)?.plan[dateIdx];
            if (!p || p.status === 'PRE_INICIO') continue;
            if (p.status === 'LIBRE') libre++;
            else if (p.turno === 'NOCHE') noche++;
            else dia++;
        }
        return { dia, noche, libre };
    };

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
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 lg:ml-auto">
                    <Icon name="check-circle" size={13} /> Edición autorizada
                </p>
            </div>

            {/* Reglas */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
                <span className="font-bold">REGLAS:</span>
                <span>• Máx. 6 días seguidos y mín. 2 domingos libres al mes → se ALERTA (puedes compensar dentro del período)</span>
                <span className="font-bold text-red-700">• Domingo de descanso: JAMÁS se fuerza a trabajar (único bloqueo)</span>
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
                                    <th className="sticky left-0 z-20 min-w-[250px] border-b border-r bg-slate-800 px-3 py-2 text-left text-xs font-bold text-white">
                                        {monthName(month).toUpperCase()} {year} — Turno / Trabajador
                                    </th>
                                    {monthDates.map((d) => {
                                        const dow = new Date(d + 'T12:00:00').getDay();
                                        return (
                                            <th
                                                key={d}
                                                className={`min-w-[46px] border-b px-0.5 py-1.5 text-center ${isMonday(d) ? 'border-l-2 border-l-slate-400' : ''} ${!inMonth(d) ? 'opacity-60 ' : ''}${dow === 0 ? 'bg-red-700 text-white' : dow === 6 ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-200'
                                                    }`}
                                            >
                                                <div className="text-[9px] font-semibold">{dayNameShort(d).toUpperCase()}</div>
                                                <div className="text-xs font-bold">{parseInt(d.slice(-2), 10)}</div>
                                            </th>
                                        );
                                    })}
                                    <th className="min-w-[104px] border-b border-l-2 border-l-slate-400 bg-slate-800 px-2 py-1.5 text-center text-[9px] font-bold text-slate-200">
                                        RESUMEN<br />T · L · DomL · Racha
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {groups.length === 0 && (
                                    <tr>
                                        <td colSpan={monthDates.length + 2} className="px-4 py-8 text-center text-sm text-slate-400">
                                            Sin personal para el filtro aplicado
                                        </td>
                                    </tr>
                                )}
                                {groups.map((group) => (
                                    <Fragment key={group.cargo}>
                                        {/* Título de cargo (fijo al scroll) */}
                                        <tr>
                                            <td className="sticky left-0 z-10 border-b border-r bg-blue-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-800">
                                                {group.cargo} ({group.members.length})
                                            </td>
                                            <td colSpan={monthDates.length + 1} className="border-b bg-blue-50" />
                                        </tr>

                                        {group.members.map((s) => {
                                            const entry = plans.get(s.id);
                                            if (!entry) return null;
                                            const { plan, rules } = entry;
                                            const trabaja = plan.filter((p) => p.status === 'TRABAJA').length;
                                            const libres = plan.filter((p) => p.status === 'LIBRE').length;
                                            const rank = modalityRank(s);
                                            const badgeCls = rank === 0 ? 'bg-slate-200 text-slate-700'
                                                : rank === 1 ? 'bg-blue-100 text-blue-700'
                                                    : rank === 2 ? 'bg-cyan-100 text-cyan-700'
                                                        : rank === 3 ? 'bg-amber-100 text-amber-700'
                                                            : rank === 5 ? 'bg-purple-100 text-purple-700'
                                                                : 'bg-slate-100 text-slate-500';

                                            return (
                                                <tr key={s.id} className="group">
                                                    <td className={`sticky left-0 z-10 border-b border-r px-3 py-1 ${s.suspended ? 'bg-amber-50' : 'bg-white'} group-hover:bg-slate-50`}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-xs font-bold text-slate-800">
                                                                    {s.nombre}
                                                                    {s.suspended && <span className="ml-1.5 rounded bg-amber-200 px-1 text-[9px] font-bold text-amber-800">SUSP</span>}
                                                                </p>
                                                                <button
                                                                    onClick={() => setModalityEdit(s)}
                                                                    className={`mt-0.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-all hover:ring-1 hover:ring-slate-400 ${badgeCls}`}
                                                                    title="Cambiar modalidad de turno"
                                                                >
                                                                    <Icon name="settings" size={10} />
                                                                    {modalityLabel(s)}
                                                                </button>
                                                            </div>
                                                            {rules.warnings.length > 0 && (
                                                                <span title={rules.warnings.join(' ')}>
                                                                    <Icon name="alert-triangle" size={14} className="shrink-0 text-amber-500" />
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {plan.map((p) => (
                                                        <td key={p.date} className={`border-b p-0.5 ${isMonday(p.date) ? 'border-l-2 border-l-slate-400' : ''} ${!inMonth(p.date) ? 'opacity-50' : ''}`}>
                                                            <DayCellBtn plan={p} onClick={() => setDayEdit({ staff: s, date: p.date })} />
                                                        </td>
                                                    ))}

                                                    <td className="border-b border-l-2 border-l-slate-400 px-1 py-1 text-center">
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
                                            );
                                        })}

                                        {/* Cuadratura del grupo (según filtro de turno) */}
                                        <tr>
                                            <td className="sticky left-0 z-10 border-b-2 border-r border-b-slate-300 bg-gradient-to-r from-slate-700 to-slate-600 px-3 py-1.5">
                                                <p className="text-[10px] font-bold uppercase text-white">Cuadratura</p>
                                                <div className="mt-0.5 flex gap-1.5 text-[9px] font-semibold">
                                                    {showDia && <span className="rounded-full bg-sky-400/90 px-1.5 text-white">Día</span>}
                                                    {showNoche && <span className="rounded-full bg-indigo-400/90 px-1.5 text-white">Noche</span>}
                                                    <span className="rounded-full bg-slate-400/80 px-1.5 text-white">Libres</span>
                                                </div>
                                            </td>
                                            {monthDates.map((d, di) => {
                                                const c = groupCounters(group.members, di);
                                                return (
                                                    <td key={d} className={`border-b-2 border-b-slate-300 bg-slate-100/80 px-0.5 py-1 text-center align-middle ${isMonday(d) ? 'border-l-2 border-l-slate-400' : ''} ${!inMonth(d) ? 'opacity-50' : ''}`}>
                                                        <div className="mx-auto flex w-fit flex-col gap-0.5">
                                                            {showDia && <CounterPill value={c.dia} tone="dia" />}
                                                            {showNoche && <CounterPill value={c.noche} tone="noche" />}
                                                            <CounterPill value={c.libre} tone="libre" />
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td className="border-b-2 border-b-slate-300 border-l-2 border-l-slate-400 bg-slate-100/80" />
                                        </tr>
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Leyenda */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded bg-blue-50 ring-1 ring-blue-200" /> Trabaja día</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded bg-indigo-50 ring-1 ring-indigo-200" /> Trabaja noche</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded bg-slate-800" /> Libre</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded bg-slate-100 ring-1 ring-slate-200" /> — antes del inicio</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-3 w-6 rounded-full bg-red-500 text-center text-[9px] font-bold leading-3 text-white">0</span> día caído</span>
                        <span className="ml-auto">Orden por cargo: Fijos → Normal → Contraturno → Manuales · línea gruesa separa semanas Lun-Dom</span>
                    </div>
                </div>
            )}

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
// Píldora de cuadratura
// ==========================================

const COUNTER_META: Record<'dia' | 'noche' | 'libre', { letter: string; title: string; cls: string }> = {
    dia: { letter: 'D', title: 'Trabajando turno Día', cls: 'bg-sky-100 text-sky-800' },
    noche: { letter: 'N', title: 'Trabajando turno Noche', cls: 'bg-indigo-100 text-indigo-800' },
    libre: { letter: 'L', title: 'Libres', cls: 'bg-slate-200 text-slate-500' },
};

const CounterPill = ({ value, tone }: { value: number; tone: 'dia' | 'noche' | 'libre' }) => {
    const meta = COUNTER_META[tone];
    const caido = value === 0 && tone !== 'libre';
    return (
        <span
            title={`${meta.title}: ${value}${caido ? ' — DÍA CAÍDO' : ''}`}
            className={`flex min-w-[30px] items-center justify-between gap-0.5 rounded-full px-1.5 text-[9px] font-bold leading-4 ${caido ? 'bg-red-500 text-white shadow-sm' : meta.cls}`}
        >
            <span className="opacity-70">{meta.letter}</span>
            <span>{value}</span>
        </span>
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
            title={`${dayNameShort(plan.date)} ${formatDateCL(plan.date)} · ${plan.status === 'LIBRE' ? 'LIBRE' : plan.horario || 'Trabaja'}`}
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
        </button>
    );
};

// ==========================================
// Modal: cambio de día — acción directa.
// "Repetir cada 2 semanas" convierte el cambio en parte del juego
// (semana 1 y 2 replicadas al infinito).
// ==========================================

const DayEditModal = ({
    staff, date, year, month, ctx, onClose,
}: {
    staff: ExportStaff; date: string; year: number; month: number;
    ctx: Parameters<typeof checkDayOverride>[1]; onClose: () => void;
}) => {
    const upsertOverride = useUpsertOverrideControl();
    const removeOverride = useDeleteOverrideControl();
    const upsertTemplate = useUpsertSpecialTemplate();
    const upsertShift = useUpsertShiftControl();

    const currentOverride = ctx.overrides.find(
        (o) => o.staff_id === staff.id && o.override_date === date
    );

    const currentMeta = (currentOverride?.meta_json || {}) as { turno?: 'DIA' | 'NOCHE'; horario?: string };
    const [turno, setTurno] = useState<'DIA' | 'NOCHE'>(
        currentMeta.turno || turnoDeFicha(staff.turno, staff.horario)
    );
    const [horario, setHorario] = useState(currentMeta.horario || staff.horario || '');
    const [showWork, setShowWork] = useState(false);
    const [repetir, setRepetir] = useState(false);

    const isSunday = new Date(date + 'T12:00:00').getDay() === 0;
    const workCheck = useMemo(
        () => checkDayOverride(staff, ctx, year, month, date, 'WORK'),
        [staff, ctx, year, month, date]
    );
    const sundayRest = isSunday && workCheck.blocked !== null;
    const busy = upsertOverride.isPending || removeOverride.isPending || upsertTemplate.isPending || upsertShift.isPending;

    /** Cambio repetitivo: modifica el juego de 2 semanas y lo replica al infinito */
    const applyRepeating = async (type: 'OFF' | 'WORK') => {
        const base = seedTwoWeekPattern(staff, ctx, date);
        const idx = twoWeekIndex(date);
        base.libres[idx] = type === 'OFF';
        if (type === 'WORK') base.noches[idx] = turno === 'NOCHE';

        const tpl = twoWeekToTemplate(base.libres, base.noches);
        await upsertTemplate.mutateAsync({
            staffId: staff.id,
            offDays: tpl.offDays,
            settings: { daily_shifts: tpl.dailyShifts },
        });
        if (staff.shift?.shift_type_code !== 'ESPECIAL') {
            await upsertShift.mutateAsync({
                staff_id: staff.id,
                shift_type_code: 'ESPECIAL',
                variant_code: 'ESPECIAL',
                start_date: staff.shift?.start_date || undefined,
            });
        }
        // El ajuste puntual de ese día ya no aplica: el patrón manda
        if (currentOverride) {
            await removeOverride.mutateAsync({ staffId: staff.id, date });
        }
    };

    const apply = async (type: 'OFF' | 'WORK' | null) => {
        if (busy) return;
        try {
            const check = checkDayOverride(staff, ctx, year, month, date, type);
            if (type === 'WORK' && check.blocked) return;

            if (type !== null && repetir) {
                await applyRepeating(type);
                showSuccessToast(
                    'Juego de 2 semanas actualizado',
                    `${staff.nombre}: el ${dayNameShort(date)} queda ${type === 'OFF' ? 'LIBRE' : 'TRABAJANDO'} y se replica cada 2 semanas al infinito.`
                );
                broadcastActivity({
                    actor: sessionActor(),
                    accion: `modificó el juego de 2 semanas de`,
                    objetivo: staff.nombre,
                    seccion: 'Control ASISS · Programación',
                    detalle: `${dayNameShort(date)} ${type === 'OFF' ? 'LIBRE' : 'TRABAJA'} · replicado al infinito`,
                });
            } else if (type === null) {
                await removeOverride.mutateAsync({ staffId: staff.id, date });
                showSuccessToast('Ajuste eliminado', `${staff.nombre} vuelve a su patrón normal el ${formatDateCL(date)}.`);
            } else {
                await upsertOverride.mutateAsync({
                    staffId: staff.id,
                    date,
                    type,
                    meta: type === 'WORK' ? { turno, horario: horario.trim() || undefined } : undefined,
                });
                showSuccessToast(
                    'Cambio de día aplicado',
                    `${staff.nombre} · ${dayNameShort(date)} ${formatDateCL(date)}: ${type === 'OFF' ? 'LIBRE' : `TRABAJA ${turno === 'NOCHE' ? 'Noche' : 'Día'}${horario.trim() ? ` (${horario.trim()})` : ''}`}.`
                );
                broadcastActivity({
                    actor: sessionActor(),
                    accion: `hizo un cambio de día a`,
                    objetivo: staff.nombre,
                    seccion: 'Control ASISS · Programación',
                    detalle: `${dayNameShort(date)} ${formatDateCL(date)} → ${type === 'OFF' ? 'LIBRE' : `TRABAJA ${turno === 'NOCHE' ? 'Noche' : 'Día'}`}`,
                });
            }
            onClose();
            if (check.warnings.length > 0) {
                showWarningToast('Situación a revisar', check.warnings.join(' '));
            }
        } catch (e) {
            showErrorToast('No se pudo guardar', e instanceof Error ? e.message : 'Error al guardar el cambio.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="bg-slate-800 px-5 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-white">Cambio de Día</h3>
                            <p className="text-xs text-slate-300">
                                {staff.nombre} · {dayNameShort(date)} {formatDateCL(date)}
                            </p>
                        </div>
                        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                            <Icon name="x" size={18} />
                        </button>
                    </div>
                </div>

                <div className="space-y-3 p-5">
                    {/* Repetir cada 2 semanas */}
                    <button
                        onClick={() => setRepetir((v) => !v)}
                        className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-2.5 transition-all ${repetir ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                        <div className="text-left">
                            <p className="text-sm font-bold text-slate-800">Repetir cada 2 semanas</p>
                            <p className="text-xs text-slate-500">
                                {repetir
                                    ? 'El cambio modifica el juego de 2 semanas y se replica al infinito'
                                    : 'Apagado: el cambio aplica solo a este día puntual'}
                            </p>
                        </div>
                        <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${repetir ? 'bg-purple-500' : 'bg-slate-300'}`}>
                            <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${repetir ? 'translate-x-4' : ''}`} />
                        </span>
                    </button>

                    {/* FORZAR TRABAJA */}
                    {sundayRest ? (
                        <div className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-2.5">
                            <p className="text-sm font-bold text-red-800">Forzar TRABAJA — BLOQUEADO</p>
                            <p className="text-xs text-red-700">{workCheck.blocked}</p>
                        </div>
                    ) : (
                        <div className={`rounded-xl border-2 transition-all ${showWork ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                            <button onClick={() => setShowWork((v) => !v)} className="w-full px-4 py-2.5 text-left">
                                <p className="text-sm font-bold text-slate-800">Forzar TRABAJA</p>
                                <p className="text-xs text-slate-500">Elige turno y horario del día (cubre día o noche de cualquier terminal)</p>
                            </button>
                            {showWork && (
                                <div className="space-y-3 border-t border-blue-200 px-4 py-3">
                                    <div className="flex gap-2">
                                        {(['DIA', 'NOCHE'] as const).map((t) => (
                                            <button
                                                key={t}
                                                onClick={() => setTurno(t)}
                                                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2 text-sm font-bold transition-all ${turno === t
                                                    ? t === 'NOCHE' ? 'border-indigo-500 bg-indigo-100 text-indigo-800' : 'border-amber-400 bg-amber-50 text-amber-800'
                                                    : 'border-slate-200 text-slate-500'
                                                    }`}
                                            >
                                                <Icon name={t === 'NOCHE' ? 'moon' : 'sun'} size={14} />
                                                {t === 'NOCHE' ? 'Noche' : 'Día'}
                                            </button>
                                        ))}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-slate-500">Horario del día (ej: 20:00-08:00)</label>
                                        <input
                                            value={horario}
                                            onChange={(e) => setHorario(e.target.value)}
                                            placeholder="HH:MM-HH:MM"
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <button
                                        onClick={() => apply('WORK')}
                                        disabled={busy}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {busy ? <Icon name="loader" size={14} className="animate-spin" /> : <Icon name="check" size={14} />}
                                        Forzar TRABAJA {turno === 'NOCHE' ? '(Noche)' : '(Día)'}{repetir ? ' · cada 2 semanas' : ''}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* FORZAR LIBRE */}
                    <button
                        onClick={() => apply('OFF')}
                        disabled={busy}
                        className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-left transition-all hover:border-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    >
                        <p className="text-sm font-bold text-slate-800">Forzar LIBRE{repetir ? ' · cada 2 semanas' : ''}</p>
                        <p className="text-xs text-slate-500">
                            {repetir ? 'Este día queda libre en el juego, replicado al infinito' : 'Se aplica al instante — solo este día puntual'}
                        </p>
                    </button>

                    {/* QUITAR AJUSTE */}
                    {currentOverride && (
                        <button
                            onClick={() => apply(null)}
                            disabled={busy}
                            className="w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-2.5 text-left transition-all hover:border-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        >
                            <p className="text-sm font-bold text-slate-700">Quitar ajuste manual</p>
                            <p className="text-xs text-slate-500">Volver al patrón normal del turno</p>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// Modal: modalidad de turno (4 opciones + editor manual de 2 semanas)
// ==========================================

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const ModalityEditModal = ({
    staff, year, month, ctx, allStaff, onClose,
}: {
    staff: ExportStaff; year: number; month: number;
    ctx: Parameters<typeof checkRules>[1];
    allStaff: StaffWithShift[];
    onClose: () => void;
}) => {
    const upsertShift = useUpsertShiftControl();
    const upsertTemplate = useUpsertSpecialTemplate();

    const mm = String(month + 1).padStart(2, '0');
    const monthStart = `${year}-${mm}-01`;

    // Modalidad actual → key
    const currentKey: ModalidadKey = staff.shift?.shift_type_code === 'ESPECIAL'
        ? (staff.shift?.variant_code === 'RELEVO' ? 'RELEVO' : 'MANUAL')
        : staff.shift?.shift_type_code === '5X2_FIJO' ? 'FIJO'
            : staff.shift?.variant_code === 'CONTRATURNO' ? 'NORMAL'
                : staff.shift ? 'CONTRA' : 'NORMAL';

    const [key, setKey] = useState<ModalidadKey>(currentKey);

    // Turno especial de relevo: solo supervisores de El Roble / La Reina
    const relevoDisponible = esElegibleRelevo(staff);
    const opciones = relevoDisponible ? [...MODALIDAD_OPTIONS, RELEVO_OPTION] : MODALIDAD_OPTIONS;

    // Programación automática del relevo (recalculada en vivo)
    const relevoResult: RelevoResult | null = useMemo(() => {
        if (key !== 'RELEVO' || !relevoDisponible) return null;
        return generateRelevoTemplate(staff, allStaff, ctx, monthStart);
    }, [key, relevoDisponible, staff, allStaff, ctx, monthStart]);

    // Editor manual: juego de 2 semanas sembrado del patrón actual
    const [manual, setManual] = useState(() => seedTwoWeekPattern(staff, ctx, monthStart));

    const esPersonalNuevo = !staff.shift;
    const [startDate, setStartDate] = useState(staff.shift?.start_date || '');

    // Recomendación (solo entre Normal y Contraturno)
    const recommendation = useMemo(() => {
        const rec = buildShiftRecommendation(staff, allStaff);
        const superCombos = rec.combos.filter((c) => c.shiftType === '5X2_SUPER');
        if (superCombos.length === 0) return null;
        const weakest = superCombos[0];
        return {
            key: (weakest.variant === 'CONTRATURNO' ? 'NORMAL' : 'CONTRA') as ModalidadKey,
            count: weakest.count,
        };
    }, [staff, allStaff]);

    const selected = opciones.find((m) => m.key === key) || MODALIDAD_OPTIONS[1];

    // Simulación de reglas con la modalidad elegida
    const check = useMemo(() => {
        const simulatedShift = {
            id: staff.shift?.id || 'sim',
            staff_id: staff.id,
            shift_type_code: selected.code,
            variant_code: selected.variant,
            start_date: (esPersonalNuevo ? startDate : staff.shift?.start_date) || '2026-01-01',
            created_at: '',
        };
        const simStaff: StaffWithShift = { ...staff, shift: simulatedShift };

        if (key === 'MANUAL' || (key === 'RELEVO' && relevoResult)) {
            const tpl = key === 'MANUAL'
                ? twoWeekToTemplate(manual.libres, manual.noches)
                : { offDays: relevoResult!.offDays, dailyShifts: relevoResult!.dailyShifts };
            const simCtx = {
                ...ctx,
                specialTemplates: [
                    ...ctx.specialTemplates.filter((t) => t.staff_id !== staff.id),
                    {
                        id: 'sim-tpl', staff_id: staff.id, cycle_days: 28,
                        off_days_json: tpl.offDays,
                        settings_json: { daily_shifts: tpl.dailyShifts },
                        updated_at: '',
                    },
                ],
            };
            return checkRules(simStaff, simCtx, year, month);
        }
        return checkRules(simStaff, ctx, year, month);
    }, [staff, key, selected, manual, relevoResult, startDate, esPersonalNuevo, ctx, year, month]);

    const handleSave = async () => {
        try {
            // CLAVE: limpiar los ajustes puntuales anteriores (celdas
            // forzadas). Si no, taparían el patrón nuevo y la modalidad
            // elegida "no se vería" en la grilla.
            await deleteAllOverridesForStaff(staff.id);

            if (key === 'MANUAL') {
                const tpl = twoWeekToTemplate(manual.libres, manual.noches);
                await upsertTemplate.mutateAsync({
                    staffId: staff.id,
                    offDays: tpl.offDays,
                    settings: { daily_shifts: tpl.dailyShifts },
                });
            } else if (key === 'RELEVO' && relevoResult) {
                await upsertTemplate.mutateAsync({
                    staffId: staff.id,
                    offDays: relevoResult.offDays,
                    settings: {
                        daily_shifts: relevoResult.dailyShifts,
                        custom_schedules: relevoResult.customSchedules,
                    },
                });
            }
            await upsertShift.mutateAsync({
                staff_id: staff.id,
                shift_type_code: selected.code,
                variant_code: selected.variant,
                start_date: esPersonalNuevo ? (startDate || undefined) : (staff.shift?.start_date || undefined),
            });
            onClose();
            showSuccessToast(
                'Modalidad guardada',
                `${staff.nombre} queda en ${selected.label}. Se limpiaron los ajustes puntuales anteriores y la tabla se reordenó.`
            );
            broadcastActivity({
                actor: sessionActor(),
                accion: `cambió la programación a ${selected.label} para`,
                objetivo: staff.nombre,
                seccion: 'Control ASISS · Programación',
            });
            if (check.warnings.length > 0) {
                showWarningToast('Situación a revisar', check.warnings.join(' '));
            }
        } catch (e) {
            showErrorToast('No se pudo guardar', e instanceof Error ? e.message : 'Error al guardar la modalidad.');
        }
    };

    const busy = upsertShift.isPending || upsertTemplate.isPending;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="bg-slate-800 px-5 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-white">Modalidad de Turno</h3>
                            <p className="text-xs text-slate-300">
                                {staff.nombre} · {staff.cargo} · el juego siempre se repite cada 2 semanas
                            </p>
                        </div>
                        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                            <Icon name="x" size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                    {/* Opciones */}
                    <div className="space-y-2">
                        {opciones.map((m) => (
                            <button
                                key={m.key}
                                onClick={() => setKey(m.key)}
                                className={`w-full rounded-xl border-2 p-3 text-left transition-all ${key === m.key ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                            >
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-slate-800">{m.label}</p>
                                    <div className="flex items-center gap-1.5">
                                        {recommendation?.key === m.key && (
                                            <span className="flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                                <Icon name="sparkles" size={10} />
                                                Recomendado ({recommendation.count} en el grupo)
                                            </span>
                                        )}
                                        {currentKey === m.key && (
                                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">Actual</span>
                                        )}
                                    </div>
                                </div>
                                <p className="mt-0.5 text-[11px] text-slate-500">{m.desc}</p>
                            </button>
                        ))}
                    </div>

                    {/* Editor manual del juego de 2 semanas */}
                    {key === 'MANUAL' && (
                        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-purple-700">
                                Juego de 2 semanas (Lun → Dom) — toca los días que salen LIBRES
                            </p>
                            <p className="mb-3 text-[11px] text-purple-600">
                                Semana 1 y Semana 2 se replican al infinito (sem 1 = sem 3, sem 2 = sem 4…).
                            </p>
                            <div className="space-y-2">
                                {[0, 1].map((week) => (
                                    <div key={week} className="flex items-center gap-2">
                                        <span className="w-12 text-[10px] font-bold text-purple-700">Sem {week + 1}</span>
                                        <div className="flex flex-1 gap-1">
                                            {DIAS_SEMANA.map((label, di) => {
                                                const idx = week * 7 + di;
                                                const libre = manual.libres[idx];
                                                const noche = manual.noches[idx];
                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setManual((prev) => {
                                                            const libres = [...prev.libres];
                                                            libres[idx] = !libres[idx];
                                                            return { ...prev, libres };
                                                        })}
                                                        className={`flex h-10 flex-1 flex-col items-center justify-center rounded-lg text-[10px] font-bold transition-all ${libre
                                                            ? 'bg-slate-800 text-white shadow ring-1 ring-slate-900'
                                                            : noche
                                                                ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300 hover:bg-indigo-200'
                                                                : 'bg-white text-slate-700 ring-1 ring-purple-200 hover:bg-purple-100'
                                                            }`}
                                                        title={libre ? 'LIBRE — clic para trabajar' : 'Trabaja — clic para dejar libre'}
                                                    >
                                                        <span>{label}</span>
                                                        <span className="text-[8px] opacity-70">{libre ? 'LIBRE' : noche ? 'N' : 'D'}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-2 text-[10px] text-purple-500">
                                Libres marcados: {manual.libres.filter(Boolean).length} de 14 · los días de trabajo
                                conservan su turno D/N actual (ajustable día a día desde la grilla).
                            </p>
                        </div>
                    )}

                    {/* Vista previa del Relevo Automático */}
                    {key === 'RELEVO' && relevoResult && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-700">
                                Programación automática generada (ciclo de 4 semanas Lun→Dom, replicado al infinito)
                            </p>
                            <div className="mb-2 space-y-0.5 text-[11px] text-amber-800">
                                <p>
                                    <b>Cubre a fijos de DÍA:</b>{' '}
                                    {relevoResult.fijosDia.length > 0 ? relevoResult.fijosDia.join(', ') : '— (no hay fijos de día)'}
                                </p>
                                <p>
                                    <b>Cubre a fijos de NOCHE:</b>{' '}
                                    {relevoResult.fijosNoche.length > 0 ? relevoResult.fijosNoche.join(', ') : '— (no hay fijos de noche)'}
                                </p>
                            </div>

                            {/* Mini-grilla del ciclo */}
                            <div className="space-y-1">
                                {[0, 1, 2, 3].map((week) => (
                                    <div key={week} className="flex items-center gap-2">
                                        <span className="w-12 text-[10px] font-bold text-amber-700">Sem {week + 1}</span>
                                        <div className="flex flex-1 gap-1">
                                            {DIAS_SEMANA.map((label, di) => {
                                                const d = relevoResult.days[week * 7 + di];
                                                return (
                                                    <div
                                                        key={di}
                                                        title={`${dayNameShort(d.date)} ${formatDateCL(d.date)} · ${d.assign}${d.gap ? ` · BRECHA ${d.gap}: ${d.motivo || ''}` : ''}`}
                                                        className={`flex h-9 flex-1 flex-col items-center justify-center rounded-lg text-[9px] font-bold ${d.assign === 'LIBRE'
                                                            ? 'bg-slate-800 text-white'
                                                            : d.assign === 'NOCHE'
                                                                ? 'bg-indigo-500 text-white'
                                                                : 'bg-sky-400 text-white'
                                                            } ${d.gap ? 'ring-2 ring-red-500' : ''}`}
                                                    >
                                                        <span>{label}</span>
                                                        <span className="text-[8px] opacity-80">
                                                            {d.assign === 'LIBRE' ? 'L' : d.assign === 'NOCHE' ? 'N' : 'D'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Estadísticas */}
                            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">
                                    Cubre {relevoResult.stats.cubiertosDia}/{relevoResult.stats.necesidadesDia} días
                                </span>
                                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800">
                                    Cubre {relevoResult.stats.cubiertosNoche}/{relevoResult.stats.necesidadesNoche} noches
                                </span>
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
                                    Racha máx: {relevoResult.stats.rachaMaxima}
                                </span>
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
                                    Domingos libres: {relevoResult.stats.domingosLibres}/4
                                </span>
                                {relevoResult.stats.brechas > 0 && (
                                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
                                        {relevoResult.stats.brechas} brecha(s)
                                    </span>
                                )}
                            </div>

                            {/* Brechas y motivos */}
                            {relevoResult.warnings.length > 0 && (
                                <div className="mt-2 space-y-0.5 rounded-lg bg-white px-3 py-2">
                                    {relevoResult.warnings.map((w, i) => (
                                        <p key={i} className="text-[10px] text-amber-800">• {w}</p>
                                    ))}
                                    <p className="pt-1 text-[10px] font-semibold text-amber-600">
                                        Las brechas quedan LIBRES para no violar reglas — cúbrelas con otro
                                        supervisor mediante cambio de día u horas extra.
                                    </p>
                                </div>
                            )}
                            <p className="mt-2 text-[10px] text-amber-600">
                                Horarios: Día {relevoResult.customSchedules.dia} · Noche {relevoResult.customSchedules.noche}
                                {' '}(tomados de los fijos que cubre) · editable día a día desde la grilla.
                            </p>
                        </div>
                    )}

                    {/* Fecha de inicio: SOLO personal nuevo, una sola vez */}
                    {esPersonalNuevo ? (
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Fecha de inicio — personal nuevo (los días anteriores quedan con “-”)
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="mt-1 text-[11px] text-slate-400">Se define UNA sola vez, al ingresar la persona.</p>
                        </div>
                    ) : (
                        <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                            La programación histórica se conserva: cambiar la modalidad NO borra
                            la asistencia hacia atrás{staff.shift?.start_date ? ` (inicio original: ${formatDateCL(staff.shift.start_date)})` : ''}.
                        </p>
                    )}

                    {/* Validación */}
                    {check.warnings.length === 0 ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
                            <p className="font-bold">✓ La modalidad cumple las reglas del mes</p>
                            <p>Racha máx: {check.maxRun} días · Domingos libres: {check.sundaysLibres}/{check.sundaysRequired}</p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                            <p className="font-bold">⚠ ALERTA (no bloquea — puedes compensar en el período):</p>
                            {check.warnings.map((v, i) => <p key={i}>• {v}</p>)}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-3.5">
                    <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={busy}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {busy && <Icon name="loader" size={14} className="animate-spin" />}
                        Guardar modalidad
                    </button>
                </div>
            </div>
        </div>
    );
};
