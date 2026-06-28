import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    CreditCard,
    Search,
    Building2,
    CheckCircle2,
    UserCheck,
    Ban,
    Layers,
    CalendarDays,
    Clock,
    FileText,
    Trash2,
} from 'lucide-react';
import { fetchCards, fetchLoans, deleteCard } from '../api/backupApi';
import { BackupCard, BackupLoan, INVENTORY_TERMINALS, InventoryTerminal, TerminalFilter } from '../types';
import { formatRut } from '../utils/rut';
import { ConfirmDialog } from '../../../shared/components/common/ConfirmDialog';
import { showSuccessToast, showErrorToast } from '../../../shared/state/toastStore';

// Visual identity per terminal so each subsection is instantly distinguishable
const TERMINAL_THEME: Record<InventoryTerminal, { gradient: string; soft: string; text: string; ring: string }> = {
    'El Roble': {
        gradient: 'from-brand-500 to-brand-700',
        soft: 'bg-brand-50',
        text: 'text-brand-700',
        ring: 'ring-brand-100',
    },
    'La Reina': {
        gradient: 'from-accent-500 to-blue-600',
        soft: 'bg-accent-50',
        text: 'text-accent-700',
        ring: 'ring-accent-100',
    },
    'Maria Angelica': {
        gradient: 'from-violet-500 to-fuchsia-600',
        soft: 'bg-violet-50',
        text: 'text-violet-700',
        ring: 'ring-violet-100',
    },
};

const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
    LIBRE: { label: 'Disponible', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    ASIGNADA: { label: 'En uso', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
    INACTIVA: { label: 'Inactiva', badge: 'bg-slate-200 text-slate-600', dot: 'bg-slate-400' },
};

interface EnrichedCard extends BackupCard {
    assignedTo: string | null;
    assignedRut: string | null;
    issuedAt: string | null;
    daysInUse: number | null;
}

const daysBetween = (from: string) => {
    const start = new Date(from).getTime();
    return Math.max(0, Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24)));
};

const StatusBadge = ({ status }: { status: string }) => {
    const meta = STATUS_META[status] || STATUS_META.INACTIVA;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full ${meta.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
        </span>
    );
};

const StatChip = ({
    icon,
    label,
    value,
    tone,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    tone: string;
}) => (
    <div className="flex items-center gap-2 rounded-lg bg-white/15 backdrop-blur-sm px-2.5 py-1.5">
        <span className={`flex items-center justify-center w-6 h-6 rounded-md ${tone}`}>{icon}</span>
        <div className="leading-tight">
            <p className="text-sm font-bold text-white">{value}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-white/70">{label}</p>
        </div>
    </div>
);

interface TerminalSectionProps {
    terminal: InventoryTerminal;
    cards: EnrichedCard[];
    onDelete: (card: EnrichedCard) => void;
}

const TerminalSection = ({ terminal, cards, onDelete }: TerminalSectionProps) => {
    const theme = TERMINAL_THEME[terminal];
    const total = cards.length;
    const libres = cards.filter((c) => c.status === 'LIBRE').length;
    const enUso = cards.filter((c) => c.status === 'ASIGNADA').length;
    const inactivas = cards.filter((c) => c.status === 'INACTIVA').length;

    return (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Header */}
            <div className={`bg-gradient-to-r ${theme.gradient} px-4 py-3 sm:px-5 sm:py-4`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm">
                            <Building2 className="w-5 h-5 text-white" />
                        </span>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-white leading-tight">{terminal}</h3>
                            <p className="text-xs text-white/80">{total} credencial{total === 1 ? '' : 'es'} en inventario</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
                        <StatChip icon={<CheckCircle2 className="w-3.5 h-3.5 text-white" />} label="Libres" value={libres} tone="bg-emerald-500/40" />
                        <StatChip icon={<UserCheck className="w-3.5 h-3.5 text-white" />} label="En uso" value={enUso} tone="bg-blue-500/40" />
                        <StatChip icon={<Ban className="w-3.5 h-3.5 text-white" />} label="Inactivas" value={inactivas} tone="bg-slate-500/40" />
                    </div>
                </div>
            </div>

            {cards.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-400">
                    Sin credenciales que coincidan con la busqueda.
                </div>
            ) : (
                <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 w-12">N°</th>
                                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Codigo</th>
                                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Estado</th>
                                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Asignada a</th>
                                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Fecha asignacion</th>
                                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Total dias</th>
                                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Notas</th>
                                    <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {cards.map((card, idx) => (
                                    <tr key={card.id} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="px-4 py-3 text-sm text-slate-400 tabular-nums">{idx + 1}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <CreditCard className="w-4 h-4 text-slate-300" />
                                                <span className="font-mono text-sm font-semibold text-slate-900">{card.card_number}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3"><StatusBadge status={card.status} /></td>
                                        <td className="px-4 py-3">
                                            {card.assignedTo ? (
                                                <div className="leading-tight">
                                                    <p className="text-sm font-medium text-slate-800">{card.assignedTo}</p>
                                                    {card.assignedRut && <p className="text-xs font-mono text-slate-400">{formatRut(card.assignedRut)}</p>}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-slate-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">
                                            {card.issuedAt ? new Date(card.issuedAt).toLocaleDateString('es-CL') : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {card.daysInUse !== null ? (
                                                <span className={`text-sm font-semibold ${card.daysInUse > 7 ? 'text-amber-600' : 'text-slate-700'}`}>
                                                    {card.daysInUse}d
                                                </span>
                                            ) : (
                                                <span className="text-sm text-slate-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 max-w-[200px] truncate text-sm text-slate-500" title={card.notes || ''}>
                                            {card.notes || <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => onDelete(card)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Eliminar credencial"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden divide-y divide-slate-100">
                        {cards.map((card, idx) => (
                            <div key={card.id} className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400 tabular-nums">{idx + 1}.</span>
                                        <CreditCard className="w-4 h-4 text-slate-300" />
                                        <span className="font-mono text-sm font-semibold text-slate-900">{card.card_number}</span>
                                    </div>
                                    <StatusBadge status={card.status} />
                                </div>
                                <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-sm">
                                    <div className="col-span-2">
                                        <span className="block text-[10px] uppercase tracking-wide text-slate-400">Asignada a</span>
                                        {card.assignedTo ? (
                                            <span className="text-slate-800">{card.assignedTo}{card.assignedRut ? ` · ${formatRut(card.assignedRut)}` : ''}</span>
                                        ) : (
                                            <span className="text-slate-300">—</span>
                                        )}
                                    </div>
                                    <div>
                                        <span className="block text-[10px] uppercase tracking-wide text-slate-400 flex items-center gap-1"><CalendarDays className="w-3 h-3" />Asignacion</span>
                                        <span className="text-slate-700">{card.issuedAt ? new Date(card.issuedAt).toLocaleDateString('es-CL') : '—'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] uppercase tracking-wide text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />Total dias</span>
                                        <span className={`font-semibold ${card.daysInUse !== null && card.daysInUse > 7 ? 'text-amber-600' : 'text-slate-700'}`}>
                                            {card.daysInUse !== null ? `${card.daysInUse}d` : '—'}
                                        </span>
                                    </div>
                                    {card.notes && (
                                        <div className="col-span-2">
                                            <span className="block text-[10px] uppercase tracking-wide text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3" />Notas</span>
                                            <span className="text-slate-600">{card.notes}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end mt-3 pt-3 border-t border-slate-100">
                                    <button
                                        onClick={() => onDelete(card)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </section>
    );
};

interface InventoryPanelProps {
    // Shared terminal filter — controlled by the page so it also drives the loans registry
    terminalFilter: TerminalFilter;
    onTerminalFilterChange: (terminal: TerminalFilter) => void;
}

export const InventoryPanel = ({ terminalFilter, onTerminalFilterChange }: InventoryPanelProps) => {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [cardToDelete, setCardToDelete] = useState<EnrichedCard | null>(null);

    const cardsQuery = useQuery({
        queryKey: ['backup-cards', 'inventory'],
        queryFn: () => fetchCards(),
    });

    const deleteCardMutation = useMutation({
        mutationFn: (id: string) => deleteCard(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backup-cards'] });
            queryClient.invalidateQueries({ queryKey: ['backup-kpis'] });
            setCardToDelete(null);
            showSuccessToast('Credencial eliminada', 'La credencial se elimino del inventario.');
        },
        onError: (error: unknown) => {
            showErrorToast('No se pudo eliminar', error instanceof Error ? error.message : 'Error desconocido');
        },
    });

    const activeLoansQuery = useQuery({
        queryKey: ['backup-loans', 'active-inventory'],
        queryFn: () => fetchLoans({ status: 'ASIGNADA' }),
    });

    // Map card_id -> active loan to enrich assigned cards
    const loanByCardId = useMemo(() => {
        const map = new Map<string, BackupLoan>();
        (activeLoansQuery.data || []).forEach((loan) => map.set(loan.card_id, loan));
        return map;
    }, [activeLoansQuery.data]);

    const enrichedCards = useMemo<EnrichedCard[]>(() => {
        const term = search.trim().toLowerCase();
        return (cardsQuery.data || [])
            .filter((card) => {
                if (!term) return true;
                const loan = loanByCardId.get(card.id);
                return (
                    card.card_number.toLowerCase().includes(term) ||
                    (loan?.person_name?.toLowerCase().includes(term) ?? false) ||
                    (loan?.person_rut?.toLowerCase().includes(term) ?? false)
                );
            })
            .map((card) => {
                const loan = card.status === 'ASIGNADA' ? loanByCardId.get(card.id) : undefined;
                return {
                    ...card,
                    assignedTo: loan?.person_name ?? null,
                    assignedRut: loan?.person_rut ?? null,
                    issuedAt: loan?.issued_at ?? null,
                    daysInUse: loan?.issued_at ? daysBetween(loan.issued_at) : null,
                };
            });
    }, [cardsQuery.data, loanByCardId, search]);

    const visibleTerminals = terminalFilter === 'TODAS' ? INVENTORY_TERMINALS : [terminalFilter];

    const isLoading = cardsQuery.isLoading || activeLoansQuery.isLoading;
    const totalCards = cardsQuery.data?.length || 0;

    return (
        <div className="space-y-4">
            {/* Section header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-brand text-white shadow-brand">
                        <Layers className="w-5 h-5" />
                    </span>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 leading-tight">Inventario de Credenciales</h2>
                        <p className="text-xs text-slate-500">Todas las credenciales disponibles y en uso por terminal</p>
                    </div>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar codigo, RUT o nombre..."
                        className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                    />
                </div>
            </div>

            {/* Terminal segmented selector */}
            <div className="flex flex-wrap gap-2">
                {(['TODAS', ...INVENTORY_TERMINALS] as TerminalFilter[]).map((t) => {
                    const active = terminalFilter === t;
                    return (
                        <button
                            key={t}
                            onClick={() => onTerminalFilterChange(t)}
                            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                active
                                    ? 'bg-gradient-brand text-white shadow-brand'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                        >
                            {t === 'TODAS' ? 'Todas' : t}
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="space-y-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="h-40 rounded-2xl border border-slate-200 bg-white shadow-sm animate-pulse" />
                    ))}
                </div>
            ) : totalCards === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                    <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No hay credenciales registradas en el inventario.</p>
                    <p className="text-xs text-slate-400 mt-1">Use el boton "Tarjetas" para agregar credenciales.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {visibleTerminals.map((terminal) => (
                        <TerminalSection
                            key={terminal}
                            terminal={terminal}
                            cards={enrichedCards.filter((c) => c.inventory_terminal === terminal)}
                            onDelete={setCardToDelete}
                        />
                    ))}
                </div>
            )}

            <ConfirmDialog
                isOpen={!!cardToDelete}
                title="Eliminar credencial"
                message={
                    <>
                        Vas a eliminar la credencial{' '}
                        <strong className="text-slate-900 font-mono">{cardToDelete?.card_number}</strong> de{' '}
                        <strong className="text-slate-900">{cardToDelete?.inventory_terminal}</strong>. Esta accion es
                        permanente y no se puede deshacer.
                    </>
                }
                isLoading={deleteCardMutation.isPending}
                onConfirm={() => cardToDelete && deleteCardMutation.mutate(cardToDelete.id)}
                onClose={() => setCardToDelete(null)}
            />
        </div>
    );
};
