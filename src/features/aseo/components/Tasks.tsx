import { useState } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import { useFetchTasks, useUpdateTaskStatus } from '../hooks';

interface Props {
    cleanerId: string;
}

export const Tasks = ({ cleanerId }: Props) => {
    console.log('📋 Tasks component - cleanerId:', cleanerId);

    const { data: tasks = [], isLoading } = useFetchTasks(cleanerId);
    const updateMutation = useUpdateTaskStatus();
    const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
    const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);

    const handleToggleStatus = async (taskId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'PENDIENTE' ? 'TERMINADA' : 'PENDIENTE';

        if (newStatus === 'TERMINADA' && !evidenceFile) {
            setSelectedTaskId(taskId);
            return;
        }

        try {
            await updateMutation.mutateAsync({
                taskId,
                status: newStatus,
                evidenceFile: evidenceFile || undefined
            });
            setEvidenceFile(null);
            setEvidencePreview(null);
            setSelectedTaskId(null);
        } catch (error) {
            console.error(error);
            alert('Error al actualizar tarea');
        }
    };

    const handleEvidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setEvidenceFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setEvidencePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                <Icon name="loader" size={32} className="text-blue-600 mx-auto mb-2 animate-spin" />
                <p className="text-slate-600">Cargando tareas...</p>
            </div>
        );
    }

    const pendingTasks = tasks.filter(t => t.status === 'PENDIENTE');
    const completedTasks = tasks.filter(t => t.status === 'TERMINADA');

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Mis Tareas</h2>

            {/* Pending Tasks */}
            {pendingTasks.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-semibold text-amber-600 flex items-center gap-2">
                        <Icon name="clock" size={18} />
                        Pendientes ({pendingTasks.length})
                    </h3>
                    {pendingTasks.map(task => (
                        <div key={task.id} className="bg-white rounded-xl shadow-md p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <h4 className="font-bold text-lg text-slate-900">{task.title}</h4>
                                    {task.description && (
                                        <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                                    )}
                                    <p className="text-xs text-slate-400 mt-2">
                                        Asignada: {new Date(task.created_at).toLocaleDateString('es-CL')}
                                    </p>
                                </div>
                            </div>

                            {selectedTaskId === task.id && (
                                <div className="mb-3">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Foto de evidencia (opcional)
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        id={`evidence-${task.id}`}
                                        className="hidden"
                                        onChange={handleEvidenceChange}
                                    />
                                    <label
                                        htmlFor={`evidence-${task.id}`}
                                        className="block w-full cursor-pointer"
                                    >
                                        {evidencePreview ? (
                                            <img src={evidencePreview} alt="Evidencia" className="w-full h-32 object-cover rounded-lg" />
                                        ) : (
                                            <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
                                                <Icon name="image" size={24} className="text-slate-400 mx-auto" />
                                                <p className="text-xs text-slate-500 mt-1">Tomar foto</p>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            )}

                            <button
                                onClick={() => handleToggleStatus(task.id, task.status)}
                                disabled={updateMutation.isPending}
                                className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                            >
                                {updateMutation.isPending ? 'Actualizando...' : 'Marcar como Terminada'}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
                <div className="space-y-3">
                    <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="w-full font-semibold text-emerald-600 flex items-center justify-between gap-2 py-2 px-3 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Icon name="check-circle" size={18} />
                            Completadas ({completedTasks.length})
                        </div>
                        <Icon
                            name="chevron-down"
                            size={18}
                            className={`transition-transform ${showCompleted ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {showCompleted && completedTasks.map(task => (
                        <div key={task.id} className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                            <h4 className="font-bold text-slate-900">{task.title}</h4>
                            {task.description && (
                                <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                            )}
                            {task.evidence_url && (
                                <img src={task.evidence_url} alt="Evidencia" className="w-full h-32 object-cover rounded-lg mt-3" />
                            )}
                            <p className="text-xs text-emerald-600 mt-2 font-semibold">
                                Completada: {task.completed_at ? new Date(task.completed_at).toLocaleDateString('es-CL') : '-'}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {tasks.length === 0 && (
                <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                    <Icon name="check-circle" size={48} className="text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600 font-semibold">No tienes tareas asignadas</p>
                </div>
            )}
        </div>
    );
};
