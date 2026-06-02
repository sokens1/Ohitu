import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { useNotifications } from '@/contexts/NotificationContext';
import type { DBNotification } from '@/contexts/NotificationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Bell, CheckCircle, AlertCircle, AlertTriangle, Info,
  Trash2, CheckCheck, Search, Filter, Check,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_CFG: Record<string, { icon: React.ReactNode; bg: string; border: string; dot: string }> = {
  success: {
    icon:   <CheckCircle  className="w-4 h-4 text-emerald-500 flex-shrink-0" />,
    bg:     'bg-emerald-50',
    border: 'border-emerald-200',
    dot:    'bg-emerald-500',
  },
  warning: {
    icon:   <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />,
    bg:     'bg-amber-50',
    border: 'border-amber-200',
    dot:    'bg-amber-500',
  },
  error: {
    icon:   <AlertCircle  className="w-4 h-4 text-red-500 flex-shrink-0" />,
    bg:     'bg-red-50',
    border: 'border-red-200',
    dot:    'bg-red-500',
  },
  info: {
    icon:   <Info         className="w-4 h-4 text-blue-500 flex-shrink-0" />,
    bg:     'bg-blue-50',
    border: 'border-blue-200',
    dot:    'bg-blue-500',
  },
};

const TYPE_LABELS: Record<string, string> = {
  document_uploaded:        'Document déposé',
  document_reviewed:        'Document examiné',
  pv_submitted:             'PV soumis',
  pv_validated:             'PV validé',
  pv_rejected:              'PV rejeté',
  observer_opinion:         'Avis observateur',
  opinion_reaction:         'Réaction avis',
  election_status_changed:  'Statut élection',
  results_published:        'Résultats publiés',
};

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr });
  } catch { return ''; }
}

// ── Composant ─────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'unread' | 'read';

const NotificationsPage: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, loading } = useNotifications();
  const navigate = useNavigate();

  const [tab,    setTab]    = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  const filtered = notifications.filter(n => {
    if (tab === 'unread' && n.read)  return false;
    if (tab === 'read'   && !n.read) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
    }
    return true;
  });

  const handleClick = (n: DBNotification) => {
    if (!n.read) markAsRead(n.id);
    const type = n.type ?? '';
    if (type.startsWith('pv_') || type.startsWith('observer_') || type.startsWith('opinion_') ||
        type.startsWith('document_') || type.startsWith('results_')) {
      navigate('/results');
    } else if (type.startsWith('election_')) {
      navigate('/elections');
    }
  };

  const cfg = (n: DBNotification) => SEVERITY_CFG[n.severity] ?? SEVERITY_CFG.info;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">

        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Bell className="w-6 h-6 text-[#1B2E5A]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
              <p className="text-xs text-gray-500">
                {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est lu'}
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-[#1B2E5A] border-[#1B2E5A] hover:bg-blue-50 h-8 text-xs"
              onClick={markAllAsRead}
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
              Tout marquer comme lu
            </Button>
          )}
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Onglets */}
          <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
            {([ ['all', 'Toutes'], ['unread', 'Non lues'], ['read', 'Lues'] ] as [FilterTab, string][]).map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setTab(val)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                  tab === val
                    ? 'bg-[#1B2E5A] text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {lbl}
                {val === 'unread' && unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex-shrink-0">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Recherche */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1B2E5A]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">Aucune notification</p>
            <p className="text-gray-400 text-sm mt-1">
              {tab === 'unread' ? 'Vous avez tout lu.' : tab === 'read' ? 'Aucune notification lue.' : 'Vous n\'avez pas encore reçu de notification.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(n => {
              const c = cfg(n);
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`group relative flex gap-3 p-3.5 rounded-xl border cursor-pointer transition-all hover:shadow-sm ${
                    !n.read ? `${c.bg} ${c.border}` : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Point non-lu */}
                  {!n.read && (
                    <span className={`absolute top-3.5 right-3.5 w-2 h-2 rounded-full ${c.dot}`} />
                  )}

                  {/* Icône sévérité */}
                  <div className="mt-0.5">{c.icon}</div>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold leading-tight ${!n.read ? 'text-gray-900' : 'text-gray-700'}`}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{n.message}</p>
                    {n.type && TYPE_LABELS[n.type] && (
                      <span className="inline-block mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        {TYPE_LABELS[n.type]}
                      </span>
                    )}
                  </div>

                  {/* Actions au survol */}
                  <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
                    {!n.read && (
                      <button
                        title="Marquer comme lu"
                        onClick={e => { e.stopPropagation(); markAsRead(n.id); }}
                        className="p-1 rounded hover:bg-white/70 text-gray-400 hover:text-emerald-600 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      title="Supprimer"
                      onClick={e => { e.stopPropagation(); removeNotification(n.id); }}
                      className="p-1 rounded hover:bg-white/70 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filtered.length > 0 && (
          <p className="text-center text-xs text-gray-400 pb-4">
            {filtered.length} notification{filtered.length > 1 ? 's' : ''}
            {tab !== 'all' ? ` ${tab === 'unread' ? 'non lue' : 'lue'}${filtered.length > 1 ? 's' : ''}` : ''}
          </p>
        )}
      </div>
    </Layout>
  );
};

export default NotificationsPage;
