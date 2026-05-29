// Script to query votes and seats details
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const ELECTION_ID = 'b80a33c6-a11e-4171-ac6d-f2de550a402b';

function allocateSeatsPlusForteMoyenne(
  entries,
  totalSeats
) {
  const result = new Map();
  if (totalSeats <= 0 || entries.length === 0) return result;
  
  const totalVotes = entries.reduce((sum, e) => sum + e.votes, 0);
  if (totalVotes <= 0) return result;

  const electoralQuotient = totalVotes / totalSeats;
  let allocatedSeats = 0;
  
  entries.forEach(({ id, votes }) => {
    const seats = Math.floor(votes / electoralQuotient);
    result.set(id, seats);
    allocatedSeats += seats;
  });

  const remainingSeats = totalSeats - allocatedSeats;
  for (let s = 0; s < remainingSeats; s++) {
    let maxAverage = -1;
    let winnerId = '';
    let winnerVotes = -1;

    entries.forEach(({ id, votes }) => {
      const currentSeats = result.get(id) || 0;
      const average = votes / (currentSeats + 1);
      
      if (average > maxAverage) {
        maxAverage = average;
        winnerId = id;
        winnerVotes = votes;
      } else if (average === maxAverage) {
        if (votes > winnerVotes) {
          winnerId = id;
          winnerVotes = votes;
        }
      }
    });

    if (winnerId) {
      result.set(winnerId, (result.get(winnerId) || 0) + 1);
    }
  }

  return result;
}

async function run() {
  // Get electoral colleges
  const { data: colleges } = await supabase
    .from('electoral_colleges')
    .select('*')
    .eq('election_id', ELECTION_ID);
  
  const seatsMap = {};
  colleges.forEach(ec => {
    seatsMap[ec.college_type] = ec.seats_to_fill || 0;
  });

  // Get PVs
  const { data: pvs } = await supabase
    .from('procès_verbaux')
    .select('*')
    .eq('election_id', ELECTION_ID)
    .in('status', ['validated', 'published']);
  
  const pvToCollege = {};
  pvs.forEach(pv => {
    pvToCollege[pv.id] = pv.college_type;
  });

  // Get candidate results
  const pvIds = pvs.map(pv => pv.id);
  const { data: crRows } = await supabase
    .from('candidate_results')
    .select('pv_id, candidate_id, votes, candidates!inner(id, name, party)')
    .in('pv_id', pvIds);

  console.log(`Loaded ${crRows.length} candidate result rows.`);

  // Group by college and party
  const collegeKeys = [...new Set(pvs.map(pv => pv.college_type).filter(Boolean))];
  console.log('Colleges with PVs:', collegeKeys);

  const newSeatsByParty = {};

  for (const collegeType of collegeKeys) {
    const totalSeats = seatsMap[collegeType] || 0;
    console.log(`\n--- College: ${collegeType} (seats to fill: ${totalSeats}) ---`);
    
    const votesByPartyForCollege = {};
    crRows.forEach(r => {
      if (pvToCollege[r.pv_id] !== collegeType) return;
      const partyKey = (r.candidates?.party?.split(' — ')[0] || r.candidates?.name || '').trim();
      votesByPartyForCollege[partyKey] = (votesByPartyForCollege[partyKey] || 0) + (r.votes || 0);
    });

    console.log('Votes in college:', votesByPartyForCollege);

    const entries = Object.entries(votesByPartyForCollege).map(([party, votes]) => ({ id: party, votes }));
    if (entries.length === 0 || entries.every(e => e.votes === 0)) {
      console.log('No votes in this college.');
      continue;
    }

    const allocatedMap = allocateSeatsPlusForteMoyenne(entries, totalSeats);
    console.log('Seat allocation results:');
    allocatedMap.forEach((seats, party) => {
      console.log(`  ${party}: ${seats} seats`);
      newSeatsByParty[party] = (newSeatsByParty[party] || 0) + seats;
    });
  }

  console.log('\n========================================');
  console.log('Total Seats won by Party:');
  console.log(newSeatsByParty);
}

run();
