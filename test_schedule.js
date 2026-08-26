const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSchedule() {
  const userId = 'c2292da4-2420-41a5-be0e-a1bdc888a09d';
  
  const { data, error } = await supabase.from('study_schedules').insert({
    user_id: userId,
    subject: 'Kuliah Pemrograman Web',
    day_of_week: 1, // Senin
    start_time: '08:00:00',
    end_time: '10:30:00'
  }).select();

  if (error) {
    console.error("Failed to insert schedule:", error);
  } else {
    console.log("Successfully created test schedule:", data);
  }
}

testSchedule();
