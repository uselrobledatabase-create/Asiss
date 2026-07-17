/**
 * RecordCard - Tarjeta empresarial para registros de asistencia
 * (No Marcaciones, Sin Credencial, Cambios de Día, Autorizaciones,
 * Vacaciones). Reemplaza las tablas anchas con scroll horizontal:
 * una tarjeta por registro, apiladas hacia abajo, 100% responsivas.
 */

import { ReactNode } from 'react';
import { Icon } from '../../../shared/components/common/Icon';

export interface RecordField {
    label: string;
    value: ReactNode;
    /** true = ocupa el ancho completo (observaciones, motivos largos) */
    wide?: boolean;
}

interface RecordCardProps {
    nombre: string;
    rut: string;
    /** chips bajo el nombre: terminal, fecha, cargo… */
    chips?: ReactNode;
    status: 'PENDIENTE' | 'AUTORIZADO' | 'RECHAZADO' | string;
    fields: RecordField[];
    /** motivo de rechazo (se muestra destacado si existe) */
    rejectionReason?: string | null;
    actions?: ReactNode;
}

const STATUS_META: Record<string, { accent: string; badge: string; icon: 'clock' | 'check-circle' | 'x-circle' }> = {
    PENDIENTE: { accent: 'bg-amber-400', badge: 'bg-amber-100 text-amber-800 border-amber-200', icon: 'clock' },
    AUTORIZADO: { accent: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: 'check-circle' },
    RECHAZADO: { accent: 'bg-red-500', badge: 'bg-red-100 text-red-800 border-red-200', icon: 'x-circle' },
};

const initials = (name: string) =>
    name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const RecordCard = ({ nombre, rut, chips, status, fields, rejectionReason, actions }: RecordCardProps) => {
    const meta = STATUS_META[status] || STATUS_META.PENDIENTE;

    return (
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            {/* Acento lateral por estado */}
            <div className={`absolute inset-y-0 left-0 w-1 ${meta.accent}`} />

            {/* Encabezado */}
            <div className="flex flex-col gap-2 border-b border-slate-100 py-3 pl-4 pr-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-[11px] font-bold text-white">
                        {initials(nombre)}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800">{nombre}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[11px] text-slate-400">{rut}</span>
                            {chips}
                        </div>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                    <span className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.badge}`}>
                        <Icon name={meta.icon} size={12} />
                        {status}
                    </span>
                    {actions}
                </div>
            </div>

            {/* Campos */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 py-3 pl-4 pr-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {fields.map((f, i) => (
                    <div key={i} className={`min-w-0 ${f.wide ? 'col-span-2 sm:col-span-3 lg:col-span-4 xl:col-span-6' : ''}`}>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{f.label}</p>
                        <div className="truncate text-[13px] font-medium text-slate-700" title={typeof f.value === 'string' ? f.value : undefined}>
                            {f.value || <span className="text-slate-300">—</span>}
                        </div>
                    </div>
                ))}
            </div>

            {/* Motivo de rechazo */}
            {status === 'RECHAZADO' && rejectionReason && (
                <div className="border-t border-red-100 bg-red-50/60 py-2 pl-4 pr-3">
                    <p className="text-[11px] text-red-700">
                        <b>Motivo del rechazo:</b> {rejectionReason}
                    </p>
                </div>
            )}
        </div>
    );
};

/** Chip pequeño para el encabezado de la tarjeta */
export const RecordChip = ({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'brand' | 'indigo' }) => {
    const cls = tone === 'brand'
        ? 'bg-brand-50 text-brand-700 border-brand-200'
        : tone === 'indigo'
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
            : 'bg-slate-100 text-slate-600 border-slate-200';
    return (
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
            {children}
        </span>
    );
};

/** Botonera estándar de acciones (editar / aprobar / rechazar) */
export const RecordActions = ({
    canEdit, canAuthorize, onEdit, onAuthorize, onReject,
}: {
    canEdit?: boolean;
    canAuthorize?: boolean;
    onEdit?: () => void;
    onAuthorize?: () => void;
    onReject?: () => void;
}) => (
    <div className="flex items-center gap-1">
        {canEdit && onEdit && (
            <button
                onClick={onEdit}
                className="rounded-lg bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                title="Editar"
            >
                <Icon name="clipboard" size={15} />
            </button>
        )}
        {canAuthorize && onAuthorize && (
            <button
                onClick={onAuthorize}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
                title="Autorizar"
            >
                <Icon name="check" size={13} /> Aprobar
            </button>
        )}
        {canAuthorize && onReject && (
            <button
                onClick={onReject}
                className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 ring-1 ring-red-200 transition-colors hover:bg-red-100"
                title="Rechazar"
            >
                <Icon name="x" size={13} /> Rechazar
            </button>
        )}
    </div>
);

/** Lista apilada + estado vacío */
export const RecordCardList = ({ children, empty }: { children: ReactNode[]; empty?: string }) => {
    if (!children || children.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <Icon name="inbox" size={24} className="text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-600">{empty || 'Sin registros para el filtro aplicado'}</p>
            </div>
        );
    }
    return <div className="space-y-3">{children}</div>;
};
