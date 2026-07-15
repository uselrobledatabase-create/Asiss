/**
 * Control ASISS - Grilla de Programación Mensual (editable)
 *
 * Vista mensual masiva del TURNO del personal (solo horarios y LIBRE,
 * aquí no se pasa asistencia). Activos y suspendidos, separada por
 * terminal, ordenada por cargo, con filtros y cuadratura diaria por
 * grupo de cargo (Día / Noche / Libres) para detectar días caídos.
 *
 * ACCESO: la subsección completa se desbloquea UNA VEZ con la clave de
 * autorización; desde ahí se tiene autoridad para editar todo.
 *
 * REGLAS ABSOLUTAS validadas antes de guardar: máx. 6 días seguidos,
 * mínimo 2 domingos libres al mes, y jamás trabajar un domingo de
 * descanso. Los cambios se reflejan de inmediato en Asistencia.
 */

import { Fragment, useMemo, useState } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import { StaffWithShift, ShiftTypeCode, VariantCode } from '../../asistencia2026/types';
import { useUpsertSpecialTemplate } from '../../asistencia2026/hooks';
import {
    useControlAsissExportData,
    useUpsertShiftControl,
    useUpsertOverrideControl,
    useDeleteOverrideControl,
} from '../hooks';
import { ExportStaff } from '../api';
import { getExtendedMonthRange, dayNameShort, formatDateCL, monthName } from '../utils/scheduleEngine';
import { turnoDeFicha } from '../utils/coverageAnalysis';
import {
    buildPlan,
    checkRules,
    checkDayOverride,
    validarClaveTurnos,
    seedFourWeekTemplate,
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
    // ===== Puerta de autorización (una sola vez por sesión) =====
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
    const mm = String(month + 1).padStart(2, '0');
    const monthStart = `${year}-${mm}-01`;

    // Semanas completas Lun-Dom: parte el lunes de la semana del día 1 y
    // termina el domingo de la semana del último día
    const ext = useMemo(() => getExtendedMonthRange(year, month), [year, month]);
    const monthDates = ext.dates;
    const inMonth = (d: string) => new Date(d + 'T12:00:00').getMonth() === month;

    // Rango de datos extendido ±6 días para validar rachas entre meses
    const { staff, scheduleContext, isLoading } = useControlAsissExportData(
        shiftDateStr(ext.startDate, -6),
        shiftDateStr(ext.endDate, 6)
    );

    const upsertShift = useUpsertShiftControl();
    const upsertTemplate = useUpsertSpecialTemplate();

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

    // Grupos por cargo (en orden)
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

    // Planes + validación por persona
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

    /** Cuadratura del grupo por día: [trabajando día, trabajando noche, libres] */
    const groupCounters = (members: ExportStaff[], dateIdx: number): [number, number, number] => {
        let dia = 0, noche = 0, libre = 0;
        for (const m of members) {
            const p = plans.get(m.id)?.plan[dateIdx];
            if (!p || p.status === 'PRE_INICIO') continue;
            if (p.status === 'LIBRE') libre++;
            else if (p.turno === 'NOCHE') noche++;
            else dia++;
        }
        return [dia, noche, libre];
    };

    /** Alternar ciclo de duplicidad: 2 semanas ↔ 4 semanas (mensual) */
    const handleToggleCycle = async (s: ExportStaff) => {
        if (s.shift?.shift_type_code === 'ESPECIAL') {
            // Volver a ciclo quincenal: elegir modalidad rotativa
            setModalityEdit(s);
            return;
        }
        const ok = confirm(
            `${s.nombre}\n\nCambiar a ciclo MENSUAL (4 semanas, Lun-Dom):\n` +
            'se copia su patrón actual a una plantilla de 4 semanas que se ' +
            'duplica igual hacia adelante, y podrás ajustar cada día a mano.\n\n¿Continuar?'
        );
        if (!ok) return;
        try {
            const seed = seedFourWeekTemplate(s, scheduleContext, monthStart);
            await upsertTemplate.mutateAsync({
                staffId: s.id,
                offDays: seed.offDays,
                settings: { daily_shifts: seed.dailyShifts },
            });
            await upsertShift.mutateAsync({
                staff_id: s.id,
                shift_type_code: 'ESPECIAL',
                variant_code: 'ESPECIAL',
                start_date: s.shift?.start_date || undefined,
            });
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Error al cambiar el ciclo.');
        }
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
                                    <th className="sticky left-0 z-20 min-w-[240px] border-b border-r bg-slate-800 px-3 py-2 text-left text-xs font-bold text-white">
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
                                        {/* Título de cargo: FIJO al scroll horizontal */}
                                        <tr>
                                            <td className="sticky left-0 z-10 border-b border-r bg-blue-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-800">
                                                {group.cargo} ({group.members.length})
                                            </td>
                                            <td colSpan={monthDates.length + 1} className="border-b bg-blue-50" />
                                        </tr>

                                        {/* Personas del grupo */}
                                        {group.members.map((s) => {
                                            const entry = plans.get(s.id);
                                            if (!entry) return null;
                                            const { plan, rules } = entry;
                                            const trabaja = plan.filter((p) => p.status === 'TRABAJA').length;
                                            const libres = plan.filter((p) => p.status === 'LIBRE').length;
                                            const esMensual = s.shift?.shift_type_code === 'ESPECIAL';
                                            const modalidad = s.shift
                                                ? esMensual
                                                    ? 'Plantilla mensual'
                                                    : `${MODALIDADES.find((m) => m.code === s.shift!.shift_type_code)?.label || s.shift.shift_type_code}${s.shift.variant_code === 'CONTRATURNO' ? ' · Contra' : ''}`
                                                : 'Sin turno';

                                            return (
                                                <tr key={s.id} className="group">
                                                    {/* Persona + modalidad + ciclo */}
                                                    <td className={`sticky left-0 z-10 border-b border-r px-3 py-1 ${s.suspended ? 'bg-amber-50' : 'bg-white'} group-hover:bg-slate-50`}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-xs font-bold text-slate-800">
                                                                    {s.nombre}
                                                                    {s.suspended && <span className="ml-1.5 rounded bg-amber-200 px-1 text-[9px] font-bold text-amber-800">SUSP</span>}
                                                                </p>
                                                                <div className="mt-0.5 flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => setModalityEdit(s)}
                                                                        className="flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                                                                        title="Cambiar modalidad de turno"
                                                                    >
                                                                        <Icon name="settings" size={10} />
                                                                        {modalidad}
                                                                        {s.shift?.start_date && s.shift.start_date > monthStart && (
                                                                            <span className="text-indigo-400">· desde {formatDateCL(s.shift.start_date).slice(0, 5)}</span>
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleToggleCycle(s)}
                                                                        disabled={upsertTemplate.isPending || upsertShift.isPending}
                                                                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors ${esMensual
                                                                            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                                            }`}
                                                                        title={esMensual
                                                                            ? 'Ciclo mensual (4 semanas Lun-Dom que se duplican). Clic para volver al ciclo quincenal.'
                                                                            : 'Duplicidad quincenal: semana 1 = semana 3, semana 2 = semana 4. Clic para cambiar a ciclo mensual de 4 semanas.'}
                                                                    >
                                                                        {esMensual ? '↻ 4 sem' : '↻ 2 sem'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            {rules.warnings.length > 0 && (
                                                                <span title={rules.warnings.join(' ')}>
                                                                    <Icon name="alert-triangle" size={14} className="shrink-0 text-amber-500" />
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Días */}
                                                    {plan.map((p) => (
                                                        <td key={p.date} className={`border-b p-0.5 ${isMonday(p.date) ? 'border-l-2 border-l-slate-400' : ''} ${!inMonth(p.date) ? 'opacity-50' : ''}`}>
                                                            <DayCellBtn plan={p} onClick={() => setDayEdit({ staff: s, date: p.date })} />
                                                        </td>
                                                    ))}

                                                    {/* Resumen */}
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

                                        {/* Cuadratura del grupo: Día / Noche / Libres por fecha */}
                                        <tr>
                                            <td className="sticky left-0 z-10 border-b-2 border-r border-b-slate-300 bg-slate-100 px-3 py-1">
                                                <p className="text-[10px] font-bold uppercase text-slate-600">Cuadratura {group.cargo.split(' ')[0]}</p>
                                                <p className="text-[9px] text-slate-400">Día · Noche · Libres</p>
                                            </td>
                                            {monthDates.map((d, di) => {
                                                const [dia, noche, libre] = groupCounters(group.members, di);
                                                return (
                                                    <td key={d} className={`border-b-2 border-b-slate-300 bg-slate-50 px-0.5 py-0.5 text-center ${isMonday(d) ? 'border-l-2 border-l-slate-400' : ''}`}>
                                                        <div className="flex flex-col leading-tight">
                                                            <span className={`text-[9px] font-bold ${dia === 0 ? 'rounded bg-red-500 text-white' : 'text-blue-700'}`}>{dia}</span>
                                                            <span className={`text-[9px] font-bold ${noche === 0 ? 'rounded bg-red-500 text-white' : 'text-indigo-700'}`}>{noche}</span>
                                                            <span className="text-[9px] font-semibold text-slate-400">{libre}</span>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td className="border-b-2 border-b-slate-300 border-l-2 border-l-slate-400 bg-slate-50" />
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
                        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> ajuste manual</span>
                        <span className="flex items-center gap-1"><span className="inline-block rounded bg-red-500 px-1 text-[9px] font-bold text-white">0</span> día caído (sin nadie)</span>
                        <span className="ml-auto">Cuadratura por cargo: trabajando Día · trabajando Noche · Libres — línea gruesa separa semanas Lun-Dom</span>
                    </div>
                </div>
            )}

            {/* Editores (ya autorizados con la clave de entrada) */}
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
// Modal: cambio de día — acción directa, sin confirmación extra.
// Forzar TRABAJA permite elegir turno DIA/NOCHE y horario propio
// (supervisores rotativos que cubren día o noche de otro terminal).
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

    // Sub-form de TRABAJA: turno + horario del día
    const currentMeta = (currentOverride?.meta_json || {}) as { turno?: 'DIA' | 'NOCHE'; horario?: string };
    const [turno, setTurno] = useState<'DIA' | 'NOCHE'>(
        currentMeta.turno || turnoDeFicha(staff.turno, staff.horario)
    );
    const [horario, setHorario] = useState(currentMeta.horario || staff.horario || '');
    const [showWork, setShowWork] = useState(false);

    const isSunday = new Date(date + 'T12:00:00').getDay() === 0;
    const workCheck = useMemo(
        () => checkDayOverride(staff, ctx, year, month, date, 'WORK'),
        [staff, ctx, year, month, date]
    );
    const sundayRest = isSunday && workCheck.blocked !== null;
    const busy = upsertOverride.isPending || removeOverride.isPending;

    /** Aplica de inmediato y alerta situaciones (sin bloquear) */
    const apply = async (type: 'OFF' | 'WORK' | null) => {
        if (busy) return;
        try {
            const check = checkDayOverride(staff, ctx, year, month, date, type);
            if (type === 'WORK' && check.blocked) return; // único bloqueo duro

            if (type === null) {
                await removeOverride.mutateAsync({ staffId: staff.id, date });
            } else {
                await upsertOverride.mutateAsync({
                    staffId: staff.id,
                    date,
                    type,
                    meta: type === 'WORK' ? { turno, horario: horario.trim() || undefined } : undefined,
                });
            }
            onClose();
            if (check.warnings.length > 0) {
                setTimeout(() => alert(`Cambio aplicado a ${staff.nombre}.\n\n${check.warnings.join('\n')}`), 50);
            }
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Error al guardar el cambio.');
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
                    {/* FORZAR TRABAJA (con turno/horario) */}
                    {sundayRest ? (
                        <div className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-2.5">
                            <p className="text-sm font-bold text-red-800">Forzar TRABAJA — BLOQUEADO</p>
                            <p className="text-xs text-red-700">{workCheck.blocked}</p>
                        </div>
                    ) : (
                        <div className={`rounded-xl border-2 transition-all ${showWork ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                            <button
                                onClick={() => setShowWork((v) => !v)}
                                className="w-full px-4 py-2.5 text-left"
                            >
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
                                        Forzar TRABAJA {turno === 'NOCHE' ? '(Noche)' : '(Día)'}{horario.trim() ? ` · ${horario.trim()}` : ''}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* FORZAR LIBRE: directo */}
                    <button
                        onClick={() => apply('OFF')}
                        disabled={busy}
                        className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-left transition-all hover:border-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    >
                        <p className="text-sm font-bold text-slate-800">Forzar LIBRE</p>
                        <p className="text-xs text-slate-500">Se aplica al instante — puedes mover este libre a otro día de la semana</p>
                    </button>

                    {/* QUITAR AJUSTE: directo */}
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

                    <p className="text-[11px] text-slate-400">
                        Las situaciones (racha &gt;6 días, domingos libres bajo el mínimo) se ALERTAN
                        después de aplicar — puedes compensarlas dentro del período.
                    </p>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// Modal: cambio de modalidad (la clave ya fue ingresada al entrar)
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

    const [type, setType] = useState<ShiftTypeCode>(
        staff.shift?.shift_type_code === 'ESPECIAL' ? '5X2_SUPER' : (staff.shift?.shift_type_code || '5X2_SUPER')
    );
    const [variant, setVariant] = useState<VariantCode>(
        staff.shift?.variant_code === 'ESPECIAL' ? 'PRINCIPAL' : (staff.shift?.variant_code || 'PRINCIPAL')
    );
    // La fecha de inicio SOLO se define para personal NUEVO (sin turno
    // asignado) y pasa UNA sola vez. Para personal existente se conserva
    // la original: cambiar la modalidad no borra la programación pasada.
    const esPersonalNuevo = !staff.shift;
    const [startDate, setStartDate] = useState(staff.shift?.start_date || '');

    const recommendation = useMemo(
        () => buildShiftRecommendation(staff, allStaff),
        [staff, allStaff]
    );

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
        try {
            await upsertShift.mutateAsync({
                staff_id: staff.id,
                shift_type_code: type,
                variant_code: variant,
                // Personal existente: SIEMPRE conserva su fecha de inicio original
                start_date: esPersonalNuevo ? (startDate || undefined) : (staff.shift?.start_date || undefined),
            });
            onClose();
            if (check.warnings.length > 0) {
                setTimeout(() => alert(`Modalidad guardada para ${staff.nombre}.\n\n${check.warnings.join('\n')}`), 50);
            }
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
                            <h3 className="font-bold text-white">Modalidad de Turno (ciclo 2 semanas)</h3>
                            <p className="text-xs text-slate-300">{staff.nombre} · {staff.cargo}</p>
                        </div>
                        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                            <Icon name="x" size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                    {staff.shift?.shift_type_code === 'ESPECIAL' && (
                        <p className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-xs text-purple-800">
                            Esta persona está en <b>ciclo mensual (plantilla 4 semanas)</b>. Al guardar una
                            modalidad aquí vuelve al <b>ciclo quincenal</b> (sem 1 = sem 3, sem 2 = sem 4).
                        </p>
                    )}

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
                            <p className="mt-1 text-[11px] text-slate-400">
                                Se define UNA sola vez, al ingresar la persona.
                            </p>
                        </div>
                    ) : (
                        <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                            La programación histórica se conserva: cambiar la modalidad NO borra
                            la asistencia hacia atrás{staff.shift?.start_date ? ` (fecha de inicio original: ${formatDateCL(staff.shift.start_date)})` : ''}.
                        </p>
                    )}

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
                        onClick={handleConfirm}
                        disabled={upsertShift.isPending}
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
