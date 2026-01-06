-- ========================================================
-- SCRIPT: Arreglar Permisos (RLS) para SRL
-- Descripción: Garantiza que la "Sesión Inspector" y "Admin"
-- puedan leer la configuración de email y gestionar solicitudes.
-- ========================================================

-- 1. Habilitar RLS en las tablas (por seguridad, si no estaba)
ALTER TABLE srl_email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE srl_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE srl_request_buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE srl_bus_images ENABLE ROW LEVEL SECURITY;

-- ========================================================
-- TABLA: srl_email_settings
-- Problema: El inspector no podía leer la configuración de email
-- ========================================================

-- Borrar políticas viejas para evitar conflictos
DROP POLICY IF EXISTS "Enable read access for all users" ON srl_email_settings;
DROP POLICY IF EXISTS "Enable insert for all users srl_email_cfg" ON srl_email_settings;
DROP POLICY IF EXISTS "Enable update for all users srl_email_cfg" ON srl_email_settings;
DROP POLICY IF EXISTS "Allow authenticated read access" ON srl_email_settings;

-- Crear política PERMISIVA DE LECTURA para autenticados
-- Esto permite que cualquier usuario logueado (Admin o Inspector) lea la config
CREATE POLICY "srl_email_settings_select_policy" 
ON srl_email_settings FOR SELECT 
TO authenticated 
USING (true);

-- Política de Modificación (Inserción/Actualización) 
-- Idealmente solo admins, pero por compatibilidad dejamos authenticated
CREATE POLICY "srl_email_settings_modify_policy" 
ON srl_email_settings FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- ========================================================
-- TABLA: srl_requests
-- Asegurar que todos pueden ver y crear solicitudes
-- ========================================================

DROP POLICY IF EXISTS "srl_requests_all_policy" ON srl_requests;

CREATE POLICY "srl_requests_all_policy" 
ON srl_requests FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- ========================================================
-- TABLA: srl_request_buses
-- ========================================================

DROP POLICY IF EXISTS "srl_request_buses_all_policy" ON srl_request_buses;

CREATE POLICY "srl_request_buses_all_policy" 
ON srl_request_buses FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- ========================================================
-- TABLA: srl_bus_images
-- ========================================================

DROP POLICY IF EXISTS "srl_bus_images_all_policy" ON srl_bus_images;

CREATE POLICY "srl_bus_images_all_policy" 
ON srl_bus_images FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
