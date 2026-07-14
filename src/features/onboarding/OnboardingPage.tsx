import { FormEvent, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionService } from '../../shared/services/sessionService';
import { useSessionStore } from '../../shared/state/sessionStore';
import { useTerminalStore } from '../../shared/state/terminalStore';
import { defaultTerminalContext } from '../../shared/utils/terminal';
import { AUTHORIZED_SUPERVISORS, assertValidLoginCredentials, normalizeSupervisorName } from '../../shared/utils/authorizedSupervisors';
import { Icon } from '../../shared/components/common/Icon';

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const setSession = useSessionStore((state) => state.setSession);
  const session = useSessionStore((state) => state.session);
  const setTerminalContext = useTerminalStore((state) => state.setContext);
  const [supervisorName, setSupervisorName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) {
      navigate('/personal');
    }
  }, [session, navigate]);

  useEffect(() => {
    setTerminalContext(defaultTerminalContext);
  }, [setTerminalContext]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      setSubmitting(true);
      assertValidLoginCredentials(supervisorName, password);
      const session = await sessionService.startSession(supervisorName, null, password);
      setSession(session);
      setTerminalContext(defaultTerminalContext);
      navigate('/personal');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No fue posible iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-dark-900">
      {/* Fondo */}
      <div className="absolute inset-0 bg-gradient-to-br from-dark-900 via-dark-800 to-brand-900">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent-500/10 blur-3xl" />
      </div>

      {/* Contenido */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl shadow-2xl lg:grid-cols-[5fr_6fr]">

          {/* ===== Panel de marca (izquierda) ===== */}
          <div className="relative flex flex-col justify-between bg-gradient-to-br from-brand-600 to-brand-800 p-8 lg:p-10">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                  <span className="text-2xl font-bold text-white">A</span>
                </div>
                <div>
                  <p className="text-xl font-bold leading-tight text-white">Asiss</p>
                  <p className="text-xs text-brand-100/80">Dashboard de Logística</p>
                </div>
              </div>

              <h2 className="mt-8 hidden text-2xl font-bold leading-snug text-white lg:block">
                Gestión operativa de personal y asistencia
              </h2>

              <ul className="mt-6 hidden space-y-3 lg:block">
                {[
                  { icon: 'users' as const, text: 'Personal, turnos y programación' },
                  { icon: 'clock' as const, text: 'Asistencia, HHEE y Control ASISS' },
                  { icon: 'building' as const, text: 'El Roble · La Reina · María Angélica' },
                ].map((item) => (
                  <li key={item.text} className="flex items-center gap-3 text-sm text-brand-50/90">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <Icon name={item.icon} size={15} className="text-white" />
                    </span>
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 hidden items-center gap-2 text-xs text-brand-100/70 lg:flex">
              <Icon name="check-circle" size={14} />
              Conexión segura · Datos protegidos
            </div>
          </div>

          {/* ===== Formulario (derecha) ===== */}
          <div className="bg-white p-8 lg:p-10">
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-slate-900">Bienvenido</h1>
              <p className="mt-1 text-sm text-slate-500">
                Selecciona tu nombre e ingresa la clave de acceso
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Selección de supervisor */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Supervisor
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {AUTHORIZED_SUPERVISORS.map((name) => {
                    const selected = normalizeSupervisorName(supervisorName) === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setSupervisorName(name);
                          setError(null);
                        }}
                        className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition-all ${selected
                          ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-500'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-slate-50'
                          }`}
                      >
                        <span className="truncate">{name}</span>
                        <span
                          className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${selected
                            ? 'border-brand-500 bg-brand-500 text-white'
                            : 'border-slate-300 bg-white text-transparent'
                            }`}
                        >
                          <Icon name="check" size={12} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Contraseña */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Contraseña de acceso
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-slate-400">
                    <Icon name="key" size={17} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-12 text-sm text-slate-800 placeholder:text-slate-300 transition-shadow focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition-colors hover:text-slate-600"
                    title={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    <Icon name="eye" size={17} />
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  El acceso inicia con visibilidad sobre todos los terminales.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
                  <Icon name="x-circle" size={16} className="mt-0.5 shrink-0 text-danger-500" />
                  <p className="text-sm text-danger-700">{error}</p>
                </div>
              )}

              {/* Botón */}
              <button
                type="submit"
                disabled={submitting || !supervisorName || !password}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition-all hover:from-brand-600 hover:to-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? (
                  <>
                    <Icon name="loader" size={18} className="animate-spin" />
                    Iniciando sesión…
                  </>
                ) : (
                  <>
                    Entrar al Dashboard
                    <Icon name="chevron-right" size={17} />
                  </>
                )}
              </button>
            </form>

            {/* Nota de seguridad (visible en móvil, donde no está el panel izquierdo) */}
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400 lg:hidden">
              <Icon name="check-circle" size={13} className="text-success-500" />
              Conexión segura · Datos protegidos
            </div>
          </div>
        </div>
      </div>

      {/* Pie de página */}
      <footer className="relative z-10 pb-6 text-center">
        <p className="text-xs text-slate-400">
          Versión 2.0 · © {new Date().getFullYear()} Asiss
        </p>
        <a
          href="https://www.zyteron.cl"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-white"
        >
          Desarrollado por <span className="font-bold text-brand-300 hover:text-brand-200">Zyteron</span>
          <span className="text-slate-500">· www.zyteron.cl</span>
        </a>
      </footer>
    </div>
  );
};
