const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkState() {
  const userId = 'c2292da4-2420-41a5-be0e-a1bdc888a09d';
  const { data: accounts } = await supabase.from('bank_accounts').select('*').eq('user_id', userId);
  const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', userId);
  console.log("BANK ACCOUNTS:", accounts);
  console.log("TRANSACTIONS:", txs);
}

checkState();
