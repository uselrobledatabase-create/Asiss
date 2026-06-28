import { ReactNode } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface Props {
    isOpen: boolean;
    title: string;
    message: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    loadingLabel?: string;
    isLoading?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

export const ConfirmDialog = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Eliminar',
    cancelLabel = 'Cancelar',
    loadingLabel = 'Eliminando...',
    isLoading,
    onConfirm,
    onClose,
}: Props) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50" onClick={isLoading ? undefined : onClose} />
            <div className="relative min-h-screen flex items-center justify-center p-4">
                <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md animate-scale-in">
                    <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </span>
                            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-50" disabled={isLoading}>
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    <div className="px-6 py-5 text-sm text-slate-600 leading-relaxed">{message}</div>

                    <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
                        <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isLoading}>
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            className="btn btn-primary bg-red-600 hover:bg-red-700 focus:ring-red-500"
                            disabled={isLoading}
                        >
                            {isLoading ? loadingLabel : confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
