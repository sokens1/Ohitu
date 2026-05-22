const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const names = [
    'Etablissement Exploitations Littoral',
    'Etablissement Exploitations Ogooué-Ivindo'
  ];
  
  for (const name of names) {
    console.log(`Searching for name: "${name}"`);
    const { data, error } = await supabase
      .from('voting_centers')
      .select('id, name, enterprise_id')
      .eq('name', name);
      
    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Results:', data);
    }
  }
}

inspect();
