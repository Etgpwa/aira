const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixPs4Goal() {
  const userId = 'c2292da4-2420-41a5-be0e-a1bdc888a09d';

  // Get all ps4 goals
  const { data: ps4Goals } = await supabase
    .from('goals')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', 'ps4');

  if (ps4Goals && ps4Goals.length > 0) {
    // Delete all except the first one
    const idsToDelete = ps4Goals.slice(1).map(g => g.id);
    if (idsToDelete.length > 0) {
      await supabase.from('goals').delete().in('id', idsToDelete);
    }

    // Update the single remaining ps4 goal with target_date
    const targetDate = new Date(2027, 2, 5).toISOString(); // 5 March 2027
    await supabase.from('goals').update({
      target_date: targetDate
    }).eq('id', ps4Goals[0].id);

    console.log("Fixed PS4 goal! Merged duplicates and set target_date to 5 March 2027.");
  }
}

fixPs4Goal();
