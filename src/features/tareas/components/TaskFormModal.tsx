import { useState, useEffect } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import { useTerminalStore } from '../../../shared/state/terminalStore';
import { terminalOptions } from '../../../shared/utils/terminal';
import { TerminalCode } from '../../../shared/types/terminal';
import { useCreateTask, useUpdateTask, useStaffForAssignment } from '../hooks';
import { TaskFormValues, Task, TaskPriority, TASK_PRIORITY_OPTIONS } from '../types';

interface TaskFormModalProps {
    task?: Task;
    onClose: () => void;
    onSuccess: () => void;
}

export const TaskFormModal = ({ task, onClose, onSuccess }: TaskFormModalProps) => {
    const terminalContext = useTerminalStore((s) => s.context);
    const createMutation = useCreateTask();
    const updateMutation = useUpdateTask();
    const staffQuery = useStaffForAssignment();

    const [formData, setFormData] = useState<TaskFormValues>({
        title: '',
        description: '',
        terminal_code: (terminalContext.mode === 'TERMINAL' ? terminalContext.value : 'EL_ROBLE') as TerminalCode,
        priority: 'MEDIA',
        assigned_to_name: '',
        assigned_to_email: '',
        due_at: '',
        period_start: '',
        period_end: '',
    });

    const [staffSearch, setStaffSearch] = useState('');
    const [showStaffDropdown, setShowStaffDropdown] = useState(false);

    useEffect(() => {
        if (task) {
            setFormData({
                title: task.title,
                description: task.description || '',
                terminal_code: task.terminal_code,
                priority: task.priority,
                assigned_to_staff_id: task.assigned_to_staff_id || undefined,
                assigned_to_name: task.assigned_to_name,
                assigned_to_email: task.assigned_to_email || '',
                due_at: task.due_at?.slice(0, 16) || '',
                period_start: task.period_start || '',
                period_end: task.period_end || '',
            });
        }
    }, [task]);

    const filteredStaff = (staffQuery.data || [])
        .filter(s => s.nombre.toLowerCase().includes(staffSearch.toLowerCase()))
        .slice(0, 8);

    const handleSelectStaff = (staff: { id: string; nombre: string; email: string | null }) => {
        setFormData(prev => ({
            ...prev,
            assigned_to_staff_id: staff.id,
            assigned_to_name: staff.nombre,
            assigned_to_email: staff.email || '',
        }));
        setStaffSearch('');
        setShowStaffDropdown(false);
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        try {
            if (task) {
                await updateMutation.mutateAsync({ id: task.id, values: formData });
            } else {
                await createMutation.mutateAsync(formData);
            }
            onSuccess();
        } catch (err) {
            console.error('Error saving task:', err);
        }
    };

    const isValid = formData.title && formData.assigned_to_name && formData.terminal_code;
    const isLoading = createMutation.isPending || updateMutation.isPending;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden animate-scale-in">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-50 text-brand-600">
                            <Icon name={task ? 'edit' : 'plus'} size={20} />
                        </span>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 leading-tight">{task ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
                            <p className="text-xs text-slate-500">{task ? 'Actualiza los datos de la tarea' : 'Crea y asigna una nueva tarea'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
                        <Icon name="x" size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5">
                    <div className="space-y-4">
                        <div>
                            <label className="label">Título</label>
                            <input
                                type="text"
                                className="input"
                                value={formData.title}
                                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Descripción breve de la tarea"
                                required
                            />
                        </div>

                        <div>
                            <label className="label">Descripción</label>
                            <textarea
                                className="input min-h-[80px]"
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Detalles adicionales..."
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="label">Terminal</label>
                                <select
                                    className="input"
                                    value={formData.terminal_code}
                                    onChange={(e) => setFormData(prev => ({ ...prev, terminal_code: e.target.value as TerminalCode }))}
                                    required
                                >
                                    {terminalOptions.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="label">Prioridad</label>
                                <select
                                    className="input"
                                    value={formData.priority}
                                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as TaskPriority }))}
                                >
                                    {TASK_PRIORITY_OPTIONS.map(p => (
                                        <option key={p.value} value={p.value}>{p.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="label">Asignar a</label>
                            <div className="relative">
                                {formData.assigned_to_name && (
                                    <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 bg-brand-100 text-brand-800 rounded-full text-sm">
                                        <Icon name="user" size={14} />
                                        <span>{formData.assigned_to_name}</span>
                                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, assigned_to_staff_id: undefined, assigned_to_name: '', assigned_to_email: '' }))} className="hover:text-brand-600">
                                            <Icon name="x" size={14} />
                                        </button>
                                    </div>
                                )}
                                <input
                                    type="text"
                                    className="input"
                                    value={staffSearch}
                                    onChange={(e) => { setStaffSearch(e.target.value); setShowStaffDropdown(true); }}
                                    onFocus={() => setShowStaffDropdown(true)}
                                    placeholder="Buscar personal..."
                                />
                                {showStaffDropdown && filteredStaff.length > 0 && (
                                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {filteredStaff.map(staff => (
                                            <button
                                                key={staff.id}
                                                type="button"
                                                onClick={() => handleSelectStaff(staff)}
                                                className="w-full px-4 py-2 text-left hover:bg-slate-50 border-b last:border-b-0"
                                            >
                                                <div className="font-medium text-sm">{staff.nombre}</div>
                                                <div className="text-xs text-slate-500">{staff.cargo} - {staff.terminal_code}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="label">Correo del asignado (opcional)</label>
                            <input
                                type="email"
                                className="input"
                                value={formData.assigned_to_email}
                                onChange={(e) => setFormData(prev => ({ ...prev, assigned_to_email: e.target.value }))}
                                placeholder="correo@ejemplo.cl"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="label">Vencimiento</label>
                                <input
                                    type="datetime-local"
                                    className="input"
                                    value={formData.due_at}
                                    onChange={(e) => setFormData(prev => ({ ...prev, due_at: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="label">Periodo desde</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={formData.period_start}
                                    onChange={(e) => setFormData(prev => ({ ...prev, period_start: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="label">Periodo hasta</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={formData.period_end}
                                    onChange={(e) => setFormData(prev => ({ ...prev, period_end: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>

                </form>

                <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50">
                    <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
                    <button type="button" onClick={() => handleSubmit()} disabled={!isValid || isLoading} className="btn btn-primary">
                        {isLoading ? 'Guardando...' : task ? 'Actualizar' : 'Crear Tarea'}
                    </button>
                </div>
            </div>
        </div>
    );
};
