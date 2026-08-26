const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking tables...");
  const { data: b } = await supabase.from('bank_accounts').select('*');
  const { data: t } = await supabase.from('transactions').select('*');
  console.log("bank_accounts:", b);
  console.log("transactions:", t);
}

check();
