export const AUTHORIZED_SUPERVISORS = [
    'ISAAC AVILA',
    'LEONEL CAYUQUEO',
    'CRISTIAN LURASCHI',
    'MARIO MILLANAO',
] as const;

export type AuthorizedSupervisorName = typeof AUTHORIZED_SUPERVISORS[number];

export const normalizeSupervisorName = (name: string): string => {
    return name
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
};

const AUTHORIZED_SUPERVISOR_SET = new Set(
    AUTHORIZED_SUPERVISORS.map((name) => normalizeSupervisorName(name))
);

export const isAuthorizedSupervisor = (supervisorName: string): boolean => {
    const normalized = normalizeSupervisorName(supervisorName);
    return AUTHORIZED_SUPERVISOR_SET.has(normalized);
};

export const assertAuthorizedSupervisor = (
    supervisorName: string,
    actionLabel: string = 'realizar esta acción'
): void => {
    if (isAuthorizedSupervisor(supervisorName)) return;

    throw new Error(
        `Acceso restringido. Solo ISAAC AVILA, LEONEL CAYUQUEO, CRISTIAN LURASCHI y MARIO MILLANAO pueden ${actionLabel}.`
    );
};
