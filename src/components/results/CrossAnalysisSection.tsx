import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabase';

type ZoneType = 'departement' | 'commune';

interface CrossAnalysisSectionProps {
  electionId: string;
}

interface CenterRow {
  id: string;
  name: string;
}

interface BureauRow {
  id: string;
  name: string;
}

interface CandidateRow {
  id: string;
  name: string;
  party?: string;
}

interface BureauCandidateSummaryRow {
  election_id: string;
  bureau_id: string;
  center_id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_votes: number;
  candidate_percentage?: number;
  candidate_participation_pct?: number;
}

const CrossAnalysisSection: React.FC<CrossAnalysisSectionProps> = ({ electionId }) => {
  const [zoneType, setZoneType] = useState<ZoneType | ''>('');
  const [zoneKey, setZoneKey] = useState<string>('');
  const [isLocalElection, setIsLocalElection] = useState<boolean>(false);
  const [centers, setCenters] = useState<CenterRow[]>([]);
  const [filteredCenters, setFilteredCenters] = useState<CenterRow[]>([]);
  const [localElectionCenters, setLocalElectionCenters] = useState<CenterRow[]>([]);
  const [legislativeElectionCenters, setLegislativeElectionCenters] = useState<CenterRow[]>([]);
  const [localElectionId, setLocalElectionId] = useState<string | null>(null);
  const [legislativeElectionId, setLegislativeElectionId] = useState<string | null>(null);
  const [selectedCenterId, setSelectedCenterId] = useState<string>('');
  const [selectedCenterName, setSelectedCenterName] = useState<string>('');
  const [bureaux, setBureaux] = useState<BureauRow[]>([]);
  const [selectedBureauId, setSelectedBureauId] = useState<string>('');
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [scopedCandidates, setScopedCandidates] = useState<CandidateRow[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [bureauCandidateRows, setBureauCandidateRows] = useState<BureauCandidateSummaryRow[]>([]);
  const [hasAutoSelectedCandidates, setHasAutoSelectedCandidates] = useState<boolean>(false);
  const [userTouchedCandidates, setUserTouchedCandidates] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [loadingBureaux, setLoadingBureaux] = useState(false);

  // Charger centres rattachés à l'élection (via election_centers),
  // + préparer une liste spécifique des centres d'une élection "Locale" dans la même commune (pour la zone Commune)
  useEffect(() => {
    const loadCenters = async () => {
      try {
        // 0) Charger info élection courante (pour récupérer commune_id)
        const { data: cur, error: curErr } = await supabase
          .from('elections')
          .select('id, type, commune_id, department_id')
          .eq('id', electionId)
          .single();

        // 1) Centres de l'élection en cours
        const { data: ecData, error: ecError } = await supabase
          .from('election_centers')
          .select('center_id, voting_centers!inner(id, name)')
          .eq('election_id', electionId);

        if (!ecError && Array.isArray(ecData) && ecData.length > 0) {
          const list: CenterRow[] = ecData
            .map((row: any) => row.voting_centers)
            .filter((c: any) => c && c.id)
            .map((c: any) => ({ id: String(c.id), name: c.name }));
          setCenters(list);
          console.log('[Analyse croisée] Centres chargés pour élection:', list.length);
        } else {
          console.log('[Analyse croisée] Aucun centre trouvé pour élection, fallback vers tous les centres');
          // 2) Fallback: tous les centres
          const { data, error } = await supabase
            .from('voting_centers')
            .select('id, name')
            .order('name');
          if (error) throw error;
          const list: CenterRow[] = (data || []).map((c: any) => ({ id: String(c.id), name: c.name }));
          setCenters(list);
          console.log('[Analyse croisée] Centres fallback chargés:', list.length);
        }

        // 3) Préparer centres pour la zone "Commune" depuis une élection Locale
        try {
          // Si l'élection courante est Locale, utiliser ses centres; sinon chercher la dernière Locale dans la même commune
          const isCurrentLocal = String(cur?.type || '').toLowerCase().includes('locale');
          setIsLocalElection(isCurrentLocal);
          if (isCurrentLocal) {
            // Forcer la zone à Commune pour les élections locales
            setZoneType('commune');
          }
          let localElectionId: string | null = null;

          if (isCurrentLocal) {
            localElectionId = String(cur?.id || electionId);
          } else {
            // Chercher une élection Locale dans la même commune; sinon, fallback sur même département
            let q = supabase
              .from('elections')
              .select('id, type, commune_id, department_id')
              .ilike('type', '%locale%')
              .order('election_date', { ascending: false })
              .limit(1);
            if (cur?.commune_id) q = q.eq('commune_id', cur.commune_id);
            else if (cur?.department_id) q = q.eq('department_id', cur.department_id);
            const { data: localElections, error: localErr } = await q;
            if (!localErr && Array.isArray(localElections) && localElections.length > 0) {
              localElectionId = String(localElections[0].id);
            }
          }

          if (localElectionId) {
            const { data: ecLocal, error: ecLocalErr } = await supabase
              .from('election_centers')
              .select('center_id, voting_centers!inner(id, name)')
              .eq('election_id', localElectionId);
            if (!ecLocalErr && Array.isArray(ecLocal)) {
              const localList: CenterRow[] = ecLocal
                .map((row: any) => row.voting_centers)
                .filter((c: any) => c && c.id)
                .map((c: any) => ({ id: String(c.id), name: c.name }));
              setLocalElectionCenters(localList);
              setLocalElectionId(localElectionId);
            } else {
              setLocalElectionCenters([]);
              setLocalElectionId(null);
            }
          } else {
            setLocalElectionCenters([]);
            setLocalElectionId(null);
          }
        } catch (_) {
          setLocalElectionCenters([]);
          setLocalElectionId(null);
        }

        // 4) Préparer centres pour la zone "Département" depuis une élection Législative
        try {
          const isCurrentLegislative = String(cur?.type || '').toLowerCase().includes('législ');
          let legislativeElectionId: string | null = null;

          if (isCurrentLegislative) {
            legislativeElectionId = String(cur?.id || electionId);
          } else {
            // Chercher une élection Législative dans le même département (prioritaire), sinon même commune
            let q = supabase
              .from('elections')
              .select('id, type, department_id, commune_id')
              .ilike('type', '%législ%')
              .order('election_date', { ascending: false })
              .limit(1);
            if (cur?.department_id) q = q.eq('department_id', cur.department_id);
            else if (cur?.commune_id) q = q.eq('commune_id', cur.commune_id);
            const { data: legis, error: legisErr } = await q;
            if (!legisErr && Array.isArray(legis) && legis.length > 0) {
              legislativeElectionId = String(legis[0].id);
            }
          }

          if (legislativeElectionId) {
            const { data: ecLeg, error: ecLegErr } = await supabase
              .from('election_centers')
              .select('center_id, voting_centers!inner(id, name)')
              .eq('election_id', legislativeElectionId);
            if (!ecLegErr && Array.isArray(ecLeg)) {
              const legList: CenterRow[] = ecLeg
                .map((row: any) => row.voting_centers)
                .filter((c: any) => c && c.id)
                .map((c: any) => ({ id: String(c.id), name: c.name }));
              setLegislativeElectionCenters(legList);
              setLegislativeElectionId(legislativeElectionId);
            } else {
              setLegislativeElectionCenters([]);
              setLegislativeElectionId(null);
            }
          } else {
            setLegislativeElectionCenters([]);
            setLegislativeElectionId(null);
          }
        } catch (_) {
          setLegislativeElectionCenters([]);
          setLegislativeElectionId(null);
        }
      } catch (_) {
        setCenters([]);
        setLocalElectionCenters([]);
        setLegislativeElectionCenters([]);
        setLocalElectionId(null);
        setLegislativeElectionId(null);
      }
    };
    loadCenters();
  }, [electionId]);

  // Charger candidats pour le périmètre (zone) courant afin d'afficher le parti au bon niveau
  useEffect(() => {
    const loadScopedCandidates = async () => {
      try {
        // Déterminer l'élection cible selon la zone
        // CORRECTION: Pour les élections législatives, toujours utiliser l'élection courante
        // même quand on sélectionne "commune" comme zone d'analyse
        const targetElectionId = zoneType === 'commune'
          ? (isLocalElection ? (localElectionId || null) : electionId)
          : zoneType === 'departement'
            ? (isLocalElection ? (legislativeElectionId || null) : electionId)
            : electionId;

        if (!targetElectionId) {
          setScopedCandidates([]);
          return;
        }

        const { data, error } = await supabase
          .from('election_candidates')
          .select('candidate_id, candidates!inner(id, name, party)')
          .eq('election_id', targetElectionId);
        if (error) {
          setScopedCandidates([]);
          return;
        }
        const list: CandidateRow[] = (data || [])
          .map((row: any) => row.candidates)
          .filter((c: any) => c && c.id)
          .map((c: any) => ({ id: String(c.id), name: c.name, party: c.party || undefined }));
        setScopedCandidates(list);
      } catch (_) {
        setScopedCandidates([]);
      }
    };
    loadScopedCandidates();
  }, [zoneType, localElectionId, legislativeElectionId]);

  // Charger candidats rattachés à l'élection (pour récupérer le parti), fallback global
  useEffect(() => {
    const loadCandidates = async () => {
      try {
        // 1) Candidats rattachés à l'élection
        const { data: ecData, error: ecError } = await supabase
          .from('election_candidates')
          .select('candidate_id, candidates!inner(id, name, party)')
          .eq('election_id', electionId);

        if (!ecError && Array.isArray(ecData) && ecData.length > 0) {
          const list: CandidateRow[] = ecData
            .map((row: any) => row.candidates)
            .filter((c: any) => c && c.id)
            .map((c: any) => ({ id: String(c.id), name: c.name, party: c.party || undefined }));
          setCandidates(list);
          return;
        }

        // 2) Fallback: tous les candidats
        const { data, error } = await supabase
          .from('candidates')
          .select('id, name, party')
          .order('name');
        if (error) throw error;
        const list: CandidateRow[] = (data || []).map((c: any) => ({ id: String(c.id), name: c.name, party: c.party || undefined }));
        setCandidates(list);
      } catch (_) {
        setCandidates([]);
      }
    };
    loadCandidates();
  }, [electionId]);

  // Auto-sélectionner 2 candidats par défaut en locale (une seule fois)
  useEffect(() => {
    if (!isLocalElection) return;
    if (userTouchedCandidates) return;
    if (hasAutoSelectedCandidates) return;
    if (selectedCandidateIds.length >= 2) { setHasAutoSelectedCandidates(true); return; }
    if (candidates.length >= 2) {
      setSelectedCandidateIds([String(candidates[0].id), String(candidates[1].id)]);
      setHasAutoSelectedCandidates(true);
    }
  }, [isLocalElection, candidates, selectedCandidateIds.length, hasAutoSelectedCandidates, userTouchedCandidates]);

  // Filtrer centres selon zone
  useEffect(() => {
    if (!zoneType) {
      setFilteredCenters([]);
      setSelectedCenterId('');
      return;
    }
    
    console.log('[Analyse croisée] Filtrage centres par zone:', { 
      zoneType, 
      localElectionCentersCount: localElectionCenters.length,
      legislativeElectionCentersCount: legislativeElectionCenters.length 
    });

    if (zoneType === 'commune') {
      // Commune: 10 centres issus d'une élection Locale
      if (localElectionCenters.length > 0) {
        setFilteredCenters(localElectionCenters.slice(0, 10));
      } else {
        console.log('[Analyse croisée] Aucun centre local disponible, utilisation des centres généraux');
        setFilteredCenters(centers.slice(0, 10));
      }
    } else {
      // Département: prendre 16 centres des Législatives moins les 10 des Locales → 6 restants
      if (legislativeElectionCenters.length > 0) {
        const localIds = new Set(localElectionCenters.map(c => c.id));
        const legFirst16 = legislativeElectionCenters.slice(0, 16);
        const remaining = legFirst16.filter(c => !localIds.has(c.id));
        // Si pas assez (moins de 6), fallback en complétant avec d'autres centres légis
        const final = remaining.length >= 6
          ? remaining.slice(0, 6)
          : [...remaining, ...legislativeElectionCenters.slice(16)].slice(0, 6);
        setFilteredCenters(final);
      } else {
        console.log('[Analyse croisée] Aucun centre législatif disponible, utilisation des centres généraux');
        setFilteredCenters(centers.slice(0, 6));
      }
    }
    setSelectedCenterId('');
  }, [zoneType, localElectionCenters, legislativeElectionCenters, centers]);

  // Charger bureaux du centre (en essayant de filtrer par election_id quand possible)
  useEffect(() => {
    const loadBureaux = async () => {
      if (!selectedCenterId) {
        setBureaux([]);
        setSelectedBureauId('');
        return;
      }
      try {
        setLoadingBureaux(true);
        // Déterminer l'élection liée à la sélection courante
        // CORRECTION: Pour les élections législatives, toujours utiliser l'élection courante
        // même quand on sélectionne "commune" comme zone d'analyse
        const selectionElectionId = zoneType === 'commune'
          ? (isLocalElection ? (localElectionId || electionId) : electionId)
          : (isLocalElection ? (legislativeElectionId || electionId) : electionId);

        console.log('[Analyse croisée] Chargement bureaux...', { 
          selectedCenterId, 
          selectedCenterName, 
          selectionElectionId, 
          zoneType,
          isMobile: window.innerWidth < 768,
          filteredCentersCount: filteredCenters.length,
          localElectionCentersCount: localElectionCenters.length,
          legislativeElectionCentersCount: legislativeElectionCenters.length,
          centersList: centers.map(c => ({ id: c.id, name: c.name })),
          filteredCentersList: filteredCenters.map(c => ({ id: c.id, name: c.name })),
          selectedCenterInFiltered: filteredCenters.find(c => c.id === selectedCenterId)
        });

        // Vérifier d'abord que le centre existe dans voting_centers
        const { data: centerCheck, error: centerCheckError } = await supabase
          .from('voting_centers')
          .select('id, name')
          .eq('id', selectedCenterId)
          .single();

        console.log('[Analyse croisée] Vérification centre:', { centerCheck, centerCheckError, selectedCenterId });

        if (centerCheckError || !centerCheck) {
          console.log('[Analyse croisée] Centre non trouvé dans voting_centers:', selectedCenterId);
          
          // Essayer de trouver le centre par nom si l'ID ne fonctionne pas
          if (selectedCenterName) {
            console.log('[Analyse croisée] Tentative de recherche du centre par nom:', selectedCenterName);
            const { data: centerByName, error: centerByNameError } = await supabase
              .from('voting_centers')
              .select('id, name')
              .ilike('name', `%${selectedCenterName}%`)
              .limit(1);
            
            console.log('[Analyse croisée] Centre trouvé par nom:', { centerByName, centerByNameError });
            
            if (centerByName && centerByName.length > 0) {
              console.log('[Analyse croisée] Utilisation du centre trouvé par nom:', centerByName[0]);
              // Mettre à jour l'ID du centre pour les recherches suivantes
              const foundCenterId = centerByName[0].id;
              // Recharger les bureaux avec le bon ID
              const { data: bureauData, error: bureauError } = await supabase
                .from('voting_bureaux')
                .select('id, name, center_id, voting_center_id')
                .or(`center_id.eq.${foundCenterId},voting_center_id.eq.${foundCenterId}`)
                .order('name');
              
              console.log('[Analyse croisée] Bureaux avec centre corrigé:', { bureauData, bureauError, foundCenterId });
              
              if (!bureauError && Array.isArray(bureauData) && bureauData.length > 0) {
                const list: BureauRow[] = bureauData.map((b: any) => ({ id: String(b.id), name: b.name }));
                setBureaux(list);
                console.log('[Analyse croisée] Bureaux trouvés avec centre corrigé:', list);
                return;
              }
            }
          }
          
          setBureaux([]);
          return;
        }

        // Requête simple et sûre: filtrer uniquement par center_id (UUID)
        const idStr = String(selectedCenterId).trim();
        
        // Essayer d'abord avec center_id
        let { data: bureauData, error: bureauError } = await supabase
          .from('voting_bureaux')
          .select('id, name, center_id')
          .eq('center_id', idStr)
          .order('name');
        
        console.log('[Analyse croisée] Requête initiale pour bureaux:', {
          idStr,
          bureauData: bureauData?.map(b => ({ id: b.id, name: b.name, center_id: b.center_id })),
          bureauError,
          count: bureauData?.length || 0
        });

        // Note: voting_center_id n'existe pas dans la table voting_bureaux, seul center_id est utilisé

        // Si toujours aucun résultat, essayer de chercher par nom de centre
        if ((!bureauData || bureauData.length === 0) && bureauError === null && selectedCenterName) {
          console.log('[Analyse croisée] Recherche par nom de centre dans voting_centers');
          const { data: centerData, error: centerError } = await supabase
            .from('voting_centers')
            .select('id, name')
            .ilike('name', `%${selectedCenterName}%`)
            .limit(1);
          
          console.log('[Analyse croisée] Résultat recherche par nom:', { centerData, centerError });
          
          if (centerData && centerData.length > 0) {
            const foundCenterId = centerData[0].id;
            console.log('[Analyse croisée] Centre trouvé par nom, recherche bureaux avec ID:', foundCenterId);
            const finalQuery = await supabase
              .from('voting_bureaux')
              .select('id, name, center_id')
              .eq('center_id', foundCenterId)
              .order('name');
            
            console.log('[Analyse croisée] Requête finale pour bureaux:', { 
              finalQuery,
              data: finalQuery.data,
              error: finalQuery.error,
              count: finalQuery.data?.length || 0
            });
            
            bureauData = finalQuery.data;
            bureauError = finalQuery.error;
          }
        }

        if (!bureauError && Array.isArray(bureauData) && bureauData.length > 0) {
          const list: BureauRow[] = bureauData.map((b: any) => ({ id: String(b.id), name: b.name }));
          setBureaux(list);
          console.log('[Analyse croisée] Bureaux trouvés:', list.length);
          return;
        }

        // Si aucun bureau trouvé, faire une requête de diagnostic
        console.log('[Analyse croisée] Aucun bureau trouvé pour le centre:', selectedCenterId, selectedCenterName);
        
        // Diagnostic: vérifier tous les bureaux disponibles
        try {
          console.log('[Analyse croisée] Test de connexion Supabase...');
          
          // Test 1: Requête simple sans filtre
          const { data: allBureaux, error: allBureauxError } = await supabase
            .from('voting_bureaux')
            .select('*')
            .limit(10);
          
          console.log('[Analyse croisée] Diagnostic - Premiers 10 bureaux:', {
            allBureaux: allBureaux?.map(b => ({ id: b.id, name: b.name, center_id: b.center_id })),
            allBureauxError,
            count: allBureaux?.length || 0,
            rawData: allBureaux
          });
          
          // Test 2: Requête avec filtre spécifique sur le centre sélectionné
          const { data: filteredBureaux, error: filteredError } = await supabase
            .from('voting_bureaux')
            .select('*')
            .eq('center_id', selectedCenterId)
            .limit(5);
          
          console.log('[Analyse croisée] Diagnostic - Bureaux filtrés par center_id:', {
            filteredBureaux: filteredBureaux?.map(b => ({ id: b.id, name: b.name, center_id: b.center_id })),
            filteredError,
            count: filteredBureaux?.length || 0,
            selectedCenterId,
            rawFilteredData: filteredBureaux
          });
          
          // Vérifier s'il y a des bureaux avec le même center_id mais format différent
          // Note: ilike avec UUID peut causer une erreur 404, utiliser eq à la place
          const { data: similarBureaux, error: similarError } = await supabase
            .from('voting_bureaux')
            .select('id, name, center_id')
            .eq('center_id', selectedCenterId)
            .limit(5);
          
          console.log('[Analyse croisée] Diagnostic - Bureaux avec center_id similaire:', {
            similarBureaux: similarBureaux?.map(b => ({ id: b.id, name: b.name, center_id: b.center_id })),
            similarError,
            count: similarBureaux?.length || 0
          });
          
          // Test 3: Vérifier la structure de la table avec une requête simple
          const { data: structureTest, error: structureError } = await supabase
            .from('voting_bureaux')
            .select('count(*)')
            .single();
          
          console.log('[Analyse croisée] Diagnostic - Nombre total de bureaux:', {
            structureTest,
            structureError,
            totalCount: structureTest?.count || 'Non disponible'
          });
        } catch (diagError) {
          console.log('[Analyse croisée] Erreur diagnostic:', diagError);
        }
        
        setBureaux([]);
      } catch (_) {
        setBureaux([]);
      } finally {
        setLoadingBureaux(false);
      }
    };
    loadBureaux();
  }, [selectedCenterId, selectedCenterName, zoneType, localElectionId, legislativeElectionId, electionId]);

  // Charger résultats candidats selon le périmètre: bureau > centre > zone (Commune/Dept)
  useEffect(() => {
    const loadScopeCandidateRows = async () => {
      if (!electionId) {
        setBureauCandidateRows([]);
        return;
      }
      try {
        setLoading(true);
        // CORRECTION: Pour les élections législatives, toujours utiliser l'élection courante
        // même quand on sélectionne "commune" comme zone d'analyse
        const targetElectionId = zoneType === 'commune'
          ? (isLocalElection ? (localElectionId || electionId) : electionId)
          : (isLocalElection ? (legislativeElectionId || electionId) : electionId);
        
        console.log('[Analyse croisée] Élection cible pour candidats:', {
          zoneType,
          isLocalElection,
          electionId,
          localElectionId,
          legislativeElectionId,
          targetElectionId
        });

        // Base query
        let query = supabase
          .from('bureau_candidate_results_summary')
          .select('election_id, bureau_id, center_id, candidate_id, candidate_name, candidate_votes, candidate_percentage, candidate_participation_pct')
          .eq('election_id', targetElectionId);

        if (selectedBureauId) {
          // Niveau bureau
          query = query.eq('bureau_id', selectedBureauId as any);
          const { data, error } = await query.order('candidate_votes', { ascending: false });
          if (!error && Array.isArray(data)) {
            setBureauCandidateRows(data as BureauCandidateSummaryRow[]);
          } else {
            setBureauCandidateRows([]);
          }
          return;
        }

        if (selectedCenterId) {
          // Niveau centre
          const { data, error } = await query
            .eq('center_id', selectedCenterId as any)
          .order('candidate_votes', { ascending: false });
          if (!error && Array.isArray(data)) {
            // agrégation par candidat
            const byCand = new Map<string, { candidate_id: string; candidate_name: string; candidate_votes: number }>();
            for (const row of data as any[]) {
              const id = String(row.candidate_id);
              const prev = byCand.get(id) || { candidate_id: id, candidate_name: row.candidate_name, candidate_votes: 0 };
              prev.candidate_votes += Number(row.candidate_votes) || 0;
              prev.candidate_name = row.candidate_name;
              byCand.set(id, prev);
            }
            const aggregated = Array.from(byCand.values());
            const totalVotes = aggregated.reduce((s, r) => s + r.candidate_votes, 0) || 0;
            const rows: BureauCandidateSummaryRow[] = aggregated
              .map(r => ({
                election_id: targetElectionId,
                bureau_id: '',
                center_id: selectedCenterId,
                candidate_id: r.candidate_id,
                candidate_name: r.candidate_name,
                candidate_votes: r.candidate_votes,
                candidate_percentage: totalVotes > 0 ? (100 * r.candidate_votes) / totalVotes : 0,
                candidate_participation_pct: undefined,
              }))
              .sort((a, b) => (b.candidate_votes - a.candidate_votes));
            setBureauCandidateRows(rows);
          } else {
            setBureauCandidateRows([]);
          }
          return;
        }

        // Niveau zone (Commune/Departement)
        let centerIds: string[] = [];
        if (zoneType === 'commune') {
          centerIds = (localElectionCenters || []).map(c => String(c.id));
        } else if (zoneType === 'departement') {
          centerIds = (legislativeElectionCenters || []).map(c => String(c.id));
        }

        let data: any[] | null = null;
        let error: any = null;
        if (centerIds.length > 0) {
          const res = await query.in('center_id', centerIds).order('candidate_votes', { ascending: false });
          data = res.data as any[] | null;
          error = res.error;
        } else {
          const res = await query.order('candidate_votes', { ascending: false });
          data = res.data as any[] | null;
          error = res.error;
        }

        if (!error && Array.isArray(data)) {
          const byCand = new Map<string, { candidate_id: string; candidate_name: string; candidate_votes: number }>();
          for (const row of data) {
            const id = String(row.candidate_id);
            const prev = byCand.get(id) || { candidate_id: id, candidate_name: row.candidate_name, candidate_votes: 0 };
            prev.candidate_votes += Number(row.candidate_votes) || 0;
            prev.candidate_name = row.candidate_name;
            byCand.set(id, prev);
          }
          const aggregated = Array.from(byCand.values());
          const totalVotes = aggregated.reduce((s, r) => s + r.candidate_votes, 0) || 0;
          const rows: BureauCandidateSummaryRow[] = aggregated
            .map(r => ({
              election_id: targetElectionId,
              bureau_id: '',
              center_id: '',
              candidate_id: r.candidate_id,
              candidate_name: r.candidate_name,
              candidate_votes: r.candidate_votes,
              candidate_percentage: totalVotes > 0 ? (100 * r.candidate_votes) / totalVotes : 0,
              candidate_participation_pct: undefined,
            }))
            .sort((a, b) => (b.candidate_votes - a.candidate_votes));
          setBureauCandidateRows(rows);
        } else {
          setBureauCandidateRows([]);
        }
      } catch (err) {
        console.log('[Analyse croisée] Erreur chargement périmètre:', err);
        setBureauCandidateRows([]);
      } finally {
        setLoading(false);
      }
    };
    // Charger quand zone/centre/bureau ou listes de centres changent
    loadScopeCandidateRows();
  }, [electionId, zoneType, localElectionId, legislativeElectionId, selectedCenterId, selectedBureauId, localElectionCenters, legislativeElectionCenters]);

  const candidateIdToParty = useMemo(() => {
    const map = new Map<string, string | undefined>();
    const source = (scopedCandidates && scopedCandidates.length > 0) ? scopedCandidates : candidates;
    source.forEach(c => map.set(c.id, c.party));
    return map;
  }, [candidates, scopedCandidates]);

  const displayedRows = useMemo(() => {
    if (selectedCandidateIds.length < 2) return [] as BureauCandidateSummaryRow[];
    // En législatives: exiger que la zone soit choisie avant d'afficher
    if (!isLocalElection && !zoneType) return [] as BureauCandidateSummaryRow[];
    const setIds = new Set(selectedCandidateIds);
    return bureauCandidateRows.filter(row => setIds.has(String(row.candidate_id)));
  }, [bureauCandidateRows, selectedCandidateIds, isLocalElection, zoneType]);

  // Préserver la sélection de candidats lors des changements de périmètre
  useEffect(() => {
    if (!Array.isArray(bureauCandidateRows)) return;
    const availableIds = new Set(bureauCandidateRows.map(r => String(r.candidate_id)));
    const intersection = selectedCandidateIds.filter(id => availableIds.has(id));
    // Si l'utilisateur a choisi manuellement, ne pas écraser sa sélection sauf si elle devient vide
    if (userTouchedCandidates && intersection.length >= Math.min(2, selectedCandidateIds.length)) return;
    // Si certains candidats ne sont plus dans le périmètre, garder ceux qui restent et compléter avec les premiers candidats disponibles
    const next: string[] = [...intersection];
    if (next.length < 2) {
      for (const r of bureauCandidateRows) {
        const id = String(r.candidate_id);
        if (!next.includes(id)) next.push(id);
        if (next.length >= 2) break;
      }
    }
    // Ne pas boucler si aucune amélioration possible
    if (next.length && next.join(',') !== selectedCandidateIds.join(',')) {
      setSelectedCandidateIds(next);
    }
  }, [bureauCandidateRows, userTouchedCandidates, selectedCandidateIds]);

  return (
    <section id="cross-analysis" className="py-6 sm:py-8 lg:py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="gov-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-gov-gray">Analyse croisée</CardTitle>
              {(zoneType || selectedCenterId || selectedBureauId || selectedCandidateIds.length > 0 || bureauCandidateRows.length > 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Si élection locale, forcer la zone à "commune" pour réactiver les champs
                  const resetZone: ZoneType | '' = isLocalElection ? 'commune' : '';
                  setZoneType(resetZone);
                  setZoneKey('');
                  // Recalcule immédiat des centres pour éviter l'état inactif
                  if (isLocalElection) {
                    const list = (localElectionCenters && localElectionCenters.length > 0)
                      ? localElectionCenters.slice(0, 10)
                      : centers.slice(0, 10);
                    setFilteredCenters(list);
                  } else {
                  setFilteredCenters([]);
                  }
                  setSelectedCenterId('');
                  setSelectedCenterName('');
                  setBureaux([]);
                  setSelectedBureauId('');
                  setSelectedCandidateIds([]);
                  setBureauCandidateRows([]);
                }}
              >
                Réinitialiser
              </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2 order-2">
                <Label>Zone</Label>
                <Select value={zoneType} onValueChange={(v) => { setZoneType(v as ZoneType); /* ne pas toucher aux candidats ici */ setZoneKey(''); }} disabled={isLocalElection}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={isLocalElection ? 'Commune' : 'Sélectionner une zone'} />
                  </SelectTrigger>
                  <SelectContent className="z-[100]" position="popper">
                    {isLocalElection ? (
                      <SelectItem value="commune">Commune</SelectItem>
                    ) : (
                      <>
                    <SelectItem value="departement">Département</SelectItem>
                    <SelectItem value="commune">Commune</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                {!isLocalElection && !zoneType && (
                  <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1">
                    Sélectionnez une zone pour afficher les résultats
                  </div>
                )}
              </div>

              <div className="space-y-2 order-3">
                <Label>{zoneType ? `Centre (${zoneType === 'departement' ? '6 max' : '10 max'})` : 'Centre'}</Label>
                <Select value={selectedCenterId} onValueChange={(v) => { const vv = String(v || '').trim(); setSelectedCenterId(vv); const foundName = filteredCenters.find(c => c.id === vv)?.name || ''; setSelectedCenterName((foundName || '').trim()); setSelectedBureauId(''); /* ne pas réinitialiser selectedCandidateIds */ }} disabled={!zoneType || filteredCenters.length === 0}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={zoneType ? 'Sélectionner un centre' : 'Choisir la zone d\'abord'} />
                  </SelectTrigger>
                  <SelectContent className="z-[100]" position="popper">
                    {filteredCenters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 order-4">
                <Label>Bureau</Label>
                <Select value={selectedBureauId} onValueChange={(v) => { const vv = String(v || ''); setSelectedBureauId(vv); /* ne pas réinitialiser selectedCandidateIds */ }} disabled={!selectedCenterId || bureaux.length === 0 || loadingBureaux}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={
                      loadingBureaux ? 'Chargement...' :
                      !selectedCenterId ? 'Choisir un centre' : 
                      (bureaux.length ? 'Sélectionner un bureau' : 'Aucun bureau trouvé')
                    } />
                  </SelectTrigger>
                  <SelectContent className="z-[100]" position="popper">
                    {bureaux.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loadingBureaux && (
                  <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                    Chargement des bureaux...
                  </div>
                )}
                {!loadingBureaux && selectedCenterId && bureaux.length === 0 && (
                  <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1">
                    Aucun bureau trouvé pour ce centre
                  </div>
                )}
              </div>

              <div className="space-y-2 order-1">
                <Label>Candidats (min. 2)</Label>
                <div className="max-h-40 overflow-auto rounded border border-gray-200 p-2 bg-white min-h-[120px]">
                  {loading && <div className="text-sm text-gray-500 px-1 py-0.5">Chargement…</div>}
                  {!loading && bureauCandidateRows.length === 0 && (
                    <div className="text-sm text-gray-500 px-1 py-0.5">Aucun candidat pour ce périmètre</div>
                  )}
                  {!loading && bureauCandidateRows.map(row => {
                    const id = String(row.candidate_id);
                    const checked = selectedCandidateIds.includes(id);
                    return (
                      <label key={id} className="flex items-center gap-2 py-2 cursor-pointer hover:bg-gray-50 rounded px-1 transition-colors">
                        <Checkbox checked={checked} onCheckedChange={(v) => {
                          setUserTouchedCandidates(true);
                          const isChecked = Boolean(v);
                          setSelectedCandidateIds(prev => (
                            isChecked
                              ? Array.from(new Set([...prev, id]))
                              : prev.filter(x => x !== id)
                          ));
                        }} />
                        <span className="text-sm text-gray-800 flex-1">{row.candidate_name}</span>
                      </label>
                    );
                  })}
                </div>
                {selectedCandidateIds.length < 2 && (
                  <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1 mt-2">Veuillez sélectionner au moins 2 candidats</div>
                )}
              </div>
            </div>

            {/* Tableau comparatif */}
            <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm sm:text-base">Comparatif des résultats</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedCandidateIds.length < 2 ? (
                    <div className="text-sm text-gray-500">Sélectionnez au moins 2 candidats pour afficher le comparatif.</div>
                  ) : (
                    <div className="space-y-4">
                      {/* Version mobile - cartes */}
                      <div className="block sm:hidden">
                        {displayedRows.map((row) => {
                          const party = candidateIdToParty.get(String(row.candidate_id));
                          const scorePct = typeof row.candidate_percentage === 'number' ? Math.min(Math.max(row.candidate_percentage, 0), 100) : undefined;
                          return (
                            <div key={String(row.candidate_id)} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                              <h3 className="font-semibold text-gray-800 text-sm mb-2">{row.candidate_name}</h3>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                  <span className="text-gray-500">Parti:</span>
                                  <p className="font-medium text-gray-700">{party || '-'}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Score:</span>
                                  <p className="font-medium text-gray-700">
                                    {typeof scorePct === 'number' ? `${scorePct.toFixed(2)}%` : '-'}
                                  </p>
                                </div>
                                <div className="col-span-2">
                                  <span className="text-gray-500">Voix:</span>
                                  <p className="font-bold text-lg text-gray-800">{(row.candidate_votes ?? 0).toLocaleString()}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Version desktop - tableau */}
                      <div className="hidden sm:block relative overflow-x-auto">
                        <table className="min-w-full text-xs sm:text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="text-left px-3 py-2 border">Candidat</th>
                              <th className="text-left px-3 py-2 border">Parti</th>
                              <th className="text-right px-3 py-2 border">Voix</th>
                              <th className="text-right px-3 py-2 border">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayedRows.map((row) => {
                              const party = candidateIdToParty.get(String(row.candidate_id));
                              const scorePct = typeof row.candidate_percentage === 'number' ? Math.min(Math.max(row.candidate_percentage, 0), 100) : undefined;
                              return (
                                <tr key={String(row.candidate_id)} className="odd:bg-white even:bg-gray-50">
                                  <td className="px-3 py-2 border font-medium text-gray-800">{row.candidate_name}</td>
                                  <td className="px-3 py-2 border text-gray-700">{party || '-'}</td>
                                  <td className="px-3 py-2 border text-right font-semibold">{(row.candidate_votes ?? 0).toLocaleString()}</td>
                                  <td className="px-3 py-2 border text-right">
                                    {typeof scorePct === 'number' ? `${scorePct.toFixed(2)}%` : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default CrossAnalysisSection;


