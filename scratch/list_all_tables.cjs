const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllTables() {
  try {
    const { data, error } = await supabase.rpc('get_tables_list'); // checking if there is a custom RPC
    if (error) {
      // If RPC doesn't exist, we can try querying standard tables to see if they exist.
      console.log("Could not use RPC. Let's inspect using postgrest or common schema queries.");
      // We can also query a view or a table we know. Let's check what tables are in the schema by querying a non-existent table and checking the error or checking if we can get table lists.
      // Let's run a query on pg_catalog or information_schema if allowed.
      // Usually, supabase allows select on information_schema.tables. Let's try!
      const { data: tables, error: schemaErr } = await supabase
        .from('pg_tables')
        .select('*')
        .limit(10);
      if (schemaErr) {
        console.log('pg_tables select error:', schemaErr.message);
      } else {
        console.log('Tables from pg_tables:', tables);
      }
    } else {
      console.log('Tables list from RPC:', data);
    }
  } catch (err) {
    console.error(err);
  }
}

listAllTables();
