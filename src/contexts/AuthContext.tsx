
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import auditService from '@/services/auditService';

export type UserRole = 'super-admin' | 'agent-saisie' | 'validateur' | 'observateur';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  authLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          if (userData) {
            const u: User = {
              id: userData.id,
              name: userData.name,
              email: userData.email,
              role: userData.role,
              isActive: userData.is_active
            };
            setUser(u);
            localStorage.setItem('ohitu-user', JSON.stringify(u));
          }
        } else {
          const savedUser = localStorage.getItem('ohitu-user');
          if (savedUser) setUser(JSON.parse(savedUser));
        }
      } finally {
        setAuthLoading(false);
      }
    };
    init();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // Authentification Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.error('Erreur d\'authentification:', authError);
        return false;
      }

      if (authData.user) {
        // Récupérer les données utilisateur depuis notre table users
        // Utiliser l'ID de l'utilisateur authentifié
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (userError) {
          console.error('Erreur récupération utilisateur:', userError);
          // Si l'utilisateur n'existe pas dans notre table, créer un utilisateur par défaut
          const defaultUser: User = {
            id: authData.user.id,
            name: authData.user.email?.split('@')[0] || 'Utilisateur',
            email: authData.user.email || '',
            role: 'observateur',
            isActive: true
          };
          setUser(defaultUser);
          localStorage.setItem('ohitu-user', JSON.stringify(defaultUser));
          return true;
        }

        const user: User = {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          isActive: userData.is_active
        };

        setUser(user);
        localStorage.setItem('ohitu-user', JSON.stringify(user));
        
        // Enregistrer la connexion dans l'audit
        await auditService.log({
          action: 'LOGIN',
          resource_type: 'user',
          resource_id: user.id,
          description: `Connexion de ${user.name} (${user.email})`,
          user_id: user.id,
        });
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Erreur de connexion:', error);
      return false;
    }
  };

  const logout = async () => {
    // Enregistrer la déconnexion dans l'audit avant de supprimer l'utilisateur
    if (user) {
      await auditService.log({
        action: 'LOGOUT',
        resource_type: 'user',
        resource_id: user.id,
        description: `Déconnexion de ${user.name} (${user.email})`,
        user_id: user.id,
      });
    }
    
    setUser(null);
    localStorage.removeItem('ohitu-user');
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        login, 
        logout, 
        isAuthenticated: !!user,
        authLoading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
