import React, { useEffect, useState, useRef } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Users, 
  Building,
  Vote,
  TrendingUp,
  Target,
  Activity,
  Zap,
  Star,
  Shield,
  CheckCircle,
  ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/contexts/NotificationContext';
import MetricCard from '@/components/dashboard/MetricCard';
import { useAuth } from '@/contexts/AuthContext';

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

const DashboardModernSimple = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [electionsList, setElectionsList] = useState<any[]>([]);
  const [selectedElectionIds, setSelectedElectionIds] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [stats, setStats] = useState<DashboardStats>({
    elections: { total: 0, byStatus: {}, upcoming: 0, completed: 0 },
    voters: { total: 0, registered: 0, trend: 0 },
    infrastructure: { centers: 0, bureaux: 0, provinces: 0, communes: 0, candidates: 0 },
  });

  // 1. Charger la liste des élections au montage
  useEffect(() => {
    const fetchElections = async () => {
      try {
        let query = supabase
          .from('elections')
          .select('id, title, status');

        if (user && user.role !== 'super-admin' && user.role !== 'observateur' && user.role !== 'validateur') {
          const conditions = [];
          conditions.push(`created_by.eq.${user.id}`);
          if (user.assigned_election_id) {
            conditions.push(`id.eq.${user.assigned_election_id}`);
          }
          if ((user.role === 'agent-saisie' || user.role === 'president-bureau') && user.created_by) {
            conditions.push(`created_by.eq.${user.created_by}`);
          }
          query = query.or(conditions.join(','));
        }

        const { data, error } = await query.order('election_date', { ascending: false });
        if (error) throw error;
        setElectionsList(data || []);
        // Sélectionner toutes les élections par défaut
        setSelectedElectionIds((data || []).map(e => e.id));
      } catch (error) {
        console.error('Erreur lors du chargement des élections:', error);
      }
    };
    fetchElections();
  }, [user]);

  // 2. Click outside pour fermer le dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 3. Charger les données du tableau de bord selon les élections sélectionnées
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (selectedElectionIds.length === 0) {
        setStats({
          elections: { total: 0, byStatus: {}, upcoming: 0, completed: 0 },
          voters: { total: 0, registered: 0, trend: 0 },
          infrastructure: { centers: 0, bureaux: 0, provinces: 0, communes: 0, candidates: 0 },
        });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // a. Charger les détails des élections sélectionnées
        const { data: electionsData, error: electionsError } = await supabase
          .from('elections')
          .select('id, status, election_date, created_at')
          .in('id', selectedElectionIds);

        if (electionsError) {
          console.error('Erreur lors du chargement des élections:', electionsError);
          throw electionsError;
        }

        // Normaliser les statuts et compter par statut
        const electionsByStatus = (electionsData || []).reduce((acc, election) => {
          const normalizedStatus = election.status?.trim() || 'À venir';
          acc[normalizedStatus] = (acc[normalizedStatus] || 0) + 1;
          return acc;
        }, {} as { [key: string]: number });

        const upcomingElections = (electionsData || []).filter(e => e.status?.trim() === 'À venir').length;
        const completedElections = (electionsData || []).filter(e => e.status?.trim() === 'Terminée').length;

        // b. Charger les centres liés aux élections sélectionnées via election_centers
        const { data: ecData, error: ecError } = await supabase
          .from('election_centers')
          .select('center_id')
          .in('election_id', selectedElectionIds);

        if (ecError) throw ecError;
        const centerIds = Array.from(new Set((ecData || []).map((r: any) => r.center_id).filter(Boolean)));

        let centersCount = centerIds.length;
        let bureauxCount = 0;
        let totalVoters = 0;

        if (centerIds.length > 0) {
          // c. Charger les bureaux associés à ces centres
          const { data: bureauxData, error: bError } = await supabase
            .from('voting_bureaux')
            .select('registered_voters')
            .in('center_id', centerIds);

          if (bError) throw bError;
          bureauxCount = bureauxData?.length || 0;
          totalVoters = (bureauxData || []).reduce((sum, bureau) => sum + (Number(bureau.registered_voters) || 0), 0);
        }

        // d. Compter uniquement les candidats qui sont dans la table election_candidates
        const { count: candidatesCount } = await supabase
          .from('election_candidates')
          .select('candidate_id', { count: 'exact', head: true })
          .in('election_id', selectedElectionIds);

        // Compter les provinces actives pour les centres sélectionnés
        let provincesCount = 0;
        if (centerIds.length > 0) {
          const { data: centersData } = await supabase
            .from('voting_centers')
            .select('province_id')
            .in('id', centerIds);
          const activeProvinceIds = Array.from(new Set((centersData || []).map((c: any) => c.province_id).filter(Boolean)));
          provincesCount = activeProvinceIds.length;
        }

        setStats({
          elections: {
            total: (electionsData || []).length,
            byStatus: electionsByStatus,
            upcoming: upcomingElections,
            completed: completedElections
          },
          voters: {
            total: totalVoters,
            registered: totalVoters,
            trend: 12.5 // Simulé
          },
          infrastructure: {
            centers: centersCount || 0,
            bureaux: bureauxCount || 0,
            provinces: provincesCount || 0,
            communes: 0,
            candidates: candidatesCount || 0
          }
        });

      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        addNotification({ title: 'Erreur', message: 'Erreur lors du chargement des données', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [selectedElectionIds, addNotification]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e40af] mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement du tableau de bord...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Header moderne avec gradient - Mobile First */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#1e40af] to-[#1e3a8a] rounded-lg sm:rounded-xl lg:rounded-2xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 text-white shadow-xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
              <div className="space-y-2 sm:space-y-3">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">
                  Tableau de Bord
                </h1>
                <p className="text-blue-100 text-sm sm:text-base lg:text-lg leading-relaxed">
                  Vue d'ensemble du système électoral o'Hitu
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <div className="relative" ref={dropdownRef}>
                    <button 
                      onClick={() => setIsOpen(!isOpen)}
                      className="flex items-center justify-between w-[320px] px-4 py-2 bg-white/20 hover:bg-white/30 text-white border border-white/20 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors"
                    >
                      <span className="truncate">
                        {selectedElectionIds.length === 0 
                          ? "Aucune élection sélectionnée" 
                          : selectedElectionIds.length === electionsList.length 
                            ? "Toutes les élections" 
                            : `${selectedElectionIds.length} élection(s) sélectionnée(s)`}
                      </span>
                      <ChevronDown className="w-4 h-4 ml-2 opacity-70" />
                    </button>

                    {isOpen && (
                      <div className="absolute left-0 mt-2 w-[320px] rounded-md shadow-lg bg-white text-gray-900 ring-1 ring-black ring-opacity-5 z-50 max-h-60 overflow-y-auto">
                        <div className="p-2 space-y-1">
                          <label className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                              checked={selectedElectionIds.length === electionsList.length && electionsList.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedElectionIds(electionsList.map(el => el.id));
                                } else {
                                  setSelectedElectionIds([]);
                                }
                              }}
                            />
                            <span className="text-sm font-semibold">Toutes les élections</span>
                          </label>
                          <div className="border-t border-gray-100 my-1"></div>
                          {electionsList.map((election) => (
                            <label key={election.id} className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
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
                                <span className="text-sm font-medium truncate max-w-[240px]">{election.title}</span>
                                <span className="text-[10px] text-gray-500">{election.status}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
              </div>
            </div>
          </div>
        </div>

        {/* Statistiques principales - 2 par 2 sur mobile, 4 sur desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <MetricCard
            title="Centres de Vote"
            value={stats.infrastructure.centers}
            subtitle="Centres actifs"
            icon={Building}
            color="#8b5cf6"
            className=""
          />
          
          <MetricCard
            title="Bureaux de Vote"
            value={stats.infrastructure.bureaux}
            subtitle="Bureaux total"
            icon={Vote}
            color="#1e40af"
            className=""
          />
          
          <MetricCard
            title="Candidats"
            value={stats.infrastructure.candidates || 0}
            subtitle="Candidats inscrits"
            icon={Users}
            color="#10b981"
            className=""
          />
          
          <MetricCard
            title="Électeurs"
            value={stats.voters.total.toLocaleString()}
            subtitle="Inscriptions totales"
            icon={Target}
            color="#f59e0b"
            // trend={{ value: stats.voters.trend, isPositive: true, label: "croissance" }}
            className=""
          />
        </div>

        {/* Section Élections - Mobile First */}
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">
          <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">Statut des Élections</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
            <Card className="election-card">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">À venir</p>
                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{stats.elections.upcoming}</p>
                  </div>
                  <div className="p-2 sm:p-3 bg-blue-100 rounded-full animate-pulse">
                    <Calendar className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="election-card">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">En cours</p>
                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-600">{stats.elections.byStatus['En cours'] || 0}</p>
                  </div>
                  <div className="p-2 sm:p-3 bg-orange-100 rounded-full animate-pulse">
                    <Activity className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="election-card col-span-2 sm:col-span-1">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Terminées</p>
                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">{stats.elections.completed}</p>
                  </div>
                  <div className="p-2 sm:p-3 bg-green-100 rounded-full">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>


      </div>
    </Layout>
  );
};

export default DashboardModernSimple;
