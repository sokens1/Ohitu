/// <reference types="node" />
import { createClient } from '@supabase/supabase-js';

type VercelRequest  = any;
type VercelResponse = any;

const SUPABASE_URL              = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Méthode uniquement POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Service role key obligatoire
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurée sur le serveur.' });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Vérifier que le demandeur est authentifié et autorisé ──────────────────
  const authHeader = req.headers['authorization'] as string | undefined;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user: caller }, error: verifyErr } = await supabaseAdmin.auth.getUser(token);

  if (verifyErr || !caller) {
    return res.status(401).json({ error: 'Token invalide' });
  }

  const { data: callerData } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', caller.id)
    .single();

  if (!callerData || !['super-admin', 'admin'].includes(callerData.role)) {
    return res.status(403).json({ error: 'Accès interdit' });
  }

  // ── Validation des champs ──────────────────────────────────────────────────
  const {
    name, email, password, role, is_active,
    phone,
    assigned_election_id, assigned_election_ids, created_by,
    assigned_center_ids, assigned_center_bureaux, assigned_center_colleges,
  } = req.body || {};

  console.log('[create-user] body reçu:', { name, email: email ? '[fourni]' : '[vide]', phone: phone ? '[fourni]' : '[vide]', role });

  const emailTrimmed = typeof email === 'string' ? email.trim() : '';
  const phoneTrimmed = typeof phone === 'string' ? phone.trim() : '';

  if (!name || !password || !role) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (name, password, role)' });
  }
  if (!emailTrimmed && !phoneTrimmed) {
    return res.status(400).json({ error: 'Au moins un identifiant est requis : email ou numéro de téléphone' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  // L'admin ne peut créer que des rôles opérationnels
  const OPERATIONAL_ROLES = [
    'validateur', 'agent-saisie', 'observateur', 'president-bureau',
    'president-etablissement', 'employeur', 'suppleant-president',
  ];
  if (callerData.role === 'admin' && !OPERATIONAL_ROLES.includes(role)) {
    return res.status(403).json({ error: 'Un admin ne peut créer que des rôles opérationnels' });
  }

  // ── Résolution de l'email pour Supabase Auth (obligatoire côté Auth) ────────
  // Si aucun email fourni, on génère un email interne basé sur le téléphone
  const normalizedPhone = phoneTrimmed.replace(/[^0-9]/g, '');
  const authEmail: string = emailTrimmed || `tel${normalizedPhone}@noreply.ohitu.ga`;

  // ── Création du compte Auth ────────────────────────────────────────────────
  let authUserId: string;
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
  });

  if (authErr) {
    console.error('[create-user] Auth error:', authErr.message, '| authEmail used:', authEmail);
    // Compte déjà existant : récupérer son ID
    if (authErr.message?.includes('already been registered') || authErr.message?.includes('already exists')) {
      const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
      if (listErr) return res.status(400).json({ error: `Impossible de récupérer l'utilisateur : ${listErr.message}` });
      const existing = listData.users.find((u: any) => u.email?.toLowerCase() === authEmail.toLowerCase());
      if (!existing) return res.status(400).json({ error: 'Compte Auth introuvable.' });
      authUserId = existing.id;
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        email_confirm: true,
        ...(password ? { password } : {}),
      });
    } else {
      return res.status(400).json({ error: `Erreur Auth : ${authErr.message}` });
    }
  } else {
    if (!authData.user) return res.status(500).json({ error: 'Utilisateur Auth non retourné.' });
    authUserId = authData.user.id;
  }

  // ── Upsert dans la table users ─────────────────────────────────────────────
  const { data: userData, error: userErr } = await supabaseAdmin
    .from('users')
    .upsert({
      id: authUserId,
      name: name.trim(),
      email: emailTrimmed || null,
      phone: phoneTrimmed || null,
      role,
      is_active: is_active ?? true,
      assigned_election_id: assigned_election_id || null,
      assigned_election_ids: Array.isArray(assigned_election_ids) && assigned_election_ids.length > 0 ? assigned_election_ids : null,
      created_by: created_by || null,
      assigned_center_ids: assigned_center_ids || null,
      assigned_center_bureaux: assigned_center_bureaux || null,
      assigned_center_colleges: assigned_center_colleges || null,
    }, { onConflict: 'id' })
    .select()
    .single();

  if (userErr) {
    console.error('[create-user] DB error:', userErr.message);
    if (!authErr) await supabaseAdmin.auth.admin.deleteUser(authUserId);
    if (userErr.message?.includes('not-null') && userErr.message?.includes('email')) {
      return res.status(400).json({ error: 'Migration requise : exécutez 20260605_users_email_nullable.sql dans Supabase pour autoriser les comptes sans email.' });
    }
    return res.status(400).json({ error: `Erreur base de données : ${userErr.message}` });
  }

  return res.status(200).json({ user: userData });
}
