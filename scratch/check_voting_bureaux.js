import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectProElection() {
  try {
    // 1. Get the professional election
    const { data: elections, error: elError } = await supabase
      .from('elections')
      .select('id, title, type')
      .eq('type', 'Élection Professionnelle')
      .limit(5)

    if (elError) throw elError
    console.log('Professional Elections found:', elections)
    if (elections.length === 0) {
      console.log('No professional elections found!')
      return
    }

    const targetElection = elections.find(e => e.title.includes('SEEG')) || elections[0]
    console.log(`\nInspecting election: "${targetElection.title}" (ID: ${targetElection.id})`)

    // 2. Fetch linked centers
    const { data: ecRows, error: ecError } = await supabase
      .from('election_centers')
      .select('center_id')
      .eq('election_id', targetElection.id)

    if (ecError) throw ecError
    const centerIds = ecRows.map(r => r.center_id)
    console.log(`Linked centers count: ${centerIds.length}`)

    // 3. Fetch voting centers
    const { data: centers, error: cError } = await supabase
      .from('voting_centers')
      .select('id, name, total_seats, total_voters')
      .in('id', centerIds)

    if (cError) throw cError
    console.log(`\nFirst 5 Voting Centers:`)
    centers.slice(0, 5).forEach(c => {
      console.log(`- ${c.name} | Total Seats: ${c.total_seats} | Voters: ${c.total_voters}`)
    })

    // 4. Fetch voting bureaux for this election
    const { data: bureaux, error: bError } = await supabase
      .from('voting_bureaux')
      .select('id, name, center_id, college, seats_to_fill, registered_voters')
      .eq('election_id', targetElection.id)

    if (bError) throw bError
    console.log(`\nTotal voting bureaux found for this election: ${bureaux.length}`)
    
    const collegeBureaux = bureaux.filter(b => b.college)
    const physicalBureaux = bureaux.filter(b => !b.college)
    
    console.log(`College virtual booths: ${collegeBureaux.length}`)
    console.log(`Physical bureaux: ${physicalBureaux.length}`)

    console.log('\nSample College Virtual Booths (first 10):')
    collegeBureaux.slice(0, 10).forEach((b, index) => {
      const c = centers.find(c => c.id === b.center_id)
      console.log(`- ${c?.name} | Name: ${b.name} | College: ${b.college} | Seats: ${b.seats_to_fill}`)
    })

    console.log('\nSample Physical Bureaux (first 10):')
    physicalBureaux.slice(0, 10).forEach((b, index) => {
      const c = centers.find(c => c.id === b.center_id)
      console.log(`- ${c?.name} | Name: ${b.name} | Voters: ${b.registered_voters}`)
    })

  } catch (err) {
    console.error('Error:', err)
  }
}

inspectProElection()
