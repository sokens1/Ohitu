import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('URL:', supabaseUrl)
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log("Querying voting_centers with select('*')...")
  const { data, error, status, statusText } = await supabase
    .from('voting_centers')
    .select('*')
  
  console.log('Status:', status, statusText)
  if (error) {
    console.error('Error details:', JSON.stringify(error, null, 2))
  } else {
    console.log('Success, data count:', data?.length)
    console.log(data.map(c => ({ id: c.id, name: c.name, enterprise_id: c.enterprise_id })))
  }
}

run()

