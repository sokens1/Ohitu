
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { 
  X,
  MapPin,
  Users,
  Building,
  ChevronRight,
  Search,
  Star,
  Eye,
  BarChart3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useState } from 'react';

interface Election {
  id: number;
  title: string;
  date: string;
  status: string;
  description: string;
  voters: number;
  candidates: number;
  centers: number;
}

interface ElectionDetailModalProps {
  election: Election;
  onClose: () => void;
}

interface GeographicLevel {
  id: string;
  name: string;
  type: 'province' | 'city' | 'district';
  voters: number;
  centers: number;
  bureaux: number;
  children?: GeographicLevel[];
}

interface Candidate {
  id: string;
  name: string;
  party: string;
  photo: string;
  isPriority: boolean;
  votes?: number;
  percentage?: number;
}

const ElectionDetailModal: React.FC<ElectionDetailModalProps> = ({ election, onClose }) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [candidateFilter, setCandidateFilter] = useState('');

  // Données mock pour la hiérarchie géographique
  const geographicData: GeographicLevel[] = [
    {
      id: 'estuaire',
      name: 'Estuaire',
      type: 'province',
      voters: 145780,
      centers: 45,
      bureaux: 182,
      children: [
        {
          id: 'libreville',
          name: 'Libreville',
          type: 'city',
          voters: 98450,
          centers: 28,
          bureaux: 115,
          children: [
            {
              id: 'centre',
              name: 'Centre',
              type: 'district',
              voters: 25600,
              centers: 8,
              bureaux: 32
            },
            {
              id: 'batterie4',
              name: 'Batterie IV',
              type: 'district',
              voters: 32800,
              centers: 12,
              bureaux: 48
            }
          ]
        },
        {
          id: 'owendo',
          name: 'Owendo',
          type: 'city',
          voters: 47330,
          centers: 17,
          bureaux: 67
        }
      ]
    }
  ];

  // Données mock pour les candidats
  const candidates: Candidate[] = [
    {
      id: 'C001',
      name: 'Dr. Antoine Mba',
      party: 'Parti Démocratique Gabonais',
      photo: '/placeholder.svg',
      isPriority: true,
      votes: 45670,
      percentage: 31.3
    },
    {
      id: 'C002',
      name: 'Marie-Claire Ondo',
      party: 'Union Nationale',
      photo: '/placeholder.svg',
      isPriority: false,
      votes: 38920,
      percentage: 26.7
    },
    {
      id: 'C003',
      name: 'François Engonga',
      party: 'Rassemblement pour le Gabon',
      photo: '/placeholder.svg',
      isPriority: false,
      votes: 32450,
      percentage: 22.3
    },
    {
      id: 'C004',
      name: 'Sylvie Bouanga',
      party: 'Coalition pour la Nouvelle République',
      photo: '/placeholder.svg',
      isPriority: false,
      votes: 28670,
      percentage: 19.7
    }
  ];

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const renderGeographicLevel = (level: GeographicLevel, depth: number = 0) => {
    const isExpanded = expandedItems.has(level.id);
    const hasChildren = level.children && level.children.length > 0;

    return (
      <div key={level.id}>
        <div 
          className={`flex items-center justify-between p-3 border border-gray-200 rounded-lg mb-2 bg-white hover:bg-gray-50 transition-colors ${depth > 0 ? 'ml-4' : ''}`}
        >
          <div className="flex items-center space-x-3">
            {hasChildren && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => toggleExpanded(level.id)}
                className="p-1"
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            )}
            <div>
              <h4 className="font-semibold text-gray-900">{level.name}</h4>
              <Badge variant="outline" className="text-xs">
                {level.type === 'province' ? 'Province' : level.type === 'city' ? 'Ville' : 'District'}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center space-x-6 text-sm">
            <div className="text-center">
              <div className="font-bold text-blue-600">{level.voters.toLocaleString('fr-FR')}</div>
              <div className="text-gray-500">Électeurs</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-green-600">{level.centers}</div>
              <div className="text-gray-500">Centres</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-orange-600">{level.bureaux}</div>
              <div className="text-gray-500">Bureaux</div>
            </div>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="space-y-2">
            {level.children!.map(child => renderGeographicLevel(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredCandidates = candidates.filter(candidate =>
    candidate.name.toLowerCase().includes(candidateFilter.toLowerCase()) ||
    candidate.party.toLowerCase().includes(candidateFilter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gov-gray">{election.title}</h2>
            <p className="text-gray-600">{election.description}</p>
            <div className="flex items-center space-x-4 mt-2">
              <Badge variant="outline">{election.status}</Badge>
              <span className="text-sm text-gray-500">
                {new Date(election.date).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          </div>
          <Button variant="ghost" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Contenu avec onglets */}
        <div className="p-6 overflow-auto max-h-[calc(90vh-120px)]">
          <Tabs defaultValue="infrastructure" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="infrastructure" className="flex items-center space-x-2">
                <MapPin className="w-4 h-4" />
                <span>Infrastructure</span>
              </TabsTrigger>
              <TabsTrigger value="candidats" className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Candidats</span>
              </TabsTrigger>
             </TabsList>

            {/* Onglet Infrastructure */}
            <TabsContent value="infrastructure" className="space-y-6">
              <Card className="gov-card">
                <CardHeader>
                  <CardTitle className="text-lg">Hiérarchie Géographique</CardTitle>
                  <p className="text-sm text-gray-600">
                    Explorez la structure géographique et les statistiques par niveau
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {geographicData.map(level => renderGeographicLevel(level))}
                  </div>
                </CardContent>
              </Card>

              {/* Statistiques générales */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="gov-card border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Électeurs</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {election.voters.toLocaleString('fr-FR')}
                        </p>
                      </div>
                      <Users className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="gov-card border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Centres de Vote</p>
                        <p className="text-2xl font-bold text-green-600">{election.centers}</p>
                      </div>
                      <MapPin className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="gov-card border-l-4 border-l-orange-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Bureaux de Vote</p>
                        <p className="text-2xl font-bold text-orange-600">182</p>
                      </div>
                      <Building className="h-8 w-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Onglet Candidats */}
            <TabsContent value="candidats" className="space-y-6">
              <Card className="gov-card">
                <CardHeader>
                  <CardTitle className="text-lg">Liste des Candidats Validés</CardTitle>
                  <div className="flex items-center space-x-4">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Rechercher un candidat..."
                        value={candidateFilter}
                        onChange={(e) => setCandidateFilter(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredCandidates.map((candidate) => (
                      <Card 
                        key={candidate.id} 
                        className={`gov-card ${candidate.isPriority ? 'border-2 border-gov-blue bg-blue-50' : ''}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-4">
                            <img 
                              src={candidate.photo} 
                              alt={candidate.name}
                              className="w-16 h-16 rounded-full object-cover"
                            />
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <h3 className="font-semibold text-lg">{candidate.name}</h3>
                                {candidate.isPriority && (
                                  <Badge className="bg-gov-blue text-white">
                                    <Star className="w-3 h-3 mr-1" />
                                    Notre Candidat
                                  </Badge>
                                )}
                              </div>
                              <p className="text-gray-600 text-sm">{candidate.party}</p>
                              {candidate.votes && (
                                <div className="mt-2 text-sm">
                                  <span className="font-medium">{candidate.votes.toLocaleString('fr-FR')} voix</span>
                                  <span className="text-gray-500 ml-2">({candidate.percentage}%)</span>
                                </div>
                              )}
                              <Button variant="outline" size="sm" className="mt-2">
                                <Eye className="w-4 h-4 mr-1" />
                                Voir Profil
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ElectionDetailModal;
