import { supabase } from '@/lib/supabase';
import { isElectionPublishedForPublic, isElectionVisibleOnPublic } from '@/utils/electionVisibility';

export interface ElectionEntity {
  id: string;
  slug?: string;
  title: string;
  election_date: string;
  status: string;
  description?: string;
  localisation?: string;
  nb_electeurs?: number;
  is_published?: boolean;
  is_public_visible?: boolean;
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

/** Élections listées sur login / sélecteur public (publiées et visibles). */
export async function fetchPublicElections(): Promise<ElectionEntity[]> {
  const { data, error } = await supabase
    .from('elections')
    .select('*')
    .eq('is_published', true)
    .eq('is_public_visible', true)
    .neq('status', 'Annulée')
    .order('election_date', { ascending: false });
  if (error) {
    // Colonne is_public_visible absente : repli client après migration manuelle
    if (error.code === '42703' || error.code === 'PGRST204') {
      const { data: fallback, error: fallbackError } = await supabase
        .from('elections')
        .select('*')
        .eq('is_published', true)
        .order('election_date', { ascending: false });
      if (fallbackError) throw fallbackError;
      return (fallback || []).filter(isElectionPublishedForPublic);
    }
    throw error;
  }
  return (data || []).filter(isElectionPublishedForPublic);
}

export async function fetchRunningElection(): Promise<ElectionEntity | null> {
  const { data, error } = await supabase
    .from('elections')
    .select('*')
    .ilike('status', '%en cours%')
    .eq('is_public_visible', true)
    .order('election_date', { ascending: false })
    .limit(5);
  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204') {
      const { data: fallback, error: fallbackError } = await supabase
        .from('elections')
        .select('*')
        .ilike('status', '%en cours%')
        .order('election_date', { ascending: false })
        .limit(5);
      if (fallbackError) throw fallbackError;
      const visible = (fallback || []).filter(isElectionVisibleOnPublic);
      return visible.length > 0 ? visible[0] : null;
    }
    throw error;
  }
  const visible = (data || []).filter(isElectionVisibleOnPublic);
  return visible.length > 0 ? visible[0] : null;
}

export async function fetchPublishedElection(): Promise<ElectionEntity | null> {
  const { data, error } = await supabase
    .from('elections')
    .select('*')
    .eq('is_published', true)
    .eq('is_public_visible', true)
    .neq('status', 'Annulée')
    .order('election_date', { ascending: false })
    .limit(5);
  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204') {
      const { data: fallback, error: fallbackError } = await supabase
        .from('elections')
        .select('*')
        .eq('is_published', true)
        .order('election_date', { ascending: false })
        .limit(5);
      if (fallbackError) throw fallbackError;
      const visible = (fallback || []).filter(isElectionPublishedForPublic);
      return visible.length > 0 ? visible[0] : null;
    }
    throw error;
  }
  const visible = (data || []).filter(isElectionPublishedForPublic);
  return visible.length > 0 ? visible[0] : null;
}

export async function fetchLatestElection(): Promise<ElectionEntity | null> {
  const { data, error } = await supabase
    .from('elections')
    .select('*')
    .eq('is_public_visible', true)
    .order('election_date', { ascending: false })
    .limit(5);
  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204') {
      const { data: fallback, error: fallbackError } = await supabase
        .from('elections')
        .select('*')
        .order('election_date', { ascending: false })
        .limit(5);
      if (fallbackError) throw fallbackError;
      const visible = (fallback || []).filter(isElectionVisibleOnPublic);
      return visible.length > 0 ? visible[0] : null;
    }
    throw error;
  }
  const visible = (data || []).filter(isElectionVisibleOnPublic);
  return visible.length > 0 ? visible[0] : null;
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

/** Résout un slug d'URL vers l'élection correspondante. */
export async function fetchElectionBySlug(slug: string): Promise<ElectionEntity | null> {
  const { data, error } = await supabase
    .from('elections')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error) return null;
  return data as ElectionEntity;
}
