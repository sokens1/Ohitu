/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Debug pour voir les variables d'environnement
console.log('🔍 Debug Supabase:')
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('VITE_SUPABASE_ANON_KEY length:', import.meta.env.VITE_SUPABASE_ANON_KEY?.length)
console.log('VITE_SUPABASE_ANON_KEY starts with eyJ:', import.meta.env.VITE_SUPABASE_ANON_KEY?.startsWith('eyJ'))
console.log('supabaseUrl final:', supabaseUrl)
console.log('supabaseAnonKey final length:', supabaseAnonKey?.length)

// Validation des variables
if (!supabaseUrl) {
  throw new Error('❌ SUPABASE_URL is required')
}
if (!supabaseAnonKey) {
  throw new Error('❌ SUPABASE_ANON_KEY is required')
}
if (!supabaseAnonKey.startsWith('eyJ')) {
  throw new Error('❌ SUPABASE_ANON_KEY format is invalid')
}

// Debug final avant création du client
console.log('🚀 Création du client Supabase...')
console.log('URL:', supabaseUrl)
console.log('Key (premiers 20 chars):', supabaseAnonKey.substring(0, 20) + '...')
console.log('Key (derniers 20 chars):', '...' + supabaseAnonKey.substring(supabaseAnonKey.length - 20))

// Créer le client avec une syntaxe plus explicite
let supabaseClient
try {
  supabaseClient = createClient(
    supabaseUrl as string,
    supabaseAnonKey as string,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }
  )
  // console.log('✅ Client Supabase créé avec succès!')
} catch (error) {
  console.error('❌ Erreur lors de la création du client Supabase:', error)
  throw error
}

export const supabase = supabaseClient

// Client avec service role pour les opérations admin (uniquement côté serveur)
// Note: Le service role key ne doit jamais être exposé côté client
export const supabaseAdmin = supabase // Utiliser le même client pour l'instant

// Types pour la base de données
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          role: 'super-admin' | 'agent-saisie' | 'validateur' | 'observateur'
          assigned_center_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          role: 'super-admin' | 'agent-saisie' | 'validateur' | 'observateur'
          assigned_center_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: 'super-admin' | 'agent-saisie' | 'validateur' | 'observateur'
          assigned_center_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      elections: {
        Row: {
          id: string
          title: string
          type: 'Législatives' | 'Locales'
          election_date: string
          status: 'À venir' | 'En cours' | 'Terminée'
          description: string | null
          seats_available: number
          budget: number
          vote_goal: number
          province_id: string | null
          department_id: string | null
          commune_id: string | null
          arrondissement_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          type: 'Législatives' | 'Locales'
          election_date: string
          status?: 'À venir' | 'En cours' | 'Terminée'
          description?: string | null
          seats_available?: number
          budget?: number
          vote_goal?: number
          province_id?: string | null
          department_id?: string | null
          commune_id?: string | null
          arrondissement_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          type?: 'Législatives' | 'Locales'
          election_date?: string
          status?: 'À venir' | 'En cours' | 'Terminée'
          description?: string | null
          seats_available?: number
          budget?: number
          vote_goal?: number
          province_id?: string | null
          department_id?: string | null
          commune_id?: string | null
          arrondissement_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      voting_centers: {
        Row: {
          id: string
          name: string
          address: string
          coordinates: any | null
          photo_url: string | null
          province_id: string | null
          department_id: string | null
          commune_id: string | null
          arrondissement_id: string | null
          contact_name: string
          contact_phone: string | null
          contact_email: string | null
          total_voters: number
          total_bureaux: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address: string
          coordinates?: any | null
          photo_url?: string | null
          province_id?: string | null
          department_id?: string | null
          commune_id?: string | null
          arrondissement_id?: string | null
          contact_name: string
          contact_phone?: string | null
          contact_email?: string | null
          total_voters?: number
          total_bureaux?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string
          coordinates?: any | null
          photo_url?: string | null
          province_id?: string | null
          department_id?: string | null
          commune_id?: string | null
          arrondissement_id?: string | null
          contact_name?: string
          contact_phone?: string | null
          contact_email?: string | null
          total_voters?: number
          total_bureaux?: number
          created_at?: string
          updated_at?: string
        }
      }
      voting_bureaux: {
        Row: {
          id: string
          name: string
          center_id: string
          registered_voters: number
          urns_count: number
          president_name: string | null
          president_phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          center_id: string
          registered_voters?: number
          urns_count?: number
          president_name?: string | null
          president_phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          center_id?: string
          registered_voters?: number
          urns_count?: number
          president_name?: string | null
          president_phone?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      candidates: {
        Row: {
          id: string
          name: string
          party: string
          photo_url: string | null
          is_our_candidate: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          party: string
          photo_url?: string | null
          is_our_candidate?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          party?: string
          photo_url?: string | null
          is_our_candidate?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      voters: {
        Row: {
          id: string
          first_name: string
          last_name: string
          phone: string | null
          quartier: string | null
          center_id: string | null
          bureau_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          phone?: string | null
          quartier?: string | null
          center_id?: string | null
          bureau_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          phone?: string | null
          quartier?: string | null
          center_id?: string | null
          bureau_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      procès_verbaux: {
        Row: {
          id: string
          election_id: string
          bureau_id: string
          total_registered: number
          total_voters: number
          blank_votes: number
          null_votes: number
          votes_expressed: number
          status: 'pending' | 'entered' | 'validated' | 'anomaly' | 'published'
          entered_by: string | null
          validated_by: string | null
          anomaly_description: string | null
          pv_photo_url: string | null
          signature_photo_url: string | null
          entered_at: string | null
          validated_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          election_id: string
          bureau_id: string
          total_registered?: number
          total_voters?: number
          blank_votes?: number
          null_votes?: number
          votes_expressed?: number
          status?: 'pending' | 'entered' | 'validated' | 'anomaly' | 'published'
          entered_by?: string | null
          validated_by?: string | null
          anomaly_description?: string | null
          pv_photo_url?: string | null
          signature_photo_url?: string | null
          entered_at?: string | null
          validated_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          election_id?: string
          bureau_id?: string
          total_registered?: number
          total_voters?: number
          blank_votes?: number
          null_votes?: number
          votes_expressed?: number
          status?: 'pending' | 'entered' | 'validated' | 'anomaly' | 'published'
          entered_by?: string | null
          validated_by?: string | null
          anomaly_description?: string | null
          pv_photo_url?: string | null
          signature_photo_url?: string | null
          entered_at?: string | null
          validated_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      candidate_results: {
        Row: {
          id: string
          pv_id: string
          candidate_id: string
          votes: number
          created_at: string
        }
        Insert: {
          id?: string
          pv_id: string
          candidate_id: string
          votes?: number
          created_at?: string
        }
        Update: {
          id?: string
          pv_id?: string
          candidate_id?: string
          votes?: number
          created_at?: string
        }
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          details: any | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          details?: any | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          details?: any | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: 'info' | 'warning' | 'error' | 'success'
          is_read: boolean
          data: any | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type?: 'info' | 'warning' | 'error' | 'success'
          is_read?: boolean
          data?: any | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          type?: 'info' | 'warning' | 'error' | 'success'
          is_read?: boolean
          data?: any | null
          created_at?: string
        }
      }
    }
    Views: {
      dashboard_stats: {
        Row: {
          elections_en_cours: number
          elections_a_venir: number
          total_voters: number
          total_centers: number
          pv_en_attente: number
          notifications_non_lues: number
        }
      }
      election_results_summary: {
        Row: {
          election_id: string
          election_title: string
          candidate_id: string
          candidate_name: string
          candidate_party: string
          is_our_candidate: boolean
          total_votes: number
          pv_count: number
        }
      }
    }
    Functions: {
      get_election_stats: {
        Args: {
          election_uuid: string
        }
        Returns: {
          total_centers: number
          total_bureaux: number
          total_voters: number
          pv_entered: number
          pv_validated: number
          pv_anomalies: number
        }
      }
      get_candidate_results: {
        Args: {
          election_uuid: string
          candidate_uuid: string
        }
        Returns: {
          candidate_name: string
          total_votes: number
          percentage: number
        }
      }
    }
  }
}

// Types utilitaires
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row']
