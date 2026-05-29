import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const ELECTION_ID = 'b80a33c6-a11e-4171-ac6d-f2de550a402b';

function normalizeCollegeKey(val) {
  if (!val) return null;
  const v = val.toLowerCase().trim();
  if (v === 'general' || v === 'encadrement') return 'general';
  if (v === 'cadres' || v === 'cadre') return 'cadres';
  if (v === 'employes' || v.includes('maitrise') || v.includes('maîtrise')) return 'employes';
  if (v === 'ouvriers' || v.includes('execution') || v.includes('exécution')) return 'ouvriers';
  return v;
}

// Seat allocation algorithm
function allocateSeatsForCollege(syndicats, seatsToFill) {
  const empty = {};
  syndicats.forEach(s => { empty[s.partyKey] = 0; });
  if (!syndicats.length || seatsToFill === 0) return { seats: empty };
  const suffrages = syndicats.reduce((sum, s) => sum + s.votes, 0);
  if (suffrages === 0) return { seats: empty };

  const ancAgeTie = (tied) => {
    const maxAnc = Math.max(...tied.map(t => t.anciennete));
    const byAnc = tied.filter(t => t.anciennete === maxAnc);
    if (byAnc.length === 1) return byAnc[0];
    const maxAge = Math.max(...byAnc.map(t => t.age));
    const byAge = byAnc.filter(t => t.age === maxAge);
    return byAge.length === 1 ? byAge[0] : null;
  };

  // Case 1: 1 seat
  if (seatsToFill === 1) {
    const maxV = Math.max(...syndicats.map(s => s.votes));
    const tied = syndicats.filter(s => s.votes === maxV);
    if (tied.length === 1) return { seats: { ...empty, [tied[0].partyKey]: 1 } };
    const winner = ancAgeTie(tied);
    if (!winner) return { seats: empty, manualTie: tied.map(s => s.partyKey) };
    return { seats: { ...empty, [winner.partyKey]: 1 } };
  }

  // Case 2: 2 seats
  if (seatsToFill === 2) {
    const quotient = suffrages / 2;
    const allocated = { ...empty };
    syndicats.forEach(s => { allocated[s.partyKey] = Math.floor(s.votes / quotient); });
    let remaining = 2 - Object.values(allocated).reduce((a, b) => a + b, 0);
    if (remaining === 0) return { seats: allocated };

    while (remaining > 0) {
      const withMoy = syndicats.map(s => ({ ...s, moy: s.votes / (allocated[s.partyKey] + 1) }));
      const maxMoy = Math.max(...withMoy.map(m => m.moy));
      const tied = withMoy.filter(m => m.moy === maxMoy);
      if (tied.length === 1) { allocated[tied[0].partyKey]++; remaining--; continue; }

      // Tie breaker: total votes -> seniority -> age -> manual
      const maxV = Math.max(...tied.map(t => t.votes));
      const byVotes = tied.filter(t => t.votes === maxV);
      if (byVotes.length === 1) { allocated[byVotes[0].partyKey]++; remaining--; continue; }
      const winner = ancAgeTie(byVotes);
      if (!winner) return { seats: allocated, manualTie: byVotes.map(s => s.partyKey) };
      allocated[winner.partyKey]++;
      remaining--;
    }
    return { seats: allocated };
  }

  return { seats: empty };
}

async function run() {
  // 1. Fetch union lists
  const { data: unionLists } = await supabase
    .from('union_lists')
    .select('id, college, titulaires, suppleants, unions(id, name, acronym)')
    .eq('election_id', ELECTION_ID);

  const candidateInfoMap = new Map();
  unionLists.forEach(ul => {
    const acronym = ul.unions?.acronym?.trim();
    const name = ul.unions?.name?.trim();
    const collegeKey = normalizeCollegeKey(ul.college);
    
    let age = 0;
    let seniority = 0;
    
    if (Array.isArray(ul.titulaires) && ul.titulaires.length > 0) {
      const tete = ul.titulaires[0];
      age = Number(tete.age) || 0;
      seniority = Number(tete.anciennete) || 0;
    }
    
    if (acronym && collegeKey) candidateInfoMap.set(`${acronym}_${collegeKey}`, { age, seniority });
    if (name && collegeKey) candidateInfoMap.set(`${name}_${collegeKey}`, { age, seniority });
  });

  // 2. Fetch voting bureaux
  const { data: allBureaux } = await supabase
    .from('voting_bureaux')
    .select('id, name, center_id, college, seats_to_fill');

  const bureauSeats = new Map();
  allBureaux.forEach(b => {
    const colKey = normalizeCollegeKey(b.college);
    if (b.seats_to_fill && colKey && b.center_id) {
      const key = `${String(b.center_id)}_${colKey}`;
      bureauSeats.set(key, Number(b.seats_to_fill) || 0);
    }
  });

  // 3. Fetch all PVs
  const { data: pvs } = await supabase
    .from('procès_verbaux')
    .select('id, bureau_id, college_type, status')
    .eq('election_id', ELECTION_ID);

  // 4. Fetch candidate results
  const pvIds = pvs.map(pv => pv.id);
  const { data: crRows } = await supabase
    .from('candidate_results')
    .select('pv_id, candidate_id, votes, candidates(id, name, party)')
    .in('pv_id', pvIds);

  const bureauMap = new Map(allBureaux.map(b => [b.id, b]));
  const resultSeats = {};

  console.log('--- Bureau-by-Bureau Calculations (excluding entered/saisi status) ---');

  pvs.forEach((pv, idx) => {
    // Exclude entered/saisi PVs
    if (pv.status === 'entered' || pv.status === 'saisi') {
      console.log(`[PV ${idx + 1}] Bureau: ${bureauMap.get(pv.bureau_id)?.name} | College: ${pv.college_type} | Status is ${pv.status}. EXCLUDED.`);
      return;
    }

    const b = bureauMap.get(pv.bureau_id);
    const centerId = b?.center_id;
    const colKey = normalizeCollegeKey(pv.college_type);
    const seatsToFillKey = `${centerId}_${colKey}`;
    const seatsToFill = bureauSeats.get(seatsToFillKey) || 0;

    if (seatsToFill === 0) return;

    const pvResults = crRows.filter(r => r.pv_id === pv.id);
    const partyVotes = new Map();
    pvResults.forEach(r => {
      const cand = r.candidates;
      if (!cand) return;
      const pk = (cand.party?.split(' — ')[0] || cand.name || '').trim();
      partyVotes.set(pk, (partyVotes.get(pk) || 0) + (r.votes || 0));
    });

    const syndicats = Array.from(partyVotes.entries()).map(([pk, v]) => {
      const infoKey = `${pk}_${colKey}`;
      const info = candidateInfoMap.get(infoKey) || { age: 0, seniority: 0 };
      return {
        partyKey: pk,
        votes: v,
        anciennete: info.seniority,
        age: info.age
      };
    });

    const alloc = allocateSeatsForCollege(syndicats, seatsToFill);
    
    console.log(`[PV ${idx + 1}] Bureau: ${b?.name} | College: ${pv.college_type} | Seats: ${seatsToFill} | Allocated: ${JSON.stringify(alloc.seats)}`);

    Object.entries(alloc.seats).forEach(([pk, s]) => {
      resultSeats[pk] = (resultSeats[pk] || 0) + s;
    });
  });

  console.log('\n--- Final Seats Accumulation ---');
  console.log(resultSeats);
}

run();
