import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectImportedData() {
  try {
    const { data: lists, error } = await supabase
      .from('union_lists')
      .select(`
        id,
        election_id,
        college,
        titulaires,
        suppleants,
        unions(name, acronym)
      `)

    if (error) {
      console.error('Error fetching union_lists:', error)
      return
    }

    console.log(`Found ${lists.length} lists in union_lists database table:`)
    let totalTitulaires = 0
    let totalSuppleants = 0
    
    lists.forEach((list, index) => {
      const uName = list.unions?.name || 'Inconnu'
      const uAcronym = list.unions?.acronym || 'Inconnu'
      const tLen = list.titulaires ? list.titulaires.length : 0
      const sLen = list.suppleants ? list.suppleants.length : 0
      totalTitulaires += tLen
      totalSuppleants += sLen
      
      console.log(`[List ${index + 1}] Union: ${uAcronym} (${uName}) | College: ${list.college} | Titulaires: ${tLen} | Suppleants: ${sLen}`)
    });
    
    console.log(`\nTotal imported across all lists: Titulaires = ${totalTitulaires}, Suppleants = ${totalSuppleants}`)
  } catch (err) {
    console.error('Error:', err)
  }
}

inspectImportedData()
