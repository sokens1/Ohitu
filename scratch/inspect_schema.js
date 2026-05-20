import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function inspect() {
  try {
    console.log('Querying candidate_results columns and test rows...');
    const { data, error } = await supabase
      .from('candidate_results')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error fetching candidate_results:', error);
    } else {
      console.log('Fetched test row successfully:', data);
    }
  } catch (err) {
    console.error(err);
  }
}

inspect();
