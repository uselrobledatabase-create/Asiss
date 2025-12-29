import { useState } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import { useUpdateSrlRequest } from '../hooks';
import { SrlStatus } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    requestId: string;
    currentStatus: SrlStatus;
    technicianName?: string;
    technicianMessage?: string;
    technicianVisitAt?: string;
    result?: 'OPERATIVO' | 'NO_OPERATIVO';
    nextVisitAt?: string;
}

export const TechnicianPanel = ({
    isOpen,
    onClose,
    requestId,
    currentStatus,
    technicianName: initialTechnicianName,
    technicianMessage: initialMessage,
    technicianVisitAt: initialVisitAt,
    result: initialResult,
    nextVisitAt: initialNextVisit
}: Props) => {
    const updateMutation = useUpdateSrlRequest();

    const [technicianName, setTechnicianName] = useState(initialTechnicianName || '');
    const [technicianMessage, setTechnicianMessage] = useState(initialMessage || '');
    const [technicianVisitAt, setTechnicianVisitAt] = useState(
        initialVisitAt ? new Date(initialVisitAt).toISOString().slice(0, 16) : ''
    );
    const [result, setResult] = useState<'OPERATIVO' | 'NO_OPERATIVO' | ''>(initialResult || '');
    const [nextVisitAt, setNextVisitAt] = useState(
        initialNextVisit ? new Date(initialNextVisit).toISOString().slice(0, 16) : ''
    );
    const [documentFile, setDocumentFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            setFileError('Solo se permiten imágenes (JPG, PNG, WEBP) o PDF');
            setDocumentFile(null);
            setPreviewUrl(null);
            return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            setFileError(`El archivo es muy grande. Máximo ${MAX_FILE_SIZE / 1024 / 1024}MB`);
            setDocumentFile(null);
            setPreviewUrl(null);
            return;
        }

        setFileError(null);
        setDocumentFile(file);

        // Generate preview for images
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setPreviewUrl(null);
        }
    };

    const handleRemoveFile = () => {
        setDocumentFile(null);
        setPreviewUrl(null);
        setFileError(null);
        // Reset file input
        const input = document.getElementById('tech-doc-upload') as HTMLInputElement;
        if (input) input.value = '';
    };

    const handleStartReview = async () => {
        if (!technicianName.trim()) {
            alert('Debe ingresar el nombre del técnico');
            return;
        }

        try {
            await updateMutation.mutateAsync({
                id: requestId,
                updates: {
                    status: 'EN_REVISION',
                    technician_name: technicianName,
                    technician_visit_at: technicianVisitAt ? new Date(technicianVisitAt).toISOString() : null
                }
            });
            alert('Revisión iniciada correctamente');
            onClose();
        } catch (error) {
            console.error(error);
            alert('Error al iniciar revisión');
        }
    };

    const handleComplete = async (newStatus: 'REPARADA' | 'NO_REPARADA') => {
        if (!result) {
            alert('Debe seleccionar un resultado (Operativo/No Operativo)');
            return;
        }

        try {
            let documentUrl: string | undefined;

            // Upload document if provided
            if (documentFile) {
                setIsUploading(true);
                setUploadProgress(0);

                const { uploadTechnicianDocument } = await import('../api/srlApi');

                // Simulate progress (since Supabase doesn't provide real progress)
                const progressInterval = setInterval(() => {
                    setUploadProgress(prev => Math.min(prev + 10, 90));
                }, 200);

                try {
                    documentUrl = await uploadTechnicianDocument(requestId, documentFile);
                    setUploadProgress(100);
                } finally {
                    clearInterval(progressInterval);
                }
            }

            await updateMutation.mutateAsync({
                id: requestId,
                updates: {
                    status: newStatus,
                    technician_name: technicianName,
                    technician_message: technicianMessage,
                    technician_visit_at: technicianVisitAt ? new Date(technicianVisitAt).toISOString() : null,
                    result: result,
                    next_visit_at: nextVisitAt ? new Date(nextVisitAt).toISOString() : null,
                    closed_at: newStatus === 'REPARADA' ? new Date().toISOString() : null,
                    technician_document_url: documentUrl || null
                }
            });

            setIsUploading(false);
            alert(`Solicitud marcada como ${newStatus}`);
            onClose();
        } catch (error) {
            console.error(error);
            setIsUploading(false);
            alert('Error al completar revisión');
        }
    };

    const handleReschedule = async () => {
        if (!nextVisitAt) {
            alert('Debe seleccionar una fecha para reagendar');
            return;
        }

        try {
            await updateMutation.mutateAsync({
                id: requestId,
                updates: {
                    status: 'REAGENDADA',
                    technician_name: technicianName,
                    technician_message: technicianMessage,
                    next_visit_at: new Date(nextVisitAt).toISOString()
                }
            });
            alert('Solicitud reagendada correctamente');
            onClose();
        } catch (error) {
            console.error(error);
            alert('Error al reagendar');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            ></div>

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                            <Icon name="wrench" size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg">Panel de Técnico</h3>
                            <p className="text-slate-300 text-sm">Gestión de Revisión Técnica</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                    >
                        <Icon name="x" size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] space-y-6">
                    {/* Technician Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Nombre del Técnico
                            </label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <Icon name="user" size={18} />
                                </div>
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900"
                                    placeholder="Ingrese nombre completo"
                                    value={technicianName}
                                    onChange={e => setTechnicianName(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Fecha y Hora de Visita
                            </label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <Icon name="calendar" size={18} />
                                </div>
                                <input
                                    type="datetime-local"
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900"
                                    value={technicianVisitAt}
                                    onChange={e => setTechnicianVisitAt(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Observation */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Observaciones del Técnico
                        </label>
                        <textarea
                            rows={4}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900 resize-none"
                            placeholder="Detalle la revisión técnica, piezas reemplazadas, reparaciones realizadas..."
                            value={technicianMessage}
                            onChange={e => setTechnicianMessage(e.target.value)}
                        />
                    </div>

                    {/* Document Upload - ENHANCED */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            📄 Documento Técnico (Informe de Revisión)
                        </label>

                        {!documentFile ? (
                            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-blue-400 transition-colors bg-slate-50/50">
                                <input
                                    type="file"
                                    id="tech-doc-upload"
                                    className="hidden"
                                    accept="image/*,application/pdf"
                                    onChange={handleFileChange}
                                />
                                <label
                                    htmlFor="tech-doc-upload"
                                    className="flex flex-col items-center cursor-pointer"
                                >
                                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                                        <Icon name="upload" size={24} className="text-blue-600" />
                                    </div>
                                    <p className="text-sm font-semibold text-slate-900 mb-1">Subir documento</p>
                                    <p className="text-xs text-slate-500">PDF o Imagen (Max 10MB)</p>
                                </label>
                            </div>
                        ) : (
                            <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50/30">
                                {/* Preview for images */}
                                {previewUrl && (
                                    <div className="mb-4">
                                        <img
                                            src={previewUrl}
                                            alt="Vista previa"
                                            className="w-full h-48 object-contain rounded-lg bg-white border border-slate-200"
                                        />
                                    </div>
                                )}

                                {/* File info */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                            <Icon name={documentFile.type.startsWith('image/') ? 'image' : 'file-text'} size={20} className="text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{documentFile.name}</p>
                                            <p className="text-xs text-slate-500">{(documentFile.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleRemoveFile}
                                        className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                                        title="Eliminar archivo"
                                    >
                                        <Icon name="trash" size={18} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Error message */}
                        {fileError && (
                            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                                <Icon name="alert-circle" size={16} className="text-red-600" />
                                <p className="text-sm text-red-700">{fileError}</p>
                            </div>
                        )}

                        {/* Upload progress */}
                        {isUploading && (
                            <div className="mt-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-slate-700">Subiendo documento...</span>
                                    <span className="text-sm font-bold text-blue-600">{uploadProgress}%</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Result Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-3">
                            Resultado de la Revisión
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setResult('OPERATIVO')}
                                className={`
                                    relative overflow-hidden p-4 rounded-xl border-2 transition-all duration-200 font-semibold text-sm flex items-center justify-center gap-2
                                    ${result === 'OPERATIVO'
                                        ? 'bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-105'
                                        : 'bg-white border-slate-300 text-slate-700 hover:border-emerald-400 hover:bg-emerald-50'
                                    }
                                `}
                            >
                                <Icon name="check-circle" size={20} />
                                OPERATIVO
                            </button>
                            <button
                                onClick={() => setResult('NO_OPERATIVO')}
                                className={`
                                    relative overflow-hidden p-4 rounded-xl border-2 transition-all duration-200 font-semibold text-sm flex items-center justify-center gap-2
                                    ${result === 'NO_OPERATIVO'
                                        ? 'bg-red-500 border-red-600 text-white shadow-lg shadow-red-500/30 scale-105'
                                        : 'bg-white border-slate-300 text-slate-700 hover:border-red-400 hover:bg-red-50'
                                    }
                                `}
                            >
                                <Icon name="x-circle" size={20} />
                                NO OPERATIVO
                            </button>
                        </div>
                    </div>

                    {/* Next Visit */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Próxima Visita (Opcional)
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                <Icon name="clock" size={18} />
                            </div>
                            <input
                                type="datetime-local"
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900"
                                value={nextVisitAt}
                                onChange={e => setNextVisitAt(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3 pt-4 border-t border-slate-200">
                        {currentStatus === 'CREADA' || currentStatus === 'ENVIADA' || currentStatus === 'PROGRAMADA' ? (
                            <button
                                onClick={handleStartReview}
                                disabled={updateMutation.isPending || isUploading}
                                className="w-full px-6 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Icon name="check" size={20} />
                                Iniciar Revisión Técnica
                            </button>
                        ) : null}

                        {currentStatus === 'EN_REVISION' ? (
                            <>
                                <button
                                    onClick={() => handleComplete('REPARADA')}
                                    disabled={updateMutation.isPending || isUploading}
                                    className="w-full px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Icon name="check-circle" size={20} />
                                    Completar como REPARADA
                                </button>
                                <button
                                    onClick={() => handleComplete('NO_REPARADA')}
                                    disabled={updateMutation.isPending || isUploading}
                                    className="w-full px-6 py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Icon name="x-circle" size={20} />
                                    Marcar como NO REPARADA
                                </button>
                                <button
                                    onClick={handleReschedule}
                                    disabled={updateMutation.isPending || isUploading}
                                    className="w-full px-6 py-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold rounded-xl shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Icon name="clock" size={20} />
                                    Reagendar Visita Técnica
                                </button>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
};
