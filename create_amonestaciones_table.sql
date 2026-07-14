-- Create Amonestaciones Table
CREATE TABLE IF NOT EXISTS public.amonestaciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    
    -- Worker
    worker_rut TEXT NOT NULL,
    worker_name TEXT NOT NULL,
    worker_cargo TEXT NOT NULL,
    worker_base TEXT,
    shift_schedule TEXT,

    -- Sanction
    sanction_code_id INTEGER NOT NULL,
    description TEXT NOT NULL, -- The generated/edited narrative

    -- Place
    place_terminal TEXT,
    place_public_way TEXT,
    place_vehicle TEXT,
    place_ppu TEXT,
    place_detail TEXT,

    -- Involved
    involved_jefatura TEXT,
    involved_companeros TEXT,
    involved_other TEXT,

    -- Witnesses
    witness1_name TEXT,
    witness1_rut TEXT,
    witness1_cargo TEXT,
    
    witness2_name TEXT,
    witness2_rut TEXT,
    witness2_cargo TEXT,

    -- Responsible
    responsible_name TEXT NOT NULL,
    responsible_cargo TEXT NOT NULL,

    -- Metadata
    document_path TEXT,
    created_by UUID DEFAULT auth.uid(),
    status TEXT DEFAULT 'GENERATED'
);

-- Enable RLS
ALTER TABLE public.amonestaciones ENABLE ROW LEVEL SECURITY;

-- Policies (Permissive for authenticated users for now)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.amonestaciones;
CREATE POLICY "Enable all access for authenticated users" ON public.amonestaciones
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.amonestaciones TO authenticated;
GRANT ALL ON public.amonestaciones TO service_role;
