-- ==============================================================================
-- Migration: ai_training_rules
-- Tabel untuk menyimpan aturan kustom training & contoh few-shot intent AI Karen
-- ==============================================================================

CREATE TABLE IF NOT EXISTS ai_training_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sample_phrase TEXT NOT NULL,
    expected_intents JSONB NOT NULL,
    explanation_rule TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index untuk performa query cepat
CREATE INDEX IF NOT EXISTS idx_ai_training_rules_user_active ON ai_training_rules (user_id, is_active);

-- Aktifkan Row Level Security (RLS)
ALTER TABLE ai_training_rules ENABLE ROW LEVEL SECURITY;

-- Policy RLS: Pengguna hanya dapat mengakses dan mengelola aturan miliknya sendiri
CREATE POLICY "Users can manage their own ai training rules"
    ON ai_training_rules
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
