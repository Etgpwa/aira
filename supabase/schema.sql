-- =========================================================================
-- AsistenPribadi PWA - Supabase Database Schema
-- Silakan COPY dan PASTE seluruh isi file ini ke fitur "SQL Editor" di Supabase, lalu jalankan (RUN).
-- =========================================================================

-- Enable UUID extension (biasanya sudah default di Supabase, tapi untuk pastikan)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. TABLES CREATION
-- ==========================================

-- Table: user_settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  phone_number VARCHAR NOT NULL UNIQUE,
  default_currency VARCHAR DEFAULT 'IDR',
  timezone VARCHAR DEFAULT 'Asia/Jakarta',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: bank_accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name VARCHAR NOT NULL, -- e.g., 'BCA', 'GoPay', 'Cash'
  currency VARCHAR DEFAULT 'IDR' NOT NULL,
  balance NUMERIC DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: transaction_categories
CREATE TABLE IF NOT EXISTS transaction_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name VARCHAR NOT NULL,
  type VARCHAR NOT NULL CHECK (type IN ('income', 'expense')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES bank_accounts ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES transaction_categories ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  currency VARCHAR NOT NULL DEFAULT 'IDR',
  original_amount NUMERIC,
  type VARCHAR NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  description TEXT,
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: budgets
CREATE TABLE IF NOT EXISTS budgets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES transaction_categories ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: debts (Hutang / Piutang)
CREATE TABLE IF NOT EXISTS debts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  person_name VARCHAR NOT NULL,
  type VARCHAR NOT NULL CHECK (type IN ('PAYABLE', 'RECEIVABLE')),
  amount NUMERIC NOT NULL,
  remaining_amount NUMERIC NOT NULL,
  currency VARCHAR DEFAULT 'IDR' NOT NULL,
  status VARCHAR DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PARTIAL', 'PAID')),
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: goals (Target Tabungan Virtual)
CREATE TABLE IF NOT EXISTS goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name VARCHAR NOT NULL,
  target_amount NUMERIC NOT NULL,
  current_amount NUMERIC DEFAULT 0 NOT NULL,
  currency VARCHAR DEFAULT 'IDR' NOT NULL,
  target_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'ACHIEVED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title VARCHAR NOT NULL,
  description TEXT,
  priority VARCHAR CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')) DEFAULT 'MEDIUM',
  category VARCHAR,
  status VARCHAR CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')) DEFAULT 'TODO',
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: study_schedules
CREATE TABLE IF NOT EXISTS study_schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
  subject VARCHAR NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: reminders
CREATE TABLE IF NOT EXISTS reminders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR CHECK (status IN ('PENDING', 'SENT', 'CANCELLED')) DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: work_routines (Seragam harian & rotasi shift konten medsos)
CREATE TABLE IF NOT EXISTS work_routines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
  uniform_schedule JSONB DEFAULT '{"1":"Batik","2":"Kemeja","3":"Bebas Rapi","4":"Batik","5":"Kaos Polo","6":"Bebas Rapi"}'::jsonb,
  social_media_departments JSONB DEFAULT '["Homeschool", "TSD", "Okupasi"]'::jsonb,
  rotation_anchor_date DATE DEFAULT '2026-08-31',
  story_reminder_time TIME DEFAULT '15:30:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: therapy_schedules (Jadwal terapi TSD & OT hasil OCR visual)
CREATE TABLE IF NOT EXISTS therapy_schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  period_label VARCHAR NOT NULL,
  department VARCHAR CHECK (department IN ('TSD', 'OT')) NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  session_number INT NOT NULL,
  time_range VARCHAR NOT NULL,
  child_name VARCHAR NOT NULL,
  therapist_initial VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. course_schedules (Jadwal Kuliah Mingguan)
CREATE TABLE IF NOT EXISTS course_schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  subject_name VARCHAR NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room VARCHAR,
  lecturer VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. course_weekly_targets (Target Mingguan per Matkul)
CREATE TABLE IF NOT EXISTS course_weekly_targets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  subject_name VARCHAR NOT NULL,
  week_number INT NOT NULL,
  material_title VARCHAR NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. course_modules (Kontainer Materi Modul / KB)
CREATE TABLE IF NOT EXISTS course_modules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  subject_name VARCHAR NOT NULL,
  module_title VARCHAR NOT NULL,
  kb_title VARCHAR NOT NULL,
  week_number INT,
  is_completed BOOLEAN DEFAULT FALSE NOT NULL,
  best_score INT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 16. course_quiz_questions (Bank Soal Kuis OCR + user_note)
CREATE TABLE IF NOT EXISTS course_quiz_questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  module_id UUID REFERENCES course_modules(id) ON DELETE CASCADE,
  subject_name VARCHAR,
  week_number INT,
  question_text TEXT NOT NULL,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  correct_answer VARCHAR NOT NULL,
  question_type VARCHAR DEFAULT 'MCQ' NOT NULL,
  already_asked BOOLEAN DEFAULT FALSE NOT NULL,
  user_note TEXT,
  last_asked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ==========================================
-- Supabase secara default menutup akses database dari luar jika RLS diaktifkan,
-- sehingga hanya user yang login yang bisa baca data mereka sendiri.

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapy_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_weekly_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_quiz_questions ENABLE ROW LEVEL SECURITY;

-- Policies for Authenticated Users
CREATE POLICY "Users can only access their own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own bank accounts" ON bank_accounts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own categories" ON transaction_categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own transactions" ON transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own budgets" ON budgets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own debts" ON debts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own goals" ON goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own tasks" ON tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own study schedules" ON study_schedules FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own reminders" ON reminders FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own work routines" ON work_routines FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own therapy schedules" ON therapy_schedules FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own course schedules" ON course_schedules FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own weekly targets" ON course_weekly_targets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own course modules" ON course_modules FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can only access their own quiz questions" ON course_quiz_questions FOR ALL USING (auth.uid() = user_id);

-- 17. Tabel ai_training_rules (Dynamic AI Intent Rules & Few-Shot Learning)
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
CREATE INDEX IF NOT EXISTS idx_ai_training_rules_user_active ON ai_training_rules (user_id, is_active);
ALTER TABLE ai_training_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own ai training rules" ON ai_training_rules FOR ALL USING (auth.uid() = user_id);

-- (Optional) Default Seed Data for Categories (bisa dijalankan via dashboard)
-- Kita akan isi nanti ketika backend mulai jalan dan user mendaftar.

-- ==========================================
-- 18. Habit Tracker Tables
-- ==========================================

-- Table: habit_logs
CREATE TABLE IF NOT EXISTS habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_type TEXT NOT NULL CHECK (habit_type IN (
    'WAKE_UP',       -- bangun tidur
    'SLEEP',         -- mulai tidur / pergi tidur
    'START_WORK',    -- mulai kerja
    'STOP_WORK',     -- selesai kerja
    'START_STUDY',   -- mulai kuliah/belajar
    'STOP_STUDY',    -- selesai kuliah/belajar
    'EXERCISE',      -- olahraga/stretching
    'TIME_SINK'      -- scroll medsos, nonton, game, dll (pemakan waktu)
  )),
  custom_label TEXT,          -- detail untuk TIME_SINK (misal: "scroll ig", "main ML")
  logged_at TIMESTAMPTZ NOT NULL,  -- waktu aktual kejadian
  duration_minutes INT,       -- opsional: durasi (misal olahraga 30 menit)
  notes TEXT,                 -- catatan bebas
  source TEXT DEFAULT 'WA' CHECK (source IN ('WA', 'PWA')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own habit_logs" ON habit_logs FOR ALL USING (auth.uid() = user_id);

-- Table: habit_targets
CREATE TABLE IF NOT EXISTS habit_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_type TEXT NOT NULL,
  target_time TIME,                 -- jam target (misal bangun jam 05:30)
  target_duration_minutes INT,      -- durasi target (misal olahraga min 30 menit)
  max_duration_minutes INT,         -- batas maksimal (misal screen time maks 60 menit/hari)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE habit_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own habit_targets" ON habit_targets FOR ALL USING (auth.uid() = user_id);
