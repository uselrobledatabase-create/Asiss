import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { OnboardingPage } from '../../features/onboarding/OnboardingPage';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useSessionStore } from '../../shared/state/sessionStore';
import { LoadingState } from '../../shared/components/common/LoadingState';
import { PersonalPage } from '../../features/personal/PersonalPage';
import { ReunionesPage } from '../../features/reuniones/ReunionesPage';
import { TareasPage } from '../../features/tareas/TareasPage';
import { InformativosPage } from '../../features/informativos/InformativosPage';
import { AsistenciaPage } from '../../features/asistencia/AsistenciaPage';
import { CredencialesRespaldoPage } from '../../features/credenciales_respaldo/CredencialesRespaldoPage';
import { SolicitudesPage } from '../../features/solicitudes/SolicitudesPage';
import { MyInfoPage } from '../../features/asistencia2026/pages/MyInfoPage';
import { AmonestacionesPage } from '../../features/amonestaciones/AmonestacionesPage';
import { InspeccionICA } from '../../features/inspeccion_ica/InspeccionICA';
import { AsistenciaMensualPage } from '../../features/control_asiss/pages/AsistenciaMensualPage';
import { ControlHHEEPage } from '../../features/control_asiss/pages/ControlHHEEPage';
import { ExportesPage } from '../../features/control_asiss/pages/ExportesPage';

const RequireSession = () => {
  const session = useSessionStore((state) => state.session);
  const hydrateSession = useSessionStore((state) => state.hydrateSession);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hydrateSession().finally(() => setLoading(false));
  }, [hydrateSession]);

  if (loading) {
    return <LoadingState label="Validando sesión" />;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export const AppRouter = () => (
  <HashRouter>
    <Routes>
      <Route path="/" element={<OnboardingPage />} />
      <Route element={<RequireSession />}>
        <Route element={<DashboardLayout />}>
          <Route path="/personal" element={<PersonalPage />} />
          <Route path="/reuniones" element={<ReunionesPage />} />
          <Route path="/tareas" element={<TareasPage />} />
          <Route path="/informativos" element={<InformativosPage />} />
          <Route path="/asistencia" element={<AsistenciaPage />} />
          <Route path="/mi-info" element={<MyInfoPage />} />
          <Route path="/credenciales" element={<CredencialesRespaldoPage />} />
          <Route path="/solicitudes" element={<SolicitudesPage />} />
          <Route path="/amonestaciones" element={<AmonestacionesPage />} />
          <Route path="/fiscalizacion-ica" element={<InspeccionICA />} />
          <Route path="/control-asiss/asistencia-mensual" element={<AsistenciaMensualPage />} />
          <Route path="/control-asiss/hhee" element={<ControlHHEEPage />} />
          <Route path="/control-asiss/exportes" element={<ExportesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </HashRouter>
);
