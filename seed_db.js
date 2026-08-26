const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log("Seeding database...");

  // 1. Create a dummy user in auth
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: 'test@example.com',
    password: 'password123',
    email_confirm: true
  });
  
  if (authErr) {
    console.error("Auth error:", authErr.message);
    if (!authErr.message.includes('already exists')) {
      return;
    }
  }

  // Get user ID
  let userId;
  if (authData?.user) {
    userId = authData.user.id;
  } else {
    // If user already exists, find the user ID
    const { data: users, error } = await supabase.auth.admin.listUsers();
    userId = users.users[0]?.id;
  }

  if (!userId) {
    console.error("No user found or created.");
    return;
  }

  console.log("User ID:", userId);

  // 2. Add to user_settings
  await supabase.from('user_settings').upsert({
    user_id: userId,
    phone_number: '6287756987979',
    default_currency: 'IDR',
    timezone: 'Asia/Jakarta'
  }, { onConflict: 'user_id' });

  // 3. Add bank account
  const { data: accounts } = await supabase.from('bank_accounts').select('id').eq('user_id', userId);
  if (accounts.length === 0) {
    await supabase.from('bank_accounts').insert([
      { user_id: userId, name: 'BCA', balance: 5000000 },
      { user_id: userId, name: 'GoPay', balance: 150000 }
    ]);
  }

  // 4. Add categories
  const { data: categories } = await supabase.from('transaction_categories').select('id').eq('user_id', userId);
  if (categories.length === 0) {
    await supabase.from('transaction_categories').insert([
      { user_id: userId, name: 'Makan', type: 'expense' },
      { user_id: userId, name: 'Transportasi', type: 'expense' },
      { user_id: userId, name: 'Gaji', type: 'income' }
    ]);
  }
  
  // 5. Add some tasks
  const { data: tasks } = await supabase.from('tasks').select('id').eq('user_id', userId);
  if (tasks.length === 0) {
    await supabase.from('tasks').insert([
      { user_id: userId, title: 'Beli Token Listrik', priority: 'HIGH', status: 'TODO' },
      { user_id: userId, title: 'Review PR Backend', priority: 'MEDIUM', status: 'IN_PROGRESS' }
    ]);
  }

  console.log("Seeding complete!");
}

seed();
