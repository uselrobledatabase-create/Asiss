import { useState, useEffect } from 'react';
import { AmonestacionFormModal } from './components/AmonestacionFormModal';
import { Icon } from '../../shared/components/common/Icon';
import { ConfirmDialog } from '../../shared/components/common/ConfirmDialog';
import { fetchAmonestaciones, deleteAmonestacion, AmonestacionRecord } from './api/amonestacionesApi';
import { generateAmonestacionPDF } from './utils/pdfGenerator';
import { useToastStore } from '../../shared/state/toastStore';

export const AmonestacionesPage = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [records, setRecords] = useState<AmonestacionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [recordToDelete, setRecordToDelete] = useState<AmonestacionRecord | null>(null);
    const [deleting, setDeleting] = useState(false);
    const addToast = useToastStore(state => state.addToast);

    const loadRecords = async () => {
        try {
            setLoading(true);
            const data = await fetchAmonestaciones();
            setRecords(data);
        } catch (error) {
            console.error(error);
            addToast({ type: 'error', title: 'Error', message: 'Error al cargar historial' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRecords();
    }, []);

    const handleDownload = (record: AmonestacionRecord) => {
        try {
            generateAmonestacionPDF(record);
            addToast({ type: 'success', title: 'Éxito', message: 'PDF descargado nuevamente' });
        } catch (e) {
            console.error(e);
            addToast({ type: 'error', title: 'Error', message: 'Error al generar PDF' });
        }
    };

    const handleDelete = async () => {
        if (!recordToDelete) return;
        try {
            setDeleting(true);
            await deleteAmonestacion(recordToDelete.id);
            addToast({ type: 'success', title: 'Eliminada', message: 'La amonestación fue eliminada de la base de datos' });
            setRecordToDelete(null);
            await loadRecords();
        } catch (e) {
            console.error(e);
            addToast({ type: 'error', title: 'Error', message: 'No se pudo eliminar la amonestación' });
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Amonestaciones y Constataciones</h1>
                    <p className="text-slate-500">Gestión de faltas y actas disciplinarias</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-md transition-colors"
                >
                    <Icon name="plus" size={18} />
                    Nueva Amonestación
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">Historial Reciente</h3>
                    <button onClick={loadRecords} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500" title="Recargar">
                        <Icon name="loader" size={16} />
                    </button>
                </div>

                {loading ? (
                    <div className="p-10 text-center text-slate-400">
                        Cargando historial...
                    </div>
                ) : records.length === 0 ? (
                    <div className="p-10 text-center text-slate-400">
                        No hay registros aún.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3">Infractor</th>
                                    <th className="px-4 py-3">Falta</th>
                                    <th className="px-4 py-3">Responsable</th>
                                    <th className="px-4 py-3 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {records.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium">
                                            {r.date} <span className="text-slate-400 text-xs ml-1">{r.time}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-700">{r.worker_name}</div>
                                            <div className="text-xs text-slate-500">{r.worker_rut}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100">
                                                Cód. {r.sanction_code_id}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 text-xs">
                                            {r.responsible_name}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleDownload(r)}
                                                    className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                                    title="Descargar PDF"
                                                >
                                                    <Icon name="download" size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setRecordToDelete(r)}
                                                    className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Icon name="trash" size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <ConfirmDialog
                isOpen={!!recordToDelete}
                title="Eliminar amonestación"
                message={
                    <>
                        Vas a eliminar la amonestación de{' '}
                        <strong className="text-slate-900">{recordToDelete?.worker_name}</strong> (Cód.{' '}
                        {recordToDelete?.sanction_code_id}). Esta acción elimina el registro de la base de datos de forma
                        permanente y no se puede deshacer.
                    </>
                }
                isLoading={deleting}
                onConfirm={handleDelete}
                onClose={() => setRecordToDelete(null)}
            />
        </div>
    );
};
