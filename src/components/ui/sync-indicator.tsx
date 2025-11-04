import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { electionSyncService } from '@/services/electionSyncService';

interface SyncIndicatorProps {
  className?: string;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({ className = '' }) => {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [serviceStatus, setServiceStatus] = useState(electionSyncService.getStatus());

  useEffect(() => {
    // Vérifier le statut du service toutes les 5 secondes
    const interval = setInterval(() => {
      setServiceStatus(electionSyncService.getStatus());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setStatus('syncing');
    try {
      await electionSyncService.syncAllElections();
      setStatus('success');
      setLastSync(new Date());
      setTimeout(() => setStatus('idle'), 2000);
    } catch (error) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'syncing':
        return <RefreshCw className="w-3 h-3 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'syncing':
        return 'Synchronisation...';
      case 'success':
        return 'Synchronisé';
      case 'error':
        return 'Erreur';
      default:
        return serviceStatus.isRunning ? 'Auto-sync actif' : 'Synchronisation manuelle';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'syncing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return serviceStatus.isRunning 
          ? 'bg-green-100 text-green-800 border-green-200'
          : 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge 
        variant="outline" 
        className={`flex items-center gap-1 text-xs ${getStatusColor()}`}
      >
        {getStatusIcon()}
        {getStatusText()}
      </Badge>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleManualSync}
        disabled={status === 'syncing'}
        className="h-6 px-2 text-xs"
      >
        <RefreshCw className={`w-3 h-3 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      </Button>

      {lastSync && (
        <span className="text-xs text-gray-500">
          Dernière sync: {lastSync.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};

export default SyncIndicator;

