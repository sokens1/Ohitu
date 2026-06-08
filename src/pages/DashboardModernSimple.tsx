import React, { useEffect, useState, useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { isProfessionalElection } from '@/utils/electionCalculations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  Users,
  Building,
  Vote,
  TrendingUp,
  Target,
  Activity,
  ChevronDown,
  Clock,
  FileText,
  UserPlus,
  Settings,
  CheckCircle,
  Shield,
  Map,
  Building2,
  Star,
  Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/contexts/NotificationContext';
import MetricCard from '@/components/dashboard/MetricCard';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';

interface DashboardStats {
  elections: {
    total: number;
    byStatus: { [key: string]: number };
    upcoming: number;
    completed: number;
  };
  voters: {
    total: number;
    registered: number;
    trend: number;
  };
  infrastructure: {
    centers: number;
    bureaux: number;
    provinces: number;
    communes: number;
    candidates: number;
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#06b6d4', '#14b8a6'];

// ---------------------------------------------------------------------------
// Standalone fetcher 1 – elections list
// ---------------------------------------------------------------------------
async function fetchElectionsList({
  userId,
  userRole,
  assignedElectionIds,
}: {
  userId: string;
  userRole: string;
  assignedElectionIds: string[];
}): Promise<any[]> {
  let query = supabase
    .from('elections')
    .select('id, title, status, type, election_date, is_public_visible');

  if (userRole === 'super-admin') {
    // accès total — aucun filtre
  } else if (userRole === 'admin') {
    // élections créées par lui ou qui lui sont assignées
    const adminIds =
      assignedElectionIds.length > 0
        ? [`created_by.eq.${userId}`, ...assignedElectionIds.map((id) => `id.eq.${id}`)]
        : [`created_by.eq.${userId}`];
    query = query.or(adminIds.join(','));
  } else {
    // rôles opérationnels → uniquement les élections assignées
    if (assignedElectionIds.length > 0) {
      query = query.in('id', assignedElectionIds);
    } else {
      // aucune assignation → retourner vide
      return [];
    }
  }

  const { data, error } = await query.order('election_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ---------------------------------------------------------------------------
// Standalone fetcher 2 – dashboard aggregate data
// ---------------------------------------------------------------------------
async function fetchDashboardData({
  selectedElectionIds,
  userId,
  userRole,
}: {
  selectedElectionIds: string[];
  userId: string;
  userRole: string;
}): Promise<{
  stats: DashboardStats;
  chartData: { timeline: any[]; colleges: any[]; provinces: any[]; parties: any[] };
  recentActivities: any[];
  nextElection: any;
  isPro: boolean;
}> {
  // a. Load election details
  const { data: electionsData, error: electionsError } = await supabase
    .from('elections')
    .select('id, title, status, type, election_date, nb_electeurs, created_at')
    .in('id', selectedElectionIds);

  if (electionsError) throw electionsError;

  // Stats by status
  const electionsByStatus = (electionsData || []).reduce((acc, election) => {
    const normalizedStatus = election.status?.trim() || 'À venir';
    acc[normalizedStatus] = (acc[normalizedStatus] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  const upcomingElections = (electionsData || []).filter((e) => e.status?.trim() === 'À venir').length;
  const completedElections = (electionsData || []).filter((e) => e.status?.trim() === 'Terminée').length;

  // Find nearest upcoming election among selected elections
  const upcomingSorted = (electionsData || [])
    .filter((e) => e.status?.trim() === 'À venir' && e.election_date)
    .sort((a, b) => new Date(a.election_date).getTime() - new Date(b.election_date).getTime());

  let nextElection: any = null;
  if (upcomingSorted.length > 0) {
    nextElection = upcomingSorted[0];
  } else if (electionsData && electionsData.length > 0) {
    nextElection = electionsData[0];
  }

  // b. Load centers linked to selected elections
  const { data: ecData, error: ecError } = await supabase
    .from('election_centers')
    .select('center_id')
    .in('election_id', selectedElectionIds);

  if (ecError) throw ecError;
  const centerIds = Array.from(
    new Set((ecData || []).map((r: any) => r.center_id).filter(Boolean))
  );

  let centersCount = centerIds.length;
  let bureauxCount = 0;
  let totalVoters = 0;

  if (centerIds.length > 0) {
    // c. Load bureaux
    const { data: bureauxData, error: bError } = await supabase
      .from('voting_bureaux')
      .select('registered_voters')
      .in('center_id', centerIds);

    if (bError) throw bError;
    bureauxCount = bureauxData?.length || 0;
    totalVoters = (bureauxData || []).reduce(
      (sum, bureau) => sum + (Number(bureau.registered_voters) || 0),
      0
    );
  }

  // If totalVoters is 0, fallback to sum of nb_electeurs from election headers
  if (totalVoters === 0 && electionsData) {
    totalVoters = electionsData.reduce((sum, e) => sum + (e.nb_electeurs || 0), 0);
  }

  // d. Count candidates in election_candidates
  const { count: candidatesCount } = await supabase
    .from('election_candidates')
    .select('candidate_id', { count: 'exact', head: true })
    .in('election_id', selectedElectionIds);

  // e. Count active provinces & communes
  let provincesCount = 0;
  let communesCount = 0;
  let provincesList: any[] = [];

  // Déterminer si toutes les élections sélectionnées sont professionnelles
  const isProLocal = (electionsData || []).length > 0
    && (electionsData || []).every(e => isProfessionalElection(e.type));

  if (centerIds.length > 0) {
    const { data: centersData } = await supabase
      .from('voting_centers')
      .select('province_id, commune_id, address, provinces(name)')
      .in('id', centerIds);

    const regionMap: Record<string, number> = {};

    (centersData || []).forEach((c: any) => {
      let regionName: string | null = null;

      if (isProLocal) {
        // Pro : la région vient de l'import Excel, stockée dans voting_centers.address
        // Format : "lieu_vote, région"  →  on prend la dernière partie après la virgule
        const addr = (c.address || '').trim();
        if (addr) {
          const parts = addr.split(',').map((s: string) => s.trim()).filter(Boolean);
          regionName = parts[parts.length - 1] || null;
        }
      } else {
        // Politique : via FK province_id → provinces.name
        regionName = (c.provinces as any)?.name || null;
      }

      if (regionName) {
        regionMap[regionName] = (regionMap[regionName] || 0) + 1;
      }
    });

    provincesList = Object.entries(regionMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    provincesCount = provincesList.length;

    const activeCommuneIds = Array.from(
      new Set((centersData || []).map((c: any) => c.commune_id).filter(Boolean))
    );
    communesCount = activeCommuneIds.length;
  }

  // If no centers or provinces, query directly
  if (provincesList.length === 0) {
    const { data: allProvinces } = await supabase.from('provinces').select('name');
    provincesCount = allProvinces?.length || 0;

    const { data: allCommunes } = await supabase.from('communes').select('id');
    communesCount = allCommunes?.length || 0;

    provincesList = [];
  }

  // f. Load electoral colleges
  const { data: collegesData } = await supabase
    .from('electoral_colleges')
    .select('name, total_voters, college_type, election_id')
    .in('election_id', selectedElectionIds);

  const collegesChart = (collegesData || []).reduce((acc: any[], curr: any) => {
    const name = curr.name || 'Général';
    const existing = acc.find((item) => item.name === name);
    if (existing) {
      existing.value += Number(curr.total_voters) || 0;
    } else {
      acc.push({ name, value: Number(curr.total_voters) || 0 });
    }
    return acc;
  }, []);


  // g. Load candidates and their parties for selected elections
  const { data: ecCandidates } = await supabase
    .from('election_candidates')
    .select(`
      candidates (
        id,
        name,
        party
      )
    `)
    .in('election_id', selectedElectionIds);

  const partyMap: Record<string, number> = {};
  if (ecCandidates) {
    ecCandidates.forEach((item: any) => {
      if (item.candidates) {
        const p = item.candidates.party?.trim() || 'Indépendant';
        partyMap[p] = (partyMap[p] || 0) + 1;
      }
    });
  }

  const partiesChart = Object.entries(partyMap).map(([name, value]) => ({ name, value }));

  // h. Fetch procès_verbaux for the selected elections
  const { data: pvsData } = await supabase
    .from('procès_verbaux')
    .select('election_id, total_voters, total_registered')
    .in('election_id', selectedElectionIds);

  const electionVotesMap: Record<string, { voters: number; registered: number }> = {};
  (pvsData || []).forEach((pv) => {
    if (!electionVotesMap[pv.election_id]) {
      electionVotesMap[pv.election_id] = { voters: 0, registered: 0 };
    }
    electionVotesMap[pv.election_id].voters += pv.total_voters || 0;
    electionVotesMap[pv.election_id].registered += pv.total_registered || 0;
  });

  const timelineChart = (electionsData || [])
    .map((e) => {
      const pvsStats = electionVotesMap[e.id] || { voters: 0, registered: 0 };
      const inscrits = pvsStats.registered > 0 ? pvsStats.registered : e.nb_electeurs || 0;
      return {
        name: e.title.length > 20 ? e.title.substring(0, 20) + '...' : e.title,
        inscrits,
        votants: pvsStats.voters,
      };
    })
    .reverse();

  // i. Recent activities
  const activities: any[] = [];

  // Fetch new users — uniquement pour super-admin et admin
  if (userRole === 'super-admin' || userRole === 'admin') {
    const { data: recentUsers } = await supabase
      .from('users')
      .select('name, email, role, created_at')
      .order('created_at', { ascending: false })
      .limit(3);

    if (recentUsers) {
      recentUsers.forEach((u, i) => {
        activities.push({
          id: `user_${i}_${u.created_at}`,
          type: 'user',
          action: 'Utilisateur créé',
          description: `${u.name} ajouté en tant que ${u.role}`,
          timestamp: new Date(u.created_at).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }),
          iconType: 'user',
        });
      });
    }
  }

  // Fetch recent PV modifications for selected elections
  const { data: recentPVs } = await supabase
    .from('procès_verbaux')
    .select('id, election_id, status, created_at, elections(title)')
    .in('election_id', selectedElectionIds)
    .order('created_at', { ascending: false })
    .limit(3);

  if (recentPVs) {
    recentPVs.forEach((pv: any, i) => {
      activities.push({
        id: `pv_${i}_${pv.created_at}`,
        type: 'pv',
        action: 'Saisie PV',
        description: `PV de l'élection "${pv.elections?.title || 'Élection'}" mis à jour (${pv.status})`,
        timestamp: new Date(pv.created_at).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
        iconType: 'pv',
      });
    });
  }

  return {
    stats: {
      elections: {
        total: (electionsData || []).length,
        byStatus: electionsByStatus,
        upcoming: upcomingElections,
        completed: completedElections,
      },
      voters: {
        total: totalVoters,
        registered: totalVoters,
        trend: 8.4,
      },
      infrastructure: {
        centers: centersCount || 0,
        bureaux: bureauxCount || 0,
        provinces: provincesCount || 0,
        communes: communesCount || 0,
        candidates: candidatesCount || 0,
      },
    },
    chartData: {
      timeline: timelineChart,
      colleges: collegesChart,
      provinces: provincesList,
      parties: partiesChart,
    },
    recentActivities: activities.slice(0, 5),
    nextElection,
    isPro: (electionsData || []).length > 0 && (electionsData || []).every(e => isProfessionalElection(e.type)),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const DashboardModernSimple = () => {
  const { user } = useAuth();
  const { can, isOperational, assignedElectionIds } = useRBAC();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [electionsList, setElectionsList] = useState<any[]>([]);
  const [selectedElectionIds, setSelectedElectionIds] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasNotifiedRef = useRef(false);

  // Countdown timer state
  const [nextElection, setNextElection] = useState<any>(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // -------------------------------------------------------------------------
  // Query 1 – elections list
  // -------------------------------------------------------------------------
  const { data: electionsListData } = useQuery({
    queryKey: ['dashboard-elections', user?.id, user?.role, assignedElectionIds.join(',')],
    queryFn: () =>
      fetchElectionsList({
        userId: user!.id,
        userRole: user!.role,
        assignedElectionIds,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  // Sync elections list to local state (selectedElectionIds is also user-controlled via dropdown)
  useEffect(() => {
    if (!electionsListData) return;
    setElectionsList(electionsListData);
    // Par défaut : dernière élection uniquement (triée par date DESC, donc index 0)
    if (electionsListData.length > 0) {
      setSelectedElectionIds([electionsListData[0].id]);
    } else {
      setSelectedElectionIds([]);
    }

    // Find nearest upcoming election
    const upcoming = electionsListData
      .filter((e) => e.status?.trim() === 'À venir' && e.election_date)
      .sort(
        (a, b) => new Date(a.election_date).getTime() - new Date(b.election_date).getTime()
      );

    if (upcoming.length > 0) {
      setNextElection(upcoming[0]);
    } else if (electionsListData.length > 0) {
      setNextElection(electionsListData[0]);
    } else {
      setNextElection(null);
    }
  }, [electionsListData]);

  // -------------------------------------------------------------------------
  // Query 2 – dashboard aggregate data
  // -------------------------------------------------------------------------
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dashboard-data', selectedElectionIds.join(','), user?.id],
    queryFn: () =>
      fetchDashboardData({
        selectedElectionIds,
        userId: user!.id,
        userRole: user!.role,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: selectedElectionIds.length > 0 && !!user,
    placeholderData: keepPreviousData,
  });

  // Derive state from query results
  const stats: DashboardStats = dashboardData?.stats ?? {
    elections: { total: 0, byStatus: {}, upcoming: 0, completed: 0 },
    voters: { total: 0, registered: 0, trend: 0 },
    infrastructure: { centers: 0, bureaux: 0, provinces: 0, communes: 0, candidates: 0 },
  };

  const chartData = dashboardData?.chartData ?? {
    timeline: [],
    colleges: [],
    provinces: [],
    parties: [],
  };

  const isPro = dashboardData?.isPro ?? false;

  // Map iconType strings back to JSX icons inside the component render
  const recentActivities = (dashboardData?.recentActivities ?? []).map((a) => ({
    ...a,
    icon:
      a.iconType === 'user' ? (
        <UserPlus className="w-4 h-4 text-blue-500" />
      ) : a.iconType === 'pv' ? (
        <FileText className="w-4 h-4 text-orange-500" />
      ) : a.iconType === 'system' ? (
        <Layers className="w-4 h-4 text-green-500" />
      ) : (
        <Calendar className="w-4 h-4 text-purple-500" />
      ),
  }));

  // Derive loading: show skeleton only while first-loading (no data yet)
  const loading = (dashboardLoading && !dashboardData) || (!electionsListData && !dashboardData);

  // Sync nextElection from dashboard query result
  useEffect(() => {
    if (dashboardData?.nextElection !== undefined) {
      setNextElection(dashboardData.nextElection);
    }
  }, [dashboardData]);

  // Fire notification once after first load
  useEffect(() => {
    if (!dashboardData) return;
    if (!hasNotifiedRef.current) {
      const upcomingCount = dashboardData.stats.elections.upcoming;
      if (upcomingCount > 0) {
        addNotification({
          title: 'Élection active à venir',
          message: `${upcomingCount} scrutin(s) planifié(s) dans le calendrier.`,
          type: 'info',
        });
      }
      hasNotifiedRef.current = true;
    }
  }, [dashboardData]);

  // 2. Click outside logic for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 3. Countdown timer ticker
  useEffect(() => {
    if (!nextElection || !nextElection.election_date) return;

    const updateCountdown = () => {
      const now = new Date();
      const electionDate = new Date(nextElection.election_date);
      const diff = electionDate.getTime() - now.getTime();

      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setCountdown({ days, hours, minutes, seconds });
      } else {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [nextElection]);

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6 pb-8">
          {/* En-tête */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-12 w-full sm:w-80 rounded-2xl" />
          </div>
          {/* Cartes de stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-2xl border bg-white p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-8 w-8 rounded-xl" />
                </div>
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
          {/* Graphiques */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border bg-white p-6 space-y-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
            <div className="rounded-2xl border bg-white p-6 space-y-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          </div>
          {/* Liste élections */}
          <div className="rounded-2xl border bg-white p-6 space-y-3">
            <Skeleton className="h-5 w-36 mb-4" />
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl border">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  // Calculate some average indicators
  const avgBureauxPerCenter = stats.infrastructure.centers > 0
    ? (stats.infrastructure.bureaux / stats.infrastructure.centers).toFixed(1)
    : '0';

  const avgVotersPerBureau = stats.infrastructure.bureaux > 0
    ? Math.round(stats.voters.total / stats.infrastructure.bureaux)
    : 0;

  // Custom Tooltip component for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-950 border border-slate-800/80 p-3.5 rounded-2xl shadow-2xl text-white backdrop-blur-md">
          <p className="text-xs font-black text-slate-400 mb-1.5 tracking-wider uppercase">{label}</p>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-4 justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs text-slate-300 font-medium">{entry.name}:</span>
                </div>
                <span className="text-xs font-black text-white">{(entry.value || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8 animate-fade-in pb-8 relative">
        {/* Decorative subtle background glows */}
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-slow" style={{ animationDelay: '3s' }}></div>

        {/* HEADER SECTION: Title & Custom Dropdown Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 relative z-30">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Activity className="w-8 h-8 text-indigo-600 animate-pulse-slow" />
              <span>Tableau de bord</span>
            </h1>
            {isOperational && (
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Vous consultez les données de vos élections assignées uniquement.
              </p>
            )}
          </div>

          {/* Dropdown multi-élections : uniquement pour super-admin et admin */}
          {!isOperational && (
            <div className="relative z-40" ref={dropdownRef}>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full sm:w-[320px] px-5 py-3.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-2xl shadow-sm text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
              >
                <span className="truncate flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  {selectedElectionIds.length === 0
                    ? "Aucune élection"
                    : selectedElectionIds.length === electionsList.length && electionsList.length > 1
                      ? "Toutes les élections"
                      : selectedElectionIds.length === 1
                        ? (electionsList.find(e => e.id === selectedElectionIds[0])?.title || "1 élection")
                        : `${selectedElectionIds.length} élections sélectionnées`}
                </span>
                <ChevronDown className="w-4 h-4 ml-2 text-slate-400 transition-transform duration-300" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
              </button>

              {isOpen && (
                <div className="absolute right-0 mt-2 w-full sm:w-[340px] rounded-2xl shadow-xl bg-white border border-slate-200/85 text-slate-800 z-50 max-h-80 overflow-y-auto p-2.5 scrollbar-thin animate-scale-in">
                  <div className="p-1 space-y-1.5">
                    <label className="flex items-center space-x-3 p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5 border-slate-300 bg-white"
                        checked={selectedElectionIds.length === electionsList.length && electionsList.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedElectionIds(electionsList.map(el => el.id));
                          } else {
                            setSelectedElectionIds([]);
                          }
                        }}
                      />
                      <span className="text-sm font-bold text-slate-700">Toutes les élections</span>
                    </label>
                    <div className="border-t border-slate-100 my-1.5"></div>
                    {electionsList.map((election) => (
                      <label key={election.id} className="flex items-center space-x-3 p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5 border-slate-300 bg-white"
                          checked={selectedElectionIds.includes(election.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedElectionIds([...selectedElectionIds, election.id]);
                            } else {
                              setSelectedElectionIds(selectedElectionIds.filter(id => id !== election.id));
                            }
                          }}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-700 truncate max-w-[250px]">{election.title}</span>
                          <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${election.is_public_visible === false ? 'bg-violet-400' : election.status === 'Terminée' ? 'bg-emerald-500' : 'bg-indigo-400'}`}></span>
                            {election.type} • {election.is_public_visible === false ? 'Masqué au public' : election.status}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pour les rôles opérationnels : affichage fixe du nom de l'élection */}
          {isOperational && electionsList.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm text-sm">
              <Layers className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span className="font-bold text-slate-700 truncate max-w-[260px]">
                {electionsList.length === 1
                  ? electionsList[0].title
                  : `${electionsList.length} élections assignées`}
              </span>
            </div>
          )}
        </div>

        {/* TABS */}
        <Tabs defaultValue="overview" className="w-full space-y-6">
          <div className="flex border-b border-slate-100 pb-2 overflow-x-auto scrollbar-none justify-center sm:justify-start">
            <TabsList className="bg-slate-100/80 backdrop-blur p-1 rounded-2xl flex gap-1 border border-slate-200/30 w-full sm:w-auto h-auto">
              <TabsTrigger value="overview" className="flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md transition-all duration-300 flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900">
                <Activity className="w-4 h-4 text-indigo-500" />
                <span>Vue d'ensemble</span>
              </TabsTrigger>
              <TabsTrigger value="politics" className="flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:text-violet-600 data-[state=active]:shadow-md transition-all duration-300 flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900">
                <Target className="w-4 h-4 text-violet-500" />
                <span>{isPro ? 'Syndicats' : 'Partis & Syndicats'}</span>
              </TabsTrigger>
              <TabsTrigger value="geo" className="flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-md transition-all duration-300 flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900">
                <Map className="w-4 h-4 text-emerald-500" />
                <span>Géographie</span>
              </TabsTrigger>
              <TabsTrigger value="live" className="flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-md transition-all duration-300 flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Suivi</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: VUE D'ENSEMBLE */}
          <TabsContent value="overview" className="space-y-6 focus:outline-none animate-fade-in">
            {/* METRICS ROW (4 Cards) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Card 1 */}
              <div className="relative group overflow-hidden bg-white rounded-3xl border border-slate-100 p-5 sm:p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider">
                      {isPro ? 'Salariés Inscrits' : 'Électeurs Inscrits'}
                    </p>
                    <p className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                      {stats.voters.total.toLocaleString()}
                    </p>
                    {avgVotersPerBureau > 0 ? (
                      <p className="text-[11px] font-semibold text-slate-500">Moyenne: {avgVotersPerBureau} / bureau</p>
                    ) : (
                      <p className="text-[11px] font-semibold text-slate-400">Aucun bureau</p>
                    )}
                  </div>
                  <div className="p-3.5 rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-inner">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="relative group overflow-hidden bg-white rounded-3xl border border-slate-100 p-5 sm:p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider">
                      {isPro ? 'Établissements' : 'Centres de Vote'}
                    </p>
                    <p className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                      {stats.infrastructure.centers.toLocaleString()}
                    </p>
                    {isPro ? (
                      <p className="text-[11px] font-semibold text-emerald-600">{stats.infrastructure.centers} établissement{stats.infrastructure.centers > 1 ? 's' : ''}</p>
                    ) : (
                      <p className="text-[11px] font-semibold text-emerald-600">{stats.infrastructure.provinces} province{stats.infrastructure.provinces > 1 ? 's' : ''} active{stats.infrastructure.provinces > 1 ? 's' : ''}</p>
                    )}
                  </div>
                  <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shadow-inner">
                    <Building className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Card 3 */}
              <div className="relative group overflow-hidden bg-white rounded-3xl border border-slate-100 p-5 sm:p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 to-violet-500"></div>
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider">
                      {isPro ? 'Collèges / Bureaux' : 'Bureaux de Vote'}
                    </p>
                    <p className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                      {stats.infrastructure.bureaux.toLocaleString()}
                    </p>
                    <p className="text-[11px] font-semibold text-purple-600">
                      Ratio: {avgBureauxPerCenter} / {isPro ? 'établissement' : 'centre'}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-purple-50 text-purple-600 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300 shadow-inner">
                    <Vote className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Card 4 */}
              <div className="relative group overflow-hidden bg-white rounded-3xl border border-slate-100 p-5 sm:p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-pink-500 to-rose-500"></div>
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider">
                      {isPro ? 'Listes Syndicales' : 'Candidatures'}
                    </p>
                    <p className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                      {stats.infrastructure.candidates.toLocaleString()}
                    </p>
                    <p className="text-[11px] font-semibold text-pink-600">
                      {chartData.parties.length} {isPro ? 'syndicat' : 'parti'}{chartData.parties.length > 1 ? 's' : ''} représenté{chartData.parties.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-pink-50 text-pink-600 group-hover:scale-110 group-hover:bg-pink-600 group-hover:text-white transition-all duration-300 shadow-inner">
                    <Target className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </div>

            {/* CHARTS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Area Chart: Participation & Registrations */}
              <Card className="lg:col-span-2 border border-slate-100 rounded-3xl shadow-md overflow-hidden bg-white hover:shadow-xl transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-50">
                  <div>
                    <CardTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-500" />
                      Progression & Participation
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Comparaison des inscrits et des suffrages exprimés par élection
                    </CardDescription>
                  </div>
                  <Badge className="bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100/50 px-2.5 py-1 rounded-full text-xs font-semibold">Consolidé</Badge>
                </CardHeader>
                <CardContent className="h-[320px] pt-6 pb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorInscrits" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorVotants" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 600}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 600}} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, fontWeight: 600, color: '#475569' }} />
                      <Area name={isPro ? 'Salariés Inscrits' : 'Électeurs Inscrits'} type="monotone" dataKey="inscrits" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorInscrits)" />
                      <Area name={isPro ? 'Votes Exprimés' : 'Suffrages Exprimés'} type="monotone" dataKey="votants" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorVotants)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Donut Chart: Electoral Colleges */}
              <Card className="border border-slate-100 rounded-3xl shadow-md overflow-hidden bg-white hover:shadow-xl transition-all duration-300">
                <CardHeader className="border-b border-slate-50 pb-4">
                  <CardTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-purple-500" />
                    {isPro ? 'Collèges Professionnels' : 'Collèges Électoraux'}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    {isPro ? 'Répartition des salariés par collège professionnel' : 'Répartition des électeurs par catégorie'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[270px] flex flex-col justify-center pb-2 pt-6">
                  <div className="relative w-full h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData.colleges.length > 0 ? chartData.colleges : [{ name: 'Général', value: stats.voters.total }]}
                          cx="50%"
                          cy="50%"
                          innerRadius={58}
                          outerRadius={78}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {(chartData.colleges.length > 0 ? chartData.colleges : [{ name: 'Général', value: stats.voters.total }]).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="focus:outline-none transition-all duration-300" />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => `${value.toLocaleString()} électeurs`}
                          contentStyle={{
                            borderRadius: '16px',
                            border: 'none',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                            backgroundColor: '#0f172a',
                            color: '#fff'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Total</span>
                      <span className="text-2xl font-black text-slate-800 leading-none">{stats.voters.total.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 px-2 max-h-[70px] overflow-y-auto scrollbar-thin">
                    {(chartData.colleges.length > 0 ? chartData.colleges : [{ name: 'Général', value: stats.voters.total }]).map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-left truncate">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                        <span className="text-[11px] font-bold text-slate-700 truncate">{item.name}</span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          ({Math.round((item.value / (stats.voters.total || 1)) * 100)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: PARTIS & SYNDICATS */}
          <TabsContent value="politics" className="space-y-6 focus:outline-none animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border border-slate-100 rounded-3xl shadow-md overflow-hidden bg-white hover:shadow-xl transition-all duration-300">
                <CardHeader className="border-b border-slate-50 pb-4">
                  <CardTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Target className="w-5 h-5 text-violet-500" />
                    {isPro ? 'Représentation Syndicale' : 'Représentation Politique & Syndicale'}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    {isPro
                      ? 'Nombre de listes déposées par organisation syndicale'
                      : 'Nombre de candidats représentés par étiquette politique'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[320px] pt-6 pb-4">
                  {chartData.parties.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.parties} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                        <defs>
                          {COLORS.map((color, index) => (
                            <linearGradient key={index} id={`barGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                              <stop offset="100%" stopColor={color} stopOpacity={0.4} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}} angle={-15} textAnchor="end" height={50} axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={32}>
                          {chartData.parties.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={`url(#barGradient-${index})`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                      <Target className="w-8 h-8 opacity-30" />
                      <p className="text-sm font-medium">Aucune donnée {isPro ? 'syndicale' : 'politique'} disponible.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-slate-100 rounded-3xl shadow-md overflow-hidden bg-white hover:shadow-xl transition-all duration-300">
                <CardHeader className="border-b border-slate-50 pb-4">
                  <CardTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Star className="w-5 h-5 text-violet-500 fill-violet-100" />
                    {isPro ? 'Force Syndicale' : 'Force Partisane'}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    {isPro ? 'Répartition des listes syndicales' : 'Répartition des candidatures par parti'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  <div className="p-4 bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl border border-violet-100/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-violet-800 uppercase tracking-wider">
                        Total {isPro ? 'syndicats' : 'organisations'}
                      </span>
                      <Badge className="bg-violet-600 text-white font-bold text-xs px-2.5 py-0.5 rounded-full">{chartData.parties.length}</Badge>
                    </div>
                  </div>
                  <div className="border border-slate-100 rounded-2xl p-4 space-y-3 bg-white shadow-inner">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">Répartition détaillée</span>
                    {chartData.parties.length > 0 ? (
                      <div className="space-y-2.5 max-h-[180px] overflow-y-auto scrollbar-thin pr-1">
                        {chartData.parties.slice(0, 8).map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                              <span className="text-xs font-bold text-slate-700 truncate">{p.name}</span>
                            </div>
                            <span className="text-xs font-extrabold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md flex-shrink-0">
                              {p.value} {isPro ? 'liste(s)' : 'candidat(s)'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-4">Aucune donnée</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 3: GÉOGRAPHIE */}
          <TabsContent value="geo" className="space-y-6 focus:outline-none animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border border-slate-100 rounded-3xl shadow-md overflow-hidden bg-white hover:shadow-xl transition-all duration-300">
                <CardHeader className="border-b border-slate-50 pb-4">
                  <CardTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Map className="w-5 h-5 text-emerald-500" />
                    Distribution Territoriale
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    {isPro ? 'Nombre d\'établissements par région / localisation' : 'Centres de vote actifs par province'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[320px] pt-6 pb-4">
                  {chartData.provinces.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.provinces} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                        <defs>
                          {COLORS.map((color, index) => (
                            <linearGradient key={index} id={`barGeoGradient-${index}`} x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                              <stop offset="100%" stopColor={color} stopOpacity={0.9} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" horizontal={false} vertical={true} stroke="#f1f5f9" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 600, fill: '#64748b'}} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#475569'}} width={110} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={16}>
                          {chartData.provinces.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={`url(#barGeoGradient-${index})`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                      <Map className="w-8 h-8 opacity-30" />
                      <p className="text-sm font-medium">Aucune donnée géographique disponible.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-slate-100 rounded-3xl shadow-md overflow-hidden bg-white hover:shadow-xl transition-all duration-300">
                <CardHeader className="border-b border-slate-50 pb-4">
                  <CardTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-emerald-500" />
                    {isPro ? 'Densité des Établissements' : 'Densité Électorale'}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">Indicateurs de répartition territoriale</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        Moy. {isPro ? 'salariés' : 'électeurs'}
                      </span>
                      <p className="text-xl font-black text-slate-800">{avgVotersPerBureau.toLocaleString()}</p>
                    </div>
                    <span className="text-xs text-slate-500 font-semibold bg-white border border-slate-100 px-2.5 py-1 rounded-xl">Par bureau</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        Moy. {isPro ? 'collèges' : 'bureaux'}
                      </span>
                      <p className="text-xl font-black text-slate-800">{avgBureauxPerCenter}</p>
                    </div>
                    <span className="text-xs text-slate-500 font-semibold bg-white border border-slate-100 px-2.5 py-1 rounded-xl">
                      Par {isPro ? 'établissement' : 'centre'}
                    </span>
                  </div>
                  {chartData.provinces.length > 0 && (
                    <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100">
                      <span className="text-xs font-black text-emerald-800 uppercase tracking-wider block mb-1">
                        {isPro ? 'Région la plus représentée' : 'Concentration électorale'}
                      </span>
                      <p className="text-xs text-emerald-900 font-medium">
                        {isPro ? "L'établissement" : "La province"} « {chartData.provinces[0]?.name} » regroupe
                        la plus grande concentration de {isPro ? 'salariés inscrits' : 'centres de vote'}.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 4: SUIVI & ACTIVITÉS */}
          <TabsContent value="live" className="space-y-6 focus:outline-none animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="border border-slate-900 rounded-3xl shadow-xl overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
                <CardHeader className="pb-2 border-b border-white/5">
                  <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-white">
                    <Clock className="w-5 h-5 text-yellow-400 animate-pulse-slow" />
                    Prochaine Échéance
                  </CardTitle>
                  <CardDescription className="text-indigo-200/60 text-xs">
                    {isPro ? "Temps restant avant le début du vote" : "Temps restant avant l'ouverture du scrutin"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col justify-between h-[220px] pb-4 pt-5">
                  {nextElection ? (
                    <div className="space-y-4">
                      <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                        <p className="text-xs text-indigo-100 font-bold truncate">{nextElection.title}</p>
                        <p className="text-[10px] text-yellow-300 mt-1 font-bold tracking-wide uppercase">
                          Programmé le {new Date(nextElection.election_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center justify-center space-x-2 text-white">
                        {[{ val: countdown.days, label: 'Jours' }, { val: countdown.hours, label: 'Heures' }, { val: countdown.minutes, label: 'Min.' }, { val: countdown.seconds, label: 'Sec.' }].map((item, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <div className="text-lg font-black text-indigo-400 animate-pulse">:</div>}
                            <div className="text-center">
                              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 min-w-[52px] border border-white/10">
                                <div className="text-xl font-black tracking-tight">{item.val.toString().padStart(2, '0')}</div>
                                <div className="text-[8px] uppercase tracking-widest text-indigo-300 font-bold">{item.label}</div>
                              </div>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Shield className="w-10 h-10 text-indigo-300 mb-2 opacity-60" />
                      <p className="text-xs text-indigo-200 font-bold">Aucun scrutin futur programmé</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-slate-100 rounded-3xl shadow-md overflow-hidden bg-white hover:shadow-xl transition-all duration-300">
                <CardHeader className="border-b border-slate-50 pb-4">
                  <CardTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-indigo-500" />
                    Statut des Scrutins
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    {isPro ? 'Évolution des élections professionnelles' : 'Progression globale des processus électoraux'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                      <span>{isPro ? 'Scrutins terminés' : 'Élections terminées'}</span>
                      <span className="text-slate-800">{stats.elections.completed} / {stats.elections.total}</span>
                    </div>
                    <Progress value={stats.elections.total > 0 ? (stats.elections.completed / stats.elections.total) * 100 : 0} className="h-2.5 bg-slate-50 [&>div]:bg-emerald-500 rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                      <span>{isPro ? 'Scrutins à venir' : 'Élections planifiées'}</span>
                      <span className="text-slate-800">{stats.elections.upcoming} / {stats.elections.total}</span>
                    </div>
                    <Progress value={stats.elections.total > 0 ? (stats.elections.upcoming / stats.elections.total) * 100 : 0} className="h-2.5 bg-slate-50 [&>div]:bg-indigo-500 rounded-full" />
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-500 font-bold">Taux d'achèvement global</span>
                    <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                      {stats.elections.total > 0 ? Math.round((stats.elections.completed / stats.elections.total) * 100) : 0}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-100 rounded-3xl shadow-md overflow-hidden bg-white hover:shadow-xl transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-50">
                  <div>
                    <CardTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-amber-500" />
                      Journal d'Activité
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">Dernières actions enregistrées</CardDescription>
                  </div>
                  <Badge className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 font-bold px-2 py-0.5 rounded-full animate-pulse-slow">Live</Badge>
                </CardHeader>
                <CardContent className="p-0 pt-3">
                  <div className="max-h-[220px] overflow-y-auto px-4 pb-4 scrollbar-thin">
                    {recentActivities.length > 0 ? (
                      <div className="space-y-2">
                        {recentActivities.map((act) => (
                          <div key={act.id} className="flex items-start space-x-3 p-3 hover:bg-slate-50/80 rounded-2xl transition-all group border border-transparent hover:border-slate-100">
                            <div className="flex-shrink-0 mt-0.5 p-2 bg-slate-50 rounded-xl group-hover:bg-white group-hover:scale-105 transition-all border border-slate-100">
                              {act.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{act.action}</p>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">{act.description}</p>
                            </div>
                            <div className="flex-shrink-0 text-[10px] text-slate-400 font-semibold">{act.timestamp}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                        <Activity className="w-7 h-7 opacity-30" />
                        <p className="text-xs font-medium">Aucune activité récente</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* WORKFLOW QUICK ACTIONS PANEL — commenté temporairement */}
        {/* <Card className="border border-slate-100 rounded-3xl shadow-md overflow-hidden bg-white hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-3 border-b border-slate-50">
            <CardTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500 fill-amber-100" />
              Actions Rapides
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Accédez directement aux interfaces disponibles pour votre profil
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6 pt-6">
            {can('view:voters') && (
              <Button onClick={() => navigate('/voters')} className="h-22 flex flex-col items-center justify-center space-y-2 bg-blue-50/30 hover:bg-blue-50 border border-blue-100/50 hover:border-blue-200 rounded-2xl transition-all duration-300 hover:scale-[1.02] shadow-sm hover:shadow" variant="outline">
                <UserPlus className="w-6 h-6 text-blue-600" />
                <span className="text-xs font-bold text-blue-800">Gestion Électeurs</span>
              </Button>
            )}
            {can('elections:manage') && (
              <Button onClick={() => navigate('/elections')} className="h-22 flex flex-col items-center justify-center space-y-2 bg-emerald-50/30 hover:bg-emerald-50 border border-emerald-100/50 hover:border-emerald-200 rounded-2xl transition-all duration-300 hover:scale-[1.02] shadow-sm hover:shadow" variant="outline">
                <Plus className="w-6 h-6 text-emerald-700" />
                <span className="text-xs font-bold text-emerald-800">Nouvelle Élection</span>
              </Button>
            )}
            {can('view:results') && (
              <Button onClick={() => navigate('/results')} className="h-22 flex flex-col items-center justify-center space-y-2 bg-amber-50/30 hover:bg-amber-50 border border-amber-100/50 hover:border-amber-200 rounded-2xl transition-all duration-300 hover:scale-[1.02] shadow-sm hover:shadow" variant="outline">
                <FileText className="w-6 h-6 text-amber-600" />
                <span className="text-xs font-bold text-amber-800">
                  {can('results:submit') ? 'Saisie PV' : can('results:validate') ? 'Validation PV' : 'Résultats'}
                </span>
              </Button>
            )}
            {can('view:users') && (
              <Button onClick={() => navigate('/users')} className="h-22 flex flex-col items-center justify-center space-y-2 bg-purple-50/30 hover:bg-purple-50 border border-purple-100/50 hover:border-purple-200 rounded-2xl transition-all duration-300 hover:scale-[1.02] shadow-sm hover:shadow" variant="outline">
                <Settings className="w-6 h-6 text-purple-600" />
                <span className="text-xs font-bold text-purple-800">Gestion Utilisateurs</span>
              </Button>
            )}
            {!can('elections:manage') && can('view:elections') && (
              <Button onClick={() => navigate('/elections')} className="h-22 flex flex-col items-center justify-center space-y-2 bg-slate-50/30 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-2xl transition-all duration-300 hover:scale-[1.02] shadow-sm hover:shadow" variant="outline">
                <Calendar className="w-6 h-6 text-slate-500" />
                <span className="text-xs font-bold text-slate-600">Mes Élections</span>
              </Button>
            )}
          </CardContent>
        </Card> */}

      </div>
    </Layout>
  );
};

export default DashboardModernSimple;
