/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Building2, BookOpen, X } from 'lucide-react';

// ─── Types exportés ──────────────────────────────────────────────────────────
export interface ResultsFilters {
  search: string;
  centerId: string;   // '' = tous
  collegeType: string; // '' = tous
}

export const EMPTY_FILTERS: ResultsFilters = { search: '', centerId: '', collegeType: '' };

interface Props {
  selectedElection: string;
  filters: ResultsFilters;
  onChange: (f: ResultsFilters) => void;
}

const COLLEGE_LABELS: Record<string, string> = {
  cadres: 'Cadres', employes: 'Maîtrise', ouvriers: 'Exécution', general: 'Encadrement',
};

// ─── Composant ───────────────────────────────────────────────────────────────
const ResultsFilterBar: React.FC<Props> = ({ selectedElection, filters, onChange }) => {
  const [centers, setCenters]   = useState<{ id: string; name: string }[]>([]);
  const [colleges, setColleges] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (!selectedElection) { setCenters([]); setColleges([]); return; }
    const load = async () => {
      // Centres liés à l'élection
      const { data: ecRows } = await supabase
        .from('election_centers')
        .select('center_id')
        .eq('election_id', selectedElection);
      const ids = Array.from(new Set((ecRows ?? []).map((r: any) => r.center_id).filter(Boolean)));
      if (ids.length) {
        const { data: vc } = await supabase
          .from('voting_centers')
          .select('id, name')
          .in('id', ids)
          .order('name');
        setCenters(vc ?? []);
      } else {
        setCenters([]);
      }

      // Collèges — priorité electoral_colleges, fallback voting_bureaux (élections pro)
      const { data: coll } = await supabase
        .from('electoral_colleges')
        .select('college_type')
        .eq('election_id', selectedElection);

      let distinct: string[] = Array.from(
        new Set((coll ?? []).map((c: any) => c.college_type).filter(Boolean))
      );

      if (distinct.length === 0 && ids.length > 0) {
        // Fallback : lire les types de collège depuis voting_bureaux pseudo-entrées
        const { data: bureaux } = await supabase
          .from('voting_bureaux')
          .select('college, college_type')
          .in('center_id', ids);
        distinct = Array.from(new Set(
          (bureaux ?? [])
            .map((b: any) => String(b.college_type || b.college || ''))
            .filter((v: string) => v && v !== '' && v !== 'general')
        ));
      }

      setColleges(distinct.map((v: string) => ({ value: v, label: COLLEGE_LABELS[v] ?? v })));
    };
    load();
  }, [selectedElection]);

  const set = (patch: Partial<ResultsFilters>) => onChange({ ...filters, ...patch });
  const hasActive = filters.search || filters.centerId || filters.collegeType;

  const activeCenterName  = centers.find(c => c.id === filters.centerId)?.name;
  const activeCollegeName = colleges.find(c => c.value === filters.collegeType)?.label;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-4 py-3 space-y-3">
      {/* Ligne principale */}
      <div className="flex flex-wrap gap-2 items-center">

        {/* Recherche — largeur limitée */}
        <div className="relative w-52 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Rechercher…"
            value={filters.search}
            onChange={e => set({ search: e.target.value })}
            className="pl-9 pr-8 h-9 text-sm bg-gray-50 border-gray-200 rounded-xl focus:bg-white focus:border-blue-400 transition-colors"
          />
          {filters.search && (
            <button
              onClick={() => set({ search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Établissement */}
        {centers.length > 0 && (
          <Select
            value={filters.centerId || '_all'}
            onValueChange={v => set({ centerId: v === '_all' ? '' : v, collegeType: '' })}
          >
            <SelectTrigger className="h-9 text-sm w-52 bg-gray-50 border-gray-200 rounded-xl text-gray-700 focus:border-blue-400">
              <Building2 className="w-3.5 h-3.5 text-gray-400 mr-1.5 flex-shrink-0" />
              <SelectValue>{filters.centerId ? activeCenterName : 'Tous les établissements'}</SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-lg">
              <SelectItem value="_all" className="text-sm">Tous les établissements</SelectItem>
              {centers.map(c => (
                <SelectItem key={c.id} value={c.id} className="text-sm">{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Collège */}
        {colleges.length > 0 && (
          <Select
            value={filters.collegeType || '_all'}
            onValueChange={v => set({ collegeType: v === '_all' ? '' : v })}
          >
            <SelectTrigger className="h-9 text-sm w-44 bg-gray-50 border-gray-200 rounded-xl text-gray-700 focus:border-blue-400">
              <BookOpen className="w-3.5 h-3.5 text-gray-400 mr-1.5 flex-shrink-0" />
              <SelectValue>{filters.collegeType ? activeCollegeName : 'Tous les collèges'}</SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-lg">
              <SelectItem value="_all" className="text-sm">Tous les collèges</SelectItem>
              {colleges.map(c => (
                <SelectItem key={c.value} value={c.value} className="text-sm">{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Effacer tout */}
        {hasActive && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
          >
            <X className="w-3 h-3" /> Effacer
          </button>
        )}
      </div>

      {/* Chips filtres actifs */}
      {hasActive && (
        <div className="flex flex-wrap gap-1.5">
          {filters.search && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <Search className="w-2.5 h-2.5" /> "{filters.search}"
              <button onClick={() => set({ search: '' })} className="ml-0.5 hover:text-blue-900"><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          {filters.centerId && activeCenterName && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
              <Building2 className="w-2.5 h-2.5" /> {activeCenterName}
              <button onClick={() => set({ centerId: '', collegeType: '' })} className="ml-0.5 hover:text-violet-900"><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          {filters.collegeType && activeCollegeName && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
              <BookOpen className="w-2.5 h-2.5" /> {activeCollegeName}
              <button onClick={() => set({ collegeType: '' })} className="ml-0.5 hover:text-teal-900"><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default ResultsFilterBar;
