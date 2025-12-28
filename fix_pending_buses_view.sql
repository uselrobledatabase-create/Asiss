-- ==========================================
-- FIX: Add unique index to pending_buses_view
-- ==========================================
-- Error: cannot refresh materialized view "public.pending_buses_view" concurrently
-- Solution: Create unique index on PPU (primary key)

-- Drop existing view
DROP MATERIALIZED VIEW IF EXISTS public.pending_buses_view;

-- Recreate view
CREATE MATERIALIZED VIEW public.pending_buses_view AS
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

-- CREATE UNIQUE INDEX (CRITICAL FOR CONCURRENT REFRESH)
CREATE UNIQUE INDEX pending_buses_view_ppu_idx ON public.pending_buses_view (ppu);

-- Refresh the view
REFRESH MATERIALIZED VIEW public.pending_buses_view;

-- Verify
SELECT COUNT(*) as total_pending FROM public.pending_buses_view WHERE requiere_limpieza = TRUE;

-- Comment
COMMENT ON MATERIALIZED VIEW public.pending_buses_view IS 'Vista materializada de buses pendientes con índice único en PPU para refresh concurrente';
