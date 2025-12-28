-- Función para buscar staff por RUT limpio (sin puntos ni guiones)
CREATE OR REPLACE FUNCTION find_staff_by_cleaned_rut(search_rut TEXT)
RETURNS TABLE (
    nombre TEXT,
    rut TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.nombre,
        s.rut
    FROM staff_2026 s
    WHERE REPLACE(REPLACE(s.rut, '.', ''), '-', '') = search_rut
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Comentario
COMMENT ON FUNCTION find_staff_by_cleaned_rut IS 'Busca staff por RUT ignorando puntos y guiones. Ejemplo: 18.866.264-1 = 188662641';
