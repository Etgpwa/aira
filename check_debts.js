const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDebts() {
  const { data: usersSettings } = await supabase.from('user_settings').select('*');
  console.log("USER SETTINGS:");
  console.log(usersSettings);
  
  const { data: debts } = await supabase.from('debts').select('*');
  console.log("\nALL DEBTS:");
  console.log(debts);
}

checkDebts();
