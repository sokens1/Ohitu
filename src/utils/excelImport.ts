import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkBook } from 'xlsx';

export interface ParsedBooth {
  name: string;
  registered_voters: number;
  seats_to_fill?: number;
  is_college?: boolean;
  college?: string | null;
  college_type?: string | null;
  lieu_vote?: string;
}

export interface ParsedVotingCenter {
  name: string;
  address: string;
  contact_name: string;
  contact_phone: string | null;
  voters: number;
  bureaux: number;
  booths: ParsedBooth[];
}

/** Lit la feuille Établissements (modèle pro ou politique). */
export async function parseEstablishmentsSheet(
  workbook: WorkBook,
  isProfessional: boolean
): Promise<ParsedVotingCenter[]> {
  const { utils } = await import('xlsx');

  const estSheet = isProfessional
    ? workbook.Sheets['Etablissements'] || workbook.Sheets['Établissements & Bureaux'] || workbook.Sheets[workbook.SheetNames[0]]
    : workbook.Sheets['Établissements & Bureaux'] || workbook.Sheets['Etablissements'] || workbook.Sheets[workbook.SheetNames[0]];

  if (!estSheet) {
    throw new Error('La feuille des établissements est introuvable (attendu : « Etablissements »).');
  }

  const estRows = utils.sheet_to_json<Record<string, unknown>>(estSheet);
  const centerGroups: Record<string, ParsedVotingCenter> = {};

  let bureauxRows: Record<string, unknown>[] = [];
  if (isProfessional) {
    const bureauxSheet = workbook.Sheets['Bureaux'] || workbook.Sheets[workbook.SheetNames[1]];
    if (bureauxSheet) {
      bureauxRows = utils.sheet_to_json<Record<string, unknown>>(bureauxSheet);
    }
  }

  // 1. D'abord, on parcourt la feuille 1 (Etablissements) pour enregistrer les établissements, adresses et collèges
  estRows.forEach((row) => {
    const region =
      String(row['Region__Localisation'] || row['Région / Localisation'] || row['Région'] || 'Général').trim();
    const name = String(
      row['Nom_Etablissement__Site'] || row['Nom Établissement / Site'] || row['Site'] || ''
    ).trim();
    if (!name) return;

    const resp = String(row['Responsable_Etablissement'] || row['Responsable Établissement'] || '').trim();
    const phoneRaw = row['Contact_Telephone'] ?? row['Contact Téléphone'];
    const phone = phoneRaw != null && String(phoneRaw).trim() !== '' ? String(phoneRaw).trim() : null;

    const lieuVote = String(row['Lieu_vote'] || row['Lieu de vote'] || row['Lieu de Vote'] || '').trim();
    const address = isProfessional
      ? [lieuVote, region].filter(Boolean).join(', ')
      : region;

    const groupKey = name.toLowerCase();
    if (!centerGroups[groupKey]) {
      centerGroups[groupKey] = {
        name, // On garde la casse d'origine
        address,
        contact_name: resp || 'N/A',
        contact_phone: phone,
        voters: 0,
        bureaux: 0,
        booths: [],
      };
    }

    if (isProfessional) {
      const sEnc = Number(row['nb_sieges_Encadrement'] || row['nb_sieges_encadrement'] || row['Nbre_sieges_Encadrement'] || 0);
      const sCad = Number(row['nb_sieges_Cadre'] || row['nb_sieges_cadre'] || row['Nbre_sieges_Cadre'] || 0);
      const sMai = Number(row['nb_sieges_Maitrise'] || row['nb_sieges_maitrise'] || row['nb_sieges_Maîtrise'] || row['nb_sieges_maîtrise'] || row['Nbre_sieges_Maitrise'] || 0);
      const sExe = Number(row['nb_sieges_Execution'] || row['nb_sieges_execution'] || row['nb_sieges_Exécution'] || row['nb_sieges_exécution'] || row['Nbre_sieges_Execution'] || 0);

      // Récupérer les électeurs par collège
      const vEnc = Number(row['Nbre_electeurs_Encadrement'] || row['nbre_electeurs_encadrement'] || 0);
      const vCad = Number(row['Nbre_electeurs_Cadre'] || row['nbre_electeurs_cadre'] || 0);
      const vMai = Number(row['Nbre _electeurs_Maitrise'] || row['Nbre_electeurs_Maitrise'] || row['nbre_electeurs_maitrise'] || 0);
      const vExe = Number(row['Nbre _electeurs_Execution'] || row['Nbre_electeurs_Execution'] || row['nbre_electeurs_execution'] || 0);

      // Section 1: Collèges (Encadrement, Cadre, Maîtrise, Exécution)
      const addCollegeBooth = (collegeSuffix: string, seats: number, voters: number) => {
        if (seats > 0) {
          const collegeBoothName = `College - ${collegeSuffix}`;
          const exists = centerGroups[groupKey].booths.some(
            (b) => b.name.toLowerCase() === collegeBoothName.toLowerCase()
          );
          if (!exists) {
            centerGroups[groupKey].booths.push({
              name: collegeBoothName,
              registered_voters: voters,
              seats_to_fill: seats,
              is_college: true,
              college: collegeSuffix,
              lieu_vote: lieuVote,
            } as any);
          }
        }
      };

      addCollegeBooth('Encadrement', sEnc, vEnc);
      addCollegeBooth('Cadre', sCad, vCad);
      addCollegeBooth('Maîtrise', sMai, vMai);
      addCollegeBooth('Exécution', sExe, vExe);
    } else {
      const boothName = String(row['Nom Bureau de vote'] || '').trim();
      const totalVoters = Number(row["Nombre d'électeurs"] || 0);
      if (boothName) {
        const exists = centerGroups[groupKey].booths.some(
          (b) => b.name.toLowerCase() === boothName.toLowerCase()
        );
        if (!exists) {
          centerGroups[groupKey].booths.push({ name: boothName, registered_voters: totalVoters });
        }
      }
      centerGroups[groupKey].voters += totalVoters;
    }
  });

  // 2. Ensuite, s'il s'agit d'une élection professionnelle, on parcourt la deuxième feuille (Bureaux) pour les bureaux de vote physiques
  if (isProfessional && bureauxRows.length > 0) {
    bureauxRows.forEach((bRow) => {
      const estName = String(
        bRow['Nom_Etablissement__Site'] ||
        bRow['Nom Établissement / Site'] ||
        bRow['Site'] ||
        bRow['Etablissement'] ||
        ''
      ).trim();

      if (!estName) return;

      const groupKey = estName.toLowerCase();

      // Si l'établissement existe déjà, on ne cherche pas à le dupliquer (on garde la structure déjà créée)
      // S'il n'existe pas encore, on l'initialise
      if (!centerGroups[groupKey]) {
        const region = String(bRow['Region__Localisation'] || bRow['Région / Localisation'] || bRow['Région'] || 'Général').trim();
        const lieuVote = String(bRow['Lieu_vote'] || bRow['Lieu de vote'] || bRow['Lieu de Vote'] || '').trim();
        const address = [lieuVote, region].filter(Boolean).join(', ');

        centerGroups[groupKey] = {
          name: estName,
          address,
          contact_name: 'N/A',
          contact_phone: null,
          voters: 0,
          bureaux: 0,
          booths: [],
        };
      }

      // On récupère le bureau de vote qui est sur la ligne de cet établissement
      const bName = String(bRow['Bureau'] || bRow['Nom Bureau'] || bRow['Nom du Bureau'] || '').trim();
      if (bName) {
        const exists = centerGroups[groupKey].booths.some(
          (b) => b.name.toLowerCase() === bName.toLowerCase()
        );
        if (!exists) {
          const lieuVote = String(bRow['Lieu_vote'] || bRow['Lieu de vote'] || bRow['Lieu de Vote'] || '').trim();
          // Lecture optionnelle du collège associé à ce bureau physique
          const rawCollege = bRow['College'] || bRow['Collège'] || bRow['College_type'] || bRow['Type_College'] || null;
          const college_type = rawCollege ? normalizeCollegeValue(rawCollege) : null;
          centerGroups[groupKey].booths.push({
            name: bName,
            registered_voters: 0,
            seats_to_fill: 0,
            is_college: false,
            college: null,
            college_type,
            lieu_vote: lieuVote || (centerGroups[groupKey].booths.find((b: any) => b.lieu_vote)?.lieu_vote) || ''
          } as any);
        }
      }
    });
  }

  // 3. Post-traitement : s'assurer d'avoir au moins un bureau physique et mettre à jour le compteur 'bureaux'
  Object.values(centerGroups).forEach((center) => {
    if (isProfessional) {
      const hasPhysical = center.booths.some((b: any) => !b.is_college);
      if (!hasPhysical) {
        const firstBooth = center.booths[0] as any;
        const lieuVote = firstBooth?.lieu_vote || '';
        center.booths.push({
          name: 'Bureau unique',
          registered_voters: 0,
          seats_to_fill: 0,
          is_college: false,
          college: null,
          lieu_vote: lieuVote
        } as any);
      }
      center.bureaux = center.booths.filter((b: any) => !b.is_college).length;
    } else {
      center.bureaux = center.booths.length;
    }
  });

  return Object.values(centerGroups);
}

export interface ImportEstablishmentsResult {
  linked: number;
  created: number;
  skipped: number;
  errors: string[];
}

/** Crée ou réutilise les centres (contrainte unique sur le nom) et les lie à l'élection. */
export async function importEstablishmentsToElection(
  supabase: SupabaseClient,
  electionId: string,
  enterpriseId: string | null | undefined,
  centers: ParsedVotingCenter[]
): Promise<ImportEstablishmentsResult> {
  const result: ImportEstablishmentsResult = { linked: 0, created: 0, skipped: 0, errors: [] };

  // =======================================================================
  // NETTOYAGE PREALABLE : Écraser les données précédentes pour cette élection
  // =======================================================================
  try {
    // 1. Supprimer tous les bureaux de vote / collèges rattachés à cette élection
    await supabase.from('voting_bureaux').delete().eq('election_id', electionId);
    
    // 2. Trouver les centres qui étaient liés à cette élection pour nettoyage éventuel
    const { data: linkedCenters } = await supabase
      .from('election_centers')
      .select('center_id')
      .eq('election_id', electionId);
      
    // 3. Supprimer les liens de l'élection avec les centres
    await supabase.from('election_centers').delete().eq('election_id', electionId);
    
    // 4. Nettoyer les centres devenus orphelins
    if (linkedCenters && linkedCenters.length > 0) {
      const centerIds = linkedCenters.map(lc => lc.center_id);
      for (const centerId of centerIds) {
        const { count } = await supabase
          .from('election_centers')
          .select('id', { count: 'exact', head: true })
          .eq('center_id', centerId);

        if (count === 0) {
          await supabase.from('voting_centers').delete().eq('id', centerId);
        }
      }
    }
  } catch (cleanError) {
    console.warn("Erreur lors du nettoyage préalable à l'import des établissements:", cleanError);
  }
  // =======================================================================

  for (const center of centers) {
    try {
      // Pour éviter les conflits 409, on fait une recherche insensible à la casse sur le nom
      const { data: existingList } = await supabase
        .from('voting_centers')
        .select('id')
        .ilike('name', center.name.trim())
        .limit(1);

      const existing = existingList && existingList.length > 0 ? existingList[0] : null;

      let centerId: string;
      const totalSeats = center.booths.reduce((sum, b: any) => sum + (b.is_college ? (b.seats_to_fill || 0) : 0), 0);

      if (existing?.id) {
        centerId = existing.id;
        const updatePayload: Record<string, unknown> = {
          address: center.address,
          contact_name: center.contact_name,
          contact_phone: center.contact_phone,
          total_voters: center.voters,
          total_bureaux: Math.max(center.bureaux, center.booths.filter((b: any) => !b.is_college).length),
          total_seats: totalSeats
        };
        // Associer à l'entreprise si nécessaire
        if (enterpriseId) updatePayload.enterprise_id = enterpriseId;

        await supabase.from('voting_centers').update(updatePayload).eq('id', centerId);
      } else {
        const { data: created, error: insertErr } = await supabase
          .from('voting_centers')
          .insert({
            enterprise_id: enterpriseId || null,
            name: center.name.trim(),
            address: center.address,
            contact_name: center.contact_name,
            contact_phone: center.contact_phone,
            total_voters: center.voters,
            total_bureaux: Math.max(center.bureaux, center.booths.filter((b: any) => !b.is_college).length),
            total_seats: totalSeats
          })
          .select('id')
          .single();

        if (insertErr || !created) {
          // Gestion des cas de conflit d'unicité (code 23505 ou message contenant duplicate)
          if (insertErr?.code === '23505' || insertErr?.message?.includes('duplicate') || insertErr?.message?.includes('already exists')) {
            const { data: retryList } = await supabase
              .from('voting_centers')
              .select('id')
              .ilike('name', center.name.trim())
              .limit(1);
            
            if (retryList && retryList.length > 0) {
              centerId = retryList[0].id;
              const updatePayload: Record<string, unknown> = {
                address: center.address,
                contact_name: center.contact_name,
                contact_phone: center.contact_phone,
                total_voters: center.voters,
                total_bureaux: Math.max(center.bureaux, center.booths.filter((b: any) => !b.is_college).length),
                total_seats: totalSeats
              };
              if (enterpriseId) updatePayload.enterprise_id = enterpriseId;
              await supabase.from('voting_centers').update(updatePayload).eq('id', centerId);
              result.created++;
            } else {
              result.errors.push(`${center.name}: ${insertErr.message}`);
              result.skipped++;
              continue;
            }
          } else {
            result.errors.push(`${center.name}: ${insertErr?.message || 'insertion impossible'}`);
            result.skipped++;
            continue;
          }
        } else {
          centerId = created.id;
          result.created++;
        }
      }

      const { data: existingLink } = await supabase
          .from('election_centers')
          .select('id')
          .eq('election_id', electionId)
          .eq('center_id', centerId)
          .maybeSingle();

      if (!existingLink) {
        const { error: linkErr } = await supabase.from('election_centers').insert({
          election_id: electionId,
          center_id: centerId,
        });
        if (linkErr) {
          result.errors.push(`${center.name} (liaison): ${linkErr.message}`);
          result.skipped++;
          continue;
        }
      }

      result.linked++;

      if (center.booths.length > 0) {
        for (const booth of center.booths) {
          const { data: existingBooth } = await supabase
            .from('voting_bureaux')
            .select('id')
            .eq('center_id', centerId)
            .eq('name', booth.name)
            .eq('election_id', electionId)
            .maybeSingle();

          const updatePayload: Record<string, any> = {
            seats_to_fill: (booth as any).seats_to_fill || 0,
            registered_voters: booth.registered_voters || 0,
            election_id: electionId,
            lieu_vote: (booth as any).lieu_vote || null,
            college: (booth as any).college || null,
            ...(booth.college_type != null ? { college_type: booth.college_type } : {}),
          };

          if (existingBooth) {
            await supabase
              .from('voting_bureaux')
              .update(updatePayload)
              .eq('id', existingBooth.id);
          } else {
            await supabase
              .from('voting_bureaux')
              .insert({
                center_id: centerId,
                name: booth.name,
                president_name: 'N/A',
                president_phone: '000000000',
                urns_count: 0,
                ...updatePayload
              });
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(`${center.name}: ${msg}`);
      result.skipped++;
    }
  }

  return result;
}

export interface ParsedUnionList {
  unionAcronym: string;
  unionName: string;
  college: 'general' | 'cadres' | 'employes' | 'ouvriers';
  etablissement: string;
  titulaireName: string;
  titulaireGenre: string;
  titulaireAnciennete: string;
  suppleantName: string;
  suppleantGenre: string;
}

function normalizeCollegeValue(raw: unknown): ParsedUnionList['college'] {
  const collegeVal = String(raw || '').toLowerCase();
  if (collegeVal.includes('cadre')) return 'cadres';
  if (collegeVal.includes('maitrise') || collegeVal.includes('maîtrise')) return 'employes';
  if (collegeVal.includes('execution') || collegeVal.includes('exécution')) return 'ouvriers';
  if (collegeVal.includes('encadrement')) return 'general';
  return 'general';
}

/** Lit la feuille Listes (modèle pro) ou Candidats & Syndicats (politique). */
export async function parseUnionListsSheet(workbook: WorkBook, isProfessional: boolean): Promise<ParsedUnionList[]> {
  const { utils } = await import('xlsx');

  const listSheet = isProfessional
    ? workbook.Sheets['Listes'] || workbook.Sheets['Candidats']
    : workbook.Sheets['Candidats & Syndicats'] || workbook.Sheets['Candidats'] || workbook.Sheets['Listes'];

  if (!listSheet) {
    throw new Error(
      isProfessional
        ? 'La feuille « Listes » est introuvable (utilisez le modèle listes.xlsx).'
        : 'La feuille des listes/candidats est introuvable.'
    );
  }

  const rows = utils.sheet_to_json<Record<string, unknown>>(listSheet);
  const lists: ParsedUnionList[] = [];

  rows.forEach((row) => {
    let unionAcronym = '';
    let unionName = '';
    let college: ParsedUnionList['college'] = 'general';
    let etablissement = '';
    let titulaireName = '';
    let titulaireGenre = '';
    let titulaireAnciennete = '';
    let suppleantName = '';
    let suppleantGenre = '';

    if (isProfessional) {
      unionAcronym = String(row['Acronyme_Representation'] || row['Sigle'] || '').trim();
      unionName = String(row['Representation'] || row['Nom'] || '').trim();
      etablissement = String(row['Etablissement'] || '').trim();
      college = normalizeCollegeValue(row['College']);
      titulaireName = String(row['Titulaire'] || '').trim();
      titulaireGenre = String(row['Genre_Titulaire'] || '').trim();
      titulaireAnciennete = String(row['Anciennete_Titulaire'] || '').trim();
      suppleantName = String(row['Suppleant'] || row['Suppléant'] || '').trim();
      suppleantGenre = String(row['Genre_Suppleant'] || '').trim();
    } else {
      unionAcronym = String(row['Sigle Syndicat'] || row['Sigle'] || row['Acronyme'] || '').trim();
      unionName = String(
        row['Nom Complet Syndicat'] || row['Nom Syndicat'] || row['Syndicat'] || ''
      ).trim();
      college = normalizeCollegeValue(
        row['Collège concerné'] || row['Collège'] || row['College'] || 'general'
      );
      titulaireName = String(row['Nom complet du Titulaire'] || row['Titulaire'] || '').trim();
      suppleantName = String(
        row['Nom complet du Suppléant'] || row['Suppléant'] || row['Suppleant'] || ''
      ).trim();
    }

    if (!unionName && !unionAcronym && !titulaireName) return;

    lists.push({
      unionAcronym,
      unionName: unionName || unionAcronym,
      college,
      etablissement,
      titulaireName,
      titulaireGenre,
      titulaireAnciennete,
      suppleantName,
      suppleantGenre,
    });
  });

  return lists;
}

/** Convertit le format issu du wizard (candidates[]) vers ParsedUnionList[]. */
export function normalizeWizardCandidates(candidates: unknown[]): ParsedUnionList[] {
  if (!Array.isArray(candidates)) return [];

  const results: ParsedUnionList[] = [];

  for (const raw of candidates) {
    const cand = raw as Record<string, unknown>;
    if (Array.isArray(cand.candidates)) {
      const entries = cand.candidates as Array<Record<string, unknown>>;
      const party = String(cand.party || '').trim();
      const name = String(cand.name || '').trim();
      const college = normalizeCollegeValue(cand.collegeType || cand.college || 'general');
      const etablissement = String(cand.etablissement || '').trim();

      const tits = entries.filter((c) => {
        const r = String(c.role || '').toLowerCase();
        return r.includes('titulaire') || r.includes('tête') || r.includes('tete');
      });
      const sups = entries.filter((c) => {
        const r = String(c.role || '').toLowerCase();
        return r.includes('suppl');
      });

      const maxLen = Math.max(tits.length, sups.length, 1);
      for (let i = 0; i < maxLen; i++) {
        const tit = tits[i];
        const sup = sups[i];
        if (tit || sup) {
          results.push({
            unionAcronym: party,
            unionName: name || party,
            college,
            etablissement,
            titulaireName: String(tit?.name || '').trim(),
            titulaireGenre: String(tit?.genre || '').trim(),
            titulaireAnciennete: String(tit?.anciennete || '').trim(),
            suppleantName: String(sup?.name || '').trim(),
            suppleantGenre: String(sup?.genre || '').trim(),
          });
        }
      }
    } else {
      const college = normalizeCollegeValue(cand.college || 'general');
      results.push({
        unionAcronym: String(cand.unionAcronym || '').trim(),
        unionName: String(cand.unionName || cand.unionAcronym || '').trim(),
        college,
        etablissement: String(cand.etablissement || '').trim(),
        titulaireName: String(cand.titulaireName || '').trim(),
        titulaireGenre: String(cand.titulaireGenre || '').trim(),
        titulaireAnciennete: String(cand.titulaireAnciennete || '').trim(),
        suppleantName: String(cand.suppleantName || '').trim(),
        suppleantGenre: String(cand.suppleantGenre || '').trim(),
      });
    }
  }

  return results.filter((l) => !!(l.unionName || l.unionAcronym || l.titulaireName));
}

export interface ImportUnionListsResult {
  imported: number;
  skipped: number;
  errors: string[];
}

async function resolveUnionId(
  supabase: SupabaseClient,
  acronym: string,
  name: string
): Promise<string | null> {
  if (acronym) {
    const { data } = await supabase.from('unions').select('id').eq('acronym', acronym).maybeSingle();
    if (data?.id) return data.id;
  }
  if (name) {
    const { data } = await supabase.from('unions').select('id').eq('name', name).maybeSingle();
    if (data?.id) return data.id;
  }

  const insertName = name || acronym;
  if (!insertName) return null;

  const { data: created, error } = await supabase
    .from('unions')
    .insert({ name: insertName, acronym: acronym || null })
    .select('id')
    .single();

  if (error) return null;
  return created.id;
}

/** Insère les listes syndicales pour une élection (réutilise syndicats existants). */
export async function importUnionListsToElection(
  supabase: SupabaseClient,
  electionId: string,
  lists: ParsedUnionList[]
): Promise<ImportUnionListsResult> {
  const result: ImportUnionListsResult = { imported: 0, skipped: 0, errors: [] };

  // =======================================================================
  // NETTOYAGE PREALABLE : Écraser les listes précédentes pour cette élection
  // =======================================================================
  try {
    // Supprimer l'association de tous les candidats de cette élection
    await supabase.from('election_candidates').delete().eq('election_id', electionId);
    // Supprimer les listes de cette élection
    await supabase.from('union_lists').delete().eq('election_id', electionId);
  } catch (cleanError) {
    console.warn("Erreur lors du nettoyage préalable à l'import des listes:", cleanError);
  }
  // =======================================================================

  // Créer une liste distincte par titulaire (candidat)
  for (const list of lists) {
    try {
      const unionId = await resolveUnionId(supabase, list.unionAcronym, list.unionName);
      if (!unionId) {
        result.errors.push(`${list.unionName || list.unionAcronym}: syndicat introuvable`);
        result.skipped++;
        continue;
      }

      // Créer une liste par titulaire
      const titulaires = list.titulaireName ? [{
        name: list.titulaireName,
        role: 'Tête de liste',
        genre: list.titulaireGenre || undefined,
        anciennete: list.titulaireAnciennete || undefined,
        etablissement: list.etablissement || undefined,
      }] : [];

      const suppleants = list.suppleantName ? [{
        name: list.suppleantName,
        role: 'Suppléant',
        genre: list.suppleantGenre || undefined,
      }] : [];

      const { error: listErr } = await supabase.from('union_lists').insert({
        election_id: electionId,
        union_id: unionId,
        college: list.college,
        titulaires: titulaires,
        suppleants: suppleants,
      });

      if (listErr) {
        result.errors.push(`${list.unionName}: ${listErr.message}`);
        result.skipped++;
      } else {
        result.imported++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(`${list.unionName}: ${msg}`);
      result.skipped++;
    }
  }

  return result;
}
