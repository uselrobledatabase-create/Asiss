import { useMemo } from 'react';
import { Eye, Edit, RotateCcw, X, Mail, AlertTriangle } from 'lucide-react';
import { BackupLoan } from '../types';
import { formatRut } from '../utils/rut';

interface Props {
    loans: BackupLoan[];
    onView: (loan: BackupLoan) => void;
    onEdit: (loan: BackupLoan) => void;
    onRecover: (loan: BackupLoan) => void;
    onCancel: (loan: BackupLoan) => void;
    onResendEmails: (loan: BackupLoan) => void;
}

const StatusBadge = ({ status, isOverdue }: { status: string; isOverdue: boolean }) => {
    const baseClass = 'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full';

    if (isOverdue && status === 'ASIGNADA') {
        return (
            <span className={`${baseClass} bg-amber-100 text-amber-800`}>
                <AlertTriangle className="w-3 h-3" />
                ATRASADA
            </span>
        );
    }

    const colorMap: Record<string, string> = {
        ASIGNADA: 'bg-blue-100 text-blue-800',
        RECUPERADA: 'bg-emerald-100 text-emerald-800',
        CERRADA: 'bg-slate-100 text-slate-700',
        CANCELADA: 'bg-red-100 text-red-800',
    };

    return (
        <span className={`${baseClass} ${colorMap[status] || 'bg-slate-100 text-slate-700'}`}>
            {status}
        </span>
    );
};

const ReasonBadge = ({ reason }: { reason: string }) => {
    const colorMap: Record<string, string> = {
        PERDIDA: 'bg-red-50 text-red-700',
        DETERIORO: 'bg-orange-50 text-orange-700',
    };

    return (
        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${colorMap[reason] || ''}`}>
            {reason === 'PERDIDA' ? 'Perdida' : 'Deterioro'}
        </span>
    );
};

export const LoansTable = ({
    loans,
    onView,
    onEdit,
    onRecover,
    onCancel,
    onResendEmails,
}: Props) => {
    const loansWithOverdue = useMemo(() => {
        const now = new Date();
        return loans.map((loan) => {
            const issuedAt = new Date(loan.issued_at);
            const daysPassed = Math.floor((now.getTime() - issuedAt.getTime()) / (1000 * 60 * 60 * 24));
            return {
                ...loan,
                daysPassed,
                isOverdue: loan.status === 'ASIGNADA' && daysPassed > loan.alert_after_days,
            };
        });
    }, [loans]);

    if (loans.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <p className="text-slate-500">No se encontraron prestamos con los filtros seleccionados.</p>
            </div>
        );
    }

    return (
        <div className="table-container">
            <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Trabajador
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            RUT
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Terminal
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Tarjeta
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Motivo
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Entrega
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Dias
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Estado
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Acciones
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loansWithOverdue.map((loan) => (
                        <tr
                            key={loan.id}
                            className={`hover:bg-slate-50 ${loan.isOverdue ? 'bg-amber-50/50' : ''}`}
                        >
                            <td className="px-4 py-3 whitespace-nowrap">
                                <p className="text-sm font-medium text-slate-900">{loan.person_name}</p>
                                <p className="text-xs text-slate-500">{loan.person_cargo || '-'}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                                {formatRut(loan.person_rut)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                                {loan.person_terminal}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                <p className="text-sm font-mono text-slate-900">
                                    {loan.backup_cards?.card_number || '-'}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {loan.backup_cards?.inventory_terminal}
                                </p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                <ReasonBadge reason={loan.reason} />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                                {new Date(loan.issued_at).toLocaleDateString('es-CL')}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                <span
                                    className={`text-sm font-medium ${loan.isOverdue ? 'text-amber-600' : 'text-slate-700'
                                        }`}
                                >
                                    {loan.daysPassed}d
                                </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                <StatusBadge status={loan.status} isOverdue={loan.isOverdue} />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-1">
                                    <button
                                        onClick={() => onView(loan)}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                                        title="Ver detalle"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    {loan.status === 'ASIGNADA' && (
                                        <>
                                            <button
                                                onClick={() => onEdit(loan)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                title="Editar"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => onRecover(loan)}
                                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                                                title="Marcar recuperada"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => onCancel(loan)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                title="Cancelar"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => onResendEmails(loan)}
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                        title="Reenviar correos"
                                    >
                                        <Mail className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        </div >
    );
};
