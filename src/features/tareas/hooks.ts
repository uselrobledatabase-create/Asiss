import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertAuthorizedSupervisor } from '../../shared/utils/authorizedSupervisors';
import { useTerminalStore } from '../../shared/state/terminalStore';
import { useSessionStore } from '../../shared/state/sessionStore';
import { broadcastActivity } from '../../shared/services/activityFeed';
import {
    fetchTasks,
    fetchTaskById,
    fetchTaskKPIs,
    createTask,
    updateTask,
    updateTaskStatus,
    evaluateTask,
    fetchComments,
    addComment,
    fetchAttachments,
    uploadAttachment,
    addUrlAttachment,
    deleteAttachment,
    fetchEmailSettings,
    upsertEmailSettings,
    fetchStaffForAssignment,
    completeTask,
} from './api/tasksApi';
import { TaskFilters, TaskFormValues, TaskStatus, TaskEmailSettings, Task } from './types';

const taskKeys = {
    all: ['tasks'] as const,
    list: (terminalCode: string, filters?: TaskFilters) => [...taskKeys.all, 'list', terminalCode, filters] as const,
    detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
    kpis: (terminalCode: string) => [...taskKeys.all, 'kpis', terminalCode] as const,
    comments: (taskId: string) => [...taskKeys.all, 'comments', taskId] as const,
    attachments: (taskId: string) => [...taskKeys.all, 'attachments', taskId] as const,
    staff: ['staff-for-assignment'] as const,
    emailSettings: (scope: string) => [...taskKeys.all, 'emailSettings', scope] as const,
};

const requireTaskManager = (supervisorName: string, actionLabel: string) => {
    assertAuthorizedSupervisor(supervisorName, actionLabel);
    return supervisorName;
};

// ==========================================
// TASKS
// ==========================================

export const useTasks = (filters?: TaskFilters) => {
    const terminalContext = useTerminalStore((s) => s.context);
    const session = useSessionStore((s) => s.session);
    const terminalKey = terminalContext.mode === 'ALL' ? 'ALL' : terminalContext.value || 'ALL';

    return useQuery({
        queryKey: taskKeys.list(terminalKey, filters),
        queryFn: () => fetchTasks(terminalContext, filters, session?.supervisorName),
    });
};

export const useTaskById = (id: string | null) => {
    return useQuery({
        queryKey: taskKeys.detail(id || ''),
        queryFn: () => fetchTaskById(id!),
        enabled: !!id,
    });
};

export const useTaskKPIs = () => {
    const terminalContext = useTerminalStore((s) => s.context);
    const terminalKey = terminalContext.mode === 'ALL' ? 'ALL' : terminalContext.value || 'ALL';

    return useQuery({
        queryKey: taskKeys.kpis(terminalKey),
        queryFn: () => fetchTaskKPIs(terminalContext),
    });
};

export const useCreateTask = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: (values: TaskFormValues) =>
            createTask(values, requireTaskManager(session?.supervisorName || '', 'crear tareas')),
        onSuccess: (_data, values) => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
            broadcastActivity({
                actor: session?.supervisorName || 'Alguien',
                accion: 'asignó la TAREA',
                objetivo: `"${values.title}"`,
                seccion: 'Tareas',
            });
        },
    });
};

export const useUpdateTask = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: ({ id, values }: { id: string; values: Partial<TaskFormValues> }) => {
            requireTaskManager(session?.supervisorName || '', 'editar tareas');
            return updateTask(id, values);
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
            queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
        },
    });
};

export const useUpdateTaskStatus = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
            updateTaskStatus(id, status, session?.supervisorName || ''),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
};

export const useEvaluateTask = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: ({ id, accepted, note, reason }: { id: string; accepted: boolean; note?: string; reason?: string }) =>
            evaluateTask(
                id,
                accepted,
                requireTaskManager(session?.supervisorName || '', accepted ? 'aprobar tareas' : 'rechazar tareas'),
                note,
                reason
            ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
};

export const useCompleteTask = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: ({ task, note, file, recipients }: { task: Task; note?: string; file?: File | null; recipients: string[] }) =>
            completeTask(task, session?.supervisorName || '', { note, file, recipients }),
        onSuccess: (_, { task }) => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
            queryClient.invalidateQueries({ queryKey: taskKeys.detail(task.id) });
            queryClient.invalidateQueries({ queryKey: taskKeys.attachments(task.id) });
            queryClient.invalidateQueries({ queryKey: taskKeys.comments(task.id) });
        },
    });
};

// ==========================================
// COMMENTS
// ==========================================

export const useComments = (taskId: string | null) => {
    return useQuery({
        queryKey: taskKeys.comments(taskId || ''),
        queryFn: () => fetchComments(taskId!),
        enabled: !!taskId,
    });
};

export const useAddComment = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: ({ taskId, body }: { taskId: string; body: string }) =>
            addComment(taskId, body, session?.supervisorName || ''),
        onSuccess: (_, { taskId }) => {
            queryClient.invalidateQueries({ queryKey: taskKeys.comments(taskId) });
        },
    });
};

// ==========================================
// ATTACHMENTS
// ==========================================

export const useAttachments = (taskId: string | null) => {
    return useQuery({
        queryKey: taskKeys.attachments(taskId || ''),
        queryFn: () => fetchAttachments(taskId!),
        enabled: !!taskId,
    });
};

export const useUploadAttachment = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: ({ taskId, file }: { taskId: string; file: File }) =>
            uploadAttachment(taskId, file, session?.supervisorName || ''),
        onSuccess: (_, { taskId }) => {
            queryClient.invalidateQueries({ queryKey: taskKeys.attachments(taskId) });
        },
    });
};

export const useAddUrlAttachment = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: ({ taskId, url, label }: { taskId: string; url: string; label: string }) =>
            addUrlAttachment(taskId, url, label, session?.supervisorName || ''),
        onSuccess: (_, { taskId }) => {
            queryClient.invalidateQueries({ queryKey: taskKeys.attachments(taskId) });
        },
    });
};

export const useDeleteAttachment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, storagePath, taskId }: { id: string; storagePath?: string | null; taskId: string }) =>
            deleteAttachment(id, storagePath),
        onSuccess: (_, { taskId }) => {
            queryClient.invalidateQueries({ queryKey: taskKeys.attachments(taskId) });
        },
    });
};

// ==========================================
// STAFF FOR ASSIGNMENT
// ==========================================

export const useStaffForAssignment = () => {
    return useQuery({
        queryKey: taskKeys.staff,
        queryFn: fetchStaffForAssignment,
        staleTime: 5 * 60 * 1000,
    });
};

// ==========================================
// EMAIL SETTINGS
// ==========================================

export const useTaskEmailSettings = (scopeType: 'GLOBAL' | 'TERMINAL', scopeCode: string) => {
    return useQuery({
        queryKey: taskKeys.emailSettings(`${scopeType}-${scopeCode}`),
        queryFn: () => fetchEmailSettings(scopeType, scopeCode),
    });
};

export const useUpsertTaskEmailSettings = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: (settings: Omit<TaskEmailSettings, 'id' | 'updated_at'>) => {
            requireTaskManager(session?.supervisorName || '', 'configurar correos de tareas');
            return upsertEmailSettings(settings);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
};
