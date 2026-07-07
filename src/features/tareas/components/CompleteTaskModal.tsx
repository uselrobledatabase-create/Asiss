import { useState, useRef } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import { useCompleteTask } from '../hooks';
import { Task } from '../types';

interface CompleteTaskModalProps {
    task: Task;
    onClose: () => void;
    onCompleted: () => void;
}

const MAX_FILE_MB = 10;

export const CompleteTaskModal = ({ task, onClose, onCompleted }: CompleteTaskModalProps) => {
    const completeMutation = useCompleteTask();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [note, setNote] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [recipients, setRecipients] = useState(task.assigned_to_email || '');
    const [fileError, setFileError] = useState('');

    const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = e.target.files?.[0] || null;
        setFileError('');
        if (picked && picked.size > MAX_FILE_MB * 1024 * 1024) {
            setFileError(`El archivo supera ${MAX_FILE_MB} MB`);
            return;
        }
        setFile(picked);
    };

    const handleSubmit = async () => {
        await completeMutation.mutateAsync({
            task,
            note,
            file,
            recipients: recipients.split(',').map((r) => r.trim()).filter(Boolean),
        });
        onCompleted();
    };

    const isLoading = completeMutation.isPending;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={isLoading ? undefined : onClose} />
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-emerald-50">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500 text-white shadow-sm">
                            <Icon name="check-circle" size={20} />
                        </span>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 leading-tight">Marcar como Terminada</h3>
                            <p className="text-xs text-slate-500 line-clamp-1">{task.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={isLoading} className="p-2 text-slate-400 hover:bg-white rounded-lg disabled:opacity-50">
                        <Icon name="x" size={20} />
                    </button>
                </div>

                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Note */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Comentarios o notas de cierre</label>
                        <textarea
                            className="input min-h-[90px] resize-none"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Describe lo realizado, observaciones o resultados..."
                        />
                    </div>

                    {/* Attachment */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Archivo adjunto (opcional)</label>
                        {file ? (
                            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Icon name="file" size={18} className="text-emerald-600 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                                        <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
                                    </div>
                                </div>
                                <button onClick={() => setFile(null)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg shrink-0">
                                    <Icon name="trash" size={16} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-sm font-medium text-slate-500 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                            >
                                <Icon name="upload" size={18} />
                                Seleccionar archivo (PDF, imagen, Excel...)
                            </button>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx,.csv"
                            onChange={handlePickFile}
                        />
                        {fileError && <p className="text-xs text-red-500 mt-1">{fileError}</p>}
                    </div>

                    {/* Recipients */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notificar a (correos)</label>
                        <input
                            type="text"
                            className="input"
                            value={recipients}
                            onChange={(e) => setRecipients(e.target.value)}
                            placeholder="correo1@rbu.cl, correo2@rbu.cl"
                        />
                        <p className="text-xs text-slate-400 mt-1">Separa varios correos con coma. Se enviará un correo <strong>Tarea Terminada</strong> con el adjunto y tus comentarios.</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50">
                    <button type="button" onClick={onClose} disabled={isLoading} className="btn btn-secondary">Cancelar</button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="btn bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500"
                    >
                        <Icon name="check-circle" size={16} />
                        {isLoading ? 'Enviando...' : 'Terminar y notificar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
