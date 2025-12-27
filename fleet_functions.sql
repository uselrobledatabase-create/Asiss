-- ==========================================
-- FLEET INTEGRATION FUNCTIONS
-- ==========================================

-- Función para calcular días desde última limpieza
CREATE OR REPLACE FUNCTION calculate_days_since_cleaning(last_cleaning TIMESTAMP)
RETURNS INTEGER AS $$
BEGIN
    IF last_cleaning IS NULL THEN
        RETURN 999; -- Nunca limpiado
    END IF;
    RETURN EXTRACT(DAY FROM NOW() - last_cleaning)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Función para verificar si fue limpiado esta semana (lunes-domingo)
CREATE OR REPLACE FUNCTION was_cleaned_this_week(last_cleaning TIMESTAMP)
RETURNS BOOLEAN AS $$
DECLARE
    week_start TIMESTAMP;
BEGIN
    IF last_cleaning IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Calcular inicio de semana (lunes 00:00)
    week_start = DATE_TRUNC('week', NOW()) + INTERVAL '1 day';
    
    RETURN last_cleaning >= week_start;
END;
$$ LANGUAGE plpgsql;

-- Función para calcular prioridad basada en días sin limpieza
CREATE OR REPLACE FUNCTION calculate_priority(days_since INTEGER)
RETURNS TEXT AS $$
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

-- Vista materializada para buses pendientes (mejor performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS pending_buses_view AS
SELECT 
    fv.ppu,
    fv.numero_interno,
    fv.marca_modelo,
    fv.terminal,
    fv.ultima_limpieza,
    fv.estado,
    calculate_days_since_cleaning(fv.ultima_limpieza) as dias_sin_limpieza,
    was_cleaned_this_week(fv.ultima_limpieza) as limpiado_esta_semana,
    calculate_priority(calculate_days_since_cleaning(fv.ultima_limpieza)) as prioridad,
    CASE 
        WHEN was_cleaned_this_week(fv.ultima_limpieza) THEN FALSE
        ELSE TRUE
    END as requiere_limpieza
FROM 
    public.fleet_vehicles fv
WHERE 
    fv.estado = 'operativo'
ORDER BY 
    dias_sin_limpieza DESC;

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pending_buses_terminal ON pending_buses_view(terminal);
CREATE INDEX IF NOT EXISTS idx_pending_buses_prioridad ON pending_buses_view(prioridad);
CREATE INDEX IF NOT EXISTS idx_pending_buses_requiere ON pending_buses_view(requiere_limpieza);

-- Función para refrescar la vista (llamar después de cada registro)
CREATE OR REPLACE FUNCTION refresh_pending_buses()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY pending_buses_view;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar fleet_vehicles cuando se registra limpieza
CREATE OR REPLACE FUNCTION update_fleet_on_cleaning()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar ultima_limpieza en fleet_vehicles
    UPDATE public.fleet_vehicles
    SET 
        ultima_limpieza = NEW.created_at,
        requiere_limpieza = FALSE,
        updated_at = NOW()
    WHERE ppu = NEW.bus_ppu;
    
    -- Refrescar vista de pendientes
    PERFORM refresh_pending_buses();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger en aseo_records
DROP TRIGGER IF EXISTS trigger_update_fleet_on_cleaning ON public.aseo_records;
CREATE TRIGGER trigger_update_fleet_on_cleaning
    AFTER INSERT ON public.aseo_records
    FOR EACH ROW
    EXECUTE FUNCTION update_fleet_on_cleaning();

-- Función para reset semanal (ejecutar cada lunes 00:00 via cron)
CREATE OR REPLACE FUNCTION weekly_reset_pending_buses()
RETURNS VOID AS $$
BEGIN
    -- Marcar todos los buses como requiere_limpieza si no fueron limpiados esta semana
    UPDATE public.fleet_vehicles
    SET 
        requiere_limpieza = NOT was_cleaned_this_week(ultima_limpieza),
        updated_at = NOW()
    WHERE estado = 'operativo';
    
    -- Refrescar vista
    PERFORM refresh_pending_buses();
    
    -- Log del reset
    RAISE NOTICE 'Weekly reset completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Comentarios
COMMENT ON FUNCTION calculate_days_since_cleaning IS 'Calcula días desde última limpieza, retorna 999 si nunca fue limpiado';
COMMENT ON FUNCTION was_cleaned_this_week IS 'Verifica si el bus fue limpiado en la semana actual (lunes-domingo)';
COMMENT ON FUNCTION calculate_priority IS 'Calcula prioridad: ALTA (>7 días), MEDIA (4-7 días), BAJA (<4 días)';
COMMENT ON MATERIALIZED VIEW pending_buses_view IS 'Vista materializada de buses pendientes con cálculos de prioridad';
COMMENT ON FUNCTION weekly_reset_pending_buses IS 'Reset semanal - ejecutar cada lunes 00:00 via pg_cron';

-- Refrescar vista inicial
REFRESH MATERIALIZED VIEW pending_buses_view;
