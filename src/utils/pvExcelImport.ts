/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { resolveCandidatesForElection } from '@/lib/candidateUtils';
import { isProfessionalElection } from '@/utils/electionCalculations';

function norm(s: string | null | undefined): string {
  return (s ?? '').toString().toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeCollege(val: string | null | undefined): string | null {
  if (!val) return null;
  const v = val.toLowerCase().trim();
  if (v === 'general' || v === 'encadrement') return 'general';
  if (v === 'cadres' || v === 'cadre') return 'cadres';
  if (v === 'employes' || v.includes('maitrise') || v.includes('maîtrise')) return 'employes';
  if (v === 'ouvriers' || v.includes('execution') || v.includes('exécution')) return 'ouvriers';
  return v;
}

export interface PVImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export async function importPVsFromExcel(
  file: File,
  electionId: string,
  electionType: string | null
): Promise<PVImportResult> {
  const result: PVImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  // ── 1. Lire le fichier ──────────────────────────────────────────────────────
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets['saisie'];
  if (!ws) {
    result.errors.push('Feuille "saisie" introuvable dans le fichier.');
    return result;
  }

  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (rows.length < 2) {
    result.errors.push('Aucune donnée dans la feuille saisie.');
    return result;
  }

  // ── 2. Analyser l'en-tête ──────────────────────────────────────────────────
  // Colonnes fixes : 0=Etablissement 1=College 2=Bureau 3=N/B
  // Colonnes dynamiques à partir de 4 : "Votes [ACRONYME]"
  const header = (rows[0] as string[]).map(h => String(h).trim());
  const syndicatCols: { idx: number; acronym: string }[] = [];
  header.forEach((col, idx) => {
    if (idx >= 4 && col.toLowerCase().startsWith('votes ')) {
      const acronym = col.replace(/^votes\s+/i, '').trim();
      if (acronym) syndicatCols.push({ idx, acronym });
    }
  });

  if (syndicatCols.length === 0) {
    result.errors.push('Aucune colonne "Votes [syndicat]" trouvée dans l\'en-tête.');
    return result;
  }

  // ── 3. Charger les données DB ───────────────────────────────────────────────
  const { data: ecRows } = await supabase
    .from('election_centers')
    .select('center_id')
    .eq('election_id', electionId);
  const centerIds = (ecRows || []).map((r: any) => r.center_id);

  if (centerIds.length === 0) {
    result.errors.push('Aucun établissement associé à cette élection.');
    return result;
  }

  const [centersRes, bureauxRes] = await Promise.all([
    supabase.from('voting_centers').select('id, name').in('id', centerIds),
    supabase.from('voting_bureaux')
      .select('id, name, center_id, registered_voters, college, college_type, seats_to_fill')
      .in('center_id', centerIds),
  ]);

  const centers: any[] = centersRes.data || [];
  const bureaux: any[] = bureauxRes.data || [];
  const candidates = await resolveCandidatesForElection(electionId, electionType);
  const isPro = isProfessionalElection(electionType);

  // ── 4. Tables de correspondance ────────────────────────────────────────────
  // Centre : nom normalisé → objet center
  const centerByName = new Map<string, any>();
  centers.forEach(c => centerByName.set(norm(c.name), c));

  // Bureaux : pour chaque centre, regrouper les vrais bureaux (non-pseudo) et les pseudo-entrées
  // Un pseudo-bureau a son nom qui commence par 'College -' ou a college/college_type défini sans être physique
  const physicalBureaux = bureaux.filter(b =>
    !b.name?.startsWith('College -') &&
    (b.college == null || b.college === '' || b.college === 'general')
  );

  // bureau physique : "centerId|nomNormalisé" → bureau
  const physicalByKey = new Map<string, any>();
  physicalBureaux.forEach(b => {
    physicalByKey.set(`${b.center_id}|${norm(b.name)}`, b);
  });

  // pseudo-bureau (College -) : "centerId|collegeType" → bureau
  const pseudoByKey = new Map<string, any>();
  bureaux
    .filter(b => b.name?.startsWith('College -') || (b.college && b.college !== ''))
    .forEach(b => {
      const colKey = normalizeCollege(b.college_type || b.college);
      if (colKey) pseudoByKey.set(`${b.center_id}|${colKey}`, b);
    });

  // ── 5. Traiter chaque ligne ─────────────────────────────────────────────────
  const dataRows = rows.slice(1);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const lineNum = i + 2;

    const etabRaw  = String(row[0] ?? '').trim();
    const colRaw   = String(row[1] ?? '').trim();
    const bureauRaw = String(row[2] ?? '').trim();
    const nbRaw    = String(row[3] ?? '').trim();

    // Ignorer les lignes entièrement vides
    const hasAnyData = etabRaw || colRaw || bureauRaw || nbRaw ||
      syndicatCols.some(sc => String(row[sc.idx] ?? '').trim() !== '');
    if (!hasAnyData) { result.skipped++; continue; }

    // Ignorer les lignes sans votes ET sans N/B (ligne de structure)
    const hasVoteData = nbRaw !== '' ||
      syndicatCols.some(sc => String(row[sc.idx] ?? '').trim() !== '');
    if (!hasVoteData) { result.skipped++; continue; }

    if (!etabRaw) { result.errors.push(`L${lineNum}: Etablissement manquant.`); continue; }
    if (!bureauRaw && !colRaw) { result.errors.push(`L${lineNum}: Bureau/Collège manquant.`); continue; }

    // Trouver le centre
    const center = centerByName.get(norm(etabRaw));
    if (!center) {
      result.errors.push(`L${lineNum}: Établissement "${etabRaw}" non trouvé dans cette élection.`);
      continue;
    }

    const collegeType = normalizeCollege(colRaw) || null;

    // Trouver le bureau
    let bureau: any = null;

    if (isPro) {
      // 1) Chercher un bureau physique par nom
      if (bureauRaw) {
        bureau = physicalByKey.get(`${center.id}|${norm(bureauRaw)}`);
        // 2) Fallback : n'importe quel bureau physique de ce centre
        if (!bureau) {
          bureau = physicalBureaux.find(b => b.center_id === center.id);
        }
      }
      // 3) Fallback : pseudo-bureau du collège
      if (!bureau && collegeType) {
        bureau = pseudoByKey.get(`${center.id}|${collegeType}`);
      }
    } else {
      bureau = physicalByKey.get(`${center.id}|${norm(bureauRaw)}`);
    }

    if (!bureau) {
      result.errors.push(`L${lineNum}: Bureau "${bureauRaw}" introuvable dans "${etabRaw}".`);
      continue;
    }

    // Calculer les totaux
    let votesExpressed = 0;
    const syndicatVotes: { acronym: string; votes: number }[] = [];
    syndicatCols.forEach(sc => {
      const v = parseInt(String(row[sc.idx] ?? '0').replace(/\s/g, '')) || 0;
      votesExpressed += v;
      syndicatVotes.push({ acronym: sc.acronym, votes: v });
    });
    const nullVotes   = parseInt(nbRaw.replace(/\s/g, '')) || 0;
    const totalVoters = votesExpressed + nullVotes;
    const totalRegistered = Number(bureau.registered_voters) || 0;

    // Matcher les candidats (par syndicat + collège + établissement)
    const rowCandidates = isPro
      ? candidates.filter(c => {
          const collegeMatch = !collegeType || c.college_type === collegeType;
          const etabMatch = !c.etablissement || norm(c.etablissement) === norm(center.name);
          return collegeMatch && etabMatch;
        })
      : candidates;

    // Dédupliquer par acronyme syndicat (garder le premier id)
    const syndicatToId = new Map<string, string>();
    rowCandidates.forEach(c => {
      const acronym = (c.party?.split(' — ')[0] || c.name || '').trim();
      if (!syndicatToId.has(acronym)) syndicatToId.set(acronym, c.id);
    });

    // Vérifier si un PV existe déjà
    let pvQuery = supabase
      .from('procès_verbaux')
      .select('id, status')
      .eq('election_id', electionId)
      .eq('bureau_id', bureau.id);
    if (isPro && collegeType) pvQuery = pvQuery.eq('college_type', collegeType);
    const { data: existingPvs } = await pvQuery.limit(1);
    const existingPv = existingPvs?.[0] ?? null;

    // Ne pas écraser un PV déjà validé/publié
    if (existingPv && ['validated', 'validé', 'published'].includes(existingPv.status)) {
      result.errors.push(`L${lineNum}: PV "${bureauRaw}" (${colRaw || '—'}) déjà validé — ignoré.`);
      result.skipped++;
      continue;
    }

    const pvData = {
      election_id: electionId,
      bureau_id: bureau.id,
      college_type: isPro ? collegeType : (bureau.college_type ?? null),
      total_registered: totalRegistered,
      total_voters: totalVoters,
      null_votes: nullVotes,
      votes_expressed: votesExpressed,
      status: 'entered',
      entered_at: new Date().toISOString(),
    };

    let pvId: string;
    if (existingPv) {
      const { error } = await supabase.from('procès_verbaux').update(pvData).eq('id', existingPv.id);
      if (error) { result.errors.push(`L${lineNum}: Mise à jour PV échouée: ${error.message}`); continue; }
      pvId = existingPv.id;
      result.updated++;
    } else {
      const { data: inserted, error } = await supabase
        .from('procès_verbaux').insert(pvData).select('id').single();
      if (error || !inserted) { result.errors.push(`L${lineNum}: Création PV échouée: ${error?.message}`); continue; }
      pvId = inserted.id;
      result.created++;
    }

    // Insérer les résultats candidats
    const entries: { pv_id: string; candidate_id: string; votes: number }[] = [];
    const unmatched: string[] = [];
    syndicatVotes.forEach(({ acronym, votes }) => {
      const candidateId = syndicatToId.get(acronym);
      if (candidateId) {
        entries.push({ pv_id: pvId, candidate_id: candidateId, votes });
      } else {
        unmatched.push(acronym);
      }
    });

    if (unmatched.length > 0) {
      result.errors.push(`L${lineNum}: Syndicat(s) non trouvé(s) : ${unmatched.join(', ')}.`);
    }

    if (entries.length > 0) {
      await supabase.from('candidate_results').delete().eq('pv_id', pvId);
      const { error: crErr } = await supabase.from('candidate_results').insert(entries);
      if (crErr) result.errors.push(`L${lineNum}: Erreur résultats candidats: ${crErr.message}`);
    }
  }

  return result;
}
