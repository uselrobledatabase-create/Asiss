import { useState, useRef, useEffect } from 'react';
import { useSessionStore } from '../../../shared/state/sessionStore';
import { useTerminalStore } from '../../../shared/state/terminalStore';
import { TERMINALS } from '../../../shared/utils/terminal';
import { TerminalCode } from '../../../shared/types/terminal';
import { Icon } from '../../../shared/components/common/Icon';
import { ChecklistSection } from '../components/ChecklistSection';
import { useSaveInspeccion, useFlotaPPUs } from '../hooks';
import {
    A18_CONDICIONES,
    getInitialCondiciones,
    CondicionesMap,
    CondicionId,
    TOTAL_CONDICIONES,
} from '../types';

const todayISO = () => new Date().toISOString().slice(0, 10);

interface FormState {
    ppu: string;
    terminal_code: string;
    fiscalizador: string;
    fecha: string;
}

// ── PPU Autocomplete ──────────────────────────────────────────────────────────

interface PpuComboboxProps {
    value: string;
    onChange: (ppu: string) => void;
    onSelect: (ppu: string, terminal?: string) => void;
}

const PpuCombobox = ({ value, onChange, onSelect }: PpuComboboxProps) => {
    const [open, setOpen] = useState(false);
    const [inputVal, setInputVal] = useState(value);
    const containerRef = useRef<HTMLDivElement>(null);

    const { data: suggestions = [], isFetching } = useFlotaPPUs(inputVal);

    // Close dropdown on outside click
    useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    const handleInput = (raw: string) => {
        const v = raw.toUpperCase();
        setInputVal(v);
        onChange(v);
        setOpen(true);
    };

    const handleSelect = (ppu: string, terminal?: string) => {
        setInputVal(ppu);
        onChange(ppu);
        onSelect(ppu, terminal);
        setOpen(false);
    };

    const showDropdown = open && inputVal.length >= 2 && (suggestions.length > 0 || isFetching);

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <Icon
                    name="truck"
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => handleInput(e.target.value)}
                    onFocus={() => inputVal.length >= 2 && setOpen(true)}
                    placeholder="ABCD-12"
                    className="input pl-9 font-mono uppercase tracking-widest"
                    autoComplete="off"
                />
                {isFetching && inputVal.length >= 2 && (
                    <Icon
                        name="loader"
                        size={14}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin"
                    />
                )}
            </div>

            {showDropdown && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                    {isFetching && suggestions.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                            <Icon name="loader" size={14} className="animate-spin" />
                            Buscando...
                        </div>
                    ) : (
                        suggestions.map((s) => (
                            <button
                                key={s.ppu}
                                onMouseDown={() => handleSelect(s.ppu, s.terminal)}
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between gap-3"
                            >
                                <span className="font-mono font-bold text-slate-900">{s.ppu}</span>
                                {s.terminal && (
                                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                        {TERMINALS[s.terminal as TerminalCode] ?? s.terminal}
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

// ── FormTab ───────────────────────────────────────────────────────────────────

export const FormTab = () => {
    const session = useSessionStore((s) => s.session);
    const terminalCtx = useTerminalStore((s) => s.context);

    const defaultTerminal =
        terminalCtx.mode === 'TERMINAL' && terminalCtx.value ? String(terminalCtx.value) : '';

    const [form, setForm] = useState<FormState>({
        ppu: '',
        terminal_code: defaultTerminal,
        fiscalizador: session?.supervisorName ?? '',
        fecha: todayISO(),
    });
    const [condiciones, setCondiciones] = useState<CondicionesMap>(getInitialCondiciones());
    const [saved, setSaved] = useState(false);

    const { mutateAsync, isPending, error } = useSaveInspeccion();

    const evaluated = A18_CONDICIONES.filter((c) => condiciones[c.id]?.cumple !== null).length;
    const passing = A18_CONDICIONES.filter((c) => condiciones[c.id]?.cumple === true).length;
    const isComplete = evaluated === TOTAL_CONDICIONES;
    const hasObsRequired = A18_CONDICIONES.some(
        (c) => condiciones[c.id]?.cumple === false && !condiciones[c.id]?.observacion?.trim()
    );
    const canSave =
        isComplete && !hasObsRequired && form.ppu.trim() && form.terminal_code && form.fiscalizador.trim();

    const handleCondicionChange = (id: CondicionId, cumple: boolean, obs: string) => {
        setCondiciones((prev) => ({ ...prev, [id]: { cumple, observacion: obs } }));
        setSaved(false);
    };

    const handlePpuSelect = (ppu: string, terminal?: string) => {
        setForm((prev) => ({
            ...prev,
            ppu,
            terminal_code: terminal && TERMINALS[terminal as TerminalCode] ? terminal : prev.terminal_code,
        }));
    };

    const handleSave = async () => {
        if (!canSave) return;
        try {
            await mutateAsync({
                ppu: form.ppu.trim().toUpperCase(),
                terminal_code: form.terminal_code,
                fiscalizador: form.fiscalizador.trim(),
                fecha: form.fecha,
                norma: 'A18',
                condiciones,
                score: passing,
                total: TOTAL_CONDICIONES,
                resultado: passing === TOTAL_CONDICIONES ? 'CUMPLE' : 'NO_CUMPLE',
            });
            setSaved(true);
            setCondiciones(getInitialCondiciones());
            setForm((prev) => ({ ...prev, ppu: '' }));
        } catch {
            // error handled by mutation state
        }
    };

    const progressPct = (evaluated / TOTAL_CONDICIONES) * 100;
    const progressColor =
        evaluated === TOTAL_CONDICIONES
            ? passing === TOTAL_CONDICIONES ? 'bg-emerald-500' : 'bg-red-500'
            : 'bg-blue-500';

    return (
        <div className="space-y-6">
            {/* Progress Banner */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">Progreso de evaluación</span>
                    <span className="text-sm font-bold text-slate-900">
                        {evaluated}/{TOTAL_CONDICIONES} condiciones
                    </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left: Form + Checklist */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Header Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                <Icon name="clipboard" size={15} className="text-blue-600" />
                                Información General
                            </h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {/* PPU with autocomplete */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                    PPU / Patente *
                                </label>
                                <PpuCombobox
                                    value={form.ppu}
                                    onChange={(ppu) => setForm((p) => ({ ...p, ppu }))}
                                    onSelect={handlePpuSelect}
                                />
                                <p className="mt-1 text-xs text-slate-400">
                                    Escribe mín. 2 caracteres para buscar en flota
                                </p>
                            </div>

                            {/* Terminal */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                    Terminal *
                                </label>
                                <select
                                    value={form.terminal_code}
                                    onChange={(e) => setForm((p) => ({ ...p, terminal_code: e.target.value }))}
                                    className="input"
                                >
                                    <option value="">Seleccionar terminal...</option>
                                    {Object.entries(TERMINALS).map(([code, name]) => (
                                        <option key={code} value={code}>{name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Fiscalizador */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                    Fiscalizador *
                                </label>
                                <input
                                    type="text"
                                    value={form.fiscalizador}
                                    onChange={(e) => setForm((p) => ({ ...p, fiscalizador: e.target.value }))}
                                    className="input"
                                    placeholder="Nombre del fiscalizador"
                                />
                            </div>

                            {/* Fecha */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                    Fecha
                                </label>
                                <input
                                    type="date"
                                    value={form.fecha}
                                    onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
                                    className="input"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Checklist */}
                    <ChecklistSection condiciones={condiciones} onChange={handleCondicionChange} />
                </div>

                {/* Right: Summary Panel (desktop) */}
                <div className="hidden xl:block">
                    <div className="sticky top-6">
                        <SummaryPanel
                            passing={passing}
                            total={TOTAL_CONDICIONES}
                            evaluated={evaluated}
                            canSave={!!canSave}
                            isPending={isPending}
                            saved={saved}
                            hasError={!!error}
                            onSave={handleSave}
                        />
                    </div>
                </div>
            </div>

            {/* Mobile bottom action */}
            <div className="xl:hidden bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800">
                            {passing}/{TOTAL_CONDICIONES} CUMPLE
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                            {isComplete
                                ? passing === TOTAL_CONDICIONES ? 'Resultado: CUMPLE' : 'Resultado: NO CUMPLE'
                                : `${TOTAL_CONDICIONES - evaluated} condición(es) pendiente(s)`}
                        </p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={!canSave || isPending}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex-shrink-0 ${canSave && !isPending
                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        <Icon name="save" size={15} />
                        {isPending ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
                {saved && (
                    <div className="mt-3 flex items-center gap-2 text-emerald-700 text-sm font-medium">
                        <Icon name="check-circle" size={15} />
                        Inspección guardada exitosamente.
                    </div>
                )}
                {!!error && (
                    <p className="mt-2 text-sm text-red-600">Error al guardar. Revisa que la tabla exista en Supabase.</p>
                )}
            </div>
        </div>
    );
};

// ── Summary Panel ─────────────────────────────────────────────────────────────

interface SummaryPanelProps {
    passing: number;
    total: number;
    evaluated: number;
    canSave: boolean;
    isPending: boolean;
    saved: boolean;
    hasError: boolean;
    onSave: () => void;
}

const SummaryPanel = ({ passing, total, evaluated, canSave, isPending, saved, hasError, onSave }: SummaryPanelProps) => {
    const isComplete = evaluated === total;
    const resultado = isComplete ? (passing === total ? 'CUMPLE' : 'NO CUMPLE') : null;

    return (
        <div className="bg-slate-900 text-white rounded-2xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-white/10">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Resumen de Evaluación
                </h3>
            </div>
            <div className="p-6 space-y-4">
                <SummaryRow label="Evaluadas" value={`${evaluated}/${total}`} />
                <SummaryRow label="CUMPLE" value={String(passing)} valueClass="text-emerald-400 text-xl" />
                <SummaryRow
                    label="NO CUMPLE"
                    value={String(evaluated - passing)}
                    valueClass={evaluated - passing > 0 ? 'text-red-400 text-xl' : 'text-slate-500 text-xl'}
                />

                {resultado && (
                    <div className={`rounded-xl p-3 text-center font-bold text-sm border ${resultado === 'CUMPLE'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }`}>
                        Resultado: {resultado}
                    </div>
                )}

                <div className="h-px bg-white/10" />

                <button
                    onClick={onSave}
                    disabled={!canSave || isPending}
                    className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${canSave && !isPending
                        ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/50'
                        : 'bg-white/10 text-white/30 cursor-not-allowed'
                        }`}
                >
                    <Icon name="save" size={16} />
                    {isPending ? 'Guardando...' : 'Guardar Inspección'}
                </button>

                {saved && (
                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium justify-center">
                        <Icon name="check-circle" size={14} />
                        Guardado exitosamente
                    </div>
                )}
                {hasError && (
                    <p className="text-red-400 text-xs text-center">
                        Error al guardar. Ejecuta el SQL en Supabase.
                    </p>
                )}
            </div>
        </div>
    );
};

const SummaryRow = ({
    label, value, valueClass = 'text-white font-mono font-bold',
}: { label: string; value: string; valueClass?: string }) => (
    <div className="flex justify-between items-center">
        <span className="text-slate-400 text-sm">{label}</span>
        <span className={`font-mono font-bold ${valueClass}`}>{value}</span>
    </div>
);
