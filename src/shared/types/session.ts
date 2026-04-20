import { TerminalCode } from './terminal';

export interface SessionInfo {
  supervisorName: string;
  terminalCode: TerminalCode | null;
  startedAt: string;
}

export interface SessionService {
  startSession: (supervisorName: string, terminalCode: TerminalCode | null) => Promise<SessionInfo>;
  getSession: () => Promise<SessionInfo | null>;
  logout: () => Promise<void>;
}
