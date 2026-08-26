const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testGoal() {
  const userId = 'c2292da4-2420-41a5-be0e-a1bdc888a09d';
  
  const { data, error } = await supabase.from('goals').insert({
    user_id: userId,
    name: 'Beli Motor PCX',
    target_amount: 35000000,
    current_amount: 5000000,
    target_date: new Date(2027, 0, 1).toISOString(),
    status: 'IN_PROGRESS'
  }).select();

  if (error) {
    console.error("Failed to insert goal:", error);
  } else {
    console.log("Successfully created test goal:", data);
  }
}

testGoal();
