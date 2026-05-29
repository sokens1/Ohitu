import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('union_lists').select('*').limit(5);
  if (error) {
    console.error('Error fetching union_lists:', error);
  } else {
    data.forEach((list, index) => {
      console.log(`\n--- List ${index + 1} ---`);
      console.log('College:', list.college);
      console.log('Titulaires:', JSON.stringify(list.titulaires, null, 2));
      console.log('Suppleants:', JSON.stringify(list.suppleants, null, 2));
    });
  }
}

run();
