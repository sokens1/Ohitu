import { supabase } from '@/lib/supabase';

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
