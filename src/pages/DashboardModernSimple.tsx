import React, { useEffect, useState } from 'react';
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
  CheckCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/contexts/NotificationContext';
import MetricCard from '@/components/dashboard/MetricCard';

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
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    elections: { total: 0, byStatus: {}, upcoming: 0, completed: 0 },
    voters: { total: 0, registered: 0, trend: 0 },
    infrastructure: { centers: 0, bureaux: 0, provinces: 0, communes: 0, candidates: 0 },
  });

  // Charger les données du tableau de bord
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // 1. Statistiques des élections
        const { data: electionsData, error: electionsError } = await supabase
          .from('elections')
          .select('id, status, election_date, created_at');

        if (electionsError) {
          console.error('Erreur lors du chargement des élections:', electionsError);
          throw electionsError;
        }

        // Normaliser les statuts et compter par statut
        const electionsByStatus = (electionsData || []).reduce((acc, election) => {
          // Normaliser le statut pour éviter les problèmes de casse
          const normalizedStatus = election.status?.trim() || 'À venir';
          acc[normalizedStatus] = (acc[normalizedStatus] || 0) + 1;
          return acc;
        }, {} as { [key: string]: number });

        // Compter les élections "À venir" (basé sur le statut, pas la date)
        const upcomingElections = (electionsData || []).filter(e => {
          const status = e.status?.trim() || '';
          return status === 'À venir';
        }).length;

        // Compter les élections "Terminées" (normaliser le statut)
        const completedElections = (electionsData || []).filter(e => {
          const status = e.status?.trim() || '';
          return status === 'Terminée';
        }).length;

        // 2. Statistiques des électeurs - Valeur d'une élection spécifique (la plus récente)
        const { data: latestElection, error: latestElectionError } = await supabase
          .from('elections')
          .select('nb_electeurs')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(); // Utiliser maybeSingle() au lieu de single() pour éviter les erreurs si aucune élection n'existe

        if (latestElectionError) {
          console.error('Erreur lors du chargement de la dernière élection:', latestElectionError);
        }

        // Calculer le total d'électeurs depuis les bureaux de vote
        const { data: bureauxData } = await supabase
          .from('voting_bureaux')
          .select('registered_voters');

        const totalVoters = (bureauxData || []).reduce((sum, bureau) => {
          return sum + (Number(bureau.registered_voters) || 0);
        }, 0);

        // 3. Infrastructure
        const { count: centersCount } = await supabase
          .from('voting_centers')
          .select('*', { count: 'exact', head: true });

        const { count: bureauxCount } = await supabase
          .from('voting_bureaux')
          .select('*', { count: 'exact', head: true });

        const { count: provincesCount } = await supabase
          .from('provinces')
          .select('*', { count: 'exact', head: true });

        const { count: communesCount } = await supabase
          .from('communes')
          .select('*', { count: 'exact', head: true });

        // Compter uniquement les candidats qui sont dans la table election_candidates
        const { count: candidatesCount } = await supabase
          .from('election_candidates')
          .select('candidate_id', { count: 'exact', head: true });

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
            communes: communesCount || 0,
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
  }, [addNotification]);

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
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-sm text-blue-100">Système opérationnel</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-200" />
                    <span className="text-sm text-blue-100">Performance optimale</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
                <Button 
                  onClick={() => navigate('/elections')}
                  className="bg-white hover:bg-gray-50 text-[#1e40af] shadow-lg hover:shadow-xl transition-all duration-300 text-sm sm:text-base font-semibold px-4 sm:px-6 py-2 sm:py-3"
                >
                  <Vote className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  <span className="hidden xs:inline">Gérer les Élections</span>
                  <span className="xs:hidden">Élections</span>
                </Button>
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
                  <div className="p-2 sm:p-3 bg-blue-100 rounded-full">
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
                  <div className="p-2 sm:p-3 bg-orange-100 rounded-full">
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

        {/* Actions rapides - Mobile First */}
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">
          <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">Actions Rapides</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-4">
            <Button 
              onClick={() => navigate('/elections')}
              className="h-16 sm:h-20 flex flex-col items-center justify-center gap-2 bg-[#1e40af] hover:bg-[#1e3a8a] text-white"
            >
              <Vote className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-xs sm:text-sm font-medium">Élections</span>
            </Button>
            
            <Button 
              onClick={() => navigate('/voters')}
              className="h-16 sm:h-20 flex flex-col items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <Users className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-xs sm:text-sm font-medium">Inscrits</span>
            </Button>
            
            <Button 
              onClick={() => navigate('/results')}
              className="h-16 sm:h-20 flex flex-col items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-xs sm:text-sm font-medium">Résultats</span>
            </Button>
            
            <Button 
              onClick={() => navigate('/users')}
              className="h-16 sm:h-20 flex flex-col items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Shield className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-xs sm:text-sm font-medium">Utilisateurs</span>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardModernSimple;
