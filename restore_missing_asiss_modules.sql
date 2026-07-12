-- ==========================================
-- ASISS - RESTAURAR MODULOS FALTANTES
-- ==========================================
-- Este script agrega las tablas que hoy faltan en el proyecto
-- wvcplgwemvqhvtstlqmt para que el frontend ASISS deje de fallar.
--
-- Importante:
-- 1. Es idempotente. Puedes ejecutarlo mas de una vez.
-- 2. Crea esquema y permisos, pero NO recupera datos historicos borrados.
-- 3. Si la data antigua estaba en otro proyecto Supabase eliminado,
--    este script no la puede reconstruir.
-- ==========================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

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
END $$;

-- ==========================================
-- ASISTENCIA CLASICA
-- ==========================================

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

DROP TRIGGER IF EXISTS update_no_marcaciones_updated_at ON public.attendance_no_marcaciones;
CREATE TRIGGER update_no_marcaciones_updated_at
  BEFORE UPDATE ON public.attendance_no_marcaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sin_credenciales_updated_at ON public.attendance_sin_credenciales;
CREATE TRIGGER update_sin_credenciales_updated_at
  BEFORE UPDATE ON public.attendance_sin_credenciales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_cambios_dia_updated_at ON public.attendance_cambios_dia;
CREATE TRIGGER update_cambios_dia_updated_at
  BEFORE UPDATE ON public.attendance_cambios_dia
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_autorizaciones_updated_at ON public.attendance_autorizaciones;
CREATE TRIGGER update_autorizaciones_updated_at
  BEFORE UPDATE ON public.attendance_autorizaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vacaciones_updated_at ON public.attendance_vacaciones;
CREATE TRIGGER update_vacaciones_updated_at
  BEFORE UPDATE ON public.attendance_vacaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.attendance_no_marcaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sin_credenciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_cambios_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_autorizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_vacaciones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_no_marcaciones' AND policyname = 'attendance_no_marcaciones_public_all') THEN
    CREATE POLICY attendance_no_marcaciones_public_all ON public.attendance_no_marcaciones FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_sin_credenciales' AND policyname = 'attendance_sin_credenciales_public_all') THEN
    CREATE POLICY attendance_sin_credenciales_public_all ON public.attendance_sin_credenciales FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_cambios_dia' AND policyname = 'attendance_cambios_dia_public_all') THEN
    CREATE POLICY attendance_cambios_dia_public_all ON public.attendance_cambios_dia FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_autorizaciones' AND policyname = 'attendance_autorizaciones_public_all') THEN
    CREATE POLICY attendance_autorizaciones_public_all ON public.attendance_autorizaciones FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_vacaciones' AND policyname = 'attendance_vacaciones_public_all') THEN
    CREATE POLICY attendance_vacaciones_public_all ON public.attendance_vacaciones FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.attendance_no_marcaciones TO anon, authenticated, service_role;
GRANT ALL ON public.attendance_sin_credenciales TO anon, authenticated, service_role;
GRANT ALL ON public.attendance_cambios_dia TO anon, authenticated, service_role;
GRANT ALL ON public.attendance_autorizaciones TO anon, authenticated, service_role;
GRANT ALL ON public.attendance_vacaciones TO anon, authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_no_marcaciones') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_no_marcaciones;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_sin_credenciales') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_sin_credenciales;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_cambios_dia') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_cambios_dia;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_autorizaciones') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_autorizaciones;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_vacaciones') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_vacaciones;
  END IF;
END $$;

-- ==========================================
-- REUNIONES - TABLAS COMPLEMENTARIAS
-- ==========================================

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
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_email_settings_updated_at ON public.meeting_email_settings;
CREATE TRIGGER update_meeting_email_settings_updated_at
  BEFORE UPDATE ON public.meeting_email_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.meeting_invitees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_email_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meeting_invitees' AND policyname = 'meeting_invitees_public_all') THEN
    CREATE POLICY meeting_invitees_public_all ON public.meeting_invitees FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meeting_files' AND policyname = 'meeting_files_public_all') THEN
    CREATE POLICY meeting_files_public_all ON public.meeting_files FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meeting_actions' AND policyname = 'meeting_actions_public_all') THEN
    CREATE POLICY meeting_actions_public_all ON public.meeting_actions FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meeting_email_settings' AND policyname = 'meeting_email_settings_public_all') THEN
    CREATE POLICY meeting_email_settings_public_all ON public.meeting_email_settings FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.meeting_invitees TO anon, authenticated, service_role;
GRANT ALL ON public.meeting_files TO anon, authenticated, service_role;
GRANT ALL ON public.meeting_actions TO anon, authenticated, service_role;
GRANT ALL ON public.meeting_email_settings TO anon, authenticated, service_role;

INSERT INTO public.meeting_email_settings (scope_type, scope_code, enabled)
VALUES ('GLOBAL', 'ALL', true)
ON CONFLICT (scope_type, scope_code) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'meeting_invitees') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_invitees;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'meeting_actions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_actions;
  END IF;
END $$;

-- ==========================================
-- ASIS COMMAND
-- ==========================================

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

ALTER TABLE public.asis_command_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asis_command_email_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'asis_command_logs' AND policyname = 'asis_command_logs_public_all') THEN
    CREATE POLICY asis_command_logs_public_all ON public.asis_command_logs FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'asis_command_email_settings' AND policyname = 'asis_command_email_settings_public_all') THEN
    CREATE POLICY asis_command_email_settings_public_all ON public.asis_command_email_settings FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.asis_command_logs TO anon, authenticated, service_role;
GRANT ALL ON public.asis_command_email_settings TO anon, authenticated, service_role;

INSERT INTO public.asis_command_email_settings (intent, recipients, subject_template, enabled)
VALUES
  ('VACACIONES', '', 'Vacaciones registradas - {nombre}', true),
  ('LICENCIA', '', 'Licencia medica registrada - {nombre}', true),
  ('PERMISO', '', 'Permiso registrado - {nombre}', true),
  ('AUTORIZACION_LLEGADA', '', 'Llegada tardia autorizada - {nombre}', true),
  ('AUTORIZACION_SALIDA', '', 'Salida anticipada autorizada - {nombre}', true)
ON CONFLICT (intent) DO NOTHING;

-- ==========================================
-- AMONESTACIONES
-- ==========================================

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

ALTER TABLE public.amonestaciones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'amonestaciones' AND policyname = 'amonestaciones_public_all') THEN
    CREATE POLICY amonestaciones_public_all ON public.amonestaciones FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.amonestaciones TO anon, authenticated, service_role;

SELECT 'restore_missing_asiss_modules.sql ejecutado correctamente' AS status;
