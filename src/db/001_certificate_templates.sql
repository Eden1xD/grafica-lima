CREATE TABLE IF NOT EXISTS certificate_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL,
 pdf_base64 text NOT NULL,
 layout jsonb NOT NULL DEFAULT '{}'::jsonb,
 sponsors jsonb NOT NULL DEFAULT '[]'::jsonb,
 active boolean NOT NULL DEFAULT false,
 course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS certificate_templates_one_global_active ON certificate_templates (active) WHERE active = true AND course_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS certificate_templates_one_course_active ON certificate_templates (course_id) WHERE active = true AND course_id IS NOT NULL;
