ALTER TABLE public.course_quiz_questions
    ADD COLUMN IF NOT EXISTS user_note_images JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(user_note_images) = 'array' AND jsonb_array_length(user_note_images) <= 8);

-- Append crops atomically without rewriting question, option, or existing answer images.
CREATE OR REPLACE FUNCTION public.append_quiz_answer_images(
    question_id UUID, target_module_id UUID, images JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.course_quiz_questions AS q
    SET ocr_images = q.ocr_images || COALESCE((
        SELECT jsonb_agg(item.image ORDER BY item.position)
        FROM jsonb_array_elements(images) WITH ORDINALITY AS item(image, position)
        WHERE item.image->>'field' = 'correct_answer'
          AND NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements(q.ocr_images) AS existing(image)
              WHERE existing.image->>'field' = 'correct_answer'
                AND existing.image->>'data' = item.image->>'data'
          )
    ), '[]'::jsonb)
    WHERE q.id = question_id
      AND q.module_id = target_module_id
      AND q.user_id = auth.uid()
      AND q.question_type = 'ESSAY';
    RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.append_quiz_answer_images(UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_quiz_answer_images(UUID, UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_quiz_note_images(
    question_id UUID, added JSONB, removed TEXT
) RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    UPDATE public.course_quiz_questions AS q
    SET user_note_images = COALESCE((
        SELECT jsonb_agg(unique_item.image ORDER BY unique_item.position)
        FROM (
            SELECT item.image, min(item.position) AS position
            FROM jsonb_array_elements(q.user_note_images || added) WITH ORDINALITY AS item(image, position)
            WHERE removed IS NULL OR item.image <> to_jsonb(removed)
            GROUP BY item.image
        ) AS unique_item
    ), '[]'::jsonb)
    WHERE q.id = question_id AND q.user_id = auth.uid()
    RETURNING q.user_note_images;
$$;

REVOKE EXECUTE ON FUNCTION public.update_quiz_note_images(UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_quiz_note_images(UUID, JSONB, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
