/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import auditService, { AuditAction, ResourceType, CreateAuditLogParams, AuditChanges } from '@/services/auditService';

/**
 * Hook pour faciliter l'utilisation de la piste d'audit
 */
export const useAudit = () => {
  const { user } = useAuth();

  /**
   * Enregistre un log d'audit
   */
  const log = useCallback(async (params: Omit<CreateAuditLogParams, 'user_id'>) => {
    return auditService.log({
      ...params,
      user_id: user?.id,
    });
  }, [user]);

  /**
   * Enregistre une création
   */
  const logCreate = useCallback(async (
    resource_type: ResourceType,
    resource_id: string | undefined,
    description?: string,
    changes?: AuditChanges
  ) => {
    return log({
      action: 'CREATE',
      resource_type,
      resource_id,
      description,
      changes,
    });
  }, [log]);

  /**
   * Enregistre une modification
   */
  const logUpdate = useCallback(async (
    resource_type: ResourceType,
    resource_id: string | undefined,
    oldValues: Record<string, any> | undefined,
    newValues: Record<string, any> | undefined,
    description?: string
  ) => {
    return log({
      action: 'UPDATE',
      resource_type,
      resource_id,
      description,
      changes: {
        old_values: oldValues,
        new_values: newValues,
      },
    });
  }, [log]);

  /**
   * Enregistre une suppression
   */
  const logDelete = useCallback(async (
    resource_type: ResourceType,
    resource_id: string | undefined,
    description?: string,
    deletedData?: Record<string, any>
  ) => {
    return log({
      action: 'DELETE',
      resource_type,
      resource_id,
      description,
      changes: deletedData ? { old_values: deletedData } : undefined,
    });
  }, [log]);

  /**
   * Enregistre une validation
   */
  const logValidate = useCallback(async (
    resource_type: ResourceType,
    resource_id: string | undefined,
    description?: string
  ) => {
    return log({
      action: 'VALIDATE',
      resource_type,
      resource_id,
      description,
    });
  }, [log]);

  /**
   * Enregistre une publication
   */
  const logPublish = useCallback(async (
    resource_type: ResourceType,
    resource_id: string | undefined,
    description?: string
  ) => {
    return log({
      action: 'PUBLISH',
      resource_type,
      resource_id,
      description,
    });
  }, [log]);

  /**
   * Enregistre une connexion
   */
  const logLogin = useCallback(async (description?: string) => {
    return log({
      action: 'LOGIN',
      resource_type: 'user',
      resource_id: user?.id,
      description: description || `Connexion de ${user?.name || user?.email}`,
    });
  }, [log, user]);

  /**
   * Enregistre une déconnexion
   */
  const logLogout = useCallback(async (description?: string) => {
    return log({
      action: 'LOGOUT',
      resource_type: 'user',
      resource_id: user?.id,
      description: description || `Déconnexion de ${user?.name || user?.email}`,
    });
  }, [log, user]);

  /**
   * Enregistre un export
   */
  const logExport = useCallback(async (
    resource_type: ResourceType,
    description?: string,
    resource_id?: string
  ) => {
    return log({
      action: 'EXPORT',
      resource_type,
      resource_id,
      description,
    });
  }, [log]);

  /**
   * Enregistre une approbation
   */
  const logApprove = useCallback(async (
    resource_type: ResourceType,
    resource_id: string | undefined,
    description?: string
  ) => {
    return log({
      action: 'APPROVE',
      resource_type,
      resource_id,
      description,
    });
  }, [log]);

  /**
   * Enregistre un rejet
   */
  const logReject = useCallback(async (
    resource_type: ResourceType,
    resource_id: string | undefined,
    description?: string
  ) => {
    return log({
      action: 'REJECT',
      resource_type,
      resource_id,
      description,
    });
  }, [log]);

  return {
    log,
    logCreate,
    logUpdate,
    logDelete,
    logValidate,
    logPublish,
    logLogin,
    logLogout,
    logExport,
    logApprove,
    logReject,
  };
};

