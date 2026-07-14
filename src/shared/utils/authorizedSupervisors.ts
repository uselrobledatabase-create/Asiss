export const AUTHORIZED_SUPERVISORS = [
    'ISAAC AVILA',
    'LEONEL CAYUQUEO',
    'CRISTIAN LURASCHI',
    'MARIO MILLANAO',
    'VIVIANA VERGARA',
    'VIOLETA HERNANDEZ',
    'JUAN AMPUERO',
    'JHON CARRASCO',
    'BENJAMIN ALVAREZ',
] as const;

const LOGIN_PASSWORD = 'RBU2026.';

export type AuthorizedSupervisorName = typeof AUTHORIZED_SUPERVISORS[number];

export const normalizeSupervisorName = (name: string): string => {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
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

export const isValidLoginPassword = (password: string): boolean => password === LOGIN_PASSWORD;

export const assertValidLoginCredentials = (supervisorName: string, password: string): void => {
    if (!isAuthorizedSupervisor(supervisorName)) {
        throw new Error(
            'Acceso restringido. El nombre ingresado no está autorizado para acceder al sistema.'
        );
    }

    if (!isValidLoginPassword(password)) {
        throw new Error('Contraseña incorrecta. Verifique la clave de acceso.');
    }
};

export const assertAuthorizedSupervisor = (
    supervisorName: string,
    actionLabel: string = 'realizar esta acción'
): void => {
    if (isAuthorizedSupervisor(supervisorName)) return;

    throw new Error(
        `Acceso restringido. Solo el personal supervisor autorizado puede ${actionLabel}.`
    );
};
