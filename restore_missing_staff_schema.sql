-- =============================================
-- RESTORE MISSING STAFF / ATTENDANCE / BACKUP SCHEMA
-- Safe to run on a partially initialized database.
-- It only creates the tables/types/policies that ASISS still expects.
-- =============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================
-- SHARED FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- PERSONAL
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_status') THEN
    CREATE TYPE staff_status AS ENUM ('ACTIVO', 'DESVINCULADO');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rut TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  cargo TEXT NOT NULL,
  terminal_code TEXT NOT NULL,
  turno TEXT NOT NULL,
  horario TEXT NOT NULL,
  contacto TEXT NOT NULL,
  email TEXT,
  talla_polera TEXT,
  talla_chaqueta TEXT,
  talla_pantalon TEXT,
  talla_zapato_seguridad TEXT,
  talla_chaleco_reflectante TEXT,
  status staff_status NOT NULL DEFAULT 'ACTIVO',
  suspended BOOLEAN NOT NULL DEFAULT false,
  terminated_at TIMESTAMPTZ,
  termination_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_rut ON public.staff(rut);
CREATE INDEX IF NOT EXISTS idx_staff_terminal ON public.staff(terminal_code);
CREATE INDEX IF NOT EXISTS idx_staff_cargo ON public.staff(cargo);
CREATE INDEX IF NOT EXISTS idx_staff_status ON public.staff(status);

DROP TRIGGER IF EXISTS update_staff_updated_at ON public.staff;
CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.staff_admonitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  admonition_date DATE NOT NULL,
  document_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admonitions_staff ON public.staff_admonitions(staff_id, admonition_date DESC);

CREATE TABLE IF NOT EXISTS public.staff_caps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('TERMINAL_GROUP', 'TERMINAL', 'COMPANY')),
  scope_code TEXT NOT NULL,
  cargo TEXT NOT NULL,
  max_q INT NOT NULL CHECK (max_q >= 0),
  UNIQUE(scope_type, scope_code, cargo)
);

INSERT INTO public.staff_caps (scope_type, scope_code, cargo, max_q)
VALUES
  ('TERMINAL_GROUP', 'ER_LR', 'conductor', 12),
  ('TERMINAL_GROUP', 'ER_LR', 'inspector_patio', 21),
  ('TERMINAL_GROUP', 'ER_LR', 'cleaner', 36),
  ('TERMINAL_GROUP', 'ER_LR', 'planillero', 9),
  ('TERMINAL_GROUP', 'ER_LR', 'supervisor', 7)
ON CONFLICT (scope_type, scope_code, cargo) DO UPDATE
SET max_q = EXCLUDED.max_q;

-- =============================================
-- ATTENDANCE 2026 CORE
-- =============================================

CREATE TABLE IF NOT EXISTS public.shift_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  pattern_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_types_code ON public.shift_types(code);

CREATE TABLE IF NOT EXISTS public.staff_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  shift_type_code TEXT NOT NULL REFERENCES public.shift_types(code),
  variant_code TEXT NOT NULL CHECK (variant_code IN ('PRINCIPAL', 'CONTRATURNO', 'SUPER', 'FIJO', 'ESPECIAL', 'RELEVO')),
  start_date DATE NOT NULL DEFAULT DATE '2026-01-01',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff ON public.staff_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_type ON public.staff_shifts(shift_type_code);

CREATE TABLE IF NOT EXISTS public.staff_shift_special_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE UNIQUE,
  cycle_days INT NOT NULL DEFAULT 28,
  off_days_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings_json JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_special_templates_staff ON public.staff_shift_special_templates(staff_id);

DROP TRIGGER IF EXISTS update_special_templates_updated_at ON public.staff_shift_special_templates;
CREATE TRIGGER update_special_templates_updated_at
  BEFORE UPDATE ON public.staff_shift_special_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.staff_shift_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  override_type TEXT NOT NULL CHECK (override_type IN ('OFF', 'WORK', 'CUSTOM')),
  meta_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, override_date)
);

CREATE INDEX IF NOT EXISTS idx_shift_overrides_staff_date ON public.staff_shift_overrides(staff_id, override_date);

CREATE TABLE IF NOT EXISTS public.attendance_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  mark_date DATE NOT NULL,
  mark TEXT NOT NULL CHECK (mark IN ('P', 'A')),
  note TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, mark_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_marks_staff_date ON public.attendance_marks(staff_id, mark_date);
CREATE INDEX IF NOT EXISTS idx_attendance_marks_date ON public.attendance_marks(mark_date);

CREATE TABLE IF NOT EXISTS public.attendance_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  note TEXT,
  document_path TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_license_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_licenses_staff ON public.attendance_licenses(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendance_licenses_dates ON public.attendance_licenses(start_date, end_date);

CREATE TABLE IF NOT EXISTS public.attendance_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  permission_type TEXT NOT NULL DEFAULT 'PERSONAL',
  note TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_permission_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_permissions_staff ON public.attendance_permissions(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendance_permissions_dates ON public.attendance_permissions(start_date, end_date);

CREATE TABLE IF NOT EXISTS public.attendance_2026_email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('GLOBAL', 'TERMINAL')),
  scope_code TEXT NOT NULL,
  recipients TEXT NOT NULL DEFAULT '',
  subject_template TEXT NOT NULL DEFAULT 'Notificación de Asistencia',
  body_template TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(scope_type, scope_code)
);

DROP TRIGGER IF EXISTS update_attendance_2026_email_settings_updated_at ON public.attendance_2026_email_settings;
CREATE TRIGGER update_attendance_2026_email_settings_updated_at
  BEFORE UPDATE ON public.attendance_2026_email_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.offboarding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  staff_rut TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  terminal_code TEXT NOT NULL,
  reason TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ENVIADA', 'APROBADA', 'RECHAZADA')) DEFAULT 'ENVIADA',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offboarding_staff ON public.offboarding_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_offboarding_status ON public.offboarding_requests(status);
CREATE INDEX IF NOT EXISTS idx_offboarding_terminal ON public.offboarding_requests(terminal_code);

INSERT INTO public.shift_types (code, name, pattern_json)
VALUES
  ('5X2_FIJO', '5x2 Fijo', '{"type":"fixed","description":"Lunes a Viernes trabaja, Sábado y Domingo libre","offDays":[6,0]}'::jsonb),
  ('5X2_ROTATIVO', '5x2 Rotativo', '{"type":"rotating","description":"Semana 1: Miércoles+Domingo libre. Semana 2: Viernes+Sábado libre","cycle":2,"weeks":[{"offDays":[3,0]},{"offDays":[5,6]}]}'::jsonb),
  ('5X2_SUPER', '5x2 Super', '{"type":"fixed","description":"Lunes a Viernes trabaja, Sábado y Domingo libre","offDays":[6,0]}'::jsonb),
  ('ESPECIAL', 'Especial 28 días', '{"type":"manual","description":"Plantilla especial editable de 28 días","cycleDays":28}'::jsonb),
  ('SUPERVISOR_RELEVO', 'Supervisor Relevo', '{"type":"fixed","description":"Lunes a Viernes trabaja, Sábado y Domingo libre","offDays":[6,0]}'::jsonb)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    pattern_json = EXCLUDED.pattern_json;

-- =============================================
-- CREDENCIALES DE RESPALDO
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backup_card_status_enum') THEN
    CREATE TYPE backup_card_status_enum AS ENUM ('LIBRE', 'ASIGNADA', 'INACTIVA');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backup_loan_status_enum') THEN
    CREATE TYPE backup_loan_status_enum AS ENUM ('ASIGNADA', 'RECUPERADA', 'CERRADA', 'CANCELADA');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backup_reason_enum') THEN
    CREATE TYPE backup_reason_enum AS ENUM ('PERDIDA', 'DETERIORO');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.backup_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_number TEXT UNIQUE NOT NULL,
  inventory_terminal TEXT NOT NULL CHECK (inventory_terminal IN ('El Roble', 'La Reina', 'Maria Angelica')),
  status backup_card_status_enum NOT NULL DEFAULT 'LIBRE',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backup_cards_terminal_status ON public.backup_cards(inventory_terminal, status);

DROP TRIGGER IF EXISTS update_backup_cards_updated_at ON public.backup_cards;
CREATE TRIGGER update_backup_cards_updated_at
  BEFORE UPDATE ON public.backup_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.backup_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.backup_cards(id),
  person_rut TEXT NOT NULL,
  person_name TEXT NOT NULL,
  person_cargo TEXT,
  person_terminal TEXT NOT NULL,
  person_turno TEXT,
  person_horario TEXT,
  person_contacto TEXT,
  boss_email TEXT,
  reason backup_reason_enum NOT NULL,
  requested_at DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_return_days INT NOT NULL DEFAULT 3,
  alert_after_days INT NOT NULL DEFAULT 7,
  status backup_loan_status_enum NOT NULL DEFAULT 'ASIGNADA',
  recovered_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  cancel_reason TEXT,
  discount_amount INT NOT NULL DEFAULT 5000,
  discount_applied BOOLEAN NOT NULL DEFAULT true,
  discount_evidence_path TEXT,
  created_by_supervisor TEXT NOT NULL,
  emails_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_backup_loans_active_card ON public.backup_loans(card_id) WHERE status = 'ASIGNADA';
CREATE INDEX IF NOT EXISTS idx_backup_loans_person_rut ON public.backup_loans(person_rut);
CREATE INDEX IF NOT EXISTS idx_backup_loans_terminal_status ON public.backup_loans(person_terminal, status, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_loans_status_issued ON public.backup_loans(status, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_loans_issued ON public.backup_loans(issued_at DESC);

DROP TRIGGER IF EXISTS update_backup_loans_updated_at ON public.backup_loans;
CREATE TRIGGER update_backup_loans_updated_at
  BEFORE UPDATE ON public.backup_loans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.backup_email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('GLOBAL', 'TERMINAL')),
  scope_code TEXT NOT NULL,
  manager_email TEXT NOT NULL,
  cc_emails TEXT,
  subject_manager TEXT NOT NULL DEFAULT 'Solicitud de Nueva Credencial',
  subject_boss TEXT NOT NULL DEFAULT 'Notificación de Credencial de Respaldo',
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(scope_type, scope_code)
);

DROP TRIGGER IF EXISTS update_backup_email_settings_updated_at ON public.backup_email_settings;
CREATE TRIGGER update_backup_email_settings_updated_at
  BEFORE UPDATE ON public.backup_email_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- REALTIME
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'staff') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'staff_admonitions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_admonitions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'shift_types') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_types;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'staff_shifts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_shifts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'attendance_marks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_marks;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'attendance_licenses') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_licenses;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'attendance_permissions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_permissions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'offboarding_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.offboarding_requests;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'backup_cards') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.backup_cards;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'backup_loans') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.backup_loans;
  END IF;
END $$;

-- =============================================
-- RLS
-- =============================================

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_admonitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_caps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_shift_special_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_shift_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_2026_email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offboarding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_email_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'staff' AND policyname = 'Allow all for staff') THEN
    CREATE POLICY "Allow all for staff" ON public.staff FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'staff_admonitions' AND policyname = 'Allow all for admonitions') THEN
    CREATE POLICY "Allow all for admonitions" ON public.staff_admonitions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'staff_caps' AND policyname = 'Allow read for caps') THEN
    CREATE POLICY "Allow read for caps" ON public.staff_caps FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shift_types' AND policyname = 'Allow all for shift_types') THEN
    CREATE POLICY "Allow all for shift_types" ON public.shift_types FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'staff_shifts' AND policyname = 'Allow all for staff_shifts') THEN
    CREATE POLICY "Allow all for staff_shifts" ON public.staff_shifts FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'staff_shift_special_templates' AND policyname = 'Allow all for staff_shift_special_templates') THEN
    CREATE POLICY "Allow all for staff_shift_special_templates" ON public.staff_shift_special_templates FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'staff_shift_overrides' AND policyname = 'Allow all for staff_shift_overrides') THEN
    CREATE POLICY "Allow all for staff_shift_overrides" ON public.staff_shift_overrides FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_marks' AND policyname = 'Allow all for attendance_marks') THEN
    CREATE POLICY "Allow all for attendance_marks" ON public.attendance_marks FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_licenses' AND policyname = 'Allow all for attendance_licenses') THEN
    CREATE POLICY "Allow all for attendance_licenses" ON public.attendance_licenses FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_permissions' AND policyname = 'Allow all for attendance_permissions') THEN
    CREATE POLICY "Allow all for attendance_permissions" ON public.attendance_permissions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_2026_email_settings' AND policyname = 'Allow all for attendance_2026_email_settings') THEN
    CREATE POLICY "Allow all for attendance_2026_email_settings" ON public.attendance_2026_email_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'offboarding_requests' AND policyname = 'Allow all for offboarding_requests') THEN
    CREATE POLICY "Allow all for offboarding_requests" ON public.offboarding_requests FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'backup_cards' AND policyname = 'Allow all for backup_cards') THEN
    CREATE POLICY "Allow all for backup_cards" ON public.backup_cards FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'backup_loans' AND policyname = 'Allow all for backup_loans') THEN
    CREATE POLICY "Allow all for backup_loans" ON public.backup_loans FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'backup_email_settings' AND policyname = 'Allow all for backup_email_settings') THEN
    CREATE POLICY "Allow all for backup_email_settings" ON public.backup_email_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
