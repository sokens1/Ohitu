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
      row['Nom_Etablissement__Centre'] || row['Nom_Etablissement__Site'] || row['Nom Établissement / Site'] || row['Site'] || ''
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
        bRow['Nom_Etablissement__Centre'] ||
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
  centers: ParsedVotingCenter[],
  onProgress?: (done: number, total: number) => void
): Promise<ImportEstablishmentsResult> {
  const result: ImportEstablishmentsResult = { linked: 0, created: 0, skipped: 0, errors: [] };
  const total = centers.length;

  // 1. Nettoyage préalable
  try {
    await supabase.from('voting_bureaux').delete().eq('election_id', electionId);
    const { data: linkedCenters } = await supabase
      .from('election_centers').select('center_id').eq('election_id', electionId);
    await supabase.from('election_centers').delete().eq('election_id', electionId);
    if (linkedCenters && linkedCenters.length > 0) {
      const centerIds = linkedCenters.map((lc: any) => lc.center_id);
      // Vérification orphelins en une seule requête
      const { data: stillLinked } = await supabase
        .from('election_centers').select('center_id').in('center_id', centerIds);
      const stillLinkedIds = new Set((stillLinked || []).map((l: any) => l.center_id));
      const orphanIds = centerIds.filter((id: string) => !stillLinkedIds.has(id));
      if (orphanIds.length > 0) {
        await supabase.from('voting_centers').delete().in('id', orphanIds);
      }
    }
  } catch (cleanError) {
    console.warn("Nettoyage préalable établissements:", cleanError);
  }

  // 2. Pré-charger tous les centres existants en une seule requête
  const { data: existingCenters } = await supabase
    .from('voting_centers').select('id, name');
  const centerByName = new Map<string, string>();
  (existingCenters || []).forEach((c: any) => {
    centerByName.set(c.name.toLowerCase().trim(), c.id);
  });

  // 3. Traiter chaque établissement avec résolution des IDs
  const centerRows: { center: ParsedVotingCenter; centerId: string }[] = [];
  const toCreateCenters: { center: ParsedVotingCenter; idx: number }[] = [];

  for (let i = 0; i < centers.length; i++) {
    const center = centers[i];
    const existingId = centerByName.get(center.name.toLowerCase().trim());
    if (existingId) {
      centerRows.push({ center, centerId: existingId });
    } else {
      toCreateCenters.push({ center, idx: i });
    }
  }

  // 4. Créer les nouveaux centres en bulk
  if (toCreateCenters.length > 0) {
    const insertPayload = toCreateCenters.map(({ center }) => {
      const totalSeats = center.booths.reduce((s, b: any) => s + (b.is_college ? (b.seats_to_fill || 0) : 0), 0);
      return {
        enterprise_id: enterpriseId || null,
        name: center.name.trim(),
        address: center.address,
        contact_name: center.contact_name,
        contact_phone: center.contact_phone,
        total_voters: center.voters,
        total_bureaux: Math.max(center.bureaux, center.booths.filter((b: any) => !b.is_college).length),
        total_seats: totalSeats,
      };
    });

    const { data: created, error: bulkErr } = await supabase
      .from('voting_centers').insert(insertPayload).select('id, name');

    if (bulkErr) {
      // Fallback : insertion individuelle
      for (const { center } of toCreateCenters) {
        const totalSeats = center.booths.reduce((s, b: any) => s + (b.is_college ? (b.seats_to_fill || 0) : 0), 0);
        const { data: single, error: singleErr } = await supabase
          .from('voting_centers')
          .insert({ enterprise_id: enterpriseId || null, name: center.name.trim(), address: center.address, contact_name: center.contact_name, contact_phone: center.contact_phone, total_voters: center.voters, total_bureaux: Math.max(center.bureaux, center.booths.filter((b: any) => !b.is_college).length), total_seats: totalSeats })
          .select('id').single();
        if (singleErr || !single) {
          // Conflit d'unicité : chercher l'existant
          const { data: retry } = await supabase.from('voting_centers').select('id').ilike('name', center.name.trim()).limit(1);
          if (retry?.[0]) {
            centerRows.push({ center, centerId: retry[0].id });
            result.created++;
          } else {
            result.errors.push(`${center.name}: ${singleErr?.message || 'insertion impossible'}`);
            result.skipped++;
          }
        } else {
          centerRows.push({ center, centerId: single.id });
          result.created++;
        }
      }
    } else {
      const createdMap = new Map<string, string>();
      (created || []).forEach((c: any) => createdMap.set(c.name.toLowerCase().trim(), c.id));
      for (const { center } of toCreateCenters) {
        const cId = createdMap.get(center.name.toLowerCase().trim());
        if (cId) {
          centerRows.push({ center, centerId: cId });
          result.created++;
        } else {
          result.errors.push(`${center.name}: ID introuvable après création`);
          result.skipped++;
        }
      }
    }
  }

  // Mettre à jour les centres existants (en parallèle)
  await Promise.all(
    centerRows
      .filter(({ centerId }) => centerByName.has)
      .map(({ center, centerId }) => {
        const totalSeats = center.booths.reduce((s, b: any) => s + (b.is_college ? (b.seats_to_fill || 0) : 0), 0);
        const payload: Record<string, unknown> = {
          address: center.address, contact_name: center.contact_name, contact_phone: center.contact_phone,
          total_voters: center.voters,
          total_bureaux: Math.max(center.bureaux, center.booths.filter((b: any) => !b.is_college).length),
          total_seats: totalSeats,
        };
        if (enterpriseId) payload.enterprise_id = enterpriseId;
        return supabase.from('voting_centers').update(payload).eq('id', centerId);
      })
  );

  // 5. Batch insert election_centers en une seule requête
  const linkRows = centerRows.map(({ centerId }) => ({ election_id: electionId, center_id: centerId }));
  if (linkRows.length > 0) {
    const { error: linkErr } = await supabase.from('election_centers').insert(linkRows);
    if (linkErr) {
      result.errors.push(`Liaison centres: ${linkErr.message}`);
    } else {
      result.linked = linkRows.length;
    }
  }

  // 6. Batch insert des bureaux par établissement avec progression
  let done = 0;
  const BOOTH_BATCH = 100;
  for (const { center, centerId } of centerRows) {
    if (center.booths.length > 0) {
      const boothRows = center.booths.map((booth: any) => ({
        center_id: centerId,
        name: booth.name,
        president_name: 'N/A',
        president_phone: '000000000',
        urns_count: 0,
        seats_to_fill: booth.seats_to_fill || 0,
        registered_voters: booth.registered_voters || 0,
        election_id: electionId,
        lieu_vote: booth.lieu_vote || null,
        college: booth.college || null,
        ...(booth.college_type != null ? { college_type: booth.college_type } : {}),
      }));

      for (let i = 0; i < boothRows.length; i += BOOTH_BATCH) {
        await supabase.from('voting_bureaux').insert(boothRows.slice(i, i + BOOTH_BATCH));
      }
    }
    done++;
    onProgress?.(done, total);
  }

  return result;
}

export interface ParsedUnionList {
  unionAcronym: string;
  unionName: string;
  college: 'general' | 'cadres' | 'employes' | 'ouvriers';
  etablissement: string;
  titulaireMatricule: string;
  titulaireName: string;
  titulaireGenre: string;
  titulaireAge: string;
  titulaireAnciennete: string;
  suppleantMatricule: string;
  suppleantName: string;
  suppleantGenre: string;
  suppleantAge: string;
  suppleantAnciennete: string;
}

function normalizeCollegeValue(raw: unknown): ParsedUnionList['college'] {
  const collegeVal = String(raw || '').toLowerCase();
  // 'encadrement' doit être testé AVANT 'cadre' car 'encadrement'.includes('cadre') === true
  if (collegeVal === 'general' || collegeVal.includes('encadrement')) return 'general';
  if (collegeVal.includes('cadre')) return 'cadres';
  if (collegeVal.includes('maitrise') || collegeVal.includes('maîtrise')) return 'employes';
  if (collegeVal.includes('execution') || collegeVal.includes('exécution')) return 'ouvriers';
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
    let titulaireMatricule = '';
    let titulaireName = '';
    let titulaireGenre = '';
    let titulaireAge = '';
    let titulaireAnciennete = '';
    let suppleantMatricule = '';
    let suppleantName = '';
    let suppleantGenre = '';
    let suppleantAge = '';
    let suppleantAnciennete = '';

    if (isProfessional) {
      unionAcronym = String(row['Acronyme_Representation'] || row['Sigle'] || '').trim();
      unionName = String(row['Representation'] || row['Nom'] || '').trim();
      etablissement = String(row['Établissement'] || row['Etablissement'] || row['etablissement'] || row['ETABLISSEMENT'] || '').trim();
      college = normalizeCollegeValue(row['College']);
      titulaireMatricule = String(row['Matricule_Titulaire'] || '').trim();
      titulaireName = String(row['Titulaire'] || '').trim();
      titulaireGenre = String(row['Genre_Titulaire'] || '').trim();
      titulaireAge = String(row['Age_Titulaire'] || '').trim();
      titulaireAnciennete = String(row['Anciennete_Titulaire'] || '').trim();
      suppleantMatricule = String(row['Matricule_Suppleant'] || '').trim();
      suppleantName = String(row['Suppleant'] || row['Suppléant'] || '').trim();
      suppleantGenre = String(row['Genre_Suppleant'] || '').trim();
      suppleantAge = String(row['Age_Suppleant'] || '').trim();
      suppleantAnciennete = String(row['Ancienneté_Suppleant'] || row['Anciennete_Suppleant'] || '').trim();
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
      titulaireMatricule,
      titulaireName,
      titulaireGenre,
      titulaireAge,
      titulaireAnciennete,
      suppleantMatricule,
      suppleantName,
      suppleantGenre,
      suppleantAge,
      suppleantAnciennete,
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
            titulaireMatricule: String(tit?.matricule || '').trim(),
            titulaireName: String(tit?.name || '').trim(),
            titulaireGenre: String(tit?.genre || '').trim(),
            titulaireAge: String(tit?.age || '').trim(),
            titulaireAnciennete: String(tit?.anciennete || '').trim(),
            suppleantMatricule: String(sup?.matricule || '').trim(),
            suppleantName: String(sup?.name || '').trim(),
            suppleantGenre: String(sup?.genre || '').trim(),
            suppleantAge: String(sup?.age || '').trim(),
            suppleantAnciennete: String(sup?.anciennete || '').trim(),
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
        titulaireMatricule: String(cand.titulaireMatricule || '').trim(),
        titulaireName: String(cand.titulaireName || '').trim(),
        titulaireGenre: String(cand.titulaireGenre || '').trim(),
        titulaireAge: String(cand.titulaireAge || '').trim(),
        titulaireAnciennete: String(cand.titulaireAnciennete || '').trim(),
        suppleantMatricule: String(cand.suppleantMatricule || '').trim(),
        suppleantName: String(cand.suppleantName || '').trim(),
        suppleantGenre: String(cand.suppleantGenre || '').trim(),
        suppleantAge: String(cand.suppleantAge || '').trim(),
        suppleantAnciennete: String(cand.suppleantAnciennete || '').trim(),
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
  lists: ParsedUnionList[],
  onProgress?: (done: number, total: number) => void
): Promise<ImportUnionListsResult> {
  const result: ImportUnionListsResult = { imported: 0, skipped: 0, errors: [] };
  const total = lists.length;

  // 1. Nettoyage préalable (2 requêtes)
  try {
    await supabase.from('election_candidates').delete().eq('election_id', electionId);
    await supabase.from('union_lists').delete().eq('election_id', electionId);
  } catch (cleanError) {
    console.warn("Nettoyage préalable:", cleanError);
  }

  // 2. Charger tous les syndicats existants en une seule requête
  const { data: existingUnions } = await supabase.from('unions').select('id, acronym, name');
  const byAcronym = new Map<string, string>();
  const byName = new Map<string, string>();
  (existingUnions || []).forEach((u: any) => {
    if (u.acronym) byAcronym.set(u.acronym.toLowerCase(), u.id);
    if (u.name) byName.set(u.name.toLowerCase(), u.id);
  });

  // 3. Identifier les syndicats manquants et les créer en bulk (1 requête)
  const uniqueSyndicats = new Map<string, { acronym: string; name: string }>();
  for (const list of lists) {
    const key = (list.unionAcronym || list.unionName).toLowerCase();
    if (!key) continue;
    const exists = (list.unionAcronym && byAcronym.has(list.unionAcronym.toLowerCase())) ||
                   (list.unionName && byName.has(list.unionName.toLowerCase()));
    if (!exists && !uniqueSyndicats.has(key)) {
      uniqueSyndicats.set(key, { acronym: list.unionAcronym, name: list.unionName });
    }
  }

  if (uniqueSyndicats.size > 0) {
    const toCreate = Array.from(uniqueSyndicats.values()).map(s => ({
      name: s.name || s.acronym,
      acronym: s.acronym || null,
    }));
    const { data: created } = await supabase.from('unions').insert(toCreate).select('id, acronym, name');
    (created || []).forEach((u: any) => {
      if (u.acronym) byAcronym.set(u.acronym.toLowerCase(), u.id);
      if (u.name) byName.set(u.name.toLowerCase(), u.id);
    });
  }

  // 4. Construire toutes les lignes à insérer (sans requête réseau)
  const rows: any[] = [];
  for (const list of lists) {
    const unionId =
      (list.unionAcronym && byAcronym.get(list.unionAcronym.toLowerCase())) ||
      (list.unionName && byName.get(list.unionName.toLowerCase())) ||
      null;

    if (!unionId) {
      result.errors.push(`${list.unionName || list.unionAcronym}: syndicat introuvable`);
      result.skipped++;
      continue;
    }

    rows.push({
      election_id: electionId,
      union_id: unionId,
      college: list.college,
      titulaires: list.titulaireName ? [{
        name: list.titulaireName,
        role: 'Tête de liste',
        genre: list.titulaireGenre || undefined,
        age: list.titulaireAge || undefined,
        anciennete: list.titulaireAnciennete || undefined,
        matricule: list.titulaireMatricule || undefined,
        etablissement: list.etablissement || undefined,
      }] : [],
      suppleants: list.suppleantName ? [{
        name: list.suppleantName,
        role: 'Suppléant',
        genre: list.suppleantGenre || undefined,
        age: list.suppleantAge || undefined,
        anciennete: list.suppleantAnciennete || undefined,
        matricule: list.suppleantMatricule || undefined,
      }] : [],
    });
  }

  // 5. Insertion par batches de 50 avec progression
  const BATCH = 50;
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error: batchErr } = await supabase.from('union_lists').insert(batch);
    if (batchErr) {
      // Fallback : insertion individuelle pour ce batch
      for (const row of batch) {
        const { error: singleErr } = await supabase.from('union_lists').insert(row);
        if (singleErr) {
          result.errors.push(singleErr.message);
          result.skipped++;
        } else {
          result.imported++;
        }
        done++;
        onProgress?.(done, total);
      }
    } else {
      result.imported += batch.length;
      done += batch.length;
      onProgress?.(done, total);
    }
  }

  return result;
}

