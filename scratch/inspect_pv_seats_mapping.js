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

async function run() {
  const { data: allBureaux, error: bErr } = await supabase
    .from('voting_bureaux')
    .select('id, name, center_id, college, seats_to_fill, college_type');
  
  if (bErr) throw bErr;

  console.log('Sample bureau with college:', allBureaux.find(b => b.college));

  const bureauSeats = new Map();
  allBureaux.forEach(b => {
    // Normalise le collège pour la clé
    const colKey = normalizeCollegeKey(b.college || b.college_type);
    if (b.seats_to_fill && colKey && b.center_id) {
      const key = `${String(b.center_id)}_${colKey}`;
      bureauSeats.set(key, Number(b.seats_to_fill) || 0);
    }
  });

  console.log(`Built bureauSeats Map with ${bureauSeats.size} entries.`);

  const { data: pvs, error: pvErr } = await supabase
    .from('procès_verbaux')
    .select('id, bureau_id, college_type, status')
    .eq('election_id', ELECTION_ID)
    .in('status', ['validated', 'published']);

  if (pvErr) throw pvErr;

  const bureauMap = new Map(allBureaux.map(b => [b.id, b]));

  console.log('\nMapping PVs to seats:');
  pvs.forEach((pv, idx) => {
    const b = bureauMap.get(pv.bureau_id);
    const centerId = b?.center_id;
    const key = `${String(centerId)}_${normalizeCollegeKey(pv.college_type)}`;
    const seats = bureauSeats.get(key) || 0;
    console.log(`[PV ${idx + 1}] PV ID: ${pv.id} | Bureau: ${b?.name} | Center: ${centerId} | College: ${pv.college_type} | Key: ${key} | Resolved Seats: ${seats}`);
  });
}

run();
