/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';

export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
export type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'unknown' | 'none';

export interface NetworkState {
  isOnline: boolean;
  quality: NetworkQuality;
  type: ConnectionType;
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
  downlink?: number; // Vitesse estimée en Mb/s
  rtt?: number; // Latence estimée en ms
}

export const useNetworkQuality = () => {
  const [network, setNetwork] = useState<NetworkState>({
    isOnline: navigator.onLine,
    quality: navigator.onLine ? 'excellent' : 'offline',
    type: 'unknown',
  });

  useEffect(() => {
    const getConnectionInfo = (): NetworkState => {
      const isOnline = navigator.onLine;
      if (!isOnline) {
        return { isOnline: false, quality: 'offline', type: 'none' };
      }

      // Accès à l'API Network Information standard
      const conn = (navigator as any).connection || 
                   (navigator as any).mozConnection || 
                   (navigator as any).webkitConnection;

      let type: ConnectionType = 'unknown';
      let quality: NetworkQuality = 'excellent';
      let downlink = 10;
      let rtt = 50;

      if (conn) {
        type = conn.type || 'unknown';
        downlink = conn.downlink || 10;
        rtt = conn.rtt || 50;

        // Évaluation initiale
        if (rtt > 1200 || downlink < 0.15) {
          quality = 'poor';
        } else if (rtt > 400 || downlink < 1.5) {
          quality = 'fair';
        } else if (rtt > 150 || downlink < 5) {
          quality = 'good';
        } else {
          quality = 'excellent';
        }
      }

      return {
        isOnline,
        quality,
        type,
        effectiveType: conn?.effectiveType,
        downlink,
        rtt
      };
    };

    // Effectue un ping léger pour mesurer activement la latence réelle
    const performActivePing = async () => {
      if (!navigator.onLine) return;
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        // Requête HEAD cache-busted ultra-légère vers le favicon du site
        const response = await fetch('/favicon.ico?cb=' + Date.now(), {
          method: 'HEAD',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const rttMs = Date.now() - start;
          
          setNetwork(prev => {
            if (!prev.isOnline) return prev;
            
            let quality: NetworkQuality = 'excellent';
            const currentDownlink = prev.downlink || 10;
            
            // Évaluation de la qualité en combinant la latence réelle mesurée et le débit du navigateur
            if (rttMs > 1200 || currentDownlink < 0.15) {
              quality = 'poor';
            } else if (rttMs > 400 || currentDownlink < 1.5) {
              quality = 'fair';
            } else if (rttMs > 150 || currentDownlink < 5) {
              quality = 'good';
            } else {
              quality = 'excellent';
            }
            
            return {
              ...prev,
              rtt: rttMs,
              quality
            };
          });
        }
      } catch (e) {
        // En cas d'échec de fetch (connexion coupée transitoire), on bascule en qualité réduite
        setNetwork(prev => {
          if (!prev.isOnline) return prev;
          return {
            ...prev,
            quality: 'poor',
            rtt: 2000
          };
        });
      }
    };

    const handleStatusChange = () => {
      const info = getConnectionInfo();
      setNetwork(info);
      if (info.isOnline) {
        performActivePing();
      }
    };

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    const conn = (navigator as any).connection;
    if (conn) {
      conn.addEventListener('change', handleStatusChange);
    }

    // Premier chargement et exécution du ping
    handleStatusChange();
    
    // Déclencher un ping actif toutes les 15 secondes pour rafraîchir en temps réel
    const pingInterval = setInterval(performActivePing, 15000);

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      if (conn) {
        conn.removeEventListener('change', handleStatusChange);
      }
      clearInterval(pingInterval);
    };
  }, []);

  return network;
};
