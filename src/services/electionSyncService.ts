import { supabase } from '@/lib/supabase';
import { calculateElectionTotalVoters, updateElectionTotalVoters } from '@/utils/electionCalculations';

/**
 * Service de synchronisation automatique des élections
 * Met à jour constamment le nombre d'électeurs des élections
 */
class ElectionSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly SYNC_INTERVAL = 30000; // 30 secondes

  /**
   * Démarrer la synchronisation automatique
   */
  start() {
    if (this.isRunning) {
      console.log('🔄 Service de synchronisation déjà en cours');
      return;
    }

    console.log('🚀 Démarrage du service de synchronisation des élections');
    this.isRunning = true;

    // Synchronisation immédiate
    this.syncAllElections();

    // Synchronisation périodique
    this.syncInterval = setInterval(() => {
      this.syncAllElections();
    }, this.SYNC_INTERVAL);
  }

  /**
   * Arrêter la synchronisation automatique
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log('⏹️ Service de synchronisation arrêté');
  }

  /**
   * Synchroniser toutes les élections
   */
  private async syncAllElections() {
    try {
      console.log('🔄 Synchronisation automatique des élections...');
      
      // Récupérer toutes les élections
      const { data: elections, error } = await supabase
        .from('elections')
        .select('id, title, nb_electeurs');

      if (error) {
        console.error('❌ Erreur lors de la récupération des élections:', error);
        return;
      }

      if (!elections || elections.length === 0) {
        console.log('ℹ️ Aucune élection à synchroniser');
        return;
      }

      let updatedCount = 0;

      // Synchroniser chaque élection
      for (const election of elections) {
        try {
          // Calculer le nombre d'électeurs réel
          const realVoters = await calculateElectionTotalVoters(election.id);
          
          // Vérifier si une mise à jour est nécessaire
          if (realVoters !== election.nb_electeurs) {
            await updateElectionTotalVoters(election.id);
            updatedCount++;
            console.log(`✅ Élection "${election.title}" mise à jour: ${election.nb_electeurs} → ${realVoters} électeurs`);
          }
        } catch (error) {
          console.error(`❌ Erreur lors de la synchronisation de l'élection ${election.id}:`, error);
        }
      }

      if (updatedCount > 0) {
        console.log(`✅ Synchronisation terminée: ${updatedCount} élection(s) mise(s) à jour`);
      } else {
        console.log('✅ Synchronisation terminée: Aucune mise à jour nécessaire');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation automatique:', error);
    }
  }

  /**
   * Synchroniser une élection spécifique
   */
  async syncElection(electionId: string) {
    try {
      console.log(`🔄 Synchronisation de l'élection ${electionId}...`);
      await updateElectionTotalVoters(electionId);
      console.log(`✅ Élection ${electionId} synchronisée`);
    } catch (error) {
      console.error(`❌ Erreur lors de la synchronisation de l'élection ${electionId}:`, error);
    }
  }

  /**
   * Vérifier si le service est en cours d'exécution
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      interval: this.SYNC_INTERVAL
    };
  }
}

// Instance singleton
export const electionSyncService = new ElectionSyncService();

// Démarrer automatiquement le service
if (typeof window !== 'undefined') {
  electionSyncService.start();
}

