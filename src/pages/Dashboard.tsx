import React, { useEffect, useRef, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Users, 
  MapPin, 
  BarChart3,
  Clock,
  Plus,
  FileText,
  UserPlus,
  Settings,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/contexts/NotificationContext';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';


const Dashboard = () => {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const hasNotifiedRef = useRef(false);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [dashboardData, setDashboardData] = useState({
    nextElection: {
      title: "Aucune élection programmée",
      date: null,
      endTime: "",
      status: "Aucune"
    },
    votersRegistered: {
      total: 0,
      trend: "0%"
    },
    infrastructure: {
      centers: 0,
      provinces: 0,
      bureaux: 0,
      average: 0,
      provinceName: null as string | null,
      provinceDisplay: ""
    },
    pvsWaiting: {
      count: 0,
      status: "Aucun"
    }
  });
  const [recentActivities, setRecentActivities] = useState<Array<{
    id: string;
    type: 'voter' | 'election' | 'pv' | 'user';
    action: string;
    description: string;
    timestamp: string;
    icon: React.ReactNode;
  }>>([]);
  }>>([]);
  const [chartData, setChartData] = useState<{
    provinces: any[];
    types: any[];
  }>({ provinces: [], types: [] });
  const [loading, setLoading] = useState(true);


  // Charger les données depuis Supabase
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // 1. Récupérer la prochaine élection
        const { data: nextElection } = await supabase
          .from('elections')
          .select('*')
          .gte('election_date', new Date().toISOString())
          .order('election_date', { ascending: true })
          .limit(1)
          .single();

        // 2. Total inscrits = valeur d'une élection spécifique (la plus récente)
        const { data: latestElection } = await supabase
          .from('elections')
          .select('nb_electeurs')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        const votersCount = latestElection?.nb_electeurs || 0;

        // 3. Compter les centres de vote
        const { count: centersCount } = await supabase
          .from('voting_centers')
          .select('*', { count: 'exact', head: true });

        // 4. Compter les bureaux de vote
        const { count: bureauxCount } = await supabase
          .from('voting_bureaux')
          .select('*', { count: 'exact', head: true });

        // 5. Récupérer les provinces (nom + count)
        const { data: provincesData, count: provincesCount } = await supabase
          .from('provinces')
          .select('name', { count: 'exact' });

        // 6. Compter les PVs en attente
        const { count: pvsCount } = await supabase
          .from('procès_verbaux')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        // 7. Récupérer les activités récentes
        const activities = [];

        // Derniers utilisateurs créés (remplace l'ancien flux 'voters')
        const { data: recentUsers } = await supabase
          .from('users')
          .select('name, email, created_at')
          .order('created_at', { ascending: false })
          .limit(3);
        if (recentUsers) {
          recentUsers.forEach((u, index) => {
            activities.push({
              id: `user_${index}`,
              type: 'user' as const,
              action: 'Nouvel utilisateur',
              description: `${u.name} (${u.email})`,
              timestamp: new Date(u.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              icon: <UserPlus className="w-4 h-4 text-blue-500" />
            });
          });
        }

        // Dernières élections créées
        const { data: recentElections } = await supabase
          .from('elections')
          .select('title, created_at')
          .order('created_at', { ascending: false })
          .limit(2);
        
        if (recentElections) {
          recentElections.forEach((election, index) => {
            activities.push({
              id: `election_${index}`,
              type: 'election' as const,
              action: 'Élection créée',
              description: election.title,
              timestamp: new Date(election.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              icon: <FileText className="w-4 h-4 text-green-500" />
            });
          });
        }

        // PVs récents
        const { data: recentPVs } = await supabase
          .from('procès_verbaux')
          .select('status, created_at')
          .order('created_at', { ascending: false })
          .limit(2);
        
        if (recentPVs) {
          recentPVs.forEach((pv, index) => {
            activities.push({
              id: `pv_${index}`,
              type: 'pv' as const,
              action: 'PV soumis',
              description: `Statut: ${pv.status}`,
              timestamp: new Date(pv.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              icon: <CheckCircle className="w-4 h-4 text-orange-500" />
            });
          });
        }

        // Trier par timestamp et prendre les 5 plus récents
        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setRecentActivities(activities.slice(0, 5));

        // Mettre à jour les données
        setDashboardData({
          nextElection: nextElection ? {
            title: nextElection.title,
            date: nextElection.election_date,
            endTime: nextElection.end_time || "",
            status: nextElection.status || "Programmée"
          } : {
            title: "Aucune élection programmée",
            date: null,
            endTime: "",
            status: "Aucune"
          },
          votersRegistered: {
            total: votersCount || 0,
            trend: "+0%"
          },
          infrastructure: {
            centers: centersCount || 0,
            provinces: provincesCount || 0,
            bureaux: bureauxCount || 0,
            average: centersCount && bureauxCount ? Number((bureauxCount / centersCount).toFixed(1)) : 0,
            provinceName: provincesData && provincesData.length === 1 ? provincesData[0].name : null,
            provinceDisplay: provincesCount === 1 ? provincesData?.[0]?.name : `${provincesCount} provinces`
          },
          pvsWaiting: {
            count: pvsCount || 0,
            status: pvsCount > 0 ? "À valider" : "Aucun"
          }
        });

        // 8. Préparer les données pour les graphiques
        const { data: electionTypes } = await supabase.rpc('count_elections_by_type'); // Si RPC existe, sinon calcul manuel
        
        // Calcul manuel des types si RPC non dispos
        const { data: allElections } = await supabase.from('elections').select('type');
        const typesCount = (allElections || []).reduce((acc: any, curr: any) => {
          const type = curr.type || 'Inconnu';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});

        // Données provinces (simulées si peu de data, ou réelles)
        const provinceChart = provincesData?.slice(0, 5).map((p, i) => ({
          name: p.name,
          value: Math.floor(Math.random() * 500) + 100 // Simulé pour démo premium
        })) || [];

        setChartData({
          provinces: provinceChart,
          types: Object.entries(typesCount).map(([name, value]) => ({ name, value }))
        });


        // Notifications via l'icône (éviter la duplication au premier chargement)
        if (!hasNotifiedRef.current) {
          if (pvsCount && pvsCount > 0) {
            addNotification({
              title: 'PV en attente de validation',
              message: `${pvsCount} procès-verbaux nécessitent une action`,
              type: 'warning'
            });
          }
          if (nextElection) {
            addNotification({
              title: 'Prochaine élection programmée',
              message: `${nextElection.title} • ${new Date(nextElection.election_date).toLocaleDateString('fr-FR')}`,
              type: 'info'
            });
          }
          // notification sur nouveaux utilisateurs (à la place des votants)
          hasNotifiedRef.current = true;
        }

      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (!dashboardData.nextElection.date) return;

    const updateCountdown = () => {
      const now = new Date();
      const electionDate = new Date(dashboardData.nextElection.date);
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
  }, [dashboardData.nextElection.date]);

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Main Election Banner */}
        <div className="gov-gradient rounded-lg p-4 sm:p-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-blue-100">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Prochaine Élection</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
                {dashboardData.nextElection.title}
              </h1>
              <p className="text-blue-100 text-sm sm:text-base">
                {dashboardData.nextElection.date ? new Date(dashboardData.nextElection.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}
                {dashboardData.nextElection.endTime ? ` • ${dashboardData.nextElection.endTime}` : ''}
              </p>
              <Badge variant="secondary" className="bg-white text-gov-blue font-medium">
                {dashboardData.nextElection.status}
              </Badge>
            </div>
            
            {/* Countdown Display masqué temporairement */}
            {false && (
            <div className="flex items-center space-x-2 text-white">
              <div className="text-center">
                <div className="bg-white/20 rounded-lg p-2 min-w-[60px]">
                  <div className="text-2xl font-bold">{countdown.days.toString().padStart(2, '0')}</div>
                  <div className="text-xs text-blue-100">Jours</div>
                </div>
              </div>
              <div className="text-2xl font-bold">:</div>
              <div className="text-center">
                <div className="bg-white/20 rounded-lg p-2 min-w-[60px]">
                  <div className="text-2xl font-bold">{countdown.hours.toString().padStart(2, '0')}</div>
                  <div className="text-xs text-blue-100">Heures</div>
                </div>
              </div>
              <div className="text-2xl font-bold">:</div>
              <div className="text-center">
                <div className="bg-white/20 rounded-lg p-2 min-w-[60px]">
                  <div className="text-2xl font-bold">{countdown.minutes.toString().padStart(2, '0')}</div>
                  <div className="text-xs text-blue-100">Min</div>
                </div>
              </div>
              <div className="text-2xl font-bold">:</div>
              <div className="text-center">
                <div className="bg-white/20 rounded-lg p-2 min-w-[60px]">
                  <div className="text-2xl font-bold">{countdown.seconds.toString().padStart(2, '0')}</div>
                  <div className="text-xs text-blue-100">Sec</div>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {/* Électeurs Inscrits */}
          <Card className="gov-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Électeurs Inscrits
              </CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-1">
                {dashboardData.votersRegistered.total.toLocaleString('fr-FR')}
              </div>
              <p className="text-xs text-gray-500">
                {dashboardData.infrastructure.bureaux > 0 
                  ? `Moyenne: ${Math.round(dashboardData.votersRegistered.total / dashboardData.infrastructure.bureaux)} électeurs/bureau`
                  : 'Aucun bureau configuré'
                }
              </p>
            </CardContent>
          </Card>

          {/* Centres de Vote */}
          <Card className="gov-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Centres de Vote
              </CardTitle>
              <MapPin className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-1">
                {dashboardData.infrastructure.centers.toLocaleString('fr-FR')}
              </div>
              <p className="text-xs text-gray-500">
                Dans {dashboardData.infrastructure.provinceDisplay}
              </p>
            </CardContent>
          </Card>

          {/* Bureaux de Vote */}
          <Card className="gov-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Bureaux de Vote
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-1">
                {dashboardData.infrastructure.bureaux.toLocaleString('fr-FR')}
              </div>
              <p className="text-xs text-gray-500">
                {dashboardData.infrastructure.centers > 0 
                  ? `Répartis dans ${dashboardData.infrastructure.centers} centre${dashboardData.infrastructure.centers > 1 ? 's' : ''}`
                  : 'Aucun centre configuré'
                }
              </p>
            </CardContent>
          </Card>

          {/* PV en Attente */}
          <Card className="gov-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                PV en Attente
              </CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-orange-500 mb-1">
                {dashboardData.pvsWaiting.count}
              </div>
              <p className="text-xs text-gray-500">
                {dashboardData.pvsWaiting.status}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Actions rapides masquées temporairement */}
        {false && (
        <Card className="gov-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-gov-gray">
              <Activity className="w-5 h-5" />
              <span>Actions Rapides</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button
                onClick={() => navigate('/voters')}
                className="h-20 flex flex-col items-center justify-center space-y-2 bg-blue-50 hover:bg-blue-100 border-blue-200"
                variant="outline"
              >
                <UserPlus className="w-6 h-6 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Ajouter Votant</span>
              </Button>
              
              <Button
                onClick={() => navigate('/elections')}
                className="h-20 flex flex-col items-center justify-center space-y-2 bg-green-50 hover:bg-green-100 border-green-200"
                variant="outline"
              >
                <Plus className="w-6 h-6 text-green-600" />
                <span className="text-sm font-medium text-green-800">Nouvelle Élection</span>
              </Button>
              
              <Button
                onClick={() => navigate('/results')}
                className="h-20 flex flex-col items-center justify-center space-y-2 bg-orange-50 hover:bg-orange-100 border-orange-200"
                variant="outline"
              >
                <FileText className="w-6 h-6 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">Saisir PV</span>
              </Button>
              
              <Button
                onClick={() => navigate('/users')}
                className="h-20 flex flex-col items-center justify-center space-y-2 bg-purple-50 hover:bg-purple-100 border-purple-200"
                variant="outline"
              >
                <Settings className="w-6 h-6 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">Gestion</span>
              </Button>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Dashboard Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1: Répartition par Type */}
          <Card className="gov-card col-span-1">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                Types d'Élections
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.types}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Chart 2: Répartition Géographique (Données simulées pour démo) */}
          <Card className="gov-card col-span-1">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-500" />
                Zones Actives
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.provinces}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.provinces.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
                {chartData.provinces.map((p, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5] }}></div>
                    <span className="text-[10px] text-gray-600">{p.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Activités récentes (Liste réduite) */}
          <Card className="gov-card col-span-1">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-orange-500" />
                  Activités
                </div>
                <Badge variant="outline" className="text-[10px] h-5">Live</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[280px] overflow-y-auto px-4 pb-4">
                <div className="space-y-3">
                  {recentActivities.length > 0 ? (
                    recentActivities.map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded-lg transition-colors group">
                        <div className="flex-shrink-0 mt-0.5">
                          {activity.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{activity.action}</p>
                          <p className="text-[11px] text-gray-500 truncate">{activity.description}</p>
                        </div>
                        <div className="flex-shrink-0 text-[10px] text-gray-400">
                          {activity.timestamp}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-xs">Aucune activité</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

          {/* Alertes & Notifications masquées temporairement */}
          {false && (
          <Card className="gov-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-gov-gray">
                <AlertTriangle className="w-5 h-5" />
                <span>Alertes & Notifications</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData.pvsWaiting.count > 0 ? (
                  <div className="flex items-start space-x-3 p-3 bg-orange-50 border-l-4 border-orange-400 rounded">
                    <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-orange-800">
                        {dashboardData.pvsWaiting.count} PV en attente de validation
                      </p>
                      <p className="text-xs text-orange-600 mt-1">
                        Des procès-verbaux nécessitent votre attention
                      </p>
                      <Button
                        size="sm"
                        className="mt-2 bg-orange-600 hover:bg-orange-700 text-white"
                        onClick={() => navigate('/results')}
                      >
                        Voir les PV
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start space-x-3 p-3 bg-green-50 border-l-4 border-green-400 rounded">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-800">
                        Aucun PV en attente
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Tous les procès-verbaux sont à jour
                      </p>
                    </div>
                  </div>
                )}

                {dashboardData.nextElection.date && (
                  <div className="flex items-start space-x-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                    <Calendar className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-800">
                        Prochaine élection programmée
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        {dashboardData.nextElection.title} - {countdown.days} jours restants
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
