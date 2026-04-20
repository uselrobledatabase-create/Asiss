import { SessionInfo, SessionService } from '../types/session';
import { TerminalCode } from '../types/terminal';

let inMemorySession: SessionInfo | null = null;

const createSession = (supervisorName: string, terminalCode: TerminalCode | null): SessionInfo => ({
  supervisorName,
  terminalCode,
  startedAt: new Date().toISOString(),
});

export const sessionService: SessionService = {
  startSession: async (supervisorName, terminalCode) => {
    inMemorySession = createSession(supervisorName, terminalCode);
    return inMemorySession;
  },
  getSession: async () => inMemorySession,
  logout: async () => {
    inMemorySession = null;
  },
};
