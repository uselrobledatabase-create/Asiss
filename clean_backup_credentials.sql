-- =====================================================
-- SCRIPT: Limpiar Credenciales de Respaldo
-- Descripción: Elimina todos los registros de credenciales
-- de respaldo del sistema
-- =====================================================

-- IMPORTANTE: Este script eliminará TODOS los registros
-- de credenciales de respaldo. Ejecutar con precaución.

BEGIN;

-- 1. Eliminar todos los registros de credenciales de respaldo
-- Nota: El nombre correcto de la tabla puede variar. Verifica en tu schema.
-- Opciones comunes: backup_credentials, credentials_backup, credenciales_respaldo

-- Opción 1: Si la tabla se llama 'credenciales_respaldo'
DELETE FROM credenciales_respaldo;

-- Opción 2: Si la tabla tiene otro nombre, descomenta y ajusta:
-- DELETE FROM backup_requests;
-- DELETE FROM credential_loans;

-- 2. Resetear secuencia (opcional, para reiniciar IDs)
-- ALTER SEQUENCE credenciales_respaldo_id_seq RESTART WITH 1;

COMMIT;

-- =====================================================
-- NOTA: Eliminación de archivos PDF del Storage
-- =====================================================
-- Los PDFs firmados en Supabase Storage deben eliminarse
-- manualmente desde el panel de Supabase.
--
-- 1. Ve a Storage → (busca el bucket de credenciales)
-- 2. Selecciona todos los archivos
-- 3. Elimina
-- =====================================================

-- Verificar que se eliminaron los registros
SELECT COUNT(*) as registros_restantes FROM credenciales_respaldo;
