import { supabase } from '@/lib/supabase';

/** Élection professionnelle (délégués du personnel) — terminologie « électeurs ». */
export function isProfessionalElection(electionType?: string | null): boolean {
  return (electionType || '').trim() === 'Élection Professionnelle';
}

/** Libellé UI : « Électeurs » (pro) ou « Inscrits » (scrutins publics). */
export function getRegisteredVotersLabel(electionType?: string | null, short = false): string {
  if (isProfessionalElection(electionType)) {
    return short ? 'Élect.' : 'Électeurs';
  }
  return short ? 'Insc.' : 'Inscrits';
}

/**
 * Total d'électeurs/inscrits pour une élection.
 * Pro : collèges électoraux (total_voters) en priorité, puis bureaux, puis nb_electeurs.
 * Autres : somme des bureaux, puis nb_electeurs.
 */
export async function getElectionElectorsTotal(
  electionId: string,
  electionType?: string | null
): Promise<number> {
  try {
    let type = electionType;
    let nbElecteurs = 0;

    if (!type) {
      const { data: election } = await supabase
        .from('elections')
        .select('type, nb_electeurs')
        .eq('id', electionId)
        .maybeSingle();
      type = election?.type;
      nbElecteurs = Number(election?.nb_electeurs) || 0;
    } else {
      const { data: election } = await supabase
        .from('elections')
        .select('nb_electeurs')
        .eq('id', electionId)
        .maybeSingle();
      nbElecteurs = Number(election?.nb_electeurs) || 0;
    }

    if (isProfessionalElection(type)) {
      const { data: colleges } = await supabase
        .from('electoral_colleges')
        .select('total_voters')
        .eq('election_id', electionId);

      const collegesTotal = (colleges || []).reduce(
        (sum, c) => sum + (Number(c.total_voters) || 0),
        0
      );
      if (collegesTotal > 0) return collegesTotal;
    }

    const fromBureaux = await calculateElectionTotalVoters(electionId);
    if (fromBureaux > 0) return fromBureaux;

    return nbElecteurs;
  } catch (error) {
    console.error('Erreur getElectionElectorsTotal:', error);
    return 0;
  }
}

/**
 * Calcule le nombre total d'électeurs d'une élection
 * Logique : Somme des électeurs de tous les centres associés à l'élection
 * Chaque centre = Somme des électeurs de tous ses bureaux
 */
export async function calculateElectionTotalVoters(electionId: string): Promise<number> {
  try {
    // 1. Récupérer tous les centres associés à l'élection
    const { data: electionCenters, error: centersError } = await supabase
      .from('election_centers')
      .select(`
        voting_centers(
          id,
          voting_bureaux(id, registered_voters)
        )
      `)
      .eq('election_id', electionId);

    if (centersError) {
      console.error('Erreur lors du chargement des centres de l\'élection:', centersError);
      return 0;
    }

    // 2. Calculer le total des électeurs
    let totalVoters = 0;

    electionCenters?.forEach((link: any) => {
      const center = link.voting_centers;
      if (center?.voting_bureaux) {
        // Somme des électeurs de tous les bureaux de ce centre
        const centerVoters = center.voting_bureaux.reduce((sum: number, bureau: any) => 
          sum + (bureau.registered_voters || 0), 0);
        totalVoters += centerVoters;
      }
    });

    return totalVoters;
  } catch (error) {
    console.error('Erreur lors du calcul du nombre total d\'électeurs:', error);
    return 0;
  }
}

/**
 * Calcule le nombre total d'électeurs d'un centre
 * Logique : Somme des électeurs de tous les bureaux du centre
 */
export async function calculateCenterTotalVoters(centerId: string): Promise<number> {
  try {
    const { data: bureaux, error } = await supabase
      .from('voting_bureaux')
      .select('registered_voters')
      .eq('center_id', centerId);

    if (error) {
      console.error('Erreur lors du chargement des bureaux du centre:', error);
      return 0;
    }

    return bureaux?.reduce((sum, bureau) => 
      sum + (bureau.registered_voters || 0), 0) || 0;
  } catch (error) {
    console.error('Erreur lors du calcul du nombre d\'électeurs du centre:', error);
    return 0;
  }
}

/**
 * Met à jour le nombre total d'électeurs d'un centre dans la base de données
 */
export async function updateCenterTotalVoters(centerId: string): Promise<void> {
  try {
    const totalVoters = await calculateCenterTotalVoters(centerId);
    
    const { error } = await supabase
      .from('voting_centers')
      .update({ 
        total_voters: totalVoters,
        updated_at: new Date().toISOString()
      })
      .eq('id', centerId);

    if (error) {
      console.error('Erreur lors de la mise à jour du nombre d\'électeurs du centre:', error);
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du nombre d\'électeurs du centre:', error);
  }
}

/**
 * Met à jour le nombre total d'électeurs d'une élection dans la base de données
 */
export async function updateElectionTotalVoters(electionId: string): Promise<void> {
  try {
    const totalVoters = await calculateElectionTotalVoters(electionId);
    
    const { error } = await supabase
      .from('elections')
      .update({ 
        nb_electeurs: totalVoters,
        updated_at: new Date().toISOString()
      })
      .eq('id', electionId);

    if (error) {
      console.error('Erreur lors de la mise à jour du nombre d\'électeurs de l\'élection:', error);
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du nombre d\'électeurs de l\'élection:', error);
  }
}
