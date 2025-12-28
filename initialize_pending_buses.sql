-- ==========================================
-- INICIALIZAR BUSES PENDIENTES
-- ==========================================
-- Este script marca TODOS los buses como pendientes inicialmente

-- Marcar todos los buses operativos como pendientes
UPDATE public.fleet_vehicles
SET 
    requiere_limpieza = TRUE,
    ultima_limpieza = NULL,
    updated_at = NOW()
WHERE estado = 'operativo';

-- Verificar cuántos buses quedaron pendientes
SELECT 
    COUNT(*) as total_pendientes,
    terminal,
    COUNT(*) FILTER (WHERE requiere_limpieza = TRUE) as pendientes
FROM public.fleet_vehicles
WHERE estado = 'operativo'
GROUP BY terminal;

-- Resultado esperado: Todos los buses operativos deben tener requiere_limpieza = TRUE
