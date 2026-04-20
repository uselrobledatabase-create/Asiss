import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    fetchInspecciones,
    fetchAllInspecciones,
    fetchFlotaPPUs,
    saveInspeccion,
    InspeccionesFilters,
} from './api';
import { InspeccionICAInsert } from './types';

const QK = {
    all: ['inspeccion_ica'] as const,
    list: (f?: InspeccionesFilters) => [...QK.all, 'list', f ?? {}] as const,
    allExport: () => [...QK.all, 'export'] as const,
    flotaPPUs: (search: string) => ['flota_ppus', search] as const,
};

export const useInspecciones = (filters?: InspeccionesFilters) =>
    useQuery({
        queryKey: QK.list(filters),
        queryFn: () => fetchInspecciones(filters),
    });

export const useAllInspecciones = () =>
    useQuery({
        queryKey: QK.allExport(),
        queryFn: fetchAllInspecciones,
        staleTime: 30_000,
    });

export const useFlotaPPUs = (search: string) =>
    useQuery({
        queryKey: QK.flotaPPUs(search),
        queryFn: () => fetchFlotaPPUs(search),
        enabled: search.length >= 2,
        staleTime: 60_000,
    });

export const useSaveInspeccion = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: InspeccionICAInsert) => saveInspeccion(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: QK.all }),
    });
};
