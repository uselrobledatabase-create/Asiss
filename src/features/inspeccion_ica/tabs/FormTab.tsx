import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { HeaderSection } from '../components/HeaderSection';
import { ChecklistSection } from '../components/ChecklistSection';
import { ScoreBoard, MobileScoreBar } from '../components/ScoreBoard';
import { InspeccionData } from '../types';

// Initial state helper
const getInitialState = (): InspeccionData => ({
    ppu: '',
    terminal_id: '',
    fiscalizador: '',
    registrador: '',
    fecha: new Date(),
    detalles: {}, // Start empty to force selection
});

export const FormTab: React.FC = () => {
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
        // Reset form optionally
        setFormData(getInitialState());
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Visual Score Boards */}
            <ScoreBoard score={score} total={totalPoints} completed={completedPoints} />
            <MobileScoreBar score={score} total={totalPoints} completed={completedPoints} />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Left Column: Header & Checklist */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Header Form */}
                    <HeaderSection formData={formData} setFormData={setFormData} />

                    {/* Checklist */}
                    <ChecklistSection
                        detalles={formData.detalles}
                        onChange={handleChecklistChange}
                    />
                </div>

                {/* Right Column: Actions & Summary (Desktop Sticky) */}
                <div className="hidden xl:block">
                    <div className="sticky top-6 space-y-6">
                        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl">
                            <h3 className="text-lg font-semibold mb-4">Resumen</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Puntos Evaluados</span>
                                    <span className="font-mono text-xl">{completedPoints}/{totalPoints}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Score Actual</span>
                                    <span className={`font-mono text-2xl font-bold ${score >= 8 ? 'text-green-400' : 'text-red-400'}`}>
                                        {score}
                                    </span>
                                </div>
                                <div className="h-px bg-white/10 my-4" />
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    {score >= 8
                                        ? 'El bus cumple con los estándares mínimos de operación.'
                                        : 'El bus presenta deficiencias críticas que deben ser corregidas.'}
                                </p>
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={completedPoints < totalPoints}
                                className={`
                            mt-8 w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all duration-300
                            ${completedPoints === totalPoints
                                        ? 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-blue-500/25'
                                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                                    }
                            `}
                            >
                                <Save className="w-5 h-5" />
                                Guardar Registro
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Floating Action Button */}
            <div className="xl:hidden fixed bottom-20 right-4 z-30">
                <button
                    onClick={handleSave}
                    disabled={completedPoints < totalPoints}
                    className={`
                    w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300
                    ${completedPoints === totalPoints
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-400'
                        }
                `}
                >
                    <Save className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};
