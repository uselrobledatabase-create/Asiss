import { useState } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import { LoadingState } from '../../../shared/components/common/LoadingState';
import { displayTerminal } from '../../../shared/utils/terminal';
import {
    useTaskById,
    useComments,
    useAttachments,
    useAddComment,
    useUploadAttachment,
    useAddUrlAttachment,
    useDeleteAttachment,
    useUpdateTaskStatus,
    useEvaluateTask,
} from '../hooks';
import { useSessionStore } from '../../../shared/state/sessionStore';
import { isTaskManager, isTaskAssigned, getAllowedTransitions } from '../utils/permissions';
import { Task, TaskStatus, getStatusColor, getPriorityColor } from '../types';
import { getAttachmentUrl } from '../api/tasksApi';
import { EvaluateModal } from '../components/EvaluateModal';
import { CompleteTaskModal } from '../components/CompleteTaskModal';

interface TaskWorkspaceProps {
    taskId: string;
    onClose: () => void;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
    PENDIENTE: 'Pendiente',
    EN_CURSO: 'En curso',
    TERMINADO: 'Terminado',
    EVALUADO: 'Evaluado',
    RECHAZADO: 'Rechazado',
};

export const TaskWorkspace = ({ taskId, onClose }: TaskWorkspaceProps) => {
    const session = useSessionStore((s) => s.session);
    const supervisorName = session?.supervisorName ?? '';
    const canManage = isTaskManager(supervisorName);

    const [activeSection, setActiveSection] = useState<'info' | 'comments' | 'attachments'>('info');
    const [newComment, setNewComment] = useState('');
    const [showEvaluate, setShowEvaluate] = useState<'accept' | 'reject' | null>(null);
    const [showComplete, setShowComplete] = useState(false);
    const [urlInput, setUrlInput] = useState({ url: '', label: '' });

    const taskQuery = useTaskById(taskId);
    const commentsQuery = useComments(taskId);
    const attachmentsQuery = useAttachments(taskId);
    const addCommentMutation = useAddComment();
    const uploadMutation = useUploadAttachment();
    const addUrlMutation = useAddUrlAttachment();
    const deleteAttachmentMutation = useDeleteAttachment();
    const statusMutation = useUpdateTaskStatus();
    const evaluateMutation = useEvaluateTask();

    const task = taskQuery.data;

    const isAssigned = task ? isTaskAssigned(supervisorName, task.assigned_to_name) : false;
    const allowedTransitions = task ? getAllowedTransitions(task.status, canManage, isAssigned) : [];

    const handleStatusChange = async (status: TaskStatus) => {
        await statusMutation.mutateAsync({ id: taskId, status });
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        await addCommentMutation.mutateAsync({ taskId, body: newComment });
        setNewComment('');
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await uploadMutation.mutateAsync({ taskId, file });
        e.target.value = '';
    };

    const handleAddUrl = async () => {
        if (!urlInput.url.trim()) return;
        await addUrlMutation.mutateAsync({ taskId, url: urlInput.url, label: urlInput.label || urlInput.url });
        setUrlInput({ url: '', label: '' });
    };

    const handleDownloadFile = async (storagePath: string) => {
        const url = await getAttachmentUrl(storagePath);
        window.open(url, '_blank');
    };

    const handleEvaluate = async (accepted: boolean, note?: string, reason?: string) => {
        await evaluateMutation.mutateAsync({ id: taskId, accepted, note, reason });
        setShowEvaluate(null);
    };

    if (taskQuery.isLoading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                <LoadingState label="Cargando tarea..." />
            </div>
        );
    }

    if (!task) return null;

    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString('es-CL');
    const isOverdue = task.due_at ? new Date(task.due_at) < new Date() && !['EVALUADO', 'RECHAZADO'].includes(task.status) : false;

    const quickTransitions = allowedTransitions.filter(
        (s) => s !== task.status && !['TERMINADO', 'EVALUADO', 'RECHAZADO'].includes(s)
    ) as TaskStatus[];
    const canComplete = allowedTransitions.includes('TERMINADO') && task.status !== 'TERMINADO';

    const sections = [
        { id: 'info', label: 'Información', icon: 'info' as const },
        { id: 'comments', label: 'Comentarios', icon: 'clipboard' as const, badge: commentsQuery.data?.length },
        { id: 'attachments', label: 'Adjuntos', icon: 'file' as const, badge: attachmentsQuery.data?.length },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-3xl max-h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getStatusColor(task.status)}`}>
                                    {STATUS_LABELS[task.status]}
                                </span>
                                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${getPriorityColor(task.priority)}`}>
                                    {task.priority}
                                </span>
                                {isOverdue && (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">
                                        <Icon name="alert-triangle" size={12} /> Vencida
                                    </span>
                                )}
                            </div>
                            <h2 className="text-lg font-bold text-slate-900 leading-snug truncate">{task.title}</h2>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg shrink-0">
                            <Icon name="x" size={20} />
                        </button>
                    </div>

                    {/* Action bar */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                        {quickTransitions.map((status) => (
                            <button
                                key={status}
                                onClick={() => handleStatusChange(status)}
                                disabled={statusMutation.isPending}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                            >
                                <Icon name="activity" size={14} /> Mover a {STATUS_LABELS[status]}
                            </button>
                        ))}
                        {canComplete && (
                            <button
                                onClick={() => setShowComplete(true)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                            >
                                <Icon name="check-circle" size={15} /> Completar tarea
                            </button>
                        )}
                        {canManage && task.status === 'TERMINADO' && (
                            <>
                                <button onClick={() => setShowEvaluate('accept')} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700">
                                    <Icon name="check-circle" size={15} /> Aprobar
                                </button>
                                <button onClick={() => setShowEvaluate('reject')} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700">
                                    <Icon name="x-circle" size={15} /> Rechazar
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-100">
                    {sections.map((s) => (
                        <button
                            key={s.id}
                            onClick={() => setActiveSection(s.id as typeof activeSection)}
                            className={`relative flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeSection === s.id ? 'text-brand-600' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <Icon name={s.icon} size={16} />
                            {s.label}
                            {!!s.badge && (
                                <span className="rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-slate-600">{s.badge}</span>
                            )}
                            {activeSection === s.id && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {activeSection === 'info' && (
                        <div className="space-y-4">
                            {task.description && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Descripción</div>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{task.description}</p>
                                </div>
                            )}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <InfoCard icon="building" label="Terminal" value={displayTerminal(task.terminal_code)} />
                                <InfoCard icon="user" label="Asignado a" value={task.assigned_to_name} />
                                <InfoCard icon="calendar" label="Vencimiento" value={task.due_at ? formatDate(task.due_at) : 'Sin fecha'} highlight={isOverdue} />
                                <InfoCard icon="user" label="Creado por" value={task.created_by_supervisor} />
                            </div>
                            {task.evaluated_by && (
                                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-green-700">Evaluado por</div>
                                    <div className="font-medium text-slate-800 mt-0.5">{task.evaluated_by}{task.evaluated_at ? ` · ${formatDate(task.evaluated_at)}` : ''}</div>
                                    {task.evaluation_note && <p className="text-sm text-slate-600 mt-1">{task.evaluation_note}</p>}
                                </div>
                            )}
                            {task.rejected_reason && (
                                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-red-600">Motivo de rechazo</div>
                                    <p className="text-red-700 mt-1 text-sm">{task.rejected_reason}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeSection === 'comments' && (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <textarea
                                    className="input flex-1 min-h-[72px] resize-none"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Agregar comentario o actualización..."
                                />
                                <button onClick={handleAddComment} disabled={!newComment.trim() || addCommentMutation.isPending} className="btn btn-primary self-end">
                                    <Icon name="send" size={16} />
                                </button>
                            </div>
                            <div className="space-y-3">
                                {(commentsQuery.data || []).length === 0 && (
                                    <p className="text-center text-sm text-slate-400 py-6">Aún no hay comentarios.</p>
                                )}
                                {(commentsQuery.data || []).map((comment) => (
                                    <div key={comment.id} className="rounded-xl border border-slate-200 bg-white p-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-semibold text-slate-700">{comment.author_name}</span>
                                            <span className="text-xs text-slate-400">{new Date(comment.created_at).toLocaleString('es-CL')}</span>
                                        </div>
                                        <p className="mt-1.5 text-sm text-slate-600 whitespace-pre-wrap">{comment.body}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeSection === 'attachments' && (
                        <div className="space-y-4">
                            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-sm font-medium text-slate-500 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600 transition-colors">
                                <Icon name="upload" size={18} />
                                {uploadMutation.isPending ? 'Subiendo...' : 'Subir archivo (PDF, imagen, Excel...)'}
                                <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx,.csv" onChange={handleFileUpload} disabled={uploadMutation.isPending} />
                            </label>

                            <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row">
                                <input type="url" className="input flex-1" placeholder="Pegar enlace (URL)" value={urlInput.url} onChange={(e) => setUrlInput((p) => ({ ...p, url: e.target.value }))} />
                                <input type="text" className="input flex-1" placeholder="Etiqueta (opcional)" value={urlInput.label} onChange={(e) => setUrlInput((p) => ({ ...p, label: e.target.value }))} />
                                <button onClick={handleAddUrl} disabled={!urlInput.url} className="btn btn-secondary shrink-0">
                                    <Icon name="plus" size={16} /> Agregar
                                </button>
                            </div>

                            <div className="space-y-2">
                                {(attachmentsQuery.data || []).length === 0 && (
                                    <p className="text-center text-sm text-slate-400 py-6">Sin adjuntos.</p>
                                )}
                                {(attachmentsQuery.data || []).map((att) => (
                                    <div key={att.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 shrink-0">
                                                <Icon name={att.type === 'URL' ? 'activity' : 'file'} size={18} />
                                            </span>
                                            <div className="min-w-0">
                                                <div className="font-medium text-sm text-slate-800 truncate">{att.file_name}</div>
                                                {att.size_bytes && <div className="text-xs text-slate-500">{(att.size_bytes / 1024).toFixed(1)} KB</div>}
                                            </div>
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            {att.type === 'FILE' && att.storage_path && (
                                                <button onClick={() => handleDownloadFile(att.storage_path!)} className="btn btn-ghost btn-icon" title="Abrir">
                                                    <Icon name="eye" size={16} />
                                                </button>
                                            )}
                                            {att.type === 'URL' && att.url && (
                                                <a href={att.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-icon" title="Abrir">
                                                    <Icon name="eye" size={16} />
                                                </a>
                                            )}
                                            <button onClick={() => deleteAttachmentMutation.mutate({ id: att.id, storagePath: att.storage_path, taskId })} className="btn btn-ghost btn-icon text-red-500" title="Eliminar">
                                                <Icon name="trash" size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showEvaluate && (
                <EvaluateModal
                    mode={showEvaluate}
                    taskTitle={task.title}
                    onConfirm={(note, reason) => handleEvaluate(showEvaluate === 'accept', note, reason)}
                    onCancel={() => setShowEvaluate(null)}
                    isLoading={evaluateMutation.isPending}
                />
            )}

            {showComplete && (
                <CompleteTaskModal
                    task={task}
                    onClose={() => setShowComplete(false)}
                    onCompleted={() => setShowComplete(false)}
                />
            )}
        </div>
    );
};

const InfoCard = ({ icon, label, value, highlight }: { icon: Parameters<typeof Icon>[0]['name']; label: string; value: string; highlight?: boolean }) => (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Icon name={icon} size={13} /> {label}
        </div>
        <div className={`mt-1 font-medium ${highlight ? 'text-red-700' : 'text-slate-800'}`}>{value}</div>
    </div>
);
