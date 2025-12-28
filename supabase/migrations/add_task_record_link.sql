-- Add task_id column to aseo_records to link tasks with records
ALTER TABLE aseo_records 
ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES aseo_tasks(id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_aseo_records_task_id ON aseo_records(task_id);
CREATE INDEX IF NOT EXISTS idx_aseo_records_bus_code_date ON aseo_records(bus_code, created_at);

-- Add bus_code column to aseo_tasks if not exists (for easier querying)
ALTER TABLE aseo_tasks
ADD COLUMN IF NOT EXISTS bus_code TEXT;

CREATE INDEX IF NOT EXISTS idx_aseo_tasks_bus_code ON aseo_tasks(bus_code);
