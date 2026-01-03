import { useState } from 'react';
import { AmonestacionFormModal } from './components/AmonestacionFormModal';
import { Icon } from '../../shared/components/common/Icon';

export const AmonestacionesPage = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

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

            {/* Placeholder for History List - Future feature */}
            <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <Icon name="file-text" size={48} className="mx-auto text-slate-300 mb-3" />
                <h3 className="text-lg font-medium text-slate-700">Historial de Amonestaciones</h3>
                <p className="text-slate-500 max-w-md mx-auto mt-2">
                    Aquí aparecerán las amonestaciones generadas. Por ahora, utiliza el botón "Nueva Amonestación" para generar y descargar PDFs.
                </p>
            </div>

            <AmonestacionFormModal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                // TODO: Connect to real auth context
                currentUserName="SUPERVISOR ACTIVO"
                currentUserCargo="SUPERVISOR"
            />
        </div>
    );
};
