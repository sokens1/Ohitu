import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  DBNotification,
  fetchMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '@/lib/notificationService';

// ── Types exposés ─────────────────────────────────────────────────────────────

export type { DBNotification as Notification };

/** Compatibilité : ancienne signature utilisée par Dashboard et DashboardModernSimple */
export interface LegacyNotificationPayload {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface NotificationContextType {
  notifications: DBNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
  reload: () => Promise<void>;
  /** @deprecated Utiliser notificationService directement — ce shim affiche juste un toast local */
  addNotification: (n: LegacyNotificationPayload) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<DBNotification[]>([]);
  const [loading, setLoading]             = useState(false);
  const [userId, setUserId]               = useState<string | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // ── Chargement initial ────────────────────────────────────────────────────
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMyNotifications();
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Récupérer l'userId depuis la session ─────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Charger les notifs au login ───────────────────────────────────────────
  useEffect(() => {
    if (userId) reload();
    else setNotifications([]);
  }, [userId, reload]);

  // ── Supabase Realtime : nouvelles notifications en temps réel ─────────────
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as DBNotification;
          setNotifications(prev => {
            if (prev.some(n => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });

          // ── Toast popup d'alerte immédiate ────────────────────────────────
          const toastFn =
            newNotif.severity === 'success' ? toast.success :
            newNotif.severity === 'warning' ? toast.warning :
            newNotif.severity === 'error'   ? toast.error   :
            toast.info;

          toastFn(newNotif.title, {
            description: newNotif.message,
            duration:    6000,
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as DBNotification;
          setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
        },
      )
      .on(
        'postgres_changes',
        {
          event:  'DELETE',
          schema: 'public',
          table:  'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const deleted = payload.old as { id: string };
          setNotifications(prev => prev.filter(n => n.id !== deleted.id));
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await markNotificationRead(id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await markAllNotificationsRead();
  }, []);

  const removeNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await deleteNotification(id);
  }, []);

  // Shim de compatibilité : affiche un toast local sans écrire en base
  const addNotification = useCallback((n: LegacyNotificationPayload) => {
    const fn = n.type === 'success' ? toast.success
             : n.type === 'warning' ? toast.warning
             : n.type === 'error'   ? toast.error
             : toast.info;
    fn(n.title, { description: n.message, duration: 5000 });
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsRead,
      removeNotification,
      reload,
      addNotification,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
};
