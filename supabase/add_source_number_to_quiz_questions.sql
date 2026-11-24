-- Preserve printed OCR numbers independently of scan/insertion order.
ALTER TABLE public.course_quiz_questions
    ADD COLUMN IF NOT EXISTS source_number integer CHECK (source_number > 0);
COMMENT ON COLUMN public.course_quiz_questions.source_number IS
    'Printed OCR question number; NULL for legacy/manual questions. Not unique across source documents.';
NOTIFY pgrst, 'reload schema';
