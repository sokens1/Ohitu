import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateElectionTotalVoters, updateElectionTotalVoters } from '@/utils/electionCalculations';

/**
 * Hook pour synchroniser automatiquement le nombre d'électeurs des élections
 * avec les centres et bureaux associés
 */
export function useElectionVotersSync() {
  // Fonction pour synchroniser toutes les élections
  const syncAllElections = useCallback(async () => {
    try {
      console.log('🔄 Synchronisation du nombre d\'électeurs de toutes les élections...');
      
      // Récupérer toutes les élections
      const { data: elections, error } = await supabase
        .from('elections')
        .select('id, title');

      if (error) {
        console.error('❌ Erreur lors de la récupération des élections:', error);
        return;
      }

      // Mettre à jour le nombre d'électeurs pour chaque élection
      for (const election of elections || []) {
        await updateElectionTotalVoters(election.id);
        console.log(`✅ Élection "${election.title}" synchronisée`);
      }

      console.log('✅ Synchronisation terminée');
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation:', error);
    }
  }, []);

  // Fonction pour synchroniser une élection spécifique
  const syncElection = useCallback(async (electionId: string) => {
    try {
      console.log(`🔄 Synchronisation de l'élection ${electionId}...`);
      await updateElectionTotalVoters(electionId);
      console.log(`✅ Élection ${electionId} synchronisée`);
    } catch (error) {
      console.error(`❌ Erreur lors de la synchronisation de l'élection ${electionId}:`, error);
    }
  }, []);

  // Fonction pour synchroniser les élections affectées par un changement de centre
  const syncElectionsByCenter = useCallback(async (centerId: string) => {
    try {
      console.log(`🔄 Synchronisation des élections du centre ${centerId}...`);
      
      // Récupérer toutes les élections qui utilisent ce centre
      const { data: electionCenters, error } = await supabase
        .from('election_centers')
        .select('election_id')
        .eq('center_id', centerId);

      if (error) {
        console.error('❌ Erreur lors de la récupération des élections du centre:', error);
        return;
      }

      // Synchroniser chaque élection
      for (const link of electionCenters || []) {
        await updateElectionTotalVoters(link.election_id);
      }

      console.log(`✅ ${electionCenters?.length || 0} élections synchronisées`);
    } catch (error) {
      console.error(`❌ Erreur lors de la synchronisation des élections du centre ${centerId}:`, error);
    }
  }, []);

  // Fonction pour synchroniser les élections affectées par un changement de bureau
  const syncElectionsByBureau = useCallback(async (bureauId: string) => {
    try {
      console.log(`🔄 Synchronisation des élections du bureau ${bureauId}...`);
      
      // Récupérer le centre du bureau
      const { data: bureau, error: bureauError } = await supabase
        .from('voting_bureaux')
        .select('center_id')
        .eq('id', bureauId)
        .single();

      if (bureauError) {
        console.error('❌ Erreur lors de la récupération du centre du bureau:', bureauError);
        return;
      }

      // Synchroniser les élections de ce centre
      await syncElectionsByCenter(bureau.center_id);
    } catch (error) {
      console.error(`❌ Erreur lors de la synchronisation des élections du bureau ${bureauId}:`, error);
    }
  }, [syncElectionsByCenter]);

  // Synchronisation automatique au montage du composant
  useEffect(() => {
    syncAllElections();
  }, [syncAllElections]);

  return {
    syncAllElections,
    syncElection,
    syncElectionsByCenter,
    syncElectionsByBureau,
  };
}

/**
 * Hook pour surveiller les changements dans les bureaux de vote
 * et synchroniser automatiquement les élections affectées
 */
export function useBureauVotersSync() {
  const { syncElectionsByBureau } = useElectionVotersSync();

  // Surveiller les changements dans les bureaux de vote
  useEffect(() => {
    const channel = supabase
      .channel('bureau_voters_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voting_bureaux',
        },
        (payload) => {
          console.log('🔄 Changement détecté dans les bureaux de vote:', payload);
          if (payload.new?.id) {
            syncElectionsByBureau(payload.new.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [syncElectionsByBureau]);

  return { syncElectionsByBureau };
}

/**
 * Hook pour surveiller les changements dans les centres de vote
 * et synchroniser automatiquement les élections affectées
 */
export function useCenterVotersSync() {
  const { syncElectionsByCenter } = useElectionVotersSync();

  // Surveiller les changements dans les centres de vote
  useEffect(() => {
    const channel = supabase
      .channel('center_voters_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voting_centers',
        },
        (payload) => {
          console.log('🔄 Changement détecté dans les centres de vote:', payload);
          if (payload.new?.id) {
            syncElectionsByCenter(payload.new.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [syncElectionsByCenter]);

  return { syncElectionsByCenter };
}

/**
 * Hook pour surveiller les changements dans les liens élection-centre
 * et synchroniser automatiquement les élections affectées
 */
export function useElectionCenterSync() {
  const { syncElection } = useElectionVotersSync();

  // Surveiller les changements dans les liens élection-centre
  useEffect(() => {
    const channel = supabase
      .channel('election_center_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'election_centers',
        },
        (payload) => {
          console.log('🔄 Changement détecté dans les liens élection-centre:', payload);
          if (payload.new?.election_id) {
            syncElection(payload.new.election_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [syncElection]);

  return { syncElection };
}

