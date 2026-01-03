```javascript
import { useState, useEffect } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import { RutLookupInput } from '../../asistencia/components/RutLookupInput';
import { Staff } from '../../personal/types';
import { SANCTION_CODES } from '../constants';
import { AmonestacionFormData } from '../types';
import { generateAmonestacionPDF } from '../utils/pdfGenerator';
import { format } from 'date-fns';

interface Props {
    open: boolean;
    onClose: () => void;
    currentUserName: string;
    currentUserCargo: string;
}

export const AmonestacionFormModal = ({ open, onClose, currentUserName, currentUserCargo }: Props) => {
    const [selectedCodeId, setSelectedCodeId] = useState<string>('');
    const [worker, setWorker] = useState<Staff | null>(null);
    const [evidence, setEvidence] = useState('');
    
    // Detailed State
    const [formData, setFormData] = useState<Partial<AmonestacionFormData>>({
        date: format(new Date(), 'dd/MM/yyyy'),
        time: format(new Date(), 'HH:mm'),
        responsible_name: currentUserName,
        responsible_cargo: currentUserCargo
    });
    
    const handleWorkerFound = (s: Staff | null) => {
        setWorker(s);
        if (s) {
            setFormData(prev => ({
                ...prev,
                worker_rut: s.rut,
                worker_name: `${ s.nombres } ${ s.apellidos } `,
                worker_cargo: s.cargo,
                worker_base: s.terminal_code // Assuming base = terminal
            }));
        }
    };

    // Smart Fill Logic
    useEffect(() => {
        if (!selectedCodeId || !worker) return;
        
        const code = SANCTION_CODES.find(c => c.code.toString() === selectedCodeId);
        if (!code) return;

        setEvidence(code.evidence_required);

        // Auto-generate description if template exists, or use default
        let desc = code.template || '';
        if (!desc) {
            desc = `EL TRABAJADOR[NOMBRE_TRABAJADOR], RUT[RUT_TRABAJADOR], INCURRIÓ EN LA FALTA TIPIFICADA EN EL CÓDIGO[CODIGO]: ${ code.description.toUpperCase() }.\n\nSE PROCEDE A LEVANTAR LA PRESENTE AMONESTACIÓN CONFORME AL REGLAMENTO INTERNO DE ORDEN, HIGIENE Y SEGURIDAD.`;
        }

        desc = desc
            .replace(/\[NOMBRE_TRABAJADOR\]/g, formData.worker_name || '')
            .replace(/\[RUT_TRABAJADOR\]/g, formData.worker_rut || '')
            .replace(/\[CARGO_TRABAJADOR\]/g, formData.worker_cargo || '')
            .replace(/\[BASE_TRABAJADOR\]/g, formData.worker_base || '')
            .replace(/\[FECHA\]/g, formData.date || '')
            .replace(/\[CODIGO\]/g, code.code.toString());

        setFormData(prev => ({ ...prev, description: desc, sanction_code_id: code.code }));

    }, [selectedCodeId, worker, formData.worker_name, formData.date, formData.worker_rut, formData.worker_cargo, formData.worker_base]);

    const handleGenerate = () => {
        if (!worker || !formData.sanction_code_id) return;
        generateAmonestacionPDF(formData as AmonestacionFormData);
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
                    <h3 className="text-xl font-bold">Nueva Amonestación</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
                        <Icon name="x" size={24} className="text-white" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* COL 1: Basic Info */}
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <h3 className="font-bold mb-3 text-indigo-700 text-sm uppercase tracking-wide">1. Infractor</h3>
                                <RutLookupInput
                                    value={formData.worker_rut || ''}
                                    onChange={(val) => setFormData(prev => ({ ...prev, worker_rut: val }))}
                                    onStaffFound={handleWorkerFound}
                                />
                                {worker && (
                                    <div className="mt-3 text-xs text-slate-600 bg-white p-2 rounded border border-slate-100">
                                        <p><strong>Nombre:</strong> {worker.nombres} {worker.apellidos}</p>
                                        <p><strong>Cargo:</strong> {worker.cargo}</p>
                                        <p><strong>Base:</strong> {worker.terminal_code}</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <h3 className="font-bold mb-3 text-indigo-700 text-sm uppercase tracking-wide">2. Falta (Código)</h3>
                                <label className="label">Seleccionar Falta</label>
                                <select 
                                    className="input w-full"
                                    onChange={(e) => setSelectedCodeId(e.target.value)} 
                                    value={selectedCodeId}
                                >
                                    <option value="">Buscar código...</option>
                                    {SANCTION_CODES.map(code => (
                                        <option key={code.code} value={code.code.toString()}>
                                            Cod {code.code} - {code.severity} - {code.description.substring(0, 50)}...
                                        </option>
                                    ))}
                                </select>
                                {selectedCodeId && (
                                    <div className="mt-2 p-2 bg-amber-50 text-amber-900 text-xs rounded border border-amber-200 font-medium">
                                        ⚠️ Evidencia Requerida: {evidence}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <h3 className="font-bold mb-3 text-indigo-700 text-sm uppercase tracking-wide">3. Lugar y Hora</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="label">Fecha</label>
                                        <input type="text" className="input" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="label">Hora</label>
                                        <input type="text" className="input" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <label className="label">Terminal/Lugar</label>
                                    <input className="input" value={formData.place_terminal} onChange={e => setFormData({...formData, place_terminal: e.target.value})} placeholder="Ej: Terminal El Roble" />
                                </div>
                                <div className="mt-2">
                                    <label className="label">PPU / Vehículo</label>
                                    <input className="input" value={formData.place_ppu} onChange={e => setFormData({...formData, place_ppu: e.target.value})} placeholder="Opcional" />
                                </div>
                            </div>
                        </div>

                        {/* COL 2: Narrative & Witnesses */}
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 h-full flex flex-col">
                                <h3 className="font-bold mb-3 text-indigo-700 text-sm uppercase tracking-wide">4. Relato de los Hechos</h3>
                                <textarea 
                                    className="input flex-1 min-h-[200px] font-mono text-sm leading-relaxed p-3" 
                                    value={formData.description} 
                                    onChange={e => setFormData({...formData, description: e.target.value})} 
                                />
                                <p className="text-[10px] text-slate-400 mt-2">* El texto se genera automáticamente, pero puedes editarlo.</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                         <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <h3 className="font-bold mb-3 text-indigo-700 text-sm uppercase tracking-wide">5. Involucrados</h3>
                            <input className="input mb-2" placeholder="Jefatura" value={formData.involved_jefatura} onChange={e => setFormData({...formData, involved_jefatura: e.target.value})} />
                             <input className="input mb-2" placeholder="Compañeros" value={formData.involved_companeros} onChange={e => setFormData({...formData, involved_companeros: e.target.value})} />
                         </div>
                         <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <h3 className="font-bold mb-3 text-indigo-700 text-sm uppercase tracking-wide">6. Testigos</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <input className="input" placeholder="Nombre Testigo 1" value={formData.witness1_name} onChange={e => setFormData({...formData, witness1_name: e.target.value})} />
                                <input className="input" placeholder="RUT Testigo 1" value={formData.witness1_rut} onChange={e => setFormData({...formData, witness1_rut: e.target.value})} />
                            </div>
                         </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50/50 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors">
                        Cancelar
                    </button>
                    <button 
                        onClick={handleGenerate} 
                        disabled={!worker || !selectedCodeId} 
                        className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                    >
                        Generar PDF
                    </button>
                </div>
            </div>
        </div>
    );
};
```
