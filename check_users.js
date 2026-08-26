const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUsers() {
  const { data: users } = await supabase.from('user_settings').select('*');
  console.log("USER_SETTINGS:", users);
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  console.log("AUTH_USERS:", authUsers.users.map(u => ({ id: u.id, email: u.email })));
}

checkUsers();
