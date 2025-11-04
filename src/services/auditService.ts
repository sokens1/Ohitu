import { supabase } from '@/lib/supabase';

/**
 * Types d'actions pour la piste d'audit
 */
export type AuditAction = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'VALIDATE' 
  | 'PUBLISH' 
  | 'LOGIN' 
  | 'LOGOUT'
  | 'EXPORT' 
  | 'IMPORT'
  | 'APPROVE'
  | 'REJECT'
  | 'ARCHIVE';

/**
 * Types de ressources pour la piste d'audit
 */
export type ResourceType = 
  | 'election'
  | 'candidate'
  | 'voting_center'
  | 'voting_bureau'
  | 'user'
  | 'procès_verbaux'
  | 'election_candidate'
  | 'election_center'
  | 'campaign_operation'
  | 'notification';

/**
 * Interface pour les changements dans l'audit
 */
export interface AuditChanges {
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  diff?: Record<string, { old: any; new: any }>;
}

/**
 * Interface pour créer un log d'audit
 */
export interface CreateAuditLogParams {
  action: AuditAction;
  resource_type: ResourceType;
  resource_id?: string;
  description?: string;
  changes?: AuditChanges;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Interface pour un log d'audit complet
 */
export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  description: string | null;
  changes: AuditChanges | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  // Champs supplémentaires pour l'affichage
  user_name?: string;
  user_email?: string;
}

/**
 * Service pour gérer la piste d'audit
 */
class AuditService {
  /**
   * Récupère l'adresse IP du client (pour usage navigateur)
   */
  private async getClientIP(): Promise<string | null> {
    try {
      // Essayer de récupérer l'IP via un service externe
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || null;
    } catch (error) {
      console.warn('Impossible de récupérer l\'IP:', error);
      return null;
    }
  }

  /**
   * Récupère le user-agent du navigateur
   */
  private getUserAgent(): string | null {
    if (typeof window !== 'undefined' && window.navigator) {
      return window.navigator.userAgent;
    }
    return null;
  }

  /**
   * Calcule les différences entre deux objets
   */
  private calculateDiff(oldValues: Record<string, any>, newValues: Record<string, any>): Record<string, { old: any; new: any }> {
    const diff: Record<string, { old: any; new: any }> = {};
    const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

    for (const key of allKeys) {
      const oldVal = oldValues[key];
      const newVal = newValues[key];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff[key] = { old: oldVal, new: newVal };
      }
    }

    return diff;
  }

  /**
   * Enregistre un log d'audit
   */
  async log(params: CreateAuditLogParams): Promise<boolean> {
    try {
      // Récupérer l'IP et user-agent si non fournis
      const ip_address = params.ip_address || await this.getClientIP();
      const user_agent = params.user_agent || this.getUserAgent();

      // Préparer les changements
      let changesJson: AuditChanges | null = null;
      if (params.changes) {
        changesJson = {
          old_values: params.changes.old_values,
          new_values: params.changes.new_values,
        };

        // Calculer les différences si old_values et new_values sont présents
        if (params.changes.old_values && params.changes.new_values) {
          changesJson.diff = this.calculateDiff(
            params.changes.old_values,
            params.changes.new_values
          );
        }
      }

      // Insérer dans la base de données
      // Note: La structure de la table doit correspondre à celle définie dans STRUCTURE_BD_COMPLETE.md
      // Utiliser entity_type et entity_id si la table utilise ces colonnes, sinon resource_type/resource_id
      const { error } = await supabase
        .from('activity_logs')
        .insert({
          user_id: params.user_id || null,
          action: params.action,
          entity_type: params.resource_type, // Mapping resource_type -> entity_type
          entity_id: params.resource_id || null, // Mapping resource_id -> entity_id
          details: changesJson as any, // JSONB - mapping changes -> details
          ip_address: ip_address,
          user_agent: user_agent,
        });

      if (error) {
        console.error('Erreur lors de l\'enregistrement du log d\'audit:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du log d\'audit:', error);
      return false;
    }
  }

  /**
   * Enregistre un log avec les valeurs avant/après automatiquement calculées
   */
  async logChange(
    action: AuditAction,
    resource_type: ResourceType,
    resource_id: string | undefined,
    oldValues: Record<string, any> | undefined,
    newValues: Record<string, any> | undefined,
    description?: string,
    user_id?: string
  ): Promise<boolean> {
    return this.log({
      action,
      resource_type,
      resource_id,
      description,
      changes: {
        old_values: oldValues,
        new_values: newValues,
      },
      user_id,
    });
  }

  /**
   * Récupère les logs d'audit avec filtres
   */
  async getLogs(filters?: {
    user_id?: string;
    action?: AuditAction;
    resource_type?: ResourceType;
    resource_id?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AuditLog[] | null; error: any }> {
    try {
      let query = supabase
        .from('activity_logs')
        .select(`
          *,
          users:user_id (
            id,
            name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (filters?.user_id) {
        query = query.eq('user_id', filters.user_id);
      }

      if (filters?.action) {
        query = query.eq('action', filters.action);
      }

      if (filters?.resource_type) {
        query = query.eq('entity_type', filters.resource_type); // Mapping resource_type -> entity_type
      }

      if (filters?.resource_id) {
        query = query.eq('entity_id', filters.resource_id); // Mapping resource_id -> entity_id
      }

      if (filters?.start_date) {
        query = query.gte('created_at', filters.start_date);
      }

      if (filters?.end_date) {
        query = query.lte('created_at', filters.end_date);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erreur lors de la récupération des logs:', error);
        return { data: null, error };
      }

      // Transformer les données pour inclure les informations utilisateur
      const transformedData: AuditLog[] = (data || []).map((log: any) => ({
        id: log.id,
        user_id: log.user_id,
        action: log.action,
        resource_type: log.entity_type || log.resource_type, // Mapping entity_type -> resource_type
        resource_id: log.entity_id || log.resource_id, // Mapping entity_id -> resource_id
        description: log.description,
        changes: log.details || log.changes, // Mapping details -> changes
        ip_address: log.ip_address,
        user_agent: log.user_agent,
        created_at: log.created_at,
        user_name: log.users?.name || null,
        user_email: log.users?.email || null,
      }));

      return { data: transformedData, error: null };
    } catch (error) {
      console.error('Erreur lors de la récupération des logs:', error);
      return { data: null, error };
    }
  }

  /**
   * Récupère les statistiques d'audit
   */
  async getStats(dateRange?: { start: string; end: string }): Promise<{
    total_logs: number;
    by_action: Record<string, number>;
    by_resource_type: Record<string, number>;
    by_user: Array<{ user_id: string; user_name: string; count: number }>;
  }> {
    try {
      let query = supabase
        .from('activity_logs')
        .select('action, entity_type, user_id, users:user_id(name)'); // Utiliser entity_type

      if (dateRange) {
        query = query
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end);
      }

      const { data, error } = await query;

      if (error || !data) {
        return {
          total_logs: 0,
          by_action: {},
          by_resource_type: {},
          by_user: [],
        };
      }

      const by_action: Record<string, number> = {};
      const by_resource_type: Record<string, number> = {};
      const by_user_map: Record<string, { user_id: string; user_name: string; count: number }> = {};

      for (const log of data) {
        // Compter par action
        by_action[log.action] = (by_action[log.action] || 0) + 1;

        // Compter par type de ressource (mapping entity_type -> resource_type)
        const resourceType = log.entity_type || log.resource_type;
        by_resource_type[resourceType] = (by_resource_type[resourceType] || 0) + 1;

        // Compter par utilisateur
        if (log.user_id) {
          if (!by_user_map[log.user_id]) {
            by_user_map[log.user_id] = {
              user_id: log.user_id,
              user_name: (log.users as any)?.name || 'Utilisateur inconnu',
              count: 0,
            };
          }
          by_user_map[log.user_id].count++;
        }
      }

      return {
        total_logs: data.length,
        by_action,
        by_resource_type,
        by_user: Object.values(by_user_map).sort((a, b) => b.count - a.count),
      };
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      return {
        total_logs: 0,
        by_action: {},
        by_resource_type: {},
        by_user: [],
      };
    }
  }
}

export const auditService = new AuditService();
export default auditService;

