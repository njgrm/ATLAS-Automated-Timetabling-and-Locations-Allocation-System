DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subject_qualification_priority') THEN
    CREATE TYPE subject_qualification_priority AS ENUM ('DEPARTMENT_FIRST', 'SPECIALIZATION_PRIMARY');
  END IF;
END
$$;

ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS output_label VARCHAR(64),
  ADD COLUMN IF NOT EXISTS owner_department VARCHAR(32),
  ADD COLUMN IF NOT EXISTS qualification_priority subject_qualification_priority,
  ADD COLUMN IF NOT EXISTS rotation_family VARCHAR(64),
  ADD COLUMN IF NOT EXISTS is_system_managed BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE subjects
SET
  output_label = CASE
    WHEN code LIKE 'SCI_%' THEN 'SCIENCE'
    WHEN code LIKE 'TLE%' THEN 'TLE'
    WHEN code IN ('SPA_SPEC', 'SPS_SPEC') THEN 'SPECIALIZATION'
    WHEN code = 'STE_RESEARCH' THEN 'RESEARCH'
    ELSE code
  END,
  owner_department = CASE
    WHEN code LIKE 'FIL%' THEN 'FIL'
    WHEN code LIKE 'ENG%' THEN 'ENG'
    WHEN code LIKE 'MATH%' THEN 'MATH'
    WHEN code LIKE 'AP%' THEN 'AP'
    WHEN code LIKE 'ESP%' OR code = 'HG' THEN 'ESP'
    WHEN code LIKE 'MAPEH%' THEN 'MAPEH'
    WHEN code LIKE 'TLE%' THEN 'TLE'
    WHEN code LIKE 'SCI%' OR code LIKE 'STE_%' THEN 'SCI'
    WHEN code LIKE 'SPA_%' THEN 'SPA'
    WHEN code LIKE 'SPS_%' THEN 'SPS'
    WHEN code = 'DEVL_READING' THEN 'ENG'
    ELSE owner_department
  END,
  qualification_priority = CASE
    WHEN code LIKE 'SPA_%' OR code LIKE 'SPS_%' THEN 'SPECIALIZATION_PRIMARY'::subject_qualification_priority
    ELSE 'DEPARTMENT_FIRST'::subject_qualification_priority
  END,
  rotation_family = CASE
    WHEN code LIKE 'TLE%' THEN 'TLE_ROTATION'
    WHEN modular_group_id IS NOT NULL AND modular_group_id <> '' THEN modular_group_id
    ELSE rotation_family
  END,
  is_system_managed = CASE
    WHEN code LIKE 'TLE_%_EXP' OR code LIKE 'TLE_SPEC_%' THEN TRUE
    ELSE is_system_managed
  END
WHERE
  output_label IS NULL
  OR owner_department IS NULL
  OR qualification_priority IS NULL
  OR rotation_family IS NULL
  OR (code LIKE 'TLE_%_EXP' OR code LIKE 'TLE_SPEC_%');

UPDATE subjects
SET qualification_priority = 'DEPARTMENT_FIRST'::subject_qualification_priority
WHERE qualification_priority IS NULL;

ALTER TABLE subjects
  ALTER COLUMN qualification_priority SET NOT NULL,
  ALTER COLUMN qualification_priority SET DEFAULT 'DEPARTMENT_FIRST'::subject_qualification_priority;
