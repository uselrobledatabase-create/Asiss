import { TerminalCode } from '../../../shared/types/terminal';
import {
    AUTHORIZED_SUPERVISORS,
    isAuthorizedSupervisor,
    normalizeSupervisorName,
} from '../../../shared/utils/authorizedSupervisors';

/**
 * Authorized users who can approve/reject attendance records
 * Names are stored normalized (uppercase, trimmed, collapsed spaces)
 */
export const AUTHORIZERS = AUTHORIZED_SUPERVISORS;

export type AuthorizerName = typeof AUTHORIZERS[number];

/**
 * Terminal chiefs mapping
 * Used to auto-fill jefe_terminal when terminal is selected
 */
export const TERMINAL_CHIEFS: Partial<Record<TerminalCode, string>> = {
    EL_ROBLE: 'CRISTIAN LURASCHI',
    LA_REINA: 'CRISTIAN LURASCHI',
};

/**
 * Normalize a name for comparison
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Convert to uppercase
 */
export const normalizeName = (name: string): string => {
    return normalizeSupervisorName(name);
};

/**
 * Check if a supervisor is an authorized approver
 */
export const isAuthorizer = (supervisorName: string): boolean => {
    return isAuthorizedSupervisor(supervisorName);
};

/**
 * Get the terminal chief for a given terminal
 */
export const getTerminalChief = (terminalCode: TerminalCode): string => {
    return TERMINAL_CHIEFS[terminalCode] ?? '';
};
