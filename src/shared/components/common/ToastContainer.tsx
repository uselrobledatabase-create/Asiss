/**
 * Notificaciones del sistema — diseño empresarial.
 * Tarjetas blancas con barra de acento por tipo, ícono en insignia,
 * autor con iniciales y barra de progreso de auto-cierre.
 */

import { useToastStore, Toast as ToastType, ToastType as Kind } from '../../state/toastStore';
import { Icon } from './Icon';

const STYLES: Record<Kind, { accent: string; iconBg: string; iconTx: string; icon: 'check-circle' | 'x-circle' | 'alert-triangle' | 'bell' }> = {
    success: { accent: 'bg-emerald-500', iconBg: 'bg-emerald-100', iconTx: 'text-emerald-600', icon: 'check-circle' },
    error: { accent: 'bg-red-500', iconBg: 'bg-red-100', iconTx: 'text-red-600', icon: 'x-circle' },
    warning: { accent: 'bg-amber-500', iconBg: 'bg-amber-100', iconTx: 'text-amber-600', icon: 'alert-triangle' },
    info: { accent: 'bg-indigo-500', iconBg: 'bg-indigo-100', iconTx: 'text-indigo-600', icon: 'bell' },
};

const initials = (name: string) =>
    name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const ToastItem = ({ toast }: { toast: ToastType }) => {
    const { removeToast } = useToastStore();
    const s = STYLES[toast.type];

    return (
        <div
            className="pointer-events-auto relative w-[380px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.35)] backdrop-blur"
            style={{ animation: 'toastIn 0.35s cubic-bezier(0.21, 1.02, 0.73, 1)' }}
        >
            {/* Barra de acento */}
            <div className={`absolute inset-y-0 left-0 w-1 ${s.accent}`} />

            <div className="flex items-start gap-3 py-3.5 pl-4 pr-3">
                {/* Ícono */}
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}>
                    <Icon name={s.icon} size={18} className={s.iconTx} />
                </div>

                {/* Contenido */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <h4 className="truncate text-sm font-bold text-slate-900">{toast.title}</h4>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="shrink-0 rounded-lg p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        >
                            <Icon name="x" size={15} />
                        </button>
                    </div>
                    <p className="mt-0.5 text-[13px] leading-snug text-slate-600">{toast.message}</p>

                    {toast.createdBy && (
                        <div className="mt-2 flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[8px] font-bold text-white">
                                {initials(toast.createdBy)}
                            </span>
                            <span className="text-[11px] font-medium text-slate-400">
                                {toast.createdBy}
                            </span>
                            {toast.type === 'info' && (
                                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-600">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                                    En vivo
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Progreso de auto-cierre */}
            <div className="h-0.5 w-full bg-slate-100">
                <div
                    className={`h-full ${s.accent} opacity-60`}
                    style={{ animation: `toastBar ${toast.duration ?? 5000}ms linear forwards` }}
                />
            </div>
        </div>
    );
};

export const ToastContainer = () => {
    const { toasts } = useToastStore();

    if (toasts.length === 0) return null;

    return (
        <>
            <style>{`
        @keyframes toastIn {
          from { transform: translateX(110%) scale(0.95); opacity: 0; }
          to   { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes toastBar {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>

            <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex flex-col gap-2.5">
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} />
                ))}
            </div>
        </>
    );
};
