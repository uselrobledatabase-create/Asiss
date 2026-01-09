export interface Checkpoint {
    id: number;
    label: string;
    icon?: string; // Icon name from Lucide
}

export interface InspeccionData {
    ppu: string;
    terminal_id: string;
    fiscalizador: string;
    registrador: string; // If different from fiscalizador
    fecha: Date;
    detalles: {
        [key: number]: {
            cumple: boolean | null; // null represents unselected
            observacion?: string;
        };
    };
}

export const ICA_CHECKPOINTS: Checkpoint[] = [
    { id: 1, label: 'Estado general del bus' },
    { id: 2, label: 'Limpieza interior' },
    { id: 3, label: 'Limpieza exterior' },
    { id: 4, label: 'Estado de asientos' },
    { id: 5, label: 'Funcionamiento de puertas' },
    { id: 6, label: 'Estado de ventanas' },
    { id: 7, label: 'Sistema de iluminación' },
    { id: 8, label: 'Estado de pasamanos' },
    { id: 9, label: 'Limpieza de baños' },
    { id: 10, label: 'Señalética visible' },
];
