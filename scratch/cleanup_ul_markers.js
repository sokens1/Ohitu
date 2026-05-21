/**
 * cleanup_ul_markers.js
 * Nettoie les anciens candidats shadow avec party="ul:<uuid>" en base.
 * À exécuter une seule fois.
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanup() {
  console.log('🔍 Recherche des candidats shadow avec party="ul:..."...')

  // Récupérer tous les candidats avec party commençant par "ul:"
  const { data: candidates, error } = await supabase
    .from('candidates')
    .select('id, name, party')
  
  if (error) {
    console.error('Erreur récupération candidats:', error)
    return
  }

  const ulCandidates = (candidates || []).filter(c => (c.party || '').startsWith('ul:'))
  console.log(`Trouvé ${ulCandidates.length} candidat(s) shadow avec marqueur ul:`)

  if (ulCandidates.length === 0) {
    console.log('✅ Rien à nettoyer.')
    return
  }

  for (const cand of ulCandidates) {
    const ulId = cand.party.slice(3)
    console.log(`  Candidat: "${cand.name}" → party="${cand.party}" (union_list_id: ${ulId})`)

    // Chercher la union_list correspondante
    const { data: ul, error: ulErr } = await supabase
      .from('union_lists')
      .select('id, college, unions(name, acronym)')
      .eq('id', ulId)
      .single()

    if (ulErr || !ul) {
      console.warn(`  ⚠️  union_list ${ulId} non trouvée. Suppression du candidat orphelin...`)
      // Supprimer d'abord les liens election_candidates
      await supabase.from('election_candidates').delete().eq('candidate_id', cand.id)
      // Supprimer les candidate_results
      await supabase.from('candidate_results').delete().eq('candidate_id', cand.id)
      // Supprimer le candidat
      await supabase.from('candidates').delete().eq('id', cand.id)
      console.log(`  🗑️  Candidat orphelin supprimé.`)
      continue
    }

    const union = ul.unions
    const unionName = union?.name || 'Syndicat inconnu'
    const unionAcronym = union?.acronym || ''
    const college = ul.college || 'general'

    const displayParty = unionAcronym
      ? `${unionAcronym} — ${college}`
      : `${unionName} — ${college}`

    const { error: updateErr } = await supabase
      .from('candidates')
      .update({ party: displayParty })
      .eq('id', cand.id)

    if (updateErr) {
      console.error(`  ❌ Erreur mise à jour pour ${cand.id}:`, updateErr)
    } else {
      console.log(`  ✅ party mis à jour : "${cand.party}" → "${displayParty}"`)
    }
  }

  console.log('\n🎉 Nettoyage terminé.')
}

cleanup()
