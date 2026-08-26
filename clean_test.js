const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanTest() {
  const userId = 'c2292da4-2420-41a5-be0e-a1bdc888a09d';
  await supabase.from('transactions').delete().eq('user_id', userId);
  console.log("Test transaction removed!");
}

cleanTest();
