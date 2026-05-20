import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function testInsert() {
  try {
    const fakeCandidateId = '00000000-0000-0000-0000-000000000000';
    console.log('Testing insert with fake candidate_id:', fakeCandidateId);
    
    // Let's get a real pv_id first to avoid pv foreign key violation
    const { data: pvs } = await supabase.from('procès_verbaux').select('id').limit(1);
    if (!pvs || pvs.length === 0) {
      console.log('No PVs found. Cannot test.');
      return;
    }
    const realPvId = pvs[0].id;
    console.log('Using real pv_id:', realPvId);
    
    const { data, error } = await supabase
      .from('candidate_results')
      .insert({
        pv_id: realPvId,
        candidate_id: fakeCandidateId,
        votes: 10
      })
      .select();
    
    if (error) {
      console.error('Insert failed (as expected if constraint exists):', error.message || error);
    } else {
      console.log('Insert succeeded! This means NO FOREIGN KEY CONSTRAINT exists on candidate_id, or it does not prevent arbitrary UUIDs.', data);
      
      // Clean up
      const { error: delError } = await supabase
        .from('candidate_results')
        .delete()
        .eq('id', data[0].id);
      console.log('Cleanup error:', delError);
    }
  } catch (err) {
    console.error(err);
  }
}

testInsert();
