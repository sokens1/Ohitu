import { supabase } from '@/lib/supabase';

export interface ElectionEntity {
  id: string;
  title: string;
  election_date: string;
  status: string;
  description?: string;
  localisation?: string;
  nb_electeurs?: number;
  is_published?: boolean;
  cover_image_url?: string;
  type?: string;
}

export async function fetchAllElections(): Promise<ElectionEntity[]> {
  const { data, error } = await supabase
    .from('elections')
    .select('*')
    .order('election_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchRunningElection(): Promise<ElectionEntity | null> {
  const { data, error } = await supabase
    .from('elections')
    .select('*')
    .ilike('status', '%en cours%')
    .order('election_date', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

export async function fetchPublishedElection(): Promise<ElectionEntity | null> {
  const { data, error } = await supabase
    .from('elections')
    .select('*')
    .eq('is_published', true)
    .order('election_date', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

export async function fetchLatestElection(): Promise<ElectionEntity | null> {
  const { data, error } = await supabase
    .from('elections')
    .select('*')
    .order('election_date', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

export async function fetchElectionById(electionId: string): Promise<ElectionEntity | null> {
  const { data, error } = await supabase
    .from('elections')
    .select('*')
    .eq('id', electionId)
    .single();
  if (error) throw error;
  return data as ElectionEntity;
}


