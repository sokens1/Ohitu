
import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  MapPin, 
  Search, 
  Filter,
  Phone,
  Mail,
  Users,
  Building,
  ArrowLeft,
  Star,
  Eye,
  Plus
} from 'lucide-react';

// Types pour les données
interface VotingCenter {
  id: string;
  name: string;
  address: string;
  province: string;
  city: string;
  district: string;
  coordinates: { lat: number; lng: number };
  contact: {
    name: string;
    phone: string;
    email: string;
  };
  photo: string;
  totalVoters: number;
  totalBureaux: number;
}

interface Bureau {
  id: string;
  name: string;
  registeredVoters: number;
  urns: number;
  president: string;
}

interface Candidate {
  id: string;
  name: string;
  party: string;
  photo: string;
  isPriority: boolean; // Candidat du directeur
}

interface NewCenterForm {
  name: string;
  address: string;
  province: string;
  city: string;
  district: string;
  latitude: string;
  longitude: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  totalVoters: string;
  totalBureaux: string;
}

const VotingCenters = () => {
  const [selectedCenter, setSelectedCenter] = useState<VotingCenter | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCenterForm, setNewCenterForm] = useState<NewCenterForm>({
    name: '',
    address: '',
    province: '',
    city: '',
    district: '',
    latitude: '',
    longitude: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    totalVoters: '',
    totalBureaux: ''
  });

  const [votingCenters, setVotingCenters] = useState<VotingCenter[]>([]);
  const [bureaux, setBureaux] = useState<Bureau[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  // Charger les centres de vote depuis Supabase
  useEffect(() => {
    const fetchVotingCenters = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('voting_centers')
          .select(`
            *,
            provinces(name),
            departments(name),
            communes(name),
            arrondissements(name)
          `)
          .order('name', { ascending: true });

        if (error) {
          console.error('Erreur lors du chargement des centres de vote:', error);
          return;
        }

        // Transformer les données Supabase en format VotingCenter
        const transformedCenters: VotingCenter[] = data?.map(center => ({
          id: center.id.toString(),
          name: center.name,
          address: center.address || '',
          province: center.provinces?.name || '',
          city: center.communes?.name || '',
          district: center.arrondissements?.name || '',
          coordinates: { 
            lat: center.latitude || 0, 
            lng: center.longitude || 0 
          },
          contact: {
            name: center.contact_name || '',
            phone: center.contact_phone || '',
            email: center.contact_email || ''
          },
          photo: '/placeholder.svg',
          totalVoters: center.total_voters || 0,
          totalBureaux: center.total_bureaux || 0
        })) || [];

        setVotingCenters(transformedCenters);
      } catch (error) {
        console.error('Erreur lors du chargement des centres de vote:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVotingCenters();
  }, []);

  // Charger les bureaux pour le centre sélectionné
  useEffect(() => {
    if (!selectedCenter) {
      setBureaux([]);
      return;
    }

    const fetchBureaux = async () => {
      try {
        const { data, error } = await supabase
          .from('voting_bureaux')
          .select('*')
          .eq('voting_center_id', selectedCenter.id)
          .order('name', { ascending: true });

        if (error) {
          console.error('Erreur lors du chargement des bureaux:', error);
          return;
        }

        const transformedBureaux: Bureau[] = data?.map(bureau => ({
          id: bureau.id.toString(),
          name: bureau.name,
          registeredVoters: bureau.registered_voters || 0,
          urns: bureau.urns_count || 0,
          president: bureau.president_name || ''
        })) || [];

        setBureaux(transformedBureaux);
      } catch (error) {
        console.error('Erreur lors du chargement des bureaux:', error);
      }
    };

    fetchBureaux();
  }, [selectedCenter]);

  // Charger les candidats
  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const { data, error } = await supabase
          .from('candidates')
          .select('*')
          .order('name', { ascending: true });

        if (error) {
          console.error('Erreur lors du chargement des candidats:', error);
          return;
        }

        const transformedCandidates: Candidate[] = data?.map(candidate => ({
          id: candidate.id.toString(),
          name: candidate.name,
          party: candidate.party || '',
          photo: '/placeholder.svg',
          isPriority: candidate.is_priority || false
        })) || [];

        setCandidates(transformedCandidates);
      } catch (error) {
        console.error('Erreur lors du chargement des candidats:', error);
      }
    };

    fetchCandidates();
  }, []);

  const provinces = ['Estuaire', 'Haut-Ogooué', 'Moyen-Ogooué', 'Ngounié', 'Nyanga'];
  const cities = ['Libreville', 'Port-Gentil', 'Franceville', 'Oyem', 'Mouila'];

  const filteredCenters = votingCenters.filter(center => {
    const matchesSearch = center.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         center.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProvince = !selectedProvince || center.province === selectedProvince;
    const matchesCity = !selectedCity || center.city === selectedCity;
    return matchesSearch && matchesProvince && matchesCity;
  });

  const handleFormChange = (field: keyof NewCenterForm, value: string) => {
    setNewCenterForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmitNewCenter = (e: React.FormEvent) => {
    e.preventDefault();
    // Logique pour ajouter le nouveau centre
    console.log('Nouveau centre à ajouter:', newCenterForm);
    setIsAddModalOpen(false);
    // Réinitialiser le formulaire
    setNewCenterForm({
      name: '',
      address: '',
      province: '',
      city: '',
      district: '',
      latitude: '',
      longitude: '',
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      totalVoters: '',
      totalBureaux: ''
    });
  };

  if (selectedCenter) {
    return (
      <Layout>
        <div className="space-y-6 animate-fade-in">
          {/* En-tête avec bouton retour */}
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => setSelectedCenter(null)}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à la liste</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gov-gray">{selectedCenter.name}</h1>
              <p className="text-gray-600">{selectedCenter.address}</p>
            </div>
          </div>

          {/* Interface à onglets pour les détails du centre */}
          <Card className="gov-card">
            <CardContent className="p-6">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="flex flex-col sm:grid sm:grid-cols-3 h-auto w-full gap-1 p-1 mb-6">
                  <TabsTrigger value="general" className="flex items-center justify-center space-x-2 py-2 sm:py-1.5">
                    <Building className="w-4 h-4" />
                    <span>Infos Générales</span>
                  </TabsTrigger>
                  <TabsTrigger value="bureaux" className="flex items-center justify-center space-x-2 py-2 sm:py-1.5">
                    <Users className="w-4 h-4" />
                    <span>Bureaux de Vote</span>
                  </TabsTrigger>
                  <TabsTrigger value="candidats" className="flex items-center justify-center space-x-2 py-2 sm:py-1.5">
                    <Star className="w-4 h-4" />
                    <span>Candidats Concernés</span>
                  </TabsTrigger>
                </TabsList>

                {/* Onglet Infos Générales */}
                <TabsContent value="general" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Photo du lieu */}
                    <Card className="gov-card">
                      <CardHeader>
                        <CardTitle className="text-lg">Photo du Centre</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <img 
                          src={selectedCenter.photo} 
                          alt={selectedCenter.name}
                          className="w-full h-64 object-cover rounded-lg"
                        />
                      </CardContent>
                    </Card>

                    {/* Informations du centre */}
                    <div className="space-y-4">
                      <Card className="gov-card">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center space-x-2">
                            <MapPin className="w-5 h-5 text-gov-blue" />
                            <span>Localisation</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <span className="font-medium">Adresse :</span>
                            <p className="text-gray-600">{selectedCenter.address}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="font-medium">Province :</span>
                              <p className="text-gray-600">{selectedCenter.province}</p>
                            </div>
                            <div>
                              <span className="font-medium">Ville :</span>
                              <p className="text-gray-600">{selectedCenter.city}</p>
                            </div>
                          </div>
                          <div>
                            <span className="font-medium">Coordonnées GPS :</span>
                            <p className="text-gray-600 font-mono">
                              {selectedCenter.coordinates.lat}, {selectedCenter.coordinates.lng}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="gov-card">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center space-x-2">
                            <Phone className="w-5 h-5 text-gov-blue" />
                            <span>Contact du Responsable</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <span className="font-medium">Nom :</span>
                            <p className="text-gray-600">{selectedCenter.contact.name}</p>
                          </div>
                          <div>
                            <span className="font-medium">Téléphone :</span>
                            <p className="text-gray-600">{selectedCenter.contact.phone}</p>
                          </div>
                          <div>
                            <span className="font-medium">Email :</span>
                            <p className="text-gray-600">{selectedCenter.contact.email}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* Statistiques du centre */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="gov-card border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Total Électeurs</p>
                            <p className="text-2xl font-bold text-blue-600">
                              {selectedCenter.totalVoters.toLocaleString('fr-FR')}
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
                            <p className="text-sm text-gray-600">Bureaux de Vote</p>
                            <p className="text-2xl font-bold text-green-600">{selectedCenter.totalBureaux}</p>
                          </div>
                          <Building className="h-8 w-8 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Onglet Bureaux de Vote */}
                <TabsContent value="bureaux" className="space-y-4">
                  <Card className="gov-card">
                    <CardHeader>
                      <CardTitle className="text-lg">Liste des Bureaux de Vote</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID du Bureau</TableHead>
                              <TableHead>Électeurs Inscrits</TableHead>
                              <TableHead>Nombre d'Urnes</TableHead>
                              <TableHead>Président du Bureau</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bureaux.map((bureau) => (
                              <TableRow key={bureau.id} className="hover:bg-gray-50">
                                <TableCell className="font-medium">{bureau.id}</TableCell>
                                <TableCell>{bureau.registeredVoters.toLocaleString('fr-FR')}</TableCell>
                                <TableCell>{bureau.urns}</TableCell>
                                <TableCell>{bureau.president}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Onglet Candidats Concernés */}
                <TabsContent value="candidats" className="space-y-4">
                  <Card className="gov-card">
                    <CardHeader>
                      <CardTitle className="text-lg">Candidats pour cette Circonscription</CardTitle>
                      <p className="text-sm text-gray-600">
                        Liste des candidats pour lesquels les électeurs de ce centre peuvent voter
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {candidates.map((candidate) => (
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
                                        Prioritaire
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-gray-600 text-sm">{candidate.party}</p>
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
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des centres de vote...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gov-gray">Centres et Bureaux de Vote</h1>
            <p className="text-gray-600 mt-2">
              Annuaire détaillé de tous les lieux de vote physiques
            </p>
          </div>
          
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center space-x-2 bg-gov-blue hover:bg-gov-blue/90">
                <Plus className="w-4 h-4" />
                <span>Ajouter un centre</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Ajouter un nouveau centre de vote</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmitNewCenter} className="space-y-6">
                {/* Informations générales */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gov-gray">Informations générales</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nom du centre *</Label>
                      <Input
                        id="name"
                        value={newCenterForm.name}
                        onChange={(e) => handleFormChange('name', e.target.value)}
                        placeholder="Ex: École Primaire de..."
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="district">District</Label>
                      <Input
                        id="district"
                        value={newCenterForm.district}
                        onChange={(e) => handleFormChange('district', e.target.value)}
                        placeholder="Ex: Centre, Batterie IV..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Adresse complète *</Label>
                    <Input
                      id="address"
                      value={newCenterForm.address}
                      onChange={(e) => handleFormChange('address', e.target.value)}
                      placeholder="Ex: 15 Avenue de la République, Libreville"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="province">Province *</Label>
                      <Select 
                        value={newCenterForm.province} 
                        onValueChange={(value) => handleFormChange('province', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une province" />
                        </SelectTrigger>
                        <SelectContent>
                          {provinces.map(province => (
                            <SelectItem key={province} value={province}>{province}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city">Ville *</Label>
                      <Select 
                        value={newCenterForm.city} 
                        onValueChange={(value) => handleFormChange('city', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une ville" />
                        </SelectTrigger>
                        <SelectContent>
                          {cities.map(city => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Coordonnées GPS */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gov-gray">Coordonnées GPS</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="latitude">Latitude</Label>
                      <Input
                        id="latitude"
                        value={newCenterForm.latitude}
                        onChange={(e) => handleFormChange('latitude', e.target.value)}
                        placeholder="Ex: 0.3936"
                        type="number"
                        step="any"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="longitude">Longitude</Label>
                      <Input
                        id="longitude"
                        value={newCenterForm.longitude}
                        onChange={(e) => handleFormChange('longitude', e.target.value)}
                        placeholder="Ex: 9.4573"
                        type="number"
                        step="any"
                      />
                    </div>
                  </div>
                </div>

                {/* Informations de contact */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gov-gray">Contact du responsable</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Nom du responsable *</Label>
                    <Input
                      id="contactName"
                      value={newCenterForm.contactName}
                      onChange={(e) => handleFormChange('contactName', e.target.value)}
                      placeholder="Ex: Marie Ngoua"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contactPhone">Téléphone *</Label>
                      <Input
                        id="contactPhone"
                        value={newCenterForm.contactPhone}
                        onChange={(e) => handleFormChange('contactPhone', e.target.value)}
                        placeholder="Ex: +241 01 23 45 67"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">Email *</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        value={newCenterForm.contactEmail}
                        onChange={(e) => handleFormChange('contactEmail', e.target.value)}
                        placeholder="Ex: marie.ngoua@education.ga"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Statistiques */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gov-gray">Statistiques</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="totalVoters">Nombre total d'électeurs</Label>
                      <Input
                        id="totalVoters"
                        type="number"
                        value={newCenterForm.totalVoters}
                        onChange={(e) => handleFormChange('totalVoters', e.target.value)}
                        placeholder="Ex: 2450"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="totalBureaux">Nombre de bureaux de vote</Label>
                      <Input
                        id="totalBureaux"
                        type="number"
                        value={newCenterForm.totalBureaux}
                        onChange={(e) => handleFormChange('totalBureaux', e.target.value)}
                        placeholder="Ex: 8"
                      />
                    </div>
                  </div>
                </div>

                {/* Boutons d'action */}
                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsAddModalOpen(false)}
                    className="sm:order-1"
                  >
                    Annuler
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-gov-blue hover:bg-gov-blue/90 sm:order-2"
                  >
                    Ajouter le centre
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filtres et recherche */}
        <Card className="gov-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="w-5 h-5" />
              <span>Filtres de Recherche</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Recherche</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Nom du centre ou adresse..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Province</label>
                <Select value={selectedProvince} onValueChange={setSelectedProvince}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les provinces" />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map(province => (
                      <SelectItem key={province} value={province}>{province}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Ville</label>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les villes" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedProvince('');
                    setSelectedCity('');
                  }}
                  className="w-full"
                >
                  Réinitialiser
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Résultats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCenters.map((center) => (
            <Card 
              key={center.id} 
              className="gov-card hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedCenter(center)}
            >
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gov-gray">
                  {center.name}
                </CardTitle>
                <p className="text-sm text-gray-600">{center.address}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Localisation */}
                  <div className="flex items-center space-x-2 text-sm">
                    <MapPin className="w-4 h-4 text-gov-blue" />
                    <span>{center.province} • {center.city}</span>
                  </div>

                  {/* Statistiques */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                    <div className="text-center">
                      <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                      <div className="text-lg font-bold text-gray-900">
                        {center.totalVoters.toLocaleString('fr-FR')}
                      </div>
                      <div className="text-xs text-gray-500">Électeurs</div>
                    </div>
                    <div className="text-center">
                      <Building className="w-5 h-5 text-green-500 mx-auto mb-1" />
                      <div className="text-lg font-bold text-gray-900">
                        {center.totalBureaux}
                      </div>
                      <div className="text-xs text-gray-500">Bureaux</div>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="text-sm text-gray-600">
                    <p className="font-medium">{center.contact.name}</p>
                    <p>{center.contact.phone}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredCenters.length === 0 && (
          <Card className="gov-card">
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">Aucun centre de vote trouvé avec ces critères de recherche.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default VotingCenters;
