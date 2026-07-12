import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertAuthorizedSupervisor } from '../../shared/utils/authorizedSupervisors';
import { useTerminalStore } from '../../shared/state/terminalStore';
import { useSessionStore } from '../../shared/state/sessionStore';
import {
    fetchMeetings,
    fetchMeetingById,
    createMeeting,
    updateMeeting,
    updateMeetingStatus,
    updateMinutes,
    fetchInvitees,
    addInvitees,
    removeInvitee,
    fetchFiles,
    uploadFile,
    deleteFile,
    fetchActions,
    createAction,
    updateAction,
    deleteAction,
    fetchEmailSettings,
    upsertEmailSettings,
    sendMeetingInvitation,
    fetchSupervisors,
} from './api/meetingsApi';
import { MeetingFilters, MeetingFormValues, ActionFormValues, InviteeInput, MeetingEmailSettings, ActionStatus } from './types';

const meetingKeys = {
    all: ['meetings'] as const,
    list: (terminalCode: string, filters?: MeetingFilters) => [...meetingKeys.all, 'list', terminalCode, filters] as const,
    detail: (id: string) => [...meetingKeys.all, 'detail', id] as const,
    invitees: (meetingId: string) => [...meetingKeys.all, 'invitees', meetingId] as const,
    files: (meetingId: string) => [...meetingKeys.all, 'files', meetingId] as const,
    actions: (meetingId: string) => [...meetingKeys.all, 'actions', meetingId] as const,
    supervisors: ['supervisors'] as const,
    emailSettings: (scope: string) => [...meetingKeys.all, 'emailSettings', scope] as const,
};

const requireMeetingManager = (supervisorName: string, actionLabel: string) => {
    assertAuthorizedSupervisor(supervisorName, actionLabel);
    return supervisorName;
};

// ==========================================
// MEETINGS
// ==========================================

export const useMeetings = (filters?: MeetingFilters) => {
    const terminalContext = useTerminalStore((s) => s.context);
    const terminalKey = terminalContext.mode === 'ALL' ? 'ALL' : terminalContext.value || 'ALL';

    return useQuery({
        queryKey: meetingKeys.list(terminalKey, filters),
        queryFn: () => fetchMeetings(terminalContext, filters),
    });
};

export const useMeetingById = (id: string | null) => {
    return useQuery({
        queryKey: meetingKeys.detail(id || ''),
        queryFn: () => fetchMeetingById(id!),
        enabled: !!id,
    });
};

export const useCreateMeeting = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: (values: MeetingFormValues) =>
            createMeeting(values, requireMeetingManager(session?.supervisorName || '', 'crear reuniones')),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: meetingKeys.all });
        },
    });
};

export const useUpdateMeeting = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: ({ id, values }: { id: string; values: Partial<MeetingFormValues> }) => {
            requireMeetingManager(session?.supervisorName || '', 'editar reuniones');
            return updateMeeting(id, values);
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: meetingKeys.all });
            queryClient.invalidateQueries({ queryKey: meetingKeys.detail(id) });
        },
    });
};

export const useUpdateMeetingStatus = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: ({ id, status, reason }: { id: string; status: 'REALIZADA' | 'CANCELADA'; reason?: string }) => {
            requireMeetingManager(
                session?.supervisorName || '',
                status === 'REALIZADA' ? 'marcar reuniones como realizadas' : 'cancelar reuniones'
            );
            return updateMeetingStatus(id, status, reason);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: meetingKeys.all });
        },
    });
};

export const useUpdateMinutes = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: ({ id, minutes }: { id: string; minutes: string }) => {
            requireMeetingManager(session?.supervisorName || '', 'editar minutas de reuniones');
            return updateMinutes(id, minutes);
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: meetingKeys.detail(id) });
        },
    });
};

// ==========================================
// INVITEES
// ==========================================

export const useInvitees = (meetingId: string | null) => {
    return useQuery({
        queryKey: meetingKeys.invitees(meetingId || ''),
        queryFn: () => fetchInvitees(meetingId!),
        enabled: !!meetingId,
    });
};

export const useAddInvitees = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: ({ meetingId, invitees }: { meetingId: string; invitees: InviteeInput[] }) => {
            requireMeetingManager(session?.supervisorName || '', 'agregar invitados a reuniones');
            return addInvitees(meetingId, invitees);
        },
        onSuccess: (_, { meetingId }) => {
            queryClient.invalidateQueries({ queryKey: meetingKeys.invitees(meetingId) });
            queryClient.invalidateQueries({ queryKey: meetingKeys.all });
        },
    });
};

export const useRemoveInvitee = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: ({ id, meetingId }: { id: string; meetingId: string }) => {
            requireMeetingManager(session?.supervisorName || '', 'quitar invitados de reuniones');
            return removeInvitee(id);
        },
        onSuccess: (_, { meetingId }) => {
            queryClient.invalidateQueries({ queryKey: meetingKeys.invitees(meetingId) });
            queryClient.invalidateQueries({ queryKey: meetingKeys.all });
        },
    });
};

// ==========================================
// FILES
// ==========================================

export const useFiles = (meetingId: string | null) => {
    return useQuery({
        queryKey: meetingKeys.files(meetingId || ''),
        queryFn: () => fetchFiles(meetingId!),
        enabled: !!meetingId,
    });
};

export const useUploadFile = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: ({ meetingId, file }: { meetingId: string; file: File }) =>
            uploadFile(
                meetingId,
                file,
                requireMeetingManager(session?.supervisorName || '', 'subir archivos de reuniones')
            ),
        onSuccess: (_, { meetingId }) => {
            queryClient.invalidateQueries({ queryKey: meetingKeys.files(meetingId) });
            queryClient.invalidateQueries({ queryKey: meetingKeys.all });
        },
    });
};

export const useDeleteFile = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: ({ id, storagePath, meetingId }: { id: string; storagePath: string; meetingId: string }) => {
            requireMeetingManager(session?.supervisorName || '', 'eliminar archivos de reuniones');
            return deleteFile(id, storagePath);
        },
        onSuccess: (_, { meetingId }) => {
            queryClient.invalidateQueries({ queryKey: meetingKeys.files(meetingId) });
            queryClient.invalidateQueries({ queryKey: meetingKeys.all });
        },
    });
};

// ==========================================
// ACTIONS
// ==========================================

export const useActions = (meetingId: string | null) => {
    return useQuery({
        queryKey: meetingKeys.actions(meetingId || ''),
        queryFn: () => fetchActions(meetingId!),
        enabled: !!meetingId,
    });
};

export const useCreateAction = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: ({ meetingId, values }: { meetingId: string; values: ActionFormValues }) => {
            requireMeetingManager(session?.supervisorName || '', 'crear acuerdos de reuniones');
            return createAction(meetingId, values);
        },
        onSuccess: (_, { meetingId }) => {
            queryClient.invalidateQueries({ queryKey: meetingKeys.actions(meetingId) });
            queryClient.invalidateQueries({ queryKey: meetingKeys.all });
        },
    });
};

export const useUpdateAction = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: ({ id, meetingId, values }: { id: string; meetingId: string; values: Partial<ActionFormValues & { status: ActionStatus }> }) => {
            requireMeetingManager(session?.supervisorName || '', 'editar acuerdos de reuniones');
            return updateAction(id, values);
        },
        onSuccess: (_, { meetingId }) => {
            queryClient.invalidateQueries({ queryKey: meetingKeys.actions(meetingId) });
        },
    });
};

export const useDeleteAction = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: ({ id, meetingId }: { id: string; meetingId: string }) => {
            requireMeetingManager(session?.supervisorName || '', 'eliminar acuerdos de reuniones');
            return deleteAction(id);
        },
        onSuccess: (_, { meetingId }) => {
            queryClient.invalidateQueries({ queryKey: meetingKeys.actions(meetingId) });
            queryClient.invalidateQueries({ queryKey: meetingKeys.all });
        },
    });
};

// ==========================================
// SUPERVISORS
// ==========================================

export const useSupervisors = () => {
    return useQuery({
        queryKey: meetingKeys.supervisors,
        queryFn: fetchSupervisors,
        staleTime: 5 * 60 * 1000,
    });
};

// ==========================================
// EMAIL SETTINGS
// ==========================================

export const useEmailSettings = (scopeType: 'GLOBAL' | 'TERMINAL', scopeCode: string) => {
    return useQuery({
        queryKey: meetingKeys.emailSettings(`${scopeType}-${scopeCode}`),
        queryFn: () => fetchEmailSettings(scopeType, scopeCode),
    });
};

export const useUpsertEmailSettings = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: (settings: Omit<MeetingEmailSettings, 'id' | 'updated_at'>) => {
            requireMeetingManager(session?.supervisorName || '', 'configurar correos de reuniones');
            return upsertEmailSettings(settings);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: meetingKeys.all });
        },
    });
};

// ==========================================
// EMAIL SENDING
// ==========================================

export const useSendInvitations = () => {
    const queryClient = useQueryClient();
    const session = useSessionStore((s) => s.session);

    return useMutation({
        mutationFn: async ({ meetingId }: { meetingId: string }) => {
            requireMeetingManager(session?.supervisorName || '', 'reenviar invitaciones de reuniones');
            const meeting = await fetchMeetingById(meetingId);
            const invitees = await fetchInvitees(meetingId);
            if (meeting && invitees.length > 0) {
                await sendMeetingInvitation(meeting, invitees, session?.supervisorName || '');
            }
        },
        onSuccess: (_, { meetingId }) => {
            queryClient.invalidateQueries({ queryKey: meetingKeys.invitees(meetingId) });
        },
    });
};
