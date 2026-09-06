-- ==============================================================================
-- Migration: add_user_note_to_quiz_questions
-- Menambahkan kolom user_note untuk menyimpan catatan/cara pengerjaan kuis per butir soal
-- ==============================================================================

ALTER TABLE course_quiz_questions ADD COLUMN IF NOT EXISTS user_note TEXT;
