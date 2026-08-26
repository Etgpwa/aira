const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testInsert() {
  const userId = 'c2292da4-2420-41a5-be0e-a1bdc888a09d';
  
  // Get cash account
  const { data: acc } = await supabase.from('bank_accounts').select('*').eq('user_id', userId).limit(1);
  console.log("Account:", acc);

  if (acc && acc.length > 0) {
    const { data: tx, error } = await supabase.from('transactions').insert({
      user_id: userId,
      account_id: acc[0].id,
      amount: 50000,
      type: 'expense',
      description: 'Tes Nasi Goreng',
      transaction_date: new Date().toISOString()
    }).select();

    if (error) {
      console.error("Test Insert Error:", error);
    } else {
      console.log("Test Insert Success:", tx);
    }
  }
}

testInsert();
