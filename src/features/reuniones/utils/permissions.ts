/**
 * Permission utilities for Meetings module
 * Only authorized managers can create, edit, or cancel meetings
 */
import { isAuthorizedSupervisor } from '../../../shared/utils/authorizedSupervisors';

/**
 * Check if a user can manage meetings (create, edit, cancel)
 */
export const isMeetingManager = (supervisorName: string): boolean => {
    return isAuthorizedSupervisor(supervisorName);
};
