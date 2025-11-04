import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Calendar,
  User,
  FileText,
  RefreshCw,
  X,
  Activity,
  Shield,
  Clock,
  TrendingUp,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import auditService, { AuditAction, ResourceType, AuditLog } from '@/services/auditService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    byAction: {} as Record<string, number>,
    byResource: {} as Record<string, number>,
  });
  
  // Filtres
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<ResourceType | 'all'>('all');
  const [userFilter, setUserFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalLogs, setTotalLogs] = useState(0);
  
  // Mode de vue
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Charger les logs et statistiques
  const loadLogs = async () => {
    try {
      setLoading(true);
      
      const filters: any = {
        limit,
        offset: (page - 1) * limit,
      };

      if (actionFilter !== 'all') {
        filters.action = actionFilter;
      }

      if (resourceTypeFilter !== 'all') {
        filters.resource_type = resourceTypeFilter;
      }

      if (dateFrom) {
        filters.start_date = dateFrom;
      }

      if (dateTo) {
        filters.end_date = dateTo;
      }

      const { data, error } = await auditService.getLogs(filters);

      if (error) {
        console.error('Erreur lors du chargement des logs:', error);
        return;
      }

      let filteredLogs = data || [];

      // Filtrer par utilisateur (recherche textuelle)
      if (userFilter) {
        filteredLogs = filteredLogs.filter(log => 
          log.user_name?.toLowerCase().includes(userFilter.toLowerCase()) ||
          log.user_email?.toLowerCase().includes(userFilter.toLowerCase())
        );
      }

      // Filtrer par recherche textuelle
      if (searchQuery) {
        filteredLogs = filteredLogs.filter(log =>
          log.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.resource_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.action?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      setLogs(filteredLogs);
      setTotalLogs(filteredLogs.length);

      // Charger les statistiques
      const statsData = await auditService.getStats(
        dateFrom && dateTo ? { start: dateFrom, end: dateTo } : undefined
      );
      setStats({
        total: statsData.total_logs,
        byAction: statsData.by_action,
        byResource: statsData.by_resource_type,
      });
    } catch (error) {
      console.error('Erreur lors du chargement des logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page, actionFilter, resourceTypeFilter, dateFrom, dateTo]);

  // Recharger quand les filtres de recherche changent
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadLogs();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [userFilter, searchQuery]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', icon: 'text-green-600' };
      case 'UPDATE':
        return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', icon: 'text-blue-600' };
      case 'DELETE':
        return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', icon: 'text-red-600' };
      case 'VALIDATE':
      case 'APPROVE':
        return { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', icon: 'text-purple-600' };
      case 'REJECT':
        return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', icon: 'text-orange-600' };
      case 'PUBLISH':
        return { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200', icon: 'text-indigo-600' };
      case 'LOGIN':
      case 'LOGOUT':
        return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', icon: 'text-gray-600' };
      case 'EXPORT':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', icon: 'text-yellow-600' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', icon: 'text-gray-600' };
    }
  };

  const getResourceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      election: 'Élection',
      candidate: 'Candidat',
      voting_center: 'Centre de vote',
      voting_bureau: 'Bureau de vote',
      user: 'Utilisateur',
      'procès_verbaux': 'Procès-verbal',
      election_candidate: 'Candidat-Élection',
      election_center: 'Centre-Élection',
      campaign_operation: 'Opération de campagne',
      notification: 'Notification',
    };
    return labels[type] || type;
  };

  const handleExport = () => {
    const data = {
      logs: logs.map(log => ({
        id: log.id,
        user: log.user_name || log.user_email || 'Inconnu',
        action: log.action,
        resource_type: log.resource_type,
        resource_id: log.resource_id,
        description: log.description,
        timestamp: log.created_at,
        ip_address: log.ip_address,
      })),
      exportDate: new Date().toISOString(),
      filters: {
        action: actionFilter,
        resource_type: resourceTypeFilter,
        dateFrom,
        dateTo,
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  if (loading && page === 1) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gov-blue mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement de la piste d'audit...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header avec statistiques - Mobile First */}
        <div className="relative overflow-hidden bg-gradient-to-r from-gov-blue/5 to-gov-blue-light/5 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8">
          <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
          <div className="relative z-10">
            <div className="flex flex-col gap-4 sm:gap-6">
              <div className="space-y-1 sm:space-y-2">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Piste d'Audit</h1>
                <p className="text-sm sm:text-base lg:text-lg text-gray-600 leading-relaxed">
                  Historique complet des actions et modifications du système
                </p>
              </div>
              <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 w-full">
                <Button 
                  onClick={loadLogs}
                  variant="outline"
                  className="shadow-lg hover:shadow-xl transition-all duration-300 w-full xs:w-auto text-sm sm:text-base px-4 py-2 sm:px-6 sm:py-3"
                  size="lg"
                >
                  <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  <span className="hidden xs:inline">Actualiser</span>
                  <span className="xs:hidden">Actualiser</span>
                </Button>
                <Button 
                  onClick={handleExport}
                  variant="outline"
                  className="shadow-lg hover:shadow-xl transition-all duration-300 w-full xs:w-auto text-sm sm:text-base px-4 py-2 sm:px-6 sm:py-3"
                  size="lg"
                >
                  <Download className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  <span className="hidden xs:inline">Exporter</span>
                  <span className="xs:hidden">Exporter</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Statistiques rapides - Mobile First */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <Card className="election-card">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Total Logs</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gov-blue">{stats.total}</p>
                  <div className="w-8 sm:w-10 lg:w-12 h-1 bg-gov-blue/20 rounded-full">
                    <div className="w-full h-full bg-gov-blue rounded-full"></div>
                  </div>
                </div>
                <div className="p-2 sm:p-3 bg-gov-blue/10 rounded-full flex-shrink-0 ml-2">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-gov-blue" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="election-card">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Créations</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">{stats.byAction.CREATE || 0}</p>
                  <div className="w-8 sm:w-10 lg:w-12 h-1 bg-green-200 rounded-full">
                    <div className="w-full h-full bg-green-500 rounded-full"></div>
                  </div>
                </div>
                <div className="p-2 sm:p-3 bg-green-100 rounded-full flex-shrink-0 ml-2">
                  <Activity className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="election-card">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Modifications</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600">{stats.byAction.UPDATE || 0}</p>
                  <div className="w-8 sm:w-10 lg:w-12 h-1 bg-blue-200 rounded-full">
                    <div className="w-full h-full bg-blue-500 rounded-full"></div>
                  </div>
                </div>
                <div className="p-2 sm:p-3 bg-blue-100 rounded-full flex-shrink-0 ml-2">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="election-card">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Connexions</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-600">{stats.byAction.LOGIN || 0}</p>
                  <div className="w-8 sm:w-10 lg:w-12 h-1 bg-gray-200 rounded-full">
                    <div className="w-full h-full bg-gray-500 rounded-full"></div>
                  </div>
                </div>
                <div className="p-2 sm:p-3 bg-gray-100 rounded-full flex-shrink-0 ml-2">
                  <Shield className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtres et recherche - Mobile First */}
        <div className="bg-aqua-50 rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Barre de recherche */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              <Input
                placeholder="Rechercher dans les logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 py-3 sm:py-4 text-sm sm:text-base border-0 focus:border-0 focus:ring-0 rounded-lg sm:rounded-xl bg-gray-50 focus:bg-white transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            {/* Filtres et contrôles */}
            <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
              <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 flex-1">
                <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v as AuditAction | 'all'); setPage(1); }}>
                  <SelectTrigger className="w-full xs:w-auto py-3 sm:py-4 border-0 focus:border-0 focus:ring-0 rounded-lg sm:rounded-xl bg-gray-50 focus:bg-white transition-all duration-200 text-sm sm:text-base">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <SelectValue placeholder="Action" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les actions</SelectItem>
                    <SelectItem value="CREATE">Création</SelectItem>
                    <SelectItem value="UPDATE">Modification</SelectItem>
                    <SelectItem value="DELETE">Suppression</SelectItem>
                    <SelectItem value="VALIDATE">Validation</SelectItem>
                    <SelectItem value="PUBLISH">Publication</SelectItem>
                    <SelectItem value="LOGIN">Connexion</SelectItem>
                    <SelectItem value="LOGOUT">Déconnexion</SelectItem>
                    <SelectItem value="EXPORT">Export</SelectItem>
                    <SelectItem value="APPROVE">Approbation</SelectItem>
                    <SelectItem value="REJECT">Rejet</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={resourceTypeFilter} onValueChange={(v) => { setResourceTypeFilter(v as ResourceType | 'all'); setPage(1); }}>
                  <SelectTrigger className="w-full xs:w-auto py-3 sm:py-4 border-0 focus:border-0 focus:ring-0 rounded-lg sm:rounded-xl bg-gray-50 focus:bg-white transition-all duration-200 text-sm sm:text-base">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <SelectValue placeholder="Type de ressource" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="election">Élection</SelectItem>
                    <SelectItem value="candidate">Candidat</SelectItem>
                    <SelectItem value="voting_center">Centre de vote</SelectItem>
                    <SelectItem value="voting_bureau">Bureau de vote</SelectItem>
                    <SelectItem value="user">Utilisateur</SelectItem>
                    <SelectItem value="procès_verbaux">Procès-verbal</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  placeholder="Date de début"
                  className="w-full xs:w-auto py-3 sm:py-4 border-0 focus:border-0 focus:ring-0 rounded-lg sm:rounded-xl bg-gray-50 focus:bg-white transition-all duration-200 text-sm sm:text-base"
                />

                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  placeholder="Date de fin"
                  className="w-full xs:w-auto py-3 sm:py-4 border-0 focus:border-0 focus:ring-0 rounded-lg sm:rounded-xl bg-gray-50 focus:bg-white transition-all duration-200 text-sm sm:text-base"
                />
              </div>
            </div>

            <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
              <Input
                placeholder="Filtrer par utilisateur..."
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="py-3 sm:py-4 border-0 focus:border-0 focus:ring-0 rounded-lg sm:rounded-xl bg-gray-50 focus:bg-white transition-all duration-200 text-sm sm:text-base"
              />
            </div>
          </div>
        </div>

        {/* Liste des logs - Mobile First */}
        <Card className="election-card">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                Logs d'audit ({totalLogs})
              </h2>
              {/* Boutons de vue */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors",
                    viewMode === 'grid' && "bg-gov-blue/10 text-gov-blue hover:bg-gov-blue/20"
                  )}
                >
                  <LayoutGrid className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors",
                    viewMode === 'list' && "bg-gov-blue/10 text-gov-blue hover:bg-gov-blue/20"
                  )}
                >
                  <ListIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-sm sm:text-base">Aucun log trouvé</p>
              </div>
            ) : viewMode === 'list' ? (
              /* Vue Liste */
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-xs sm:text-sm font-semibold text-gray-700">Action</th>
                      <th className="text-left py-3 px-4 text-xs sm:text-sm font-semibold text-gray-700">Utilisateur</th>
                      <th className="text-left py-3 px-4 text-xs sm:text-sm font-semibold text-gray-700">Ressource</th>
                      <th className="text-left py-3 px-4 text-xs sm:text-sm font-semibold text-gray-700">Description</th>
                      <th className="text-left py-3 px-4 text-xs sm:text-sm font-semibold text-gray-700">Date</th>
                      <th className="text-right py-3 px-4 text-xs sm:text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const colors = getActionColor(log.action);
                      return (
                        <tr
                          key={log.id}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => handleViewDetails(log)}
                        >
                          <td className="py-3 px-4">
                            <Badge className={`${colors.bg} ${colors.text} ${colors.border} border text-xs`}>
                              {log.action}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900">
                                {log.user_name || log.user_email || 'Inconnu'}
                              </span>
                              {log.user_role && (
                                <span className="text-xs text-gray-500 capitalize">{log.user_role}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-gray-700">
                              {getResourceTypeLabel(log.resource_type)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-sm text-gray-600 line-clamp-1 max-w-xs">
                              {log.description || `${log.action} sur ${getResourceTypeLabel(log.resource_type)}`}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-gray-500">
                              {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(log);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Vue Grille (Carte) */
              <div className="space-y-2 sm:space-y-3">
                {logs.map((log) => {
                  const colors = getActionColor(log.action);
                  return (
                    <div
                      key={log.id}
                      className="border rounded-lg sm:rounded-xl p-3 sm:p-4 hover:bg-gray-50 transition-colors cursor-pointer border-gray-200"
                      onClick={() => handleViewDetails(log)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                            <Badge className={`${colors.bg} ${colors.text} ${colors.border} border`}>
                              {log.action}
                            </Badge>
                            <span className="text-xs sm:text-sm text-gray-600 font-medium">
                              {getResourceTypeLabel(log.resource_type)}
                            </span>
                            {log.resource_id && (
                              <span className="text-xs text-gray-400 font-mono">
                                {log.resource_id.substring(0, 8)}...
                              </span>
                            )}
                          </div>
                          <p className="text-sm sm:text-base text-gray-900 mb-2 line-clamp-2">
                            {log.description || 'Aucune description'}
                          </p>
                          <div className="flex items-center gap-3 sm:gap-4 text-xs text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3 sm:h-4 sm:w-4" />
                              {log.user_name || log.user_email || 'Utilisateur inconnu'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                              {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                            </span>
                            {log.ip_address && (
                              <span className="text-gray-400">IP: {log.ip_address}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(log);
                          }}
                          className="flex-shrink-0"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          <span className="hidden sm:inline">Détails</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {!loading && logs.length > 0 && (
              <div className="flex justify-center items-center gap-4 mt-6 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="text-sm"
                >
                  Précédent
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page} ({totalLogs} logs)
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={logs.length < limit}
                  className="text-sm"
                >
                  Suivant
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog détails - Modernisé */}
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-900">Détails de l'action</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-6">
                {/* Type d'action */}
                <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                  <div className={`p-2 rounded-lg ${getActionColor(selectedLog.action).bg}`}>
                    <Activity className={`h-5 w-5 ${getActionColor(selectedLog.action).icon}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Type d'action</p>
                    <Badge className={`${getActionColor(selectedLog.action).bg} ${getActionColor(selectedLog.action).text} ${getActionColor(selectedLog.action).border} border mt-1`}>
                      {selectedLog.action}
                    </Badge>
                  </div>
                </div>

                {/* Utilisateur */}
                <div className="flex items-start gap-4 pb-4 border-b border-gray-200">
                  <div className="p-2 bg-gray-100 rounded-full">
                    <User className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Utilisateur</p>
                    <p className="text-base font-semibold text-gray-900">
                      {selectedLog.user_name || selectedLog.user_email || 'Utilisateur inconnu'}
                    </p>
                    {selectedLog.user_email && (
                      <p className="text-sm text-gray-500 mt-1">{selectedLog.user_email}</p>
                    )}
                    {selectedLog.user_role && (
                      <Badge variant="outline" className="mt-2 capitalize">
                        {selectedLog.user_role.replace('-', ' ')}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Description de l'action */}
                <div className="pb-4 border-b border-gray-200">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600 mb-2">Description</p>
                      <p className="text-sm text-gray-900 leading-relaxed">
                        {selectedLog.description || 
                          `${selectedLog.action} effectué sur ${getResourceTypeLabel(selectedLog.resource_type)}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Date */}
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-full">
                    <Calendar className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Date et heure</p>
                    <p className="text-base font-semibold text-gray-900">
                      {format(new Date(selectedLog.created_at), 'dd MMMM yyyy à HH:mm:ss', { locale: fr })}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AuditLogs;
