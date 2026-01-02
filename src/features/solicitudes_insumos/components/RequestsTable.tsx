import { useState, useEffect } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import {
    fetchSupplyRequests,
    fetchSupplyRequestWithItems,
    markRequestAsRetrieved,
    deleteSupplyRequest,
    getReceiptUrl,
    uploadReceipt,
} from '../api/suppliesApi';
import { SupplyRequest, SupplyRequestWithItems } from '../types';
import { formatRequestType, formatStatus } from '../utils/calculations';
import { RequestForm } from './RequestForm';

interface Props {
    onRefresh?: () => void;
}

export const RequestsTable = ({ onRefresh }: Props) => {
    const [requests, setRequests] = useState<SupplyRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<SupplyRequestWithItems | null>(null);
    const [showDetail, setShowDetail] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDIENTE' | 'RETIRADO'>('ALL');

    // Close request modal state
    const [closeModalId, setCloseModalId] = useState<string | null>(null);
    const [closeFile, setCloseFile] = useState<File | null>(null);
    const [closing, setClosing] = useState(false);
    const [closeError, setCloseError] = useState<string | null>(null);

    const loadRequests = async () => {
        try {
            setLoading(true);
            const data = await fetchSupplyRequests(
                filterStatus !== 'ALL' ? { status: filterStatus } : undefined
            );
            setRequests(data);
        } catch (error) {
            console.error('Error loading requests:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRequests();
    }, [filterStatus]);

    const handleViewDetail = async (requestId: string) => {
        try {
            const data = await fetchSupplyRequestWithItems(requestId);
            setSelectedRequest(data);
            setShowDetail(true);
        } catch (error) {
            console.error('Error loading request detail:', error);
        }
    };

    const handleOpenCloseModal = (id: string) => {
        setCloseModalId(id);
        setCloseFile(null);
        setCloseError(null);
    };

    const handleCloseRequest = async () => {
        if (!closeModalId || !closeFile) return;

        setClosing(true);
        setCloseError(null);

        try {
            // First upload the receipt
            await uploadReceipt(closeModalId, closeFile);

            // Then mark as retrieved
            await markRequestAsRetrieved(closeModalId);

            setCloseModalId(null);
            setCloseFile(null);
            await loadRequests();
            onRefresh?.();
        } catch (error: unknown) {
            console.error('Error closing request:', error);
            const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
            if (errorMsg.includes('Bucket not found') || errorMsg.includes('not found')) {
                setCloseError('El bucket de almacenamiento no existe. Contacte al administrador para crear el bucket "supply-receipts" en Supabase Storage.');
            } else if (errorMsg.includes('security') || errorMsg.includes('policy')) {
                setCloseError('Error de permisos. Verifique las políticas del bucket en Supabase.');
            } else {
                setCloseError(`Error al cerrar solicitud: ${errorMsg}`);
            }
        } finally {
            setClosing(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
            if (!validTypes.includes(file.type)) {
                setCloseError('Tipo de archivo no válido. Use PDF, JPG o PNG.');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                setCloseError('El archivo excede 5MB.');
                return;
            }
            setCloseFile(file);
            setCloseError(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Eliminar esta solicitud?')) return;
        try {
            await deleteSupplyRequest(id);
            await loadRequests();
            onRefresh?.();
        } catch (error) {
            console.error('Error deleting request:', error);
        }
    };

    const handleDownloadReceipt = async (path: string) => {
        try {
            const url = await getReceiptUrl(path);
            window.open(url, '_blank');
        } catch (error) {
            console.error('Error getting receipt URL:', error);
        }
    };

    const handleFormSuccess = () => {
        setShowForm(false);
        loadRequests();
        onRefresh?.();
    };

    return (
        <div className="space-y-4">
            {/* Header Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setFilterStatus('ALL')}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${filterStatus === 'ALL'
                            ? 'bg-brand-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        Todas
                    </button>
                    <button
                        onClick={() => setFilterStatus('PENDIENTE')}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${filterStatus === 'PENDIENTE'
                            ? 'bg-warning-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        Pendientes
                    </button>
                    <button
                        onClick={() => setFilterStatus('RETIRADO')}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${filterStatus === 'RETIRADO'
                            ? 'bg-success-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        Retiradas
                    </button>
                </div>

                <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
                >
                    <Icon name="plus" size={18} />
                    <span>Nueva Solicitud</span>
                </button>
            </div>

            {/* Table */}
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
                    </div>
                ) : requests.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                        <Icon name="inbox" size={40} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-sm text-slate-500">No hay solicitudes registradas</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3">Tipo</th>
                                    <th className="px-4 py-3">Terminal</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3">Creado por</th>
                                    <th className="px-4 py-3 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {requests.map((req) => (
                                    <tr key={req.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-sm text-slate-600">
                                            {new Date(req.requested_at).toLocaleDateString('es-CL')}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-slate-800">
                                            {formatRequestType(req.request_type)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{req.terminal}</td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${req.status === 'PENDIENTE'
                                                    ? 'bg-warning-100 text-warning-700'
                                                    : 'bg-success-100 text-success-700'
                                                    }`}
                                            >
                                                {formatStatus(req.status)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{req.created_by}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleViewDetail(req.id)}
                                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
                                                    title="Ver detalle"
                                                >
                                                    <Icon name="eye" size={16} />
                                                </button>

                                                {req.status === 'PENDIENTE' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleOpenCloseModal(req.id)}
                                                            className="rounded-lg p-1.5 text-slate-500 hover:bg-success-100 hover:text-success-600"
                                                            title="Cerrar solicitud (requiere boleta)"
                                                        >
                                                            <Icon name="check" size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(req.id)}
                                                            className="rounded-lg p-1.5 text-slate-500 hover:bg-danger-100 hover:text-danger-600"
                                                            title="Eliminar"
                                                        >
                                                            <Icon name="trash" size={16} />
                                                        </button>
                                                    </>
                                                )}

                                                {req.receipt_path && (
                                                    <button
                                                        onClick={() => handleDownloadReceipt(req.receipt_path!)}
                                                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
                                                        title="Ver boleta"
                                                    >
                                                        <Icon name="file" size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* New Request Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
                    <div className="relative mt-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-800">Nueva Solicitud</h2>
                            <button
                                onClick={() => setShowForm(false)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                                <Icon name="x" size={20} />
                            </button>
                        </div>
                        <RequestForm onSuccess={handleFormSuccess} onCancel={() => setShowForm(false)} />
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetail && selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
                    <div className="relative mt-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-800">Detalle Solicitud</h2>
                            <button
                                onClick={() => {
                                    setShowDetail(false);
                                    setSelectedRequest(null);
                                }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                                <Icon name="x" size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-slate-500">Tipo:</span>
                                    <span className="ml-2 font-medium text-slate-800">
                                        {formatRequestType(selectedRequest.request_type)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500">Estado:</span>
                                    <span
                                        className={`ml-2 font-medium ${selectedRequest.status === 'PENDIENTE'
                                            ? 'text-warning-600'
                                            : 'text-success-600'
                                            }`}
                                    >
                                        {formatStatus(selectedRequest.status)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500">Terminal:</span>
                                    <span className="ml-2 font-medium text-slate-800">
                                        {selectedRequest.terminal}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500">Fecha:</span>
                                    <span className="ml-2 font-medium text-slate-800">
                                        {new Date(selectedRequest.requested_at).toLocaleDateString('es-CL')}
                                    </span>
                                </div>
                            </div>

                            <div className="rounded-lg border border-slate-200 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                                            <th className="px-4 py-2">Insumo</th>
                                            <th className="px-4 py-2 text-right">Cantidad</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {selectedRequest.items.map((item) => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-2 text-slate-800">
                                                    {item.supply?.name || 'Desconocido'}
                                                    {item.is_extra && (
                                                        <span className="ml-2 text-xs text-brand-500">(extra)</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-right font-medium text-slate-800">
                                                    {item.quantity}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Close Request Modal - REQUIRES RECEIPT */}
            {closeModalId && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
                    <div className="relative mt-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-800">Cerrar Solicitud</h2>
                            <button
                                onClick={() => setCloseModalId(null)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                                <Icon name="x" size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Warning */}
                            <div className="rounded-lg bg-warning-50 p-4 text-sm text-warning-800">
                                <div className="flex items-start gap-2">
                                    <Icon name="alert-triangle" size={18} className="mt-0.5 flex-shrink-0" />
                                    <p>
                                        <strong>Obligatorio:</strong> Debe adjuntar la boleta o comprobante para cerrar esta solicitud.
                                    </p>
                                </div>
                            </div>

                            {/* File Upload */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Boleta o Comprobante (PDF, JPG, PNG - max 5MB) *
                                </label>
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={handleFileSelect}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
                                />
                                {closeFile && (
                                    <p className="mt-2 flex items-center gap-2 text-sm text-success-600">
                                        <Icon name="check" size={16} />
                                        {closeFile.name}
                                    </p>
                                )}
                            </div>

                            {/* Error */}
                            {closeError && (
                                <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
                                    <div className="flex items-start gap-2">
                                        <Icon name="alert-triangle" size={16} className="mt-0.5 flex-shrink-0" />
                                        <p>{closeError}</p>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setCloseModalId(null)}
                                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCloseRequest}
                                    disabled={!closeFile || closing}
                                    className="inline-flex items-center gap-2 rounded-lg bg-success-500 px-4 py-2 text-sm font-medium text-white hover:bg-success-600 disabled:opacity-50"
                                >
                                    {closing && (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    )}
                                    Cerrar Solicitud
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
