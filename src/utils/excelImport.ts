import type { SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import type { WorkBook } from 'xlsx';

export interface ParsedBooth {
  name: string;
  registered_voters: number;
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
export function parseEstablishmentsSheet(
  workbook: WorkBook,
  isProfessional: boolean
): ParsedVotingCenter[] {
  const estSheet = isProfessional
    ? workbook.Sheets['Etablissements'] || workbook.Sheets['Établissements & Bureaux']
    : workbook.Sheets['Établissements & Bureaux'] || workbook.Sheets['Etablissements'];

  if (!estSheet) {
    throw new Error('La feuille des établissements est introuvable (attendu : « Etablissements »).');
  }

  const estRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(estSheet);
  const centerGroups: Record<string, ParsedVotingCenter> = {};

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

    const booths: ParsedBooth[] = [];
    let totalVoters = 0;
    let boothCount = 0;

    if (isProfessional) {
      const lieuVote = String(row['Lieu_vote'] || '').trim();
      const vEnc = Number(row['Nbre_electeurs_Encadrement'] || 0);
      const vCad = Number(row['Nbre_electeurs_Cadre'] || 0);
      const vMai = Number(row['Nbre _electeurs_Maitrise'] || row['Nbre_electeurs_Maitrise'] || 0);
      const vExe = Number(row['Nbre _electeurs_Execution'] || row['Nbre_electeurs_Execution'] || 0);
      const sEnc = Number(row['nb_sieges_Encadrement'] || 0);
      const sCad = Number(row['nb_sieges_Cadre'] || 0);
      const sMai = Number(row['nb_sieges_Maitrise'] || 0);
      const sExe = Number(row['nb_sieges_Execution'] || 0);

      totalVoters = vEnc + vCad + vMai + vExe;
      boothCount = 1;

      const baseName = lieuVote || name;
      const addBooth = (suffix: string, voters: number, seats: number) => {
        if (voters > 0 || seats > 0) {
          booths.push({
            name: `${baseName} - ${suffix}`,
            registered_voters: voters > 0 ? voters : seats,
          });
        }
      };

      addBooth('Encadrement', vEnc, sEnc);
      addBooth('Cadres', vCad, sCad);
      addBooth('Maîtrise', vMai, sMai);
      addBooth('Exécution', vExe, sExe);

      if (booths.length === 0) {
        const totalSeats = sEnc + sCad + sMai + sExe;
        booths.push({
          name: `${baseName} - Bureau unique`,
          registered_voters: totalVoters > 0 ? totalVoters : totalSeats,
        });
      }
    } else {
      const boothName = String(row['Nom Bureau de vote'] || '').trim();
      totalVoters = Number(row["Nombre d'électeurs"] || 0);
      boothCount = 1;
      if (boothName) {
        booths.push({ name: boothName, registered_voters: totalVoters });
      }
    }

    const groupKey = `${region}_${name}`;
    if (!centerGroups[groupKey]) {
      centerGroups[groupKey] = {
        name,
        address: region,
        contact_name: resp || 'N/A',
        contact_phone: phone,
        voters: 0,
        bureaux: 0,
        booths: [],
      };
    }
    centerGroups[groupKey].voters += totalVoters;
    centerGroups[groupKey].bureaux += boothCount;
    centerGroups[groupKey].booths.push(...booths);
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

  for (const center of centers) {
    try {
      const { data: existing } = await supabase
        .from('voting_centers')
        .select('id')
        .eq('name', center.name)
        .maybeSingle();

      let centerId: string;

      if (existing?.id) {
        centerId = existing.id;
        const updatePayload: Record<string, unknown> = {
          address: center.address,
          contact_name: center.contact_name,
          contact_phone: center.contact_phone,
          total_voters: center.voters,
          total_bureaux: Math.max(center.bureaux, center.booths.length),
        };
        if (enterpriseId) updatePayload.enterprise_id = enterpriseId;

        await supabase.from('voting_centers').update(updatePayload).eq('id', centerId);
      } else {
        const { data: created, error: insertErr } = await supabase
          .from('voting_centers')
          .insert({
            enterprise_id: enterpriseId || null,
            name: center.name,
            address: center.address,
            contact_name: center.contact_name,
            contact_phone: center.contact_phone,
            total_voters: center.voters,
            total_bureaux: Math.max(center.bureaux, center.booths.length),
          })
          .select('id')
          .single();

        if (insertErr || !created) {
          result.errors.push(`${center.name}: ${insertErr?.message || 'insertion impossible'}`);
          result.skipped++;
          continue;
        }
        centerId = created.id;
        result.created++;
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
        const { data: existingBureaux } = await supabase
          .from('voting_bureaux')
          .select('name')
          .eq('center_id', centerId);

        const existingNames = new Set((existingBureaux || []).map((b) => b.name));
        const toInsert = center.booths
          .filter((b) => !existingNames.has(b.name))
          .map((b) => ({
            center_id: centerId,
            name: b.name,
            registered_voters: b.registered_voters,
            president_name: 'N/A',
            president_phone: '000000000',
            urns_count: 0,
          }));

        if (toInsert.length > 0) {
          const { error: boothErr } = await supabase.from('voting_bureaux').insert(toInsert);
          if (boothErr) {
            result.errors.push(`${center.name} (bureaux): ${boothErr.message}`);
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
export function parseUnionListsSheet(workbook: WorkBook, isProfessional: boolean): ParsedUnionList[] {
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

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(listSheet);
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

  return candidates
    .map((raw): ParsedUnionList | null => {
      const cand = raw as Record<string, unknown>;
      if (Array.isArray(cand.candidates)) {
        const entries = cand.candidates as Array<Record<string, unknown>>;
        const tit = entries.find((c) => String(c.role || '').toLowerCase().includes('titulaire'));
        const sup = entries.find((c) => String(c.role || '').toLowerCase().includes('suppl'));
        const party = String(cand.party || '').trim();
        const name = String(cand.name || '').trim();
        return {
          unionAcronym: party,
          unionName: name || party,
          college: normalizeCollegeValue(cand.collegeType || cand.college || 'general'),
          etablissement: String(cand.etablissement || '').trim(),
          titulaireName: String(tit?.name || '').trim(),
          titulaireGenre: String(tit?.genre || '').trim(),
          titulaireAnciennete: String(tit?.anciennete || '').trim(),
          suppleantName: String(sup?.name || '').trim(),
          suppleantGenre: String(sup?.genre || '').trim(),
        };
      }
      return {
        unionAcronym: String(cand.unionAcronym || '').trim(),
        unionName: String(cand.unionName || cand.unionAcronym || '').trim(),
        college: normalizeCollegeValue(cand.college || 'general'),
        etablissement: String(cand.etablissement || '').trim(),
        titulaireName: String(cand.titulaireName || '').trim(),
        titulaireGenre: String(cand.titulaireGenre || '').trim(),
        titulaireAnciennete: String(cand.titulaireAnciennete || '').trim(),
        suppleantName: String(cand.suppleantName || '').trim(),
        suppleantGenre: String(cand.suppleantGenre || '').trim(),
      };
    })
    .filter((l): l is ParsedUnionList => !!l && !!(l.unionName || l.unionAcronym || l.titulaireName));
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

  for (const list of lists) {
    try {
      const unionId = await resolveUnionId(supabase, list.unionAcronym, list.unionName);
      if (!unionId) {
        result.errors.push(`${list.unionName || list.unionAcronym}: syndicat introuvable`);
        result.skipped++;
        continue;
      }

      const { data: existingList } = await supabase
        .from('union_lists')
        .select('id')
        .eq('election_id', electionId)
        .eq('union_id', unionId)
        .eq('college', list.college)
        .maybeSingle();

      if (existingList?.id) {
        result.skipped++;
        continue;
      }

      const titulaires = [];
      if (list.titulaireName) {
        titulaires.push({
          name: list.titulaireName,
          role: 'Tête de liste',
          genre: list.titulaireGenre || undefined,
          anciennete: list.titulaireAnciennete || undefined,
          etablissement: list.etablissement || undefined,
        });
      }
      const suppleants = [];
      if (list.suppleantName) {
        suppleants.push({
          name: list.suppleantName,
          role: 'Suppléant',
          genre: list.suppleantGenre || undefined,
        });
      }

      const { error: listErr } = await supabase.from('union_lists').insert({
        election_id: electionId,
        union_id: unionId,
        college: list.college,
        titulaires,
        suppleants,
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
