import { useState, FormEvent } from 'react';
import { X, Plus, CreditCard, Trash2, Pencil, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BackupCard, CardFormValues, INVENTORY_TERMINALS, CARD_STATUS_OPTIONS } from '../types';
import { fetchCards, createCard, deactivateCard, updateCardNotes } from '../api/backupApi';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export const CardsInventoryModal = ({ isOpen, onClose }: Props) => {
    const queryClient = useQueryClient();
    const [showAddForm, setShowAddForm] = useState(false);
    const [filterTerminal, setFilterTerminal] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editingNoteValue, setEditingNoteValue] = useState('');
    const [newCard, setNewCard] = useState<CardFormValues>({
        card_number: '',
        inventory_terminal: 'El Roble',
        notes: '',
    });

    const { data: cards = [], isLoading } = useQuery({
        queryKey: ['backup-cards', filterTerminal, filterStatus],
        queryFn: () => fetchCards(filterStatus || undefined, filterTerminal || undefined),
        enabled: isOpen,
    });

    const createMutation = useMutation({
        mutationFn: createCard,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backup-cards'] });
            setShowAddForm(false);
            setNewCard({ card_number: '', inventory_terminal: 'El Roble', notes: '' });
        },
    });

    const deactivateMutation = useMutation({
        mutationFn: deactivateCard,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backup-cards'] });
        },
    });

    const updateNotesMutation = useMutation({
        mutationFn: ({ id, notes }: { id: string; notes: string }) => updateCardNotes(id, notes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backup-cards'] });
            setEditingNoteId(null);
            setEditingNoteValue('');
        },
    });

    const handleSubmitCard = (e: FormEvent) => {
        e.preventDefault();
        createMutation.mutate(newCard);
    };

    const handleDeactivate = (card: BackupCard) => {
        if (confirm(`Desactivar tarjeta ${card.card_number}?`)) {
            deactivateMutation.mutate(card.id);
        }
    };

    const startEditNote = (card: BackupCard) => {
        setEditingNoteId(card.id);
        setEditingNoteValue(card.notes || '');
    };

    const cancelEditNote = () => {
        setEditingNoteId(null);
        setEditingNoteValue('');
    };

    const saveNote = (card: BackupCard) => {
        updateNotesMutation.mutate({ id: card.id, notes: editingNoteValue });
    };

    if (!isOpen) return null;

    const statusColors: Record<string, string> = {
        LIBRE: 'bg-emerald-100 text-emerald-800',
        ASIGNADA: 'bg-blue-100 text-blue-800',
        INACTIVA: 'bg-slate-100 text-slate-600',
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative min-h-screen flex items-center justify-center p-4">
                <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
                    <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-slate-600" />
                            <h2 className="text-lg font-semibold text-slate-900">Inventario de Tarjetas</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
                        <select
                            className="input w-auto"
                            value={filterTerminal}
                            onChange={(e) => setFilterTerminal(e.target.value)}
                        >
                            <option value="">Todos los terminales</option>
                            {INVENTORY_TERMINALS.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        <select
                            className="input w-auto"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="">Todos los estados</option>
                            {CARD_STATUS_OPTIONS.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                        <div className="flex-1" />
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="btn btn-primary flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Agregar Tarjeta
                        </button>
                    </div>

                    {showAddForm && (
                        <form onSubmit={handleSubmitCard} className="p-4 bg-slate-50 border-b border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Numero de Tarjeta</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={newCard.card_number}
                                        onChange={(e) => setNewCard((prev) => ({ ...prev, card_number: e.target.value }))}
                                        placeholder="Ej: TR-001"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Terminal</label>
                                    <select
                                        className="input"
                                        value={newCard.inventory_terminal}
                                        onChange={(e) => setNewCard((prev) => ({ ...prev, inventory_terminal: e.target.value as typeof newCard.inventory_terminal }))}
                                    >
                                        {INVENTORY_TERMINALS.map((t) => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Notas (opcional)</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={newCard.notes}
                                        onChange={(e) => setNewCard((prev) => ({ ...prev, notes: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-3">
                                <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary text-sm">
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary text-sm" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="flex-1 overflow-y-auto p-4">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                            </div>
                        ) : cards.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                No hay tarjetas registradas
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {cards.map((card) => (
                                    <div
                                        key={card.id}
                                        className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <CreditCard className="w-5 h-5 text-slate-400" />
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">{card.card_number}</p>
                                                    <p className="text-xs text-slate-500">{card.inventory_terminal}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[card.status] || ''}`}>
                                                    {card.status}
                                                </span>
                                                {editingNoteId !== card.id && (
                                                    <button
                                                        onClick={() => startEditNote(card)}
                                                        className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded"
                                                        title="Editar nota"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {card.status !== 'INACTIVA' && card.status !== 'ASIGNADA' && (
                                                    <button
                                                        onClick={() => handleDeactivate(card)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                        title="Desactivar"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Note row (editable) */}
                                        <div className="mt-2 pl-8">
                                            {editingNoteId === card.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        autoFocus
                                                        className="input h-8 py-1 text-sm flex-1"
                                                        value={editingNoteValue}
                                                        onChange={(e) => setEditingNoteValue(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveNote(card);
                                                            if (e.key === 'Escape') cancelEditNote();
                                                        }}
                                                        placeholder="Escribe una nota..."
                                                    />
                                                    <button
                                                        onClick={() => saveNote(card)}
                                                        disabled={updateNotesMutation.isPending}
                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50"
                                                        title="Guardar"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={cancelEditNote}
                                                        className="p-1.5 text-slate-400 hover:bg-slate-200 rounded"
                                                        title="Cancelar"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => startEditNote(card)}
                                                    className="text-left text-xs text-slate-500 hover:text-slate-700"
                                                >
                                                    {card.notes ? (
                                                        <span><span className="font-medium text-slate-400">Nota:</span> {card.notes}</span>
                                                    ) : (
                                                        <span className="italic text-slate-400">Sin nota — clic para agregar</span>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="border-t border-slate-200 px-6 py-4 flex justify-end">
                        <button onClick={onClose} className="btn btn-secondary">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
