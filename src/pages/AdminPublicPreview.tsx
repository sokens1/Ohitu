import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, ExternalLink, ChevronDown, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useRBAC } from '@/hooks/useRBAC';
import ElectionResults from './ElectionResults';

interface ElectionOption {
  id: string;
  title: string;
  status: string;
  is_published: boolean;
  is_public_visible: boolean | null;
}

const AdminPublicPreview: React.FC = () => {
  const navigate = useNavigate();
  const { isGlobalAdmin, assignedElectionIds } = useRBAC();
  const [elections, setElections] = useState<ElectionOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      let query = supabase
        .from('elections')
        .select('id, title, status, is_published, is_public_visible')
        .order('created_at', { ascending: false });

      // Rôle restreint → limiter aux élections assignées
      if (!isGlobalAdmin && assignedElectionIds.length > 0) {
        query = assignedElectionIds.length === 1
          ? (query as any).eq('id', assignedElectionIds[0])
          : (query as any).in('id', assignedElectionIds);
      } else if (!isGlobalAdmin && assignedElectionIds.length === 0) {
        setElections([]);
        setLoading(false);
        return;
      }

      const { data } = await query;
      setElections(data || []);
      if (data && data.length > 0) setSelectedId(data[0].id);
      setLoading(false);
    };

    fetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGlobalAdmin, assignedElectionIds.join(',')]);

  const selected = elections.find(e => e.id === selectedId);
  const isVisible = selected?.is_published && selected?.is_public_visible !== false;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Barre admin fixe */}
      <div className="sticky top-0 z-50 bg-amber-50 border-b-2 border-amber-400 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-medium transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour
          </button>

          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm shrink-0">
            <Eye className="w-4 h-4" />
            Prévisualisation publique
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              disabled={loading}
              className="w-full appearance-none bg-white border border-amber-300 rounded-lg px-3 py-1.5 pr-8 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
            >
              {elections.map(e => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {selected && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isVisible
                ? 'bg-green-50 text-green-700 border-green-300'
                : 'bg-red-50 text-red-700 border-red-300'
            }`}>
              {isVisible
                ? <><Eye className="w-3 h-3" /> Visible au public</>
                : <><EyeOff className="w-3 h-3" /> Masqué au public</>
              }
            </div>
          )}

          {selectedId && (
            <a
              href={`/election/${selectedId}/results`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-medium transition-colors shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
              Ouvrir en public
            </a>
          )}

          <span className="text-xs text-amber-600 ml-auto shrink-0">
            Mode admin — les règles de visibilité sont ignorées
          </span>
        </div>
      </div>

      {/* Contenu : page publique */}
      {selectedId && !loading ? (
        <ElectionResults
          key={selectedId}
          isAdminPreview={true}
          electionIdOverride={selectedId}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          {loading ? 'Chargement des élections…' : 'Sélectionnez une élection'}
        </div>
      )}
    </div>
  );
};

export default AdminPublicPreview;
