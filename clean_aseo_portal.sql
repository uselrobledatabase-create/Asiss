-- =====================================================
-- SCRIPT: Limpiar Portal Móvil de Aseo
-- Descripción: Elimina todos los registros, tareas e imágenes
-- del portal móvil de Aseo
-- =====================================================

-- IMPORTANTE: Este script eliminará TODOS los datos del portal Aseo
-- Ejecutar con precaución

BEGIN;

-- 1. Eliminar todas las tareas de aseo
DELETE FROM aseo_tasks;

-- 2. Eliminar todos los registros de aseo
DELETE FROM aseo_records;

-- 3. Resetear secuencias (opcional, para reiniciar IDs)
-- ALTER SEQUENCE aseo_tasks_id_seq RESTART WITH 1;
-- ALTER SEQUENCE aseo_records_id_seq RESTART WITH 1;

COMMIT;

-- =====================================================
-- NOTA: Eliminación de imágenes del Storage
-- =====================================================
-- Las imágenes en Supabase Storage deben eliminarse manualmente
-- desde el panel de Supabase o mediante código:
--
-- 1. Ve a Storage → aseo-photos
-- 2. Selecciona todos los archivos
-- 3. Elimina
--
-- O ejecuta este código en JavaScript/TypeScript:
--
-- const { data: files } = await supabase.storage
--   .from('aseo-photos')
--   .list();
--
-- if (files) {
--   const filePaths = files.map(file => file.name);
--   await supabase.storage
--     .from('aseo-photos')
--     .remove(filePaths);
-- }
-- =====================================================

-- Verificar que se eliminaron los registros
SELECT 
  (SELECT COUNT(*) FROM aseo_tasks) as tareas_restantes,
  (SELECT COUNT(*) FROM aseo_records) as registros_restantes;
