/* eslint-disable @typescript-eslint/no-explicit-any */
import { AuditAction, ResourceType } from '@/services/auditService';
import { supabase } from '@/lib/supabase';

/**
 * Utilitaires pour générer des descriptions personnalisées pour les logs d'audit
 */

/**
 * Labels pour les types de ressources
 */
const getResourceLabel = (resourceType: ResourceType): string => {
  const labels: Record<ResourceType, string> = {
    election: 'élection',
    candidate: 'candidat',
    voting_center: 'centre de vote',
    voting_bureau: 'bureau de vote',
    user: 'utilisateur',
    'procès_verbaux': 'procès-verbal',
    election_candidate: 'candidat d\'élection',
    election_center: 'centre d\'élection',
    campaign_operation: 'opération de campagne',
    notification: 'notification',
    activity_logs: 'logs d\'audit',
  };
  return labels[resourceType] || resourceType;
};

/**
 * Récupère le nom d'une ressource à partir de son ID
 */
const getResourceName = async (resourceType: ResourceType, resourceId: string): Promise<string | null> => {
  try {
    let tableName: string;
    let nameField: string;

    switch (resourceType) {
      case 'election':
        tableName = 'elections';
        nameField = 'title';
        break;
      case 'candidate':
        tableName = 'candidates';
        nameField = 'name';
        break;
      case 'voting_center':
        tableName = 'voting_centers';
        nameField = 'name';
        break;
      case 'voting_bureau':
        tableName = 'voting_bureaux';
        nameField = 'name';
        break;
      case 'user':
        tableName = 'users';
        nameField = 'name';
        break;
      case 'procès_verbaux':
        tableName = 'procès_verbaux';
        nameField = 'id';
        break;
      case 'election_candidate':
        tableName = 'election_candidates';
        nameField = 'id';
        break;
      case 'election_center':
        tableName = 'election_centers';
        nameField = 'id';
        break;
      case 'campaign_operation':
        tableName = 'campaign_operations';
        nameField = 'title';
        break;
      case 'notification':
        tableName = 'notifications';
        nameField = 'title';
        break;
      default:
        return null;
    }

    const { data, error } = await supabase
      .from(tableName)
      .select(nameField)
      .eq('id', resourceId)
      .single();

    if (error || !data) {
      return null;
    }

    return data[nameField] || null;
  } catch (error) {
    console.error('Erreur lors de la récupération du nom de la ressource:', error);
    return null;
  }
};

/**
 * Extrait le nom d'une ressource depuis les données fournies
 */
const extractResourceName = (resourceType: ResourceType, data?: Record<string, any>): string | null => {
  if (!data) return null;
  
  // Champs possibles pour le nom selon le type de ressource
  switch (resourceType) {
    case 'election':
      return data.title || data.name || null;
    case 'candidate':
      return data.name || data.full_name || null;
    case 'voting_center':
    case 'voting_bureau':
      return data.name || null;
    case 'user':
      return data.name || data.email || null;
    case 'campaign_operation':
      return data.title || data.name || null;
    case 'notification':
      return data.title || data.message || null;
    default:
      return data.title || data.name || data.email || null;
  }
};

/**
 * Formate une description selon le modèle demandé
 */
const formatDescription = (
  userName: string,
  action: string,
  details: string,
  date: Date = new Date()
): string => {
  const dateStr = date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return `L'utilisateur ${userName} ${action} ${details} le ${dateStr}`;
};

/**
 * Génère une description personnalisée pour une action CREATE
 */
const generateCreateDescription = async (
  resourceType: ResourceType,
  userName: string,
  resourceId?: string,
  resourceName?: string,
  newValues?: Record<string, any>,
  date?: Date
): Promise<string> => {
  const resourceLabel = getResourceLabel(resourceType);
  
  // Essayer d'extraire le nom depuis les données fournies
  const extractedName = resourceName || extractResourceName(resourceType, newValues);
  
  let details = '';
  if (extractedName) {
    details = `la table ${resourceLabel} "${extractedName}"`;
  } else if (resourceId) {
    const name = await getResourceName(resourceType, resourceId);
    if (name) {
      details = `la table ${resourceLabel} "${name}"`;
    } else {
      details = `la table ${resourceLabel}`;
    }
  } else {
    details = `la table ${resourceLabel}`;
  }
  
  return formatDescription(userName, 'a créé', details, date);
};

/**
 * Génère une description personnalisée pour une action UPDATE
 */
const generateUpdateDescription = async (
  resourceType: ResourceType,
  userName: string,
  resourceId?: string,
  resourceName?: string,
  changes?: { old_values?: Record<string, any>; new_values?: Record<string, any> },
  date?: Date
): Promise<string> => {
  const resourceLabel = getResourceLabel(resourceType);
  
  // Essayer d'extraire le nom depuis les nouvelles valeurs
  const extractedName = resourceName || extractResourceName(resourceType, changes?.new_values) || extractResourceName(resourceType, changes?.old_values);
  
  let details = '';
  if (extractedName) {
    details = `la table ${resourceLabel} "${extractedName}"`;
  } else if (resourceId) {
    const name = await getResourceName(resourceType, resourceId);
    if (name) {
      details = `la table ${resourceLabel} "${name}"`;
    } else {
      details = `la table ${resourceLabel}`;
    }
  } else {
    details = `la table ${resourceLabel}`;
  }
  
  return formatDescription(userName, 'a modifié', details, date);
};

/**
 * Génère une description personnalisée pour une action DELETE
 */
const generateDeleteDescription = async (
  resourceType: ResourceType,
  userName: string,
  resourceId?: string,
  resourceName?: string,
  deletedData?: Record<string, any>,
  date?: Date
): Promise<string> => {
  const resourceLabel = getResourceLabel(resourceType);
  
  // Essayer d'extraire le nom depuis les données supprimées
  const extractedName = resourceName || extractResourceName(resourceType, deletedData);
  
  let details = '';
  if (extractedName) {
    details = `la table ${resourceLabel} "${extractedName}"`;
  } else if (resourceId) {
    const name = await getResourceName(resourceType, resourceId);
    if (name) {
      details = `la table ${resourceLabel} "${name}"`;
    } else {
      details = `la table ${resourceLabel}`;
    }
  } else {
    details = `la table ${resourceLabel}`;
  }
  
  return formatDescription(userName, 'a supprimé', details, date);
};

/**
 * Génère une description personnalisée pour une action VALIDATE
 */
const generateValidateDescription = async (
  resourceType: ResourceType,
  userName: string,
  resourceId?: string,
  resourceName?: string,
  date?: Date
): Promise<string> => {
  const resourceLabel = getResourceLabel(resourceType);
  
  let details = '';
  
  // Cas spécial pour les procès-verbaux
  if (resourceType === 'procès_verbaux') {
    // Pour les PV, on veut mentionner l'élection si possible
    if (resourceId) {
      try {
        const { data: pvData } = await supabase
          .from('procès_verbaux')
          .select('election_id, elections(title)')
          .eq('id', resourceId)
          .single();
        
        if (pvData && pvData.elections) {
          const electionName = (pvData.elections as any)?.title;
          details = `le pv table de l'élection "${electionName}"`;
        } else {
          details = 'le pv table';
        }
      } catch (error) {
        details = 'le pv table';
      }
    } else {
      details = 'le pv table';
    }
  } else {
    const extractedName = resourceName || (resourceId ? await getResourceName(resourceType, resourceId) : null);
    
    if (extractedName) {
      details = `la table ${resourceLabel} "${extractedName}"`;
    } else {
      details = `la table ${resourceLabel}`;
    }
  }
  
  return formatDescription(userName, 'a validé', details, date);
};

/**
 * Génère une description personnalisée pour une action PUBLISH
 */
const generatePublishDescription = async (
  resourceType: ResourceType,
  userName: string,
  resourceId?: string,
  resourceName?: string,
  date?: Date
): Promise<string> => {
  const resourceLabel = getResourceLabel(resourceType);
  
  const extractedName = resourceName || (resourceId ? await getResourceName(resourceType, resourceId) : null);
  
  let details = '';
  if (extractedName) {
    details = `la table ${resourceLabel} "${extractedName}"`;
  } else {
    details = `la table ${resourceLabel}`;
  }
  
  return formatDescription(userName, 'a publié', details, date);
};

/**
 * Génère une description personnalisée pour une action APPROVE
 */
const generateApproveDescription = async (
  resourceType: ResourceType,
  userName: string,
  resourceId?: string,
  resourceName?: string,
  date?: Date
): Promise<string> => {
  const resourceLabel = getResourceLabel(resourceType);
  
  const extractedName = resourceName || (resourceId ? await getResourceName(resourceType, resourceId) : null);
  
  let details = '';
  if (extractedName) {
    details = `la table ${resourceLabel} "${extractedName}"`;
  } else {
    details = `la table ${resourceLabel}`;
  }
  
  return formatDescription(userName, 'a approuvé', details, date);
};

/**
 * Génère une description personnalisée pour une action REJECT
 */
const generateRejectDescription = async (
  resourceType: ResourceType,
  userName: string,
  resourceId?: string,
  resourceName?: string,
  date?: Date
): Promise<string> => {
  const resourceLabel = getResourceLabel(resourceType);
  
  const extractedName = resourceName || (resourceId ? await getResourceName(resourceType, resourceId) : null);
  
  let details = '';
  if (extractedName) {
    details = `la table ${resourceLabel} "${extractedName}"`;
  } else {
    details = `la table ${resourceLabel}`;
  }
  
  return formatDescription(userName, 'a rejeté', details, date);
};

/**
 * Génère une description personnalisée pour une action EXPORT
 */
const generateExportDescription = (
  resourceType: ResourceType,
  userName: string,
  customMessage?: string,
  date?: Date
): string => {
  if (customMessage) {
    // Si un message personnalisé est fourni, on l'utilise mais on formate quand même avec le modèle
    return formatDescription(userName, 'a exporté', customMessage.toLowerCase(), date);
  }
  
  const resourceLabel = getResourceLabel(resourceType);
  return formatDescription(userName, 'a exporté', `la table ${resourceLabel}`, date);
};

/**
 * Génère une description personnalisée pour une action LOGIN
 */
const generateLoginDescription = (userName: string, userEmail?: string, date?: Date): string => {
  const identifier = userName || userEmail || 'un utilisateur';
  // Note: "s'est connecté" au lieu de "a connecté"
  const dateStr = date ? date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return `L'utilisateur ${identifier} s'est connecté le ${dateStr}`;
};

/**
 * Génère une description personnalisée pour une action LOGOUT
 */
const generateLogoutDescription = (userName: string, userEmail?: string, date?: Date): string => {
  const identifier = userName || userEmail || 'un utilisateur';
  // Note: "s'est déconnecté" au lieu de "a déconnecté"
  const dateStr = date ? date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return `L'utilisateur ${identifier} s'est déconnecté le ${dateStr}`;
};

/**
 * Génère une description personnalisée selon l'action et le contexte
 */
export const generateAuditDescription = async (
  action: AuditAction,
  resourceType: ResourceType,
  options: {
    resourceId?: string;
    resourceName?: string;
    userName?: string;
    userEmail?: string;
    userId?: string;
    changes?: { old_values?: Record<string, any>; new_values?: Record<string, any> };
    deletedData?: Record<string, any>;
    customMessage?: string;
    date?: Date;
  } = {}
): Promise<string> => {
  const { resourceId, resourceName, userName, userEmail, userId, changes, deletedData, customMessage, date } = options;

  // Récupérer le nom d'utilisateur si non fourni
  let finalUserName = userName || userEmail || 'Utilisateur inconnu';
  if (!userName && userId) {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', userId)
        .single();
      if (userData) {
        finalUserName = userData.name || userData.email || 'Utilisateur inconnu';
      }
    } catch (error) {
      console.warn('Impossible de récupérer le nom d\'utilisateur:', error);
    }
  }

  const actionDate = date || new Date();

  switch (action) {
    case 'CREATE':
      return generateCreateDescription(resourceType, finalUserName, resourceId, resourceName, changes?.new_values, actionDate);
    
    case 'UPDATE':
      return generateUpdateDescription(resourceType, finalUserName, resourceId, resourceName, changes, actionDate);
    
    case 'DELETE':
      return generateDeleteDescription(resourceType, finalUserName, resourceId, resourceName, deletedData, actionDate);
    
    case 'VALIDATE':
      return generateValidateDescription(resourceType, finalUserName, resourceId, resourceName, actionDate);
    
    case 'PUBLISH':
      return generatePublishDescription(resourceType, finalUserName, resourceId, resourceName, actionDate);
    
    case 'APPROVE':
      return generateApproveDescription(resourceType, finalUserName, resourceId, resourceName, actionDate);
    
    case 'REJECT':
      return generateRejectDescription(resourceType, finalUserName, resourceId, resourceName, actionDate);
    
    case 'EXPORT':
      return generateExportDescription(resourceType, finalUserName, customMessage, actionDate);
    
    case 'LOGIN':
      return generateLoginDescription(finalUserName, userEmail, actionDate);
    
    case 'LOGOUT':
      return generateLogoutDescription(finalUserName, userEmail, actionDate);
    
    case 'IMPORT':
      if (customMessage) {
        return formatDescription(finalUserName, 'a importé', customMessage.toLowerCase(), actionDate);
      }
      return formatDescription(finalUserName, 'a importé', `la table ${getResourceLabel(resourceType)}`, actionDate);
    
    case 'ARCHIVE':
      if (customMessage) {
        return formatDescription(finalUserName, 'a archivé', customMessage.toLowerCase(), actionDate);
      }
      return formatDescription(finalUserName, 'a archivé', `la table ${getResourceLabel(resourceType)}`, actionDate);
    
    default:
      if (customMessage) {
        return customMessage;
      }
      return formatDescription(finalUserName, `a effectué ${action.toLowerCase()}`, `sur ${getResourceLabel(resourceType)}`, actionDate);
  }
};

