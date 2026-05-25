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
  suppleant?: string;
  college_type?: string | null; // cadres | employes | ouvriers | general — pour élections pro
  etablissement?: string | null; // nom de l'établissement — pour filtrage UI
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
 */
function computeDisplayInfo(ul: any): { displayName: string; displayParty: string; suppleantName: string; etablissementName: string } {
  const union = ul.unions;
  const unionName: string = union?.name || 'Syndicat inconnu';
  const unionAcronym: string = union?.acronym || '';
  const collegeRaw: string = ul.college || 'general';

  let college = collegeRaw;
  if (collegeRaw === 'general') college = 'Encadrement';
  else if (collegeRaw === 'cadres') college = 'Cadre';
  else if (collegeRaw === 'employes') college = 'Maîtrise';
  else if (collegeRaw === 'ouvriers') college = 'Exécution';

  const displayParty = unionAcronym
    ? `${unionAcronym} — ${college}`
    : `${unionName} — ${college}`;

  let titulaireName = '';
  let etablissementName = '';
  if (Array.isArray(ul.titulaires) && ul.titulaires.length > 0) {
    titulaireName = ul.titulaires[0].name || '';
    etablissementName = ul.titulaires[0].etablissement || '';
  } else if (typeof ul.titulaires === 'string') {
    try {
      const parsed = JSON.parse(ul.titulaires);
      if (Array.isArray(parsed) && parsed.length > 0) {
        titulaireName = parsed[0].name || '';
        etablissementName = parsed[0].etablissement || '';
      }
    } catch (e) {}
  }

  let suppleantName = '';
  if (Array.isArray(ul.suppleants) && ul.suppleants.length > 0) {
    suppleantName = ul.suppleants[0].name || '';
  } else if (typeof ul.suppleants === 'string') {
    try {
      const parsed = JSON.parse(ul.suppleants);
      if (Array.isArray(parsed) && parsed.length > 0) suppleantName = parsed[0].name || '';
    } catch (e) {}
  }

  const displayName = titulaireName
    ? titulaireName
    : (unionAcronym ? `Liste ${unionAcronym} (${college})` : `Liste ${unionName} (${college})`);

  return { displayName, displayParty, suppleantName, etablissementName };
}

/**
 * Pour les élections professionnelles :
 *  - CHEMIN RAPIDE : si tous les candidats sont déjà liés, retourne sans aucune écriture DB
 *  - CHEMIN LENT   : synchronise les candidats shadow manquants (premier chargement / après import)
 *
 * Les deux requêtes initiales sont lancées en parallèle.
 */
async function resolveUnionListsAsCandidates(electionId: string): Promise<CandidateInfo[]> {
  // Chargement parallèle : union_lists + election_candidates en un seul aller-retour réseau
  const [ulResult, ecResult] = await Promise.all([
    supabase
      .from('union_lists')
      .select('id, college, titulaires, suppleants, unions(id, name, acronym)')
      .eq('election_id', electionId),
    supabase
      .from('election_candidates')
      .select('candidate_id, candidates(id, name, party)')
      .eq('election_id', electionId),
  ]);

  if (ulResult.error) {
    console.error('[candidateUtils] Erreur union_lists:', ulResult.error);
    return [];
  }
  if (ecResult.error) {
    console.error('[candidateUtils] Erreur election_candidates (pro):', ecResult.error);
  }

  const unionLists = ulResult.data ?? [];
  if (unionLists.length === 0) return [];

  // Maps depuis les candidats déjà liés à CETTE élection
  const byName      = new Map<string, any>();
  const byParty     = new Map<string, any>();
  const byUlMarker  = new Map<string, any>();
  const linkedCandidateIds = new Set<string>();

  (ecResult.data ?? []).forEach((link: any) => {
    const cand = link.candidates;
    if (!cand) return;
    byName.set(cand.name, cand);
    const partyStr: string = cand.party || '';
    byParty.set(partyStr, cand);
    if (partyStr.startsWith('ul:')) byUlMarker.set(partyStr.slice(3), cand);
    linkedCandidateIds.add(link.candidate_id);
  });

  // Pré-calcul des noms d'affichage pour toutes les listes
  const ulInfos = (unionLists as any[]).map(ul => {
    const info = computeDisplayInfo(ul);
    const union = ul.unions;
    const unionAcronym: string = union?.acronym || '';
    const unionName: string = union?.name || 'Syndicat inconnu';
    const collegeRaw: string = ul.college || 'general';
    const oldDisplayParty = unionAcronym
      ? `${unionAcronym} — ${collegeRaw}`
      : `${unionName} — ${collegeRaw}`;
    return { ul, ...info, collegeRaw, oldDisplayParty };
  });

  // Batch-fetch les candidats DB par nom pour ceux non encore dans byName
  const missingNames = ulInfos
    .map(({ displayName }) => displayName)
    .filter(n => !byName.has(n));

  if (missingNames.length > 0) {
    const { data: dbCandidates } = await supabase
      .from('candidates')
      .select('id, name, party')
      .in('name', missingNames);

    (dbCandidates ?? []).forEach((c: any) => {
      if (!byName.has(c.name)) byName.set(c.name, c);
    });
  }

  // ─── CHEMIN RAPIDE ────────────────────────────────────────────────────────
  // Si tous les candidats sont déjà liés → retour immédiat sans aucune écriture
  const fastResult: CandidateInfo[] = [];
  let canFastPath = true;

  for (const { ul, displayName, displayParty, suppleantName, etablissementName, collegeRaw, oldDisplayParty } of ulInfos) {
    const cand = byName.get(displayName)
              ?? byParty.get(displayParty)
              ?? byParty.get(oldDisplayParty)
              ?? byUlMarker.get(ul.id)
              ?? null;
    if (!cand || !linkedCandidateIds.has(cand.id)) {
      canFastPath = false;
      break;
    }
    fastResult.push({
      id: cand.id,
      name: displayName,
      party: displayParty,
      suppleant: suppleantName,
      college_type: collegeRaw,
      etablissement: etablissementName || null,
    });
  }

  if (canFastPath && fastResult.length === ulInfos.length) return fastResult;

  // ─── CHEMIN LENT : synchronisation des candidats shadow ───────────────────
  const result: CandidateInfo[] = [];

  for (const { ul, displayName, displayParty, suppleantName, etablissementName, collegeRaw, oldDisplayParty } of ulInfos) {
    let existingCand = byName.get(displayName)
                    ?? byParty.get(displayParty)
                    ?? byParty.get(oldDisplayParty)
                    ?? byUlMarker.get(ul.id)
                    ?? null;

    if (existingCand) {
      const isLinked = linkedCandidateIds.has(existingCand.id);
      if (isLinked && (existingCand.party !== displayParty || existingCand.name !== displayName)) {
        await supabase
          .from('candidates')
          .update({ party: displayParty, name: displayName })
          .eq('id', existingCand.id);
      }
      if (!isLinked) {
        const { error: linkErr } = await supabase
          .from('election_candidates')
          .insert({ election_id: electionId, candidate_id: existingCand.id, is_our_candidate: false });
        if (!linkErr) linkedCandidateIds.add(existingCand.id);
      }
      result.push({
        id: existingCand.id,
        name: displayName,
        party: displayParty,
        suppleant: suppleantName,
        college_type: collegeRaw,
        etablissement: etablissementName || null,
      });
    } else {
      // Nouveau candidat absent de la DB
      const { data: newCand, error: insertCandErr } = await supabase
        .from('candidates')
        .insert({ name: displayName, party: displayParty, is_our_candidate: false })
        .select('id')
        .single();

      if (insertCandErr) {
        if ((insertCandErr as any).code === '23505') {
          const { data: foundCand } = await supabase
            .from('candidates')
            .select('id, name, party')
            .eq('name', displayName)
            .maybeSingle();
          if (foundCand) {
            byName.set(foundCand.name, foundCand);
            await supabase
              .from('election_candidates')
              .insert({ election_id: electionId, candidate_id: foundCand.id, is_our_candidate: false });
            result.push({ id: foundCand.id, name: displayName, party: displayParty, suppleant: suppleantName, college_type: collegeRaw, etablissement: etablissementName || null });
          }
        } else {
          console.error('[candidateUtils] Erreur création candidat shadow:', insertCandErr);
        }
        continue;
      }

      const { error: insertLinkErr } = await supabase
        .from('election_candidates')
        .insert({ election_id: electionId, candidate_id: newCand.id, is_our_candidate: false });

      if (insertLinkErr) {
        console.error('[candidateUtils] Erreur création election_candidates:', insertLinkErr);
        await supabase.from('candidates').delete().eq('id', newCand.id);
        continue;
      }

      linkedCandidateIds.add(newCand.id);
      result.push({ id: newCand.id, name: displayName, party: displayParty, suppleant: suppleantName, college_type: collegeRaw, etablissement: etablissementName || null });
    }
  }

  return result;
}
