const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testTask() {
  const userId = 'c2292da4-2420-41a5-be0e-a1bdc888a09d';
  
  const { data, error } = await supabase.from('tasks').insert({
    user_id: userId,
    title: 'Kumpul Laporan Proyek PWA',
    description: 'Pastikan fitur WhatsApp bot & Kanban board sudah siap diperagakan.',
    priority: 'HIGH',
    status: 'TODO',
    due_date: new Date(2026, 7, 26, 10, 0).toISOString()
  }).select();

  if (error) {
    console.error("Failed to insert task:", error);
  } else {
    console.log("Successfully created test task:", data);
  }
}

testTask();
