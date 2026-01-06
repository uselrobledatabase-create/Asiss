import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
    fetchSrlRequests,
    createSrlRequest,
    updateSrlRequest,
    fetchBusImages,
    uploadBusImage,
    fetchSrlEmailSettings,
    updateSrlEmailSettings,
    subscribeToSrlChanges
} from './api/srlApi';
import { SrlFilters, SrlRequest, SrlRequestBus, SrlEmailSetting } from './types';
import { useToastStore } from '../../shared/state/toastStore';

// ==========================================
// QUERY KEYS
// ==========================================

export const srlKeys = {
    all: ['srl'] as const,
    requests: (filters?: SrlFilters) => [...srlKeys.all, 'requests', filters] as const,
    request: (id: string) => [...srlKeys.all, 'request', id] as const,
    busImages: (busId: string) => [...srlKeys.all, 'busImages', busId] as const,
    settings: () => [...srlKeys.all, 'settings'] as const,
};

// ==========================================
// QUERIES
// ==========================================

export const useSrlRequests = (filters?: SrlFilters) => {
    return useQuery({
        queryKey: srlKeys.requests(filters),
        queryFn: () => fetchSrlRequests(filters),
    });
};

export const useBusImages = (busId: string) => {
    return useQuery({
        queryKey: srlKeys.busImages(busId),
        queryFn: () => fetchBusImages(busId),
        enabled: !!busId,
    });
};

export const useSrlEmailSettings = () => {
    return useQuery({
        queryKey: srlKeys.settings(),
        queryFn: fetchSrlEmailSettings,
    });
};

// ==========================================
// MUTATIONS
// ==========================================

export const useCreateSrlRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ request, buses }: { request: Partial<SrlRequest>, buses: { ppu: string; problem: string; images: File[] }[] }) =>
            createSrlRequest(request, buses),
        onSuccess: () => {
            // ...
            queryClient.invalidateQueries({ queryKey: srlKeys.requests() });
        },
    });
};

export const useUpdateSrlRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, updates }: { id: string, updates: Partial<SrlRequest> }) =>
            updateSrlRequest(id, updates),
        onSuccess: () => {
            // Invalidate all requests to update table, and specific request detail
            queryClient.invalidateQueries({ queryKey: srlKeys.requests() });
        },
    });
};

export const useUploadBusImage = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ busId, file }: { busId: string, file: File }) =>
            uploadBusImage(busId, file),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: srlKeys.busImages(variables.busId) });
        },
    });
};

export const useUpdateSrlEmailSettings = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (settings: Partial<SrlEmailSetting>) =>
            updateSrlEmailSettings(settings),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: srlKeys.settings() });
        },
    });
};

// ==========================================
// REALTIME
// ==========================================

export const useSrlRealtime = () => {
    const queryClient = useQueryClient();
    const { addToast } = useToastStore();

    useEffect(() => {
        const unsubscribe = subscribeToSrlChanges(() => {
            console.log('SRL Realtime Update');
            // Optimistic strategy: Refetch everything for now
            // Ideally we'd be more granular, but 'requests' is the main view
            queryClient.invalidateQueries({ queryKey: srlKeys.requests() });

            addToast({
                type: 'info',
                title: 'Actualización en tiempo real',
                message: 'Se ha detectado un cambio en las solicitudes. La lista se ha actualizado automáticamente.'
            });
        });

        return unsubscribe;
    }, [queryClient, addToast]);
};
