const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setup() {
  console.log("Setting up main account...");

  // 1. Get and delete the dummy user (if it exists)
  const { data: usersData, error: errList } = await supabase.auth.admin.listUsers();
  if (usersData?.users) {
    for (const u of usersData.users) {
      if (u.email === 'test@example.com') {
        console.log(`Deleting dummy user: ${u.id}`);
        await supabase.auth.admin.deleteUser(u.id);
      }
    }
  }

  // 2. Create the main account
  const mainEmail = 'teguhbudiprasetyo07@gmail.com';
  const mainPassword = 'password123';
  
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: mainEmail,
    password: mainPassword,
    email_confirm: true
  });
  
  let userId;
  if (authErr) {
    console.error("Auth error:", authErr.message);
    if (authErr.message.includes('already exists')) {
      const u = usersData?.users.find(x => x.email === mainEmail);
      if (u) userId = u.id;
    }
  } else if (authData?.user) {
    userId = authData.user.id;
    console.log(`Created new account: ${mainEmail}`);
  }

  if (!userId) {
    console.error("Failed to get/create main user ID.");
    return;
  }

  // 3. Create user_settings for the main account
  await supabase.from('user_settings').upsert({
    user_id: userId,
    phone_number: '628XXXXXXXXXX',
    default_currency: 'IDR',
    timezone: 'Asia/Jakarta'
  }, { onConflict: 'user_id' });

  console.log("Main account setup complete! User ID:", userId);
  console.log(`Email: ${mainEmail}`);
  console.log(`Password: ${mainPassword}`);
}

setup();
