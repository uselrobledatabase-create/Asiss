-- ==========================================
-- FIX RLS PARA staff_2026
-- ==========================================
-- Permitir lectura pública de staff_2026 para login de Aseo

-- Habilitar RLS si no está habilitado
ALTER TABLE public.staff_2026 ENABLE ROW LEVEL SECURITY;

-- Crear política de lectura pública
DROP POLICY IF EXISTS "Allow public read access to staff_2026" ON public.staff_2026;
CREATE POLICY "Allow public read access to staff_2026"
    ON public.staff_2026
    FOR SELECT
    USING (true);

-- Verificar que funciona
SELECT COUNT(*) FROM public.staff_2026;

-- Comentario
COMMENT ON POLICY "Allow public read access to staff_2026" ON public.staff_2026 
IS 'Permite lectura pública de staff_2026 para login de Aseo';
