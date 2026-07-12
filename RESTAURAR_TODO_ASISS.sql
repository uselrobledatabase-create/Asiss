-- ============================================================
-- ASISS - RESTAURACION COMPLETA DEL ESQUEMA FALTANTE
-- Proyecto: wvcplgwemvqhvtstlqmt
-- Generado: 2026-07-08
-- ============================================================
-- Pega TODO este archivo en el SQL Editor de Supabase y ejecuta.
-- Es 100% idempotente: puedes ejecutarlo varias veces sin peligro.
-- NO borra ni modifica datos existentes; solo crea lo que falta:
--   * Asistencia clasica (5 tablas) + cambios de horario
--   * Reuniones complementarias (4 tablas)
--   * Asis Command (2 tablas)
--   * Amonestaciones
--   * Configuracion de la app
--   * Aseo (4 tablas)
--   * Flota (fleet_vehicles + 215 buses + vista de pendientes + RPC)
--   * SRL (5 tablas)
--   * Insumos (6 tablas)
--   * Tareas complementarias (3 tablas)
--   * 9 buckets de storage con sus politicas
--   * Permisos (grants) y realtime
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper: trigger generico de updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Enums (solo si no existen)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auth_status_enum') THEN
    CREATE TYPE public.auth_status_enum AS ENUM ('PENDIENTE', 'AUTORIZADO', 'RECHAZADO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entry_exit_enum') THEN
    CREATE TYPE public.entry_exit_enum AS ENUM ('ENTRADA', 'SALIDA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_status') THEN
    CREATE TYPE public.meeting_status AS ENUM ('PROGRAMADA', 'REALIZADA', 'CANCELADA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
    CREATE TYPE public.notification_status AS ENUM ('PENDIENTE', 'ENVIADO', 'ERROR');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action_status') THEN
    CREATE TYPE public.action_status AS ENUM ('PENDIENTE', 'CUMPLIDO', 'VENCIDO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status_enum') THEN
    CREATE TYPE public.task_status_enum AS ENUM ('PENDIENTE', 'EN_CURSO', 'TERMINADO', 'EVALUADO', 'RECHAZADO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority_enum') THEN
    CREATE TYPE public.task_priority_enum AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');
  END IF;
END $$;

-- ============================================================
-- 1. ASISTENCIA CLASICA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.attendance_no_marcaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rut text NOT NULL,
  nombre text NOT NULL,
  area text,
  cargo text,
  jefe_terminal text,
  terminal_code text NOT NULL,
  cabezal text,
  incident_state text,
  schedule_in_out text,
  date date NOT NULL,
  time_range text,
  observations text,
  informed_by text,
  auth_status public.auth_status_enum NOT NULL DEFAULT 'PENDIENTE',
  authorized_by text,
  authorized_at timestamptz,
  rejection_reason text,
  created_by_supervisor text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_sin_credenciales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rut text NOT NULL,
  nombre text NOT NULL,
  terminal_code text NOT NULL,
  cabezal text,
  date date NOT NULL,
  start_time time,
  end_time time,
  cargo text,
  supervisor_autoriza text,
  area text,
  responsable text,
  observacion text,
  auth_status public.auth_status_enum NOT NULL DEFAULT 'PENDIENTE',
  authorized_by text,
  authorized_at timestamptz,
  rejection_reason text,
  created_by_supervisor text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_cambios_dia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rut text NOT NULL,
  nombre text NOT NULL,
  terminal_code text NOT NULL,
  cabezal text,
  date date NOT NULL,
  prog_start time,
  prog_end time,
  reprogram_start time,
  reprogram_end time,
  day_off_date date,
  day_off_start time,
  day_off_end time,
  day_on_date date,
  day_on_start time,
  day_on_end time,
  document_path text,
  auth_status public.auth_status_enum NOT NULL DEFAULT 'PENDIENTE',
  authorized_by text,
  authorized_at timestamptz,
  rejection_reason text,
  created_by_supervisor text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_autorizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rut text NOT NULL,
  nombre text NOT NULL,
  cargo text,
  terminal_code text NOT NULL,
  turno text,
  horario text,
  authorization_date date NOT NULL,
  entry_or_exit public.entry_exit_enum NOT NULL,
  motivo text NOT NULL,
  auth_status public.auth_status_enum NOT NULL DEFAULT 'PENDIENTE',
  authorized_by text,
  authorized_at timestamptz,
  rejection_reason text,
  created_by_supervisor text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_vacaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  rut text NOT NULL,
  nombre text NOT NULL,
  cargo text NOT NULL,
  terminal_code text NOT NULL,
  turno text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  return_date date NOT NULL,
  calendar_days integer NOT NULL DEFAULT 0,
  business_days integer NOT NULL DEFAULT 0,
  has_conflict boolean NOT NULL DEFAULT false,
  conflict_authorized boolean NOT NULL DEFAULT false,
  conflict_details text,
  note text,
  auth_status public.auth_status_enum NOT NULL DEFAULT 'PENDIENTE',
  authorized_by text,
  authorized_at timestamptz,
  rejection_reason text,
  created_by_supervisor text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Cambios de horario consultados por el portal de Aseo
CREATE TABLE IF NOT EXISTS public.attendance_schedule_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rut text NOT NULL,
  nombre text,
  terminal_code text,
  date date NOT NULL,
  prog_start text,
  prog_end text,
  new_start text,
  new_end text,
  note text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_no_marcaciones_terminal ON public.attendance_no_marcaciones(terminal_code);
CREATE INDEX IF NOT EXISTS idx_no_marcaciones_status ON public.attendance_no_marcaciones(auth_status);
CREATE INDEX IF NOT EXISTS idx_no_marcaciones_date ON public.attendance_no_marcaciones(date DESC);
CREATE INDEX IF NOT EXISTS idx_sin_credenciales_terminal ON public.attendance_sin_credenciales(terminal_code);
CREATE INDEX IF NOT EXISTS idx_sin_credenciales_status ON public.attendance_sin_credenciales(auth_status);
CREATE INDEX IF NOT EXISTS idx_sin_credenciales_date ON public.attendance_sin_credenciales(date DESC);
CREATE INDEX IF NOT EXISTS idx_cambios_dia_terminal ON public.attendance_cambios_dia(terminal_code);
CREATE INDEX IF NOT EXISTS idx_cambios_dia_status ON public.attendance_cambios_dia(auth_status);
CREATE INDEX IF NOT EXISTS idx_cambios_dia_date ON public.attendance_cambios_dia(date DESC);
CREATE INDEX IF NOT EXISTS idx_autorizaciones_terminal ON public.attendance_autorizaciones(terminal_code);
CREATE INDEX IF NOT EXISTS idx_autorizaciones_status ON public.attendance_autorizaciones(auth_status);
CREATE INDEX IF NOT EXISTS idx_autorizaciones_date ON public.attendance_autorizaciones(authorization_date DESC);
CREATE INDEX IF NOT EXISTS idx_vacaciones_terminal ON public.attendance_vacaciones(terminal_code);
CREATE INDEX IF NOT EXISTS idx_vacaciones_dates ON public.attendance_vacaciones(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_vacaciones_status ON public.attendance_vacaciones(auth_status);
CREATE INDEX IF NOT EXISTS idx_schedule_changes_rut_date ON public.attendance_schedule_changes(rut, date);

DROP TRIGGER IF EXISTS update_no_marcaciones_updated_at ON public.attendance_no_marcaciones;
CREATE TRIGGER update_no_marcaciones_updated_at
  BEFORE UPDATE ON public.attendance_no_marcaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sin_credenciales_updated_at ON public.attendance_sin_credenciales;
CREATE TRIGGER update_sin_credenciales_updated_at
  BEFORE UPDATE ON public.attendance_sin_credenciales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_cambios_dia_updated_at ON public.attendance_cambios_dia;
CREATE TRIGGER update_cambios_dia_updated_at
  BEFORE UPDATE ON public.attendance_cambios_dia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_autorizaciones_updated_at ON public.attendance_autorizaciones;
CREATE TRIGGER update_autorizaciones_updated_at
  BEFORE UPDATE ON public.attendance_autorizaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vacaciones_updated_at ON public.attendance_vacaciones;
CREATE TRIGGER update_vacaciones_updated_at
  BEFORE UPDATE ON public.attendance_vacaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. REUNIONES - TABLAS COMPLEMENTARIAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meeting_invitees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  invitee_name text NOT NULL,
  invitee_email text,
  notification_status public.notification_status NOT NULL DEFAULT 'PENDIENTE',
  notified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meeting_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  uploaded_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meeting_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  description text NOT NULL,
  responsible_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  responsible_name text,
  due_date date,
  status public.action_status NOT NULL DEFAULT 'PENDIENTE',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meeting_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL CHECK (scope_type IN ('GLOBAL', 'TERMINAL')),
  scope_code text NOT NULL,
  enabled boolean DEFAULT true,
  cc_emails text,
  subject_template text NOT NULL DEFAULT 'Invitacion a Reunion: {{title}}',
  body_template text NOT NULL DEFAULT 'Estimado/a {{invitee_name}}, se le invita a la reunion "{{title}}" el {{date}} a las {{time}}.',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(scope_type, scope_code)
);

CREATE INDEX IF NOT EXISTS idx_invitees_meeting ON public.meeting_invitees(meeting_id);
CREATE INDEX IF NOT EXISTS idx_files_meeting ON public.meeting_files(meeting_id);
CREATE INDEX IF NOT EXISTS idx_actions_meeting ON public.meeting_actions(meeting_id);

DROP TRIGGER IF EXISTS update_meeting_actions_updated_at ON public.meeting_actions;
CREATE TRIGGER update_meeting_actions_updated_at
  BEFORE UPDATE ON public.meeting_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_email_settings_updated_at ON public.meeting_email_settings;
CREATE TRIGGER update_meeting_email_settings_updated_at
  BEFORE UPDATE ON public.meeting_email_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.meeting_email_settings (scope_type, scope_code, enabled)
VALUES ('GLOBAL', 'ALL', true)
ON CONFLICT (scope_type, scope_code) DO NOTHING;

-- ============================================================
-- 3. ASIS COMMAND
-- ============================================================

CREATE TABLE IF NOT EXISTS public.asis_command_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_text text NOT NULL,
  parsed_intent text,
  payload_json jsonb DEFAULT '{}'::jsonb,
  executed_by text NOT NULL,
  terminal_code text,
  status text CHECK (status IN ('OK', 'ERROR', 'CANCELLED')) DEFAULT 'OK',
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.asis_command_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent text UNIQUE NOT NULL,
  recipients text NOT NULL DEFAULT '',
  subject_template text NOT NULL DEFAULT 'Notificacion Asis Command',
  enabled boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_asis_command_logs_created ON public.asis_command_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asis_command_logs_executed_by ON public.asis_command_logs(executed_by);

INSERT INTO public.asis_command_email_settings (intent, recipients, subject_template, enabled)
VALUES
  ('VACACIONES', '', 'Vacaciones registradas - {nombre}', true),
  ('LICENCIA', '', 'Licencia medica registrada - {nombre}', true),
  ('PERMISO', '', 'Permiso registrado - {nombre}', true),
  ('AUTORIZACION_LLEGADA', '', 'Llegada tardia autorizada - {nombre}', true),
  ('AUTORIZACION_SALIDA', '', 'Salida anticipada autorizada - {nombre}', true)
ON CONFLICT (intent) DO NOTHING;

-- ============================================================
-- 4. AMONESTACIONES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.amonestaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  date text NOT NULL,
  time text NOT NULL,
  worker_rut text NOT NULL,
  worker_name text NOT NULL,
  worker_cargo text NOT NULL,
  worker_base text,
  shift_schedule text,
  sanction_code_id integer NOT NULL,
  description text NOT NULL,
  place_terminal text,
  place_public_way text,
  place_vehicle text,
  place_ppu text,
  place_detail text,
  involved_jefatura text,
  involved_companeros text,
  involved_other text,
  witness1_name text,
  witness1_rut text,
  witness1_cargo text,
  witness2_name text,
  witness2_rut text,
  witness2_cargo text,
  responsible_name text NOT NULL,
  responsible_cargo text NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  status text DEFAULT 'GENERATED'
);

-- ============================================================
-- 5. CONFIGURACION DE LA APP
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS update_app_configuration_updated_at ON public.app_configuration;
CREATE TRIGGER update_app_configuration_updated_at
  BEFORE UPDATE ON public.app_configuration
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_configuration (key, value, description)
VALUES (
  'email_notifications',
  '{"to": ["isaac.avila@transdev.cl"], "cc": []}'::jsonb,
  'Configuracion de destinatarios para notificaciones de asistencia'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 6. ASEO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.aseo_cleaners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.aseo_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id uuid NOT NULL REFERENCES public.aseo_cleaners(id) ON DELETE CASCADE,
  cleaner_name text NOT NULL,
  bus_ppu text NOT NULL,
  terminal_code text NOT NULL,
  cleaning_type text CHECK (cleaning_type IN ('BARRIDO', 'BARRIDO_Y_TRAPEADO', 'FULL')) NOT NULL,
  graffiti_removed boolean DEFAULT false,
  stickers_removed boolean DEFAULT false,
  photo_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.aseo_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id uuid NOT NULL REFERENCES public.aseo_cleaners(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text CHECK (status IN ('PENDIENTE', 'TERMINADA')) DEFAULT 'PENDIENTE',
  evidence_url text,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.aseo_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id uuid NOT NULL REFERENCES public.aseo_cleaners(id) ON DELETE CASCADE,
  type text CHECK (type IN ('TAREA_NUEVA', 'OBSERVACION', 'CAMBIO_ESTADO')) NOT NULL,
  title text NOT NULL,
  message text,
  read boolean DEFAULT false,
  related_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aseo_records_cleaner ON public.aseo_records(cleaner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aseo_records_terminal ON public.aseo_records(terminal_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aseo_records_date ON public.aseo_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aseo_tasks_cleaner ON public.aseo_tasks(cleaner_id, status);
CREATE INDEX IF NOT EXISTS idx_aseo_notifications_cleaner ON public.aseo_notifications(cleaner_id, read, created_at DESC);

-- ============================================================
-- 7. FLOTA (fleet_vehicles + seed EL ROBLE)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fleet_vehicles (
  ppu text PRIMARY KEY,
  numero_interno integer NOT NULL,
  marca_modelo text NOT NULL,
  terminal text NOT NULL,
  estado text DEFAULT 'operativo' CHECK (estado IN ('operativo', 'en_taller', 'fuera_servicio')),
  odometro integer DEFAULT 0,
  proxima_mantencion date,
  ultima_limpieza timestamp,
  requiere_limpieza boolean DEFAULT false,
  notas text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fleet_terminal ON public.fleet_vehicles(terminal);
CREATE INDEX IF NOT EXISTS idx_fleet_estado ON public.fleet_vehicles(estado);
CREATE INDEX IF NOT EXISTS idx_fleet_requiere_limpieza ON public.fleet_vehicles(requiere_limpieza);
CREATE INDEX IF NOT EXISTS idx_fleet_ultima_limpieza ON public.fleet_vehicles(ultima_limpieza);

CREATE OR REPLACE FUNCTION public.update_fleet_vehicles_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fleet_vehicles_updated_at ON public.fleet_vehicles;
CREATE TRIGGER fleet_vehicles_updated_at
  BEFORE UPDATE ON public.fleet_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_fleet_vehicles_updated_at();

-- Seed de la flota EL ROBLE (no duplica si ya existen)
INSERT INTO public.fleet_vehicles (ppu, numero_interno, marca_modelo, terminal) VALUES
('SHCX39', 922, 'VOLVO', 'EL_ROBLE'),
('SHCY22', 936, 'VOLVO', 'EL_ROBLE'),
('SHCY28', 942, 'VOLVO', 'EL_ROBLE'),
('SHXD75', 1455, 'VOLVO', 'EL_ROBLE'),
('SHXD77', 1456, 'VOLVO', 'EL_ROBLE'),
('SHXD79', 1457, 'VOLVO', 'EL_ROBLE'),
('SHXD85', 1459, 'VOLVO', 'EL_ROBLE'),
('SHXF13', 1460, 'VOLVO', 'EL_ROBLE'),
('SHXF14', 1461, 'VOLVO', 'EL_ROBLE'),
('SHXF29', 1462, 'VOLVO', 'EL_ROBLE'),
('SHXF31', 1463, 'VOLVO', 'EL_ROBLE'),
('SHXF84', 1465, 'VOLVO', 'EL_ROBLE'),
('SHXF85', 1466, 'VOLVO', 'EL_ROBLE'),
('SHXF87', 1467, 'VOLVO', 'EL_ROBLE'),
('SHXF88', 1468, 'VOLVO', 'EL_ROBLE'),
('SHXF90', 1469, 'VOLVO', 'EL_ROBLE'),
('SHXF92', 1470, 'VOLVO', 'EL_ROBLE'),
('SHXF93', 1471, 'VOLVO', 'EL_ROBLE'),
('SHXF97', 1472, 'VOLVO', 'EL_ROBLE'),
('SHXG36', 1475, 'VOLVO', 'EL_ROBLE'),
('SHXG38', 1476, 'VOLVO', 'EL_ROBLE'),
('SJPB21', 1606, 'VOLVO', 'EL_ROBLE'),
('SJPB25', 1610, 'VOLVO', 'EL_ROBLE'),
('SJPC73', 1636, 'VOLVO', 'EL_ROBLE'),
('SJPD42', 1647, 'VOLVO', 'EL_ROBLE'),
('SJPD44', 1649, 'VOLVO', 'EL_ROBLE'),
('SJPD71', 1655, 'VOLVO', 'EL_ROBLE'),
('SJPD72', 1656, 'VOLVO', 'EL_ROBLE'),
('SJPD97', 1663, 'VOLVO', 'EL_ROBLE'),
('SJPF43', 1667, 'VOLVO', 'EL_ROBLE'),
('SJPF44', 1668, 'VOLVO', 'EL_ROBLE'),
('SKPH70', 1682, 'VOLVO', 'EL_ROBLE'),
('SKPH73', 1684, 'VOLVO', 'EL_ROBLE'),
('SKPJ90', 1822, 'VOLVO', 'EL_ROBLE'),
('SKPK18', 1823, 'VOLVO', 'EL_ROBLE'),
('SKPK19', 1824, 'VOLVO', 'EL_ROBLE'),
('SKPK21', 1826, 'VOLVO', 'EL_ROBLE'),
('SKPK22', 1827, 'VOLVO', 'EL_ROBLE'),
('SKPK23', 1828, 'VOLVO', 'EL_ROBLE'),
('SKPK25', 1829, 'VOLVO', 'EL_ROBLE'),
('SKPK26', 1830, 'VOLVO', 'EL_ROBLE'),
('SKPK27', 1831, 'VOLVO', 'EL_ROBLE'),
('SKPK28', 1832, 'VOLVO', 'EL_ROBLE'),
('SKPK31', 1834, 'VOLVO', 'EL_ROBLE'),
('SKPK32', 1835, 'VOLVO', 'EL_ROBLE'),
('SKPK34', 1837, 'VOLVO', 'EL_ROBLE'),
('SKPK35', 1838, 'VOLVO', 'EL_ROBLE'),
('SKPK37', 1839, 'VOLVO', 'EL_ROBLE'),
('SKPK39', 1840, 'VOLVO', 'EL_ROBLE'),
('SKPK40', 1841, 'VOLVO', 'EL_ROBLE'),
('SKPK42', 1843, 'VOLVO', 'EL_ROBLE'),
('SKPK44', 1844, 'VOLVO', 'EL_ROBLE'),
('SKPK45', 1845, 'VOLVO', 'EL_ROBLE'),
('SKPK62', 1846, 'VOLVO', 'EL_ROBLE'),
('SKPK63', 1847, 'VOLVO', 'EL_ROBLE'),
('SKPL28', 1848, 'VOLVO', 'EL_ROBLE'),
('SKPL30', 1849, 'VOLVO', 'EL_ROBLE'),
('SKPL33', 1850, 'VOLVO', 'EL_ROBLE'),
('SKPL34', 1851, 'VOLVO', 'EL_ROBLE'),
('SKPL36', 1852, 'VOLVO', 'EL_ROBLE'),
('PFTW34', 1872, 'SCANIA', 'EL_ROBLE'),
('SKPK20', 1825, 'VOLVO', 'EL_ROBLE'),
('LXWP79', 1864, 'SCANIA', 'EL_ROBLE'),
('PFVG98', 1716, 'SCANIA', 'EL_ROBLE'),
('LXWP57', 1919, 'SCANIA', 'EL_ROBLE'),
('LXWP58', 1931, 'SCANIA', 'EL_ROBLE'),
('LXWP59', 1932, 'SCANIA', 'EL_ROBLE'),
('LXWP60', 1885, 'SCANIA', 'EL_ROBLE'),
('LXWP61', 1920, 'SCANIA', 'EL_ROBLE'),
('LXWP62', 1921, 'SCANIA', 'EL_ROBLE'),
('LXWP64', 1886, 'SCANIA', 'EL_ROBLE'),
('LXWP66', 1693, 'SCANIA', 'EL_ROBLE'),
('LXWP67', 1854, 'SCANIA', 'EL_ROBLE'),
('LXWP68', 1855, 'SCANIA', 'EL_ROBLE'),
('LXWP69', 1856, 'SCANIA', 'EL_ROBLE'),
('LXWP70', 1857, 'SCANIA', 'EL_ROBLE'),
('LXWP71', 1858, 'SCANIA', 'EL_ROBLE'),
('LXWP72', 1859, 'SCANIA', 'EL_ROBLE'),
('LXWP73', 1860, 'SCANIA', 'EL_ROBLE'),
('LXWP74', 1861, 'SCANIA', 'EL_ROBLE'),
('LXWP75', 1862, 'SCANIA', 'EL_ROBLE'),
('LXWP76', 1694, 'SCANIA', 'EL_ROBLE'),
('LXWP77', 1695, 'SCANIA', 'EL_ROBLE'),
('LXWP78', 1863, 'SCANIA', 'EL_ROBLE'),
('PFTW35', 1892, 'SCANIA', 'EL_ROBLE'),
('PFTW36', 1702, 'SCANIA', 'EL_ROBLE'),
('PFTW38', 1873, 'SCANIA', 'EL_ROBLE'),
('PFTW39', 1893, 'SCANIA', 'EL_ROBLE'),
('PFTW40', 1703, 'SCANIA', 'EL_ROBLE'),
('PFTW41', 1894, 'SCANIA', 'EL_ROBLE'),
('PFTW42', 1895, 'SCANIA', 'EL_ROBLE'),
('PFTW44', 1874, 'SCANIA', 'EL_ROBLE'),
('PFTW45', 1875, 'SCANIA', 'EL_ROBLE'),
('PFTW46', 1704, 'SCANIA', 'EL_ROBLE'),
('PFTW47', 1876, 'SCANIA', 'EL_ROBLE'),
('PFTW48', 1896, 'SCANIA', 'EL_ROBLE'),
('PFTW49', 1877, 'SCANIA', 'EL_ROBLE'),
('PFTW50', 1878, 'SCANIA', 'EL_ROBLE'),
('PFTW51', 1897, 'SCANIA', 'EL_ROBLE'),
('PFTW55', 1898, 'SCANIA', 'EL_ROBLE'),
('PFTW56', 1879, 'SCANIA', 'EL_ROBLE'),
('PFTW57', 1705, 'SCANIA', 'EL_ROBLE'),
('PFYC20', 1726, 'SCANIA', 'EL_ROBLE'),
('LXWP80', 1865, 'SCANIA', 'EL_ROBLE'),
('LXWP81', 1696, 'SCANIA', 'EL_ROBLE'),
('LXWP82', 1866, 'SCANIA', 'EL_ROBLE'),
('LXWP83', 1867, 'SCANIA', 'EL_ROBLE'),
('LXWP85', 1697, 'SCANIA', 'EL_ROBLE'),
('LXWP86', 1698, 'SCANIA', 'EL_ROBLE'),
('LXWP87', 1888, 'SCANIA', 'EL_ROBLE'),
('PFTV77', 1699, 'SCANIA', 'EL_ROBLE'),
('PFTW19', 1889, 'SCANIA', 'EL_ROBLE'),
('PFTW20', 1890, 'SCANIA', 'EL_ROBLE'),
('PFTW25', 1700, 'SCANIA', 'EL_ROBLE'),
('PFTW26', 1891, 'SCANIA', 'EL_ROBLE'),
('PFTW28', 1868, 'SCANIA', 'EL_ROBLE'),
('PFTW29', 1869, 'SCANIA', 'EL_ROBLE'),
('PFTW30', 1870, 'SCANIA', 'EL_ROBLE'),
('PFTW31', 1871, 'SCANIA', 'EL_ROBLE'),
('PFTW32', 1701, 'SCANIA', 'EL_ROBLE'),
('PFTW58', 1880, 'SCANIA', 'EL_ROBLE'),
('PFTW59', 1899, 'SCANIA', 'EL_ROBLE'),
('PFTW60', 1706, 'SCANIA', 'EL_ROBLE'),
('PFTW61', 1900, 'SCANIA', 'EL_ROBLE'),
('PFTW62', 1901, 'SCANIA', 'EL_ROBLE'),
('PFVG75', 1902, 'SCANIA', 'EL_ROBLE'),
('PFVG76', 1903, 'SCANIA', 'EL_ROBLE'),
('PFVG77', 1904, 'SCANIA', 'EL_ROBLE'),
('PFVG78', 1707, 'SCANIA', 'EL_ROBLE'),
('PFVG79', 1881, 'SCANIA', 'EL_ROBLE'),
('PFVG80', 1708, 'SCANIA', 'EL_ROBLE'),
('PFVG82', 1709, 'SCANIA', 'EL_ROBLE'),
('PFVG83', 1710, 'SCANIA', 'EL_ROBLE'),
('PFVG85', 1711, 'SCANIA', 'EL_ROBLE'),
('PFVG86', 1712, 'SCANIA', 'EL_ROBLE'),
('PFVG87', 1713, 'SCANIA', 'EL_ROBLE'),
('PFVG88', 1714, 'SCANIA', 'EL_ROBLE'),
('PFVG89', 1905, 'SCANIA', 'EL_ROBLE'),
('PFVG90', 1906, 'SCANIA', 'EL_ROBLE'),
('PFVG92', 1907, 'SCANIA', 'EL_ROBLE'),
('PFVG94', 1909, 'SCANIA', 'EL_ROBLE'),
('PFVG95', 1910, 'SCANIA', 'EL_ROBLE'),
('PFVG96', 1911, 'SCANIA', 'EL_ROBLE'),
('PFVG97', 1715, 'SCANIA', 'EL_ROBLE'),
('PFVG99', 1717, 'SCANIA', 'EL_ROBLE'),
('PFVH10', 1882, 'SCANIA', 'EL_ROBLE'),
('PFVH11', 1883, 'SCANIA', 'EL_ROBLE'),
('PFVH12', 1718, 'SCANIA', 'EL_ROBLE'),
('PFVH13', 1719, 'SCANIA', 'EL_ROBLE'),
('PFVH14', 1884, 'SCANIA', 'EL_ROBLE'),
('PFVH15', 1720, 'SCANIA', 'EL_ROBLE'),
('PFYC13', 1721, 'SCANIA', 'EL_ROBLE'),
('PFYC14', 1722, 'SCANIA', 'EL_ROBLE'),
('PFYC16', 1723, 'SCANIA', 'EL_ROBLE'),
('PFYC17', 1724, 'SCANIA', 'EL_ROBLE'),
('PFYC19', 1725, 'SCANIA', 'EL_ROBLE'),
('PFYC25', 1727, 'SCANIA', 'EL_ROBLE'),
('PFYC26', 1728, 'SCANIA', 'EL_ROBLE'),
('PFYC27', 1729, 'SCANIA', 'EL_ROBLE'),
('PFYC28', 1730, 'SCANIA', 'EL_ROBLE'),
('PFYC29', 1731, 'SCANIA', 'EL_ROBLE'),
('PFYC31', 1732, 'SCANIA', 'EL_ROBLE'),
('PFYC81', 1759, 'SCANIA', 'EL_ROBLE'),
('PFYC85', 1761, 'SCANIA', 'EL_ROBLE'),
('PFYC88', 1914, 'SCANIA', 'EL_ROBLE'),
('PFYC90', 1915, 'SCANIA', 'EL_ROBLE'),
('PFZK83', 1762, 'SCANIA', 'EL_ROBLE'),
('PFZK91', 1927, 'SCANIA', 'EL_ROBLE'),
('PGBF59', 1928, 'SCANIA', 'EL_ROBLE'),
('PGBY67', 1916, 'SCANIA', 'EL_ROBLE'),
('PGBY72', 1929, 'SCANIA', 'EL_ROBLE'),
('PGBY73', 1930, 'SCANIA', 'EL_ROBLE'),
('PGBY83', 1774, 'SCANIA', 'EL_ROBLE'),
('PGKP67', 1781, 'SCANIA', 'EL_ROBLE'),
('PGLD42', 1782, 'SCANIA', 'EL_ROBLE'),
('PGLD67', 1917, 'SCANIA', 'EL_ROBLE'),
('PGRZ67', 1918, 'SCANIA', 'EL_ROBLE'),
('PGTT95', 1925, 'SCANIA', 'EL_ROBLE'),
('PGTV12', 1926, 'SCANIA', 'EL_ROBLE'),
('PGWT98', 1791, 'SCANIA', 'EL_ROBLE'),
('SHCV78', 911, 'VOLVO', 'EL_ROBLE'),
('PFYC32', 1733, 'SCANIA', 'EL_ROBLE'),
('SHCV83', 916, 'VOLVO', 'EL_ROBLE'),
('PFYC33', 1734, 'SCANIA', 'EL_ROBLE'),
('PFYC34', 1735, 'SCANIA', 'EL_ROBLE'),
('PFYC35', 1736, 'SCANIA', 'EL_ROBLE'),
('PFYC36', 1737, 'SCANIA', 'EL_ROBLE'),
('PFYC37', 1738, 'SCANIA', 'EL_ROBLE'),
('PFYC43', 1739, 'SCANIA', 'EL_ROBLE'),
('PFYC44', 1740, 'SCANIA', 'EL_ROBLE'),
('PFYC46', 1741, 'SCANIA', 'EL_ROBLE'),
('PFYC49', 1742, 'SCANIA', 'EL_ROBLE'),
('PFYC50', 1743, 'SCANIA', 'EL_ROBLE'),
('PFYC53', 1744, 'SCANIA', 'EL_ROBLE'),
('PFYC55', 1745, 'SCANIA', 'EL_ROBLE'),
('PFYC57', 1912, 'SCANIA', 'EL_ROBLE'),
('PFYC58', 1746, 'SCANIA', 'EL_ROBLE'),
('PFYC60', 1748, 'SCANIA', 'EL_ROBLE'),
('PFYC61', 1749, 'SCANIA', 'EL_ROBLE'),
('PFYC64', 1752, 'SCANIA', 'EL_ROBLE'),
('PFYC65', 1753, 'SCANIA', 'EL_ROBLE'),
('PFYC66', 1922, 'SCANIA', 'EL_ROBLE'),
('PFYC68', 1754, 'SCANIA', 'EL_ROBLE'),
('PFYC69', 1755, 'SCANIA', 'EL_ROBLE'),
('PFYC70', 1756, 'SCANIA', 'EL_ROBLE'),
('PFYC72', 1757, 'SCANIA', 'EL_ROBLE'),
('PFYC75', 1923, 'SCANIA', 'EL_ROBLE'),
('PFYC76', 1924, 'SCANIA', 'EL_ROBLE'),
('PFYC77', 1913, 'SCANIA', 'EL_ROBLE'),
('PFYC79', 1758, 'SCANIA', 'EL_ROBLE'),
('PFYC80', 1933, 'SCANIA', 'EL_ROBLE')
ON CONFLICT (ppu) DO NOTHING;

-- ============================================================
-- 8. FLOTA - FUNCIONES Y VISTA DE BUSES PENDIENTES
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_days_since_cleaning(last_cleaning timestamp)
RETURNS integer AS $$
BEGIN
  IF last_cleaning IS NULL THEN
    RETURN 999;
  END IF;
  RETURN EXTRACT(DAY FROM now() - last_cleaning)::integer;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.was_cleaned_this_week(last_cleaning timestamp)
RETURNS boolean AS $$
DECLARE
  week_start timestamp;
BEGIN
  IF last_cleaning IS NULL THEN
    RETURN false;
  END IF;
  week_start = DATE_TRUNC('week', now()) + INTERVAL '1 day';
  RETURN last_cleaning >= week_start;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.calculate_priority(days_since integer)
RETURNS text AS $$
BEGIN
  IF days_since > 7 THEN
    RETURN 'ALTA';
  ELSIF days_since >= 4 THEN
    RETURN 'MEDIA';
  ELSE
    RETURN 'BAJA';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Se recrea siempre: es data derivada, no se pierde nada
DROP MATERIALIZED VIEW IF EXISTS public.pending_buses_view;

CREATE MATERIALIZED VIEW public.pending_buses_view AS
SELECT
  fv.ppu,
  fv.numero_interno,
  fv.marca_modelo,
  fv.terminal,
  fv.ultima_limpieza,
  fv.estado,
  public.calculate_days_since_cleaning(fv.ultima_limpieza) AS dias_sin_limpieza,
  public.was_cleaned_this_week(fv.ultima_limpieza) AS limpiado_esta_semana,
  public.calculate_priority(public.calculate_days_since_cleaning(fv.ultima_limpieza)) AS prioridad,
  CASE
    WHEN public.was_cleaned_this_week(fv.ultima_limpieza) THEN false
    ELSE true
  END AS requiere_limpieza
FROM public.fleet_vehicles fv
WHERE fv.estado = 'operativo'
ORDER BY dias_sin_limpieza DESC;

-- Indice unico: necesario para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX pending_buses_view_ppu_idx ON public.pending_buses_view (ppu);
CREATE INDEX idx_pending_buses_terminal ON public.pending_buses_view(terminal);
CREATE INDEX idx_pending_buses_prioridad ON public.pending_buses_view(prioridad);
CREATE INDEX idx_pending_buses_requiere ON public.pending_buses_view(requiere_limpieza);

CREATE OR REPLACE FUNCTION public.refresh_pending_buses()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.pending_buses_view;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_fleet_on_cleaning()
RETURNS trigger AS $$
BEGIN
  UPDATE public.fleet_vehicles
  SET
    ultima_limpieza = NEW.created_at,
    requiere_limpieza = false,
    updated_at = now()
  WHERE ppu = NEW.bus_ppu;

  PERFORM public.refresh_pending_buses();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_fleet_on_cleaning ON public.aseo_records;
CREATE TRIGGER trigger_update_fleet_on_cleaning
  AFTER INSERT ON public.aseo_records
  FOR EACH ROW EXECUTE FUNCTION public.update_fleet_on_cleaning();

CREATE OR REPLACE FUNCTION public.weekly_reset_pending_buses()
RETURNS void AS $$
BEGIN
  UPDATE public.fleet_vehicles
  SET
    requiere_limpieza = NOT public.was_cleaned_this_week(ultima_limpieza),
    updated_at = now()
  WHERE estado = 'operativo';

  PERFORM public.refresh_pending_buses();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 9. SRL (Solicitudes y Reparaciones)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.srl_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_code text NOT NULL,
  required_date text,
  criticality text CHECK (criticality IN ('BAJA', 'MEDIA', 'ALTA')) DEFAULT 'BAJA',
  applus boolean DEFAULT false,
  status text NOT NULL DEFAULT 'CREADA',
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  closed_at timestamptz,
  technician_name text,
  technician_visit_at timestamptz,
  technician_message text,
  technician_document_url text,
  result text CHECK (result IN ('OPERATIVO', 'NO_OPERATIVO')),
  next_visit_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.srl_request_buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.srl_requests(id) ON DELETE CASCADE,
  bus_ppu text NOT NULL,
  bus_model text,
  problem_type text,
  observation text,
  applus boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.srl_bus_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_bus_id uuid REFERENCES public.srl_request_buses(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  mime_type text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.srl_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.srl_requests(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by text
);

CREATE TABLE IF NOT EXISTS public.srl_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean DEFAULT true,
  recipients text NOT NULL DEFAULT '',
  cc_emails text,
  subject_template text DEFAULT 'Solicitud SRL - {terminal} - {buses}',
  body_template text,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_srl_requests_status ON public.srl_requests(status);
CREATE INDEX IF NOT EXISTS idx_srl_requests_terminal ON public.srl_requests(terminal_code);
CREATE INDEX IF NOT EXISTS idx_srl_request_buses_ppu ON public.srl_request_buses(bus_ppu);

INSERT INTO public.srl_email_settings (recipients, subject_template)
SELECT '', 'Solicitud SRL - {terminal} - {count} Buses'
WHERE NOT EXISTS (SELECT 1 FROM public.srl_email_settings);

-- ============================================================
-- 10. INSUMOS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.supplies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL,
  life_days int,
  min_stock int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplies_name ON public.supplies(name);

CREATE TABLE IF NOT EXISTS public.supply_consumption_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_type text NOT NULL CHECK (location_type IN ('TERMINAL', 'CABEZAL')),
  location_name text NOT NULL,
  period text NOT NULL CHECK (period IN ('DAY', 'NIGHT', 'WEEKEND')),
  supply_id uuid NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(location_type, location_name, period, supply_id)
);

CREATE INDEX IF NOT EXISTS idx_consumption_profiles_location ON public.supply_consumption_profiles(location_type, location_name);

DROP TRIGGER IF EXISTS update_consumption_profiles_updated_at ON public.supply_consumption_profiles;
CREATE TRIGGER update_consumption_profiles_updated_at
  BEFORE UPDATE ON public.supply_consumption_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.supply_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('SEMANA', 'FIN_SEMANA', 'EXTRA')),
  status text NOT NULL CHECK (status IN ('PENDIENTE', 'RETIRADO')) DEFAULT 'PENDIENTE',
  receipt_path text,
  requested_at timestamptz DEFAULT now(),
  retrieved_at timestamptz,
  created_by text NOT NULL,
  consumption_snapshot jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supply_requests_terminal ON public.supply_requests(terminal);
CREATE INDEX IF NOT EXISTS idx_supply_requests_status ON public.supply_requests(status);
CREATE INDEX IF NOT EXISTS idx_supply_requests_date ON public.supply_requests(requested_at DESC);

DROP TRIGGER IF EXISTS update_supply_requests_updated_at ON public.supply_requests;
CREATE TRIGGER update_supply_requests_updated_at
  BEFORE UPDATE ON public.supply_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.supply_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.supply_requests(id) ON DELETE CASCADE,
  supply_id uuid NOT NULL REFERENCES public.supplies(id),
  quantity int NOT NULL DEFAULT 0,
  is_extra boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_request_items_request ON public.supply_request_items(request_id);

CREATE TABLE IF NOT EXISTS public.supply_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_id uuid NOT NULL REFERENCES public.supplies(id),
  staff_rut text NOT NULL,
  staff_name text NOT NULL,
  quantity int NOT NULL,
  delivered_at timestamptz DEFAULT now(),
  next_delivery_at timestamptz,
  notes text,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supply_deliveries_staff ON public.supply_deliveries(staff_rut);
CREATE INDEX IF NOT EXISTS idx_supply_deliveries_supply ON public.supply_deliveries(supply_id);
CREATE INDEX IF NOT EXISTS idx_supply_deliveries_next ON public.supply_deliveries(next_delivery_at);

CREATE TABLE IF NOT EXISTS public.supply_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL CHECK (trigger IN ('MONDAY', 'FRIDAY', 'MANUAL')),
  recipients text NOT NULL,
  subject text NOT NULL DEFAULT 'Solicitud de Insumos',
  body text NOT NULL DEFAULT '',
  enabled boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(trigger)
);

DROP TRIGGER IF EXISTS update_supply_email_settings_updated_at ON public.supply_email_settings;
CREATE TRIGGER update_supply_email_settings_updated_at
  BEFORE UPDATE ON public.supply_email_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.supplies (name, unit, life_days, min_stock)
SELECT v.name, v.unit, v.life_days, v.min_stock
FROM (VALUES
  ('Nova', 'unidad', NULL::int, 10),
  ('Confort', 'unidad', NULL, 15),
  ('Bolsas chicas', 'paquete', NULL, 5),
  ('Bolsas grandes', 'paquete', NULL, 5),
  ('Traperos', 'unidad', 30, 3),
  ('Escobillones', 'unidad', 60, 2),
  ('Dispensadores', 'unidad', NULL, 1),
  ('Pulverizador', 'unidad', NULL, 2),
  ('Jabon', 'bidon', NULL, 2)
) AS v(name, unit, life_days, min_stock)
WHERE NOT EXISTS (SELECT 1 FROM public.supplies s WHERE s.name = v.name);

INSERT INTO public.supply_email_settings (trigger, recipients, subject, body, enabled) VALUES
  ('MONDAY', '', 'Solicitud Semanal de Insumos', 'Adjunto solicitud de insumos para la semana.', true),
  ('FRIDAY', '', 'Solicitud Fin de Semana - Insumos', 'Adjunto solicitud de insumos para el fin de semana.', true),
  ('MANUAL', '', 'Solicitud Manual de Insumos', 'Solicitud manual de insumos.', true)
ON CONFLICT (trigger) DO NOTHING;

-- ============================================================
-- 11. TAREAS - TABLAS COMPLEMENTARIAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('FILE', 'URL')),
  storage_path text,
  url text,
  file_name text,
  mime_type text,
  size_bytes int,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL CHECK (scope_type IN ('GLOBAL', 'TERMINAL')),
  scope_code text NOT NULL,
  enabled boolean DEFAULT true,
  cc_emails text,
  subject_templates jsonb NOT NULL DEFAULT '{
    "assigned": "Nueva tarea asignada: {{title}}",
    "status_change": "Tarea actualizada: {{title}}",
    "overdue": "Tarea vencida: {{title}}",
    "evaluated_ok": "Tarea evaluada: {{title}}",
    "evaluated_reject": "Tarea rechazada: {{title}}"
  }'::jsonb,
  body_templates jsonb NOT NULL DEFAULT '{
    "assigned": "Estimado/a {{assigned_name}},\n\nSe le ha asignado la tarea: {{title}}\n\nDescripcion: {{description}}\nVencimiento: {{due_date}}\nPrioridad: {{priority}}\n\nSaludos cordiales,\n{{creator}}",
    "status_change": "La tarea \"{{title}}\" ha cambiado a estado: {{status}}",
    "overdue": "La tarea \"{{title}}\" ha vencido y requiere atencion.",
    "evaluated_ok": "La tarea \"{{title}}\" ha sido evaluada y aceptada.",
    "evaluated_reject": "La tarea \"{{title}}\" ha sido rechazada.\n\nMotivo: {{reason}}"
  }'::jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(scope_type, scope_code)
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON public.task_attachments(task_id, created_at DESC);

DROP TRIGGER IF EXISTS update_task_email_settings_updated_at ON public.task_email_settings;
CREATE TRIGGER update_task_email_settings_updated_at
  BEFORE UPDATE ON public.task_email_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.task_email_settings (scope_type, scope_code, enabled)
VALUES ('GLOBAL', 'ALL', true)
ON CONFLICT (scope_type, scope_code) DO NOTHING;

-- ============================================================
-- 12. RLS + POLITICAS PERMISIVAS (todas las tablas nuevas)
-- ============================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'attendance_no_marcaciones', 'attendance_sin_credenciales', 'attendance_cambios_dia',
    'attendance_autorizaciones', 'attendance_vacaciones', 'attendance_schedule_changes',
    'meeting_invitees', 'meeting_files', 'meeting_actions', 'meeting_email_settings',
    'asis_command_logs', 'asis_command_email_settings',
    'amonestaciones', 'app_configuration',
    'aseo_cleaners', 'aseo_records', 'aseo_tasks', 'aseo_notifications',
    'fleet_vehicles',
    'srl_requests', 'srl_request_buses', 'srl_bus_images', 'srl_reports', 'srl_email_settings',
    'supplies', 'supply_consumption_profiles', 'supply_requests', 'supply_request_items',
    'supply_deliveries', 'supply_email_settings',
    'task_comments', 'task_attachments', 'task_email_settings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_public_all'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO public USING (true) WITH CHECK (true)',
        t || '_public_all', t
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 13. REALTIME (publicacion supabase_realtime)
-- ============================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'attendance_no_marcaciones', 'attendance_sin_credenciales', 'attendance_cambios_dia',
    'attendance_autorizaciones', 'attendance_vacaciones',
    'meeting_invitees', 'meeting_actions',
    'aseo_records', 'aseo_tasks', 'aseo_notifications',
    'srl_requests', 'srl_request_buses',
    'supplies', 'supply_consumption_profiles', 'supply_requests', 'supply_deliveries',
    'task_comments', 'task_attachments'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 14. BUCKETS DE STORAGE + POLITICAS
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('aseo-photos', 'aseo-photos', true),
  ('attendance-docs', 'attendance-docs', true),
  ('backup-evidence', 'backup-evidence', true),
  ('meeting-files', 'meeting-files', true),
  ('srl-documents', 'srl-documents', true),
  ('srl-images', 'srl-images', true),
  ('staff-docs', 'staff-docs', true),
  ('supply-receipts', 'supply-receipts', true),
  ('task-files', 'task-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'asiss_buckets_public_all'
  ) THEN
    CREATE POLICY asiss_buckets_public_all ON storage.objects
      FOR ALL TO public
      USING (bucket_id IN (
        'aseo-photos', 'attendance-docs', 'backup-evidence', 'meeting-files',
        'srl-documents', 'srl-images', 'staff-docs', 'supply-receipts', 'task-files'
      ))
      WITH CHECK (bucket_id IN (
        'aseo-photos', 'attendance-docs', 'backup-evidence', 'meeting-files',
        'srl-documents', 'srl-images', 'staff-docs', 'supply-receipts', 'task-files'
      ));
  END IF;
END $$;

-- ============================================================
-- 15. PERMISOS GENERALES (evita errores 404/401 de PostgREST)
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Poblar la vista de buses pendientes con la flota recien creada
REFRESH MATERIALIZED VIEW public.pending_buses_view;

-- Avisar a PostgREST que recargue el esquema (los cambios se ven al instante)
NOTIFY pgrst, 'reload schema';

SELECT 'RESTAURACION COMPLETA: esquema ASISS creado correctamente' AS resultado;
