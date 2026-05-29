import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const tables = ['candidates', 'union_lists', 'unions', 'elections'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ Table ${table} error: ${error.message}`);
    } else {
      console.log(`\n📊 Table: ${table}`);
      console.log('Columns:', data && data.length > 0 ? Object.keys(data[0]) : 'Empty table');
      if (data && data.length > 0) {
        console.log('Sample row:', data[0]);
      }
    }
  }
}

run();
