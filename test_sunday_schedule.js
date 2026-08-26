const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSundaySchedule() {
  const userId = 'c2292da4-2420-41a5-be0e-a1bdc888a09d';
  
  // 7 % 7 = 0 (Minggu)
  const dayOfWeek = 7 % 7;

  const { data, error } = await supabase.from('study_schedules').insert({
    user_id: userId,
    subject: 'Kuliah Matkul Operasi Sistem',
    day_of_week: dayOfWeek, // 0 = Minggu
    start_time: '20:00:00',
    end_time: '22:00:00'
  }).select();

  if (error) {
    console.error("Error inserting sunday schedule:", error);
  } else {
    console.log("Successfully inserted sunday schedule:", data);
  }
}

testSundaySchedule();
