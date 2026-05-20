import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function listTables() {
  try {
    // We can query the pg_tables catalog via a quick trick or look at common tables
    // Let's try to query some standard tables to see if they exist
    const tables = [
      'candidates', 'candidats', 'election_candidates', 'candidate_results', 
      'union_lists', 'unions', 'enterprises', 'electoral_colleges', 
      'procès_verbaux', 'voting_bureaux', 'voting_centers', 
      'union_results', 'union_list_results'
    ];
    
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true });
      if (error) {
        console.log(`❌ Table: ${table} - Error: ${error.message}`);
      } else {
        console.log(`   Table: ${table} - Exists! Rows count: ${data || 0}`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

listTables();
