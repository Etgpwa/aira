ALTER TABLE public.course_quiz_questions
  ADD COLUMN IF NOT EXISTS ocr_images JSONB NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(ocr_images) = 'array');
