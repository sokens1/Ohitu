/// <reference types="node" />
import { createClient } from '@supabase/supabase-js';

type VercelRequest  = any;
type VercelResponse = any;

const SUPABASE_URL              = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurée.' });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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

  const { userId } = req.body || {};
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId manquant' });
  }

  const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteErr) {
    return res.status(400).json({ error: `Erreur Auth : ${deleteErr.message}` });
  }

  return res.status(200).json({ success: true });
}
