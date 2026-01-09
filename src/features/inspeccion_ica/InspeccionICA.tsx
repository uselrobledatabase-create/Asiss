import React, { useState } from 'react';
import { PageHeader } from '../../shared/components/common/PageHeader';
import { HeaderSection } from './components/HeaderSection';
import { ChecklistSection } from './components/ChecklistSection';
import { ScoreBoard, MobileScoreBar } from './components/ScoreBoard';
import { InspeccionData } from './types';

// Initial state helper
const getInitialState = (): InspeccionData => ({
    ppu: '',
    terminal_id: '',
    fiscalizador: '',
    registrador: '',
    fecha: new Date(),
    detalles: {}, // Start empty to force selection
});

export const InspeccionICA: React.FC = () => {
    const [formData, setFormData] = useState<InspeccionData>(getInitialState());

    // Derived state for score
    const totalPoints = 10;
    const completedPoints = Object.keys(formData.detalles).length;
    const score = Object.values(formData.detalles).filter((d) => d.cumple).length;

    const handleChecklistChange = (id: number, cumple: boolean, obs?: string) => {
        setFormData((prev) => ({
            ...prev,
            detalles: {
                ...prev.detalles,
                [id]: { cumple, observacion: obs },
            },
        }));
    };

    const handleSave = () => {
        if (completedPoints < totalPoints) {
            alert('Faltan puntos por evaluar. Por favor complete el checklist.');
            return;
        }
        console.log('Saving Inspection:', formData);
        alert('Inspección guardada con éxito (Simulación)');
    };

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-900 pb-20 md:pb-10">

            {/* Visual Score Boards */}
            <ScoreBoard score={score} total={totalPoints} completed={completedPoints} />
            <MobileScoreBar score={score} total={totalPoints} completed={completedPoints} />

            <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

                {/* Title Section */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Nueva Fiscalización <span className="text-blue-600">ICA A18</span>
                    </h1>
                    <p className="text-slate-500 mt-2">
                        Complete todos los puntos de control para registrar la inspección.
                    </p>
                </div>

                {/* Header Form */}
                <HeaderSection formData={formData} setFormData={setFormData} />

                {/* Checklist */}
                <ChecklistSection
                    detalles={formData.detalles}
                    onChange={handleChecklistChange}
                />

                {/* Actions Footer */}
                <div className="sticky bottom-4 md:relative pt-6 z-30">
                    <button
                        onClick={handleSave}
                        disabled={completedPoints < totalPoints}
                        className={`
               w-full py-4 rounded-2xl font-bold text-lg shadow-xl transition-all duration-300
               ${completedPoints === totalPoints
                                ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-2xl hover:-translate-y-1'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }
             `}
                    >
                        {completedPoints === totalPoints ? 'Guardar Inspección' : `Complete ${totalPoints - completedPoints} puntos para guardar`}
                    </button>
                </div>

            </div>
        </div>
    );
};
