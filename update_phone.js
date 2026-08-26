const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updatePhone() {
  const mainEmail = 'teguhbudiprasetyo07@gmail.com';
  
  // Get user by email
  const { data: usersData, error: errList } = await supabase.auth.admin.listUsers();
  const u = usersData?.users.find(x => x.email === mainEmail);
  
  if (!u) {
    console.error("User not found!");
    return;
  }

  // Update phone number
  const { error } = await supabase
    .from('user_settings')
    .update({ phone_number: '6287756987979' })
    .eq('user_id', u.id);

  if (error) {
    console.error("Failed to update user_settings:", error);
  } else {
    console.log(`Successfully updated phone number for user ${u.id}`);
  }
}

updatePhone();
