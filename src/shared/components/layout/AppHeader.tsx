import { Icon } from '../common/Icon';
import { NotificationCenter } from '../common/NotificationCenter';
import { useTerminalStore } from '../../state/terminalStore';
import { useSessionStore } from '../../state/sessionStore';
import { displayTerminal } from '../../utils/terminal';
import { sessionService } from '../../services/sessionService';

interface Props {
  onMenuToggle: () => void;
}

export const AppHeader = ({ onMenuToggle }: Props) => {
  const terminalContext = useTerminalStore((state) => state.context);
  const session = useSessionStore((state) => state.session);
  const clearSession = useSessionStore((state) => state.clearSession);

  const getTerminalDisplayName = () => {
    if (terminalContext.mode === 'ALL') return 'Todos los terminales';
    if (terminalContext.mode === 'TERMINAL' && terminalContext.value) {
      return displayTerminal(terminalContext.value);
    }
    return 'Terminal';
  };

  return (
    <header className="header px-4 md:px-6">
      <div className="flex w-full items-center justify-between gap-4">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-all hover:bg-slate-200 md:hidden"
            aria-label="Abrir menú"
          >
            <Icon name="menu" size={20} />
          </button>

          <div className="hidden md:block">
            <h1 className="text-lg font-bold text-slate-900">Dashboard</h1>
            <p className="text-xs text-slate-500">{getTerminalDisplayName()}</p>
          </div>
        </div>

        {/* Center - Search (hidden on mobile) */}
        <div className="hidden lg:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Icon
              name="search"
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              placeholder="Buscar en el dashboard..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm transition-all placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Terminal Badge (Mobile) */}
          <div className="md:hidden">
            <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5">
              <Icon name="building" size={14} className="text-brand-600" />
              <span className="text-xs font-semibold text-brand-700">
                {terminalContext.mode === 'ALL' ? 'Todos' : terminalContext.value?.split('_').pop()}
              </span>
            </div>
          </div>

          {/* Notifications */}
          <NotificationCenter />

          {/* User Menu */}
          {session && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 text-white text-sm font-bold">
                  {session.supervisorName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-slate-900">{session.supervisorName}</span>
                  <span className="text-xs text-slate-500">
                    {session.terminalCode ? displayTerminal(session.terminalCode) : 'Todos los terminales'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    clearSession();
                    sessionService.logout();
                  }}
                  className="ml-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-danger-600"
                  title="Cerrar sesión"
                >
                  <Icon name="logout" size={18} />
                </button>
              </div>

              {/* Mobile logout */}
              <button
                onClick={() => {
                  clearSession();
                  sessionService.logout();
                }}
                className="sm:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-all hover:bg-danger-100 hover:text-danger-600"
                title="Cerrar sesión"
              >
                <Icon name="logout" size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
