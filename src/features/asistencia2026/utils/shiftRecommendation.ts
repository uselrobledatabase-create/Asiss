/**
 * Motor de recomendación de turnos.
 *
 * Los turnos rotativos trabajan en pares complementarios (PRINCIPAL /
 * CONTRATURNO) para que siempre haya personal:
 * - 5x2 Super:    Sem1 Mié+Dom libre · Sem2 Jue+Vie libre (y su inverso)
 * - 5x2 Rotativo: Sem1 Mié+Dom libre · Sem2 Vie+Sáb libre (y su inverso)
 * - Supervisor Relevo: patrón propio de jefaturas
 *
 * Este motor compara la dotación REAL que ya tiene cada combinación
 * dentro del mismo grupo (terminal + familia de cargo + jornada) y
 * recomienda la combinación MÁS DÉBIL (con menos personal), para que
 * las nuevas asignaciones equilibren la cobertura.
 * El 5x2 Fijo (Lun-Vie) queda disponible solo para casos especiales.
 */

import { StaffWithShift, ShiftTypeCode, VariantCode } from '../types';

export interface ShiftComboStats {
    shiftType: ShiftTypeCode;
    variant: VariantCode;
    label: string;
    offDaysDesc: string;
    count: number;        // personas del grupo con esta combinación
    people: string[];     // nombres (para tooltip/detalle)
}

export interface ShiftRecommendation {
    /** Combos rotativos ordenados del más débil al más cubierto */
    combos: ShiftComboStats[];
    /** El combo más descubierto (recomendado) */
    recommended: ShiftComboStats | null;
    /** Personas del grupo de comparación (sin incluir al trabajador) */
    totalPeers: number;
    /** Peers sin ningún turno asignado */
    unassigned: number;
    /** Peers en 5x2 Fijo (casos especiales) */
    fijoCount: number;
    /** Peers con plantilla Especial manual */
    especialCount: number;
    /** Descripción del grupo comparado */
    scopeLabel: string;
}

const CARGO_FAMILIES = ['SUPERVISOR', 'INSPECTOR', 'CONDUCTOR', 'PLANILLERO', 'CLEANER', 'MOVILIZADOR'] as const;

function cargoFamily(cargo: string): string {
    const upper = (cargo || '').toUpperCase();
    return CARGO_FAMILIES.find((f) => upper.includes(f)) || upper.trim() || 'OTRO';
}

/** Jornada según la ficha: Noche → NOCHE; Mañana/Tarde/Rotativo → DIA */
function jornadaFicha(turno: string | undefined): 'DIA' | 'NOCHE' {
    return (turno || '').toUpperCase().includes('NOCHE') ? 'NOCHE' : 'DIA';
}

interface ComboDef {
    shiftType: ShiftTypeCode;
    variant: VariantCode;
    label: string;
    offDaysDesc: string;
    soloSupervisores?: boolean;
}

const ROTATING_COMBOS: ComboDef[] = [
    {
        shiftType: '5X2_SUPER', variant: 'PRINCIPAL',
        label: '5x2 Super · Normal',
        offDaysDesc: 'Sem 1: Mié+Dom libre · Sem 2: Jue+Vie libre',
    },
    {
        shiftType: '5X2_SUPER', variant: 'CONTRATURNO',
        label: '5x2 Super · Contraturno',
        offDaysDesc: 'Sem 1: Jue+Vie libre · Sem 2: Mié+Dom libre',
    },
    {
        shiftType: '5X2_ROTATIVO', variant: 'PRINCIPAL',
        label: '5x2 Rotativo · Normal',
        offDaysDesc: 'Sem 1: Mié+Dom libre · Sem 2: Vie+Sáb libre',
    },
    {
        shiftType: '5X2_ROTATIVO', variant: 'CONTRATURNO',
        label: '5x2 Rotativo · Contraturno',
        offDaysDesc: 'Sem 1: Vie+Sáb libre · Sem 2: Mié+Dom libre',
    },
    {
        shiftType: 'SUPERVISOR_RELEVO', variant: 'PRINCIPAL',
        label: 'Supervisor Relevo',
        offDaysDesc: 'Sem 1: Mié+Dom libre · Sem 2: Mié+Vie+Sáb libre',
        soloSupervisores: true,
    },
];

export function buildShiftRecommendation(
    target: Pick<StaffWithShift, 'id' | 'cargo' | 'terminal_code' | 'turno'>,
    allStaff: StaffWithShift[]
): ShiftRecommendation {
    const family = cargoFamily(target.cargo);
    const jornada = jornadaFicha(target.turno);

    // Grupo de comparación: mismo terminal + misma familia de cargo + misma jornada
    const peers = allStaff.filter(
        (s) =>
            s.id !== target.id &&
            s.status === 'ACTIVO' &&
            s.terminal_code === target.terminal_code &&
            cargoFamily(s.cargo) === family &&
            jornadaFicha(s.turno) === jornada
    );

    const isSupervisor = family === 'SUPERVISOR';
    const combosDef = ROTATING_COMBOS.filter((c) => !c.soloSupervisores || isSupervisor);

    const combos: ShiftComboStats[] = combosDef.map((def) => {
        const inCombo = peers.filter((p) =>
            def.shiftType === 'SUPERVISOR_RELEVO'
                // Relevo no distingue variante en los datos históricos
                ? p.shift?.shift_type_code === def.shiftType
                : p.shift?.shift_type_code === def.shiftType &&
                p.shift?.variant_code === def.variant
        );
        return {
            shiftType: def.shiftType,
            variant: def.variant,
            label: def.label,
            offDaysDesc: def.offDaysDesc,
            count: inCombo.length,
            people: inCombo.map((p) => p.nombre),
        };
    });

    // Orden: más débil primero; en empate, priorizar contraturnos de Super
    // (mantener pares balanceados) según el orden declarado
    const sorted = [...combos].sort((a, b) => a.count - b.count);

    const unassigned = peers.filter((p) => !p.shift).length;
    const fijoCount = peers.filter((p) => p.shift?.shift_type_code === '5X2_FIJO').length;
    const especialCount = peers.filter((p) => p.shift?.shift_type_code === 'ESPECIAL').length;

    return {
        combos: sorted,
        recommended: sorted[0] ?? null,
        totalPeers: peers.length,
        unassigned,
        fijoCount,
        especialCount,
        scopeLabel: `${family} · ${jornada === 'NOCHE' ? 'Noche' : 'Día'} · ${target.terminal_code.replace(/_/g, ' ')}`,
    };
}
