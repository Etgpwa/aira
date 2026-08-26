const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanData() {
  console.log("🧹 Membersihkan seluruh data operasional (transaksi, tugas, tabungan, jadwal)...");

  // 1. Dapatkan user ID utama
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const mainUser = usersData?.users.find(x => x.email === 'teguhbudiprasetyo07@gmail.com');

  if (!mainUser) {
    console.error("❌ User utama tidak ditemukan!");
    return;
  }

  const userId = mainUser.id;
  console.log(`👤 Target User ID: ${userId}`);

  // 2. Hapus data di semua tabel terkait user ini
  const tables = ['transactions', 'debts', 'goals', 'tasks', 'study_schedules', 'budgets', 'bank_accounts'];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) {
      console.error(`❌ Gagal menghapus tabel ${table}:`, error.message);
    } else {
      console.log(`✅ Tabel ${table} berhasil dibersihkan.`);
    }
  }

  // 3. Buat ulang rekening default 'Cash' dengan saldo 0
  const { error: accErr } = await supabase.from('bank_accounts').insert({
    user_id: userId,
    name: 'Cash',
    currency: 'IDR',
    balance: 0
  });

  if (accErr) {
    console.error("❌ Gagal membuat rekening Cash default:", accErr.message);
  } else {
    console.log("💵 Rekening default 'Cash' (Rp 0) telah dibuat ulang.");
  }

  console.log("\n✨ Database bersih 100%! Siap digunakan untuk data riil.");
}

cleanData();
