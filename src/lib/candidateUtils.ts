/**
 * candidateUtils.ts
 *
 * Utilitaires pour résoudre la liste des candidats selon le type d'élection.
 *
 * Pour les élections standards      : election_candidates → candidates
 * Pour les élections professionnelles: union_lists → (sync lazy vers candidates + election_candidates)
 *
 * Stratégie d'identification des candidats shadow :
 *   - Le champ `name` dans `candidates` = nom lisible unique de la liste (ex: "CSTC (CSTC)")
 *   - Le champ `party` dans `candidates` = texte lisible (ex: "CSTC — general")
 *   - PAS de marqueur interne dans `party` — tout est lisible par les composants qui lisent la DB
 *   - Rétrocompatibilité : si d'anciens enregistrements ont party="ul:<uuid>", on les met à jour
 */

import { supabase } from '@/lib/supabase';

export interface CandidateInfo {
  id: string;
  name: string;
  party: string;
}

const PRO_ELECTION_TYPE = 'Élection Professionnelle';

/**
 * Retourne true si l'élection est de type professionnel.
 */
export function isProfessionalElection(electionType?: string | null): boolean {
  return (electionType ?? '').trim() === PRO_ELECTION_TYPE;
}

/**
 * Résout la liste de candidats à afficher / utiliser pour la saisie de résultats.
 *
 * @param electionId   UUID de l'élection
 * @param electionType Type de l'élection (string depuis la DB)
 * @returns Tableau de { id, name, party } avec des valeurs toujours lisibles
 */
export async function resolveCandidatesForElection(
  electionId: string,
  electionType?: string | null
): Promise<CandidateInfo[]> {
  if (!electionId) return [];

  if (isProfessionalElection(electionType)) {
    return resolveUnionListsAsCandidates(electionId);
  }

  // Élection standard → election_candidates → candidates
  const { data, error } = await supabase
    .from('election_candidates')
    .select('candidates!candidate_id(id, name, party)')
    .eq('election_id', electionId);

  if (error) {
    console.error('[candidateUtils] Erreur election_candidates:', error);
    return [];
  }

  return (data ?? [])
    .filter((item: any) => item.candidates)
    .map((item: any) => ({
      id: item.candidates.id,
      name: item.candidates.name,
      party: item.candidates.party || 'Indépendant',
    }));
}

/**
 * Calcule le nom d'affichage et le parti d'affichage pour une union_list.
 * Ces valeurs sont également celles stockées en DB (toujours lisibles).
 */
function computeDisplayInfo(ul: any): { displayName: string; displayParty: string } {
  const union = ul.unions;
  const unionName: string = union?.name || 'Syndicat inconnu';
  const unionAcronym: string = union?.acronym || '';
  const college: string = ul.college || 'general';

  const displayName = unionAcronym
    ? `${unionName} (${unionAcronym})`
    : unionName;

  const displayParty = unionAcronym
    ? `${unionAcronym} — ${college}`
    : `${unionName} — ${college}`;

  return { displayName, displayParty };
}

/**
 * Pour les élections professionnelles :
 *  1. Charge les union_lists de cette élection
 *  2. Charge les election_candidates existants
 *  3. Pour chaque liste, retrouve ou crée le candidat shadow avec des données lisibles
 *  4. Corrige en base les anciens marqueurs "ul:<uuid>" si trouvés
 */
async function resolveUnionListsAsCandidates(electionId: string): Promise<CandidateInfo[]> {
  // 1. Charger les listes syndicales
  const { data: unionLists, error: ulError } = await supabase
    .from('union_lists')
    .select('id, college, titulaires, suppleants, unions(id, name, acronym)')
    .eq('election_id', electionId);

  if (ulError) {
    console.error('[candidateUtils] Erreur union_lists:', ulError);
    return [];
  }

  if (!unionLists || unionLists.length === 0) return [];

  // 2. Charger les election_candidates existants pour cette élection
  const { data: existingLinks, error: ecError } = await supabase
    .from('election_candidates')
    .select('candidate_id, candidates(id, name, party)')
    .eq('election_id', electionId);

  if (ecError) {
    console.error('[candidateUtils] Erreur election_candidates (pro):', ecError);
  }

  // Construire deux maps pour retrouver les candidats existants :
  //   - Par nom exact (stratégie principale)
  //   - Par ancien marqueur "ul:<uuid>" (rétrocompatibilité)
  const byName = new Map<string, any>();
  const byUlMarker = new Map<string, any>(); // clé = union_list_id

  (existingLinks ?? []).forEach((link: any) => {
    const cand = link.candidates;
    if (!cand) return;

    byName.set(cand.name, cand);

    const partyStr: string = cand.party || '';
    if (partyStr.startsWith('ul:')) {
      byUlMarker.set(partyStr.slice(3), cand);
    }
  });

  const result: CandidateInfo[] = [];

  for (const ul of unionLists as any[]) {
    const { displayName, displayParty } = computeDisplayInfo(ul);

    // Recherche : d'abord par nom exact, puis par ancien marqueur ul: (rétrocompat)
    let existingCand = byName.get(displayName) ?? byUlMarker.get(ul.id) ?? null;

    if (existingCand) {
      // Corriger l'ancien party "ul:<uuid>" si nécessaire (migration transparente)
      if ((existingCand.party || '').startsWith('ul:')) {
        const { error: updateErr } = await supabase
          .from('candidates')
          .update({ party: displayParty })
          .eq('id', existingCand.id);

        if (updateErr) {
          console.warn('[candidateUtils] Impossible de corriger party:', updateErr);
        }
      }

      result.push({
        id: existingCand.id,
        name: displayName,
        party: displayParty,
      });
    } else {
      // Créer le candidat shadow avec des valeurs 100 % lisibles
      const { data: newCand, error: insertCandErr } = await supabase
        .from('candidates')
        .insert({
          name: displayName,
          party: displayParty, // lisible directement depuis la DB
          is_our_candidate: false,
        })
        .select('id')
        .single();

      if (insertCandErr) {
        console.error('[candidateUtils] Erreur création candidat shadow:', insertCandErr);
        continue;
      }

      // Créer le lien election_candidates
      const { error: insertLinkErr } = await supabase
        .from('election_candidates')
        .insert({
          election_id: electionId,
          candidate_id: newCand.id,
          is_our_candidate: false,
        });

      if (insertLinkErr) {
        console.error('[candidateUtils] Erreur création election_candidates:', insertLinkErr);
        // Nettoyer le candidat orphelin
        await supabase.from('candidates').delete().eq('id', newCand.id);
        continue;
      }

      result.push({
        id: newCand.id,
        name: displayName,
        party: displayParty,
      });
    }
  }

  return result;
}
