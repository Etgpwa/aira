const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setBalances() {
  const userId = 'c2292da4-2420-41a5-be0e-a1bdc888a09d';

  const accounts = [
    { name: 'SeaBank', balance: 1300000 },
    { name: 'BSI', balance: 28292 },
    { name: 'DANA', balance: 3927 },
    { name: 'GoPay', balance: 560 },
    { name: 'Cash', balance: 342000 },
    { name: 'Bank Jago', balance: 82000 }
  ];

  for (const acc of accounts) {
    // Check if exists
    const { data: existing } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', acc.name)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase.from('bank_accounts').update({ balance: acc.balance }).eq('id', existing[0].id);
      console.log(`Updated ${acc.name} to ${acc.balance}`);
    } else {
      await supabase.from('bank_accounts').insert({
        user_id: userId,
        name: acc.name,
        currency: 'IDR',
        balance: acc.balance
      });
      console.log(`Inserted ${acc.name} with ${acc.balance}`);
    }
  }

  console.log("All balances set successfully!");
}

setBalances();
