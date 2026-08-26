const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixUserData() {
  const mainEmail = 'teguhbudiprasetyo07@gmail.com';
  const dummyPhone = '252093474578602';
  
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const mainUser = authUsers?.users.find(x => x.email === mainEmail);
  const dummyUser = authUsers?.users.find(x => x.email === `${dummyPhone}@asistenpribadi.local`);

  if (!mainUser) {
    console.error("Main user not found!");
    return;
  }

  const mainUserId = mainUser.id;
  console.log("Main User ID:", mainUserId);

  if (dummyUser) {
    const dummyUserId = dummyUser.id;
    console.log("Found Dummy User ID:", dummyUserId, ". Migrating data...");

    // Migrate transactions
    await supabase.from('transactions').update({ user_id: mainUserId }).eq('user_id', dummyUserId);
    // Migrate bank_accounts
    await supabase.from('bank_accounts').update({ user_id: mainUserId }).eq('user_id', dummyUserId);
    // Migrate tasks
    await supabase.from('tasks').update({ user_id: mainUserId }).eq('user_id', dummyUserId);
    // Migrate goals
    await supabase.from('goals').update({ user_id: mainUserId }).eq('user_id', dummyUserId);
    // Migrate study_schedules
    await supabase.from('study_schedules').update({ user_id: mainUserId }).eq('user_id', dummyUserId);
    // Migrate debts
    await supabase.from('debts').update({ user_id: mainUserId }).eq('user_id', dummyUserId);
    // Migrate budgets
    await supabase.from('budgets').update({ user_id: mainUserId }).eq('user_id', dummyUserId);

    // Delete dummy user_settings & auth user
    await supabase.from('user_settings').delete().eq('user_id', dummyUserId);
    await supabase.auth.admin.deleteUser(dummyUserId);
    console.log("Dummy user data migrated and deleted successfully!");
  }

  // Update main user settings to have both numbers
  const combinedPhone = `6287756987979,252093474578602`;
  await supabase
    .from('user_settings')
    .update({ phone_number: combinedPhone })
    .eq('user_id', mainUserId);

  console.log(`Updated user_settings phone_number to: ${combinedPhone}`);
}

fixUserData();
