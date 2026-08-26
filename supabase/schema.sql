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

-- (Optional) Default Seed Data for Categories (bisa dijalankan via dashboard)
-- Kita akan isi nanti ketika backend mulai jalan dan user mendaftar.
