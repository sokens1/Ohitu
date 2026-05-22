import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  try {
    const { data, error } = await supabase
      .from('union_lists')
      .select('*')
      .limit(1)

    if (error) {
      console.error('Error fetching union_lists:', error)
    } else {
      console.log('Sample union_list row:', data[0])
      console.log('All keys in union_list row:', data[0] ? Object.keys(data[0]) : 'No rows found')
    }
  } catch (err) {
    console.error('Error:', err)
  }
}

checkSchema()
