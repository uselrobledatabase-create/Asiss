import { FormEvent, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionService } from '../../shared/services/sessionService';
import { useSessionStore } from '../../shared/state/sessionStore';
import { useTerminalStore } from '../../shared/state/terminalStore';
import { terminalOptions, EL_ROBLE_SUBTERMINALS_SET } from '../../shared/utils/terminal';
import { TerminalCode, TerminalContext } from '../../shared/types/terminal';
import { Icon } from '../../shared/components/common/Icon';

type LoginTerminal = TerminalCode | 'ALL';

const resolveTerminalContext = (t: LoginTerminal): TerminalContext => {
  if (t === 'ALL') return { mode: 'ALL' };
  if (EL_ROBLE_SUBTERMINALS_SET.has(t as TerminalCode)) return { mode: 'GROUP', value: 'GRUPO_ROBLE' };
  return { mode: 'TERMINAL', value: t as TerminalCode };
};

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const setSession = useSessionStore((state) => state.setSession);
  const session = useSessionStore((state) => state.session);
  const setTerminalContext = useTerminalStore((state) => state.setContext);
  const [supervisorName, setSupervisorName] = useState('');
  const [loginTerminal, setLoginTerminal] = useState<LoginTerminal>('ALL');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) {
      navigate('/personal');
    }
  }, [session, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const sessionTerminal: TerminalCode | null = loginTerminal === 'ALL' ? null : loginTerminal as TerminalCode;
    const session = await sessionService.startSession(supervisorName, sessionTerminal);
    setSession(session);
    setTerminalContext(resolveTerminalContext(loginTerminal));
    navigate('/personal');
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-dark-900 via-dark-800 to-brand-900">
        {/* Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/30 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-brand-600/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />

        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-lg px-4 animate-slide-up">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-brand-lg">
              <span className="text-3xl font-bold text-white">A</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-white">Asiss</span>
              <span className="text-sm text-slate-400">Dashboard de Logística</span>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="card-glass p-8 md:p-10">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Bienvenido</h1>
            <p className="mt-2 text-sm text-slate-600">
              Ingresa tus datos para acceder al panel de control
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Supervisor Name */}
            <div>
              <label className="label">Nombre del Supervisor</label>
              <div className="relative">
                <Icon
                  name="users"
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  className="input pl-10"
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  placeholder="Ej: Ana Pérez"
                  required
                />
              </div>
            </div>

            {/* Terminal */}
            <div>
              <label className="label">Terminal</label>
              <div className="relative">
                <Icon
                  name="building"
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
                />
                <select
                  className="input pl-10 appearance-none cursor-pointer"
                  value={loginTerminal}
                  onChange={(e) => setLoginTerminal(e.target.value as LoginTerminal)}
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '16px',
                    paddingRight: '40px',
                  }}
                >
                  <option value="ALL">Todos los terminales</option>
                  {terminalOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !supervisorName}
              className="btn btn-primary w-full py-3.5 text-base"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Iniciando sesión...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Entrar al Dashboard
                  <Icon name="chevron-right" size={18} />
                </span>
              )}
            </button>
          </form>

          {/* Footer Info */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <Icon name="check-circle" size={14} className="text-success-500" />
              <span>Conexión segura · Datos protegidos</span>
            </div>
          </div>
        </div>

        {/* Version */}
        <p className="mt-6 text-center text-xs text-slate-500">
          Versión 2.0 · © 2024 Asiss
        </p>
      </div>
    </div>
  );
};
