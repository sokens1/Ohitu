import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import type { Plugin, ViteDevServer } from "vite";

// ── Plugin Vite : émule /api/admin/create-user en local ─────────────────────
// En production ce chemin est géré par la Vercel serverless function.
// En dev (npm run dev), ce middleware prend le relais pour éviter le 404.
function adminApiPlugin(): Plugin {
  return {
    name: "admin-api-dev",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        "/api/admin/create-user",
        async (req: any, res: any) => {
          res.setHeader("Content-Type", "application/json");

          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Method not allowed" }));
            return;
          }

          const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
          const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
          const ANON_KEY     = process.env.VITE_SUPABASE_ANON_KEY ?? "";

          if (!SERVICE_KEY) {
            res.statusCode = 500;
            res.end(JSON.stringify({
              error: "SUPABASE_SERVICE_ROLE_KEY manquante. Ajoutez-la dans .env.local.",
            }));
            return;
          }

          // Détection : clé anon utilisée à la place de la clé service_role
          if (SERVICE_KEY === ANON_KEY) {
            res.statusCode = 500;
            res.end(JSON.stringify({
              error:
                "SUPABASE_SERVICE_ROLE_KEY est identique à la clé anon. " +
                "Dans Supabase Dashboard → Settings → API, copiez la clé " +
                "'service_role' (pas 'anon') dans .env.local, puis redémarrez Vite.",
            }));
            return;
          }

          // Lire le body
          let rawBody = "";
          await new Promise<void>((resolve) => {
            req.on("data", (c: Buffer) => (rawBody += c.toString()));
            req.on("end", resolve);
          });

          let body: Record<string, unknown>;
          try {
            body = JSON.parse(rawBody);
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Corps JSON invalide" }));
            return;
          }

          const {
            name, email, password, role, is_active,
            phone,
            assigned_election_id, assigned_election_ids, created_by,
            assigned_center_ids, assigned_center_bureaux, assigned_center_colleges,
          } = body;

          const emailTrimmed = typeof email === "string" ? email.trim() : "";
          const phoneTrimmed = typeof phone === "string" ? phone.trim() : "";

          if (!name || !password || !role) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Champs obligatoires manquants (nom, mot de passe, rôle)" }));
            return;
          }
          if (!emailTrimmed && !phoneTrimmed) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Au moins un identifiant est requis : email ou numéro de téléphone" }));
            return;
          }

          // Si aucun email fourni, on génère un email interne basé sur le téléphone
          const normalizedPhone = phoneTrimmed.replace(/[^0-9]/g, "");
          const authEmail = emailTrimmed || `tel${normalizedPhone}@noreply.ohitu.ga`;

          // Import dynamique pour éviter de bundler @supabase/supabase-js côté serveur Vite
          const { createClient } = await import("@supabase/supabase-js");
          const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          // Vérifier le token du demandeur
          const authHeader = req.headers["authorization"] as string | undefined;
          if (!authHeader?.startsWith("Bearer ")) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: "Non authentifié" }));
            return;
          }
          const { data: { user: caller }, error: verifyErr } =
            await adminClient.auth.getUser(authHeader.replace("Bearer ", ""));
          if (verifyErr || !caller) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: "Token invalide" }));
            return;
          }
          const { data: callerData } = await adminClient
            .from("users")
            .select("role")
            .eq("id", caller.id)
            .single();
          if (!callerData || !["super-admin", "admin"].includes(callerData.role as string)) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: "Accès interdit" }));
            return;
          }

          // Créer le compte Auth
          let authUserId: string;
          let authErr: any = null;
          const { data: authData, error: authErrRaw } =
            await adminClient.auth.admin.createUser({
              email: authEmail,
              password: String(password),
              email_confirm: true,
            });
          authErr = authErrRaw;

          if (authErr) {
            // Si le compte Auth existe déjà, récupérer son ID
            if (authErr.message?.includes("already been registered") || authErr.message?.includes("already exists")) {
              const { data: listData, error: listErr } =
                await adminClient.auth.admin.listUsers();
              if (listErr) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: `Impossible de récupérer l'utilisateur existant : ${listErr.message}` }));
                return;
              }
              const existing = listData.users.find(
                (u) => u.email?.toLowerCase() === authEmail.toLowerCase()
              );
              if (!existing) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Compte Auth introuvable malgré l'email déjà enregistré." }));
                return;
              }
              authUserId = existing.id;
              await adminClient.auth.admin.updateUserById(authUserId, {
                email_confirm: true,
                ...(password ? { password: String(password) } : {}),
              });
            } else {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: `Erreur Auth : ${authErr.message}` }));
              return;
            }
          } else {
            if (!authData.user) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "Utilisateur Auth non retourné après création." }));
              return;
            }
            authUserId = authData.user.id;
          }

          // Insérer (ou mettre à jour si déjà présent) dans la table users
          const { data: userData, error: userErr } = await adminClient
            .from("users")
            .upsert({
              id: authUserId,
              name: String(name).trim(),
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
            }, { onConflict: "id" })
            .select()
            .single();

          if (userErr) {
            if (!authErr) await adminClient.auth.admin.deleteUser(authUserId);
            res.statusCode = 400;
            res.end(JSON.stringify({ error: `Erreur base de données : ${userErr.message}` }));
            return;
          }

          res.statusCode = 200;
          res.end(JSON.stringify({ user: userData }));
        }
      );

      // ── DELETE /api/admin/delete-user ────────────────────────────────────────
      server.middlewares.use(
        "/api/admin/delete-user",
        async (req: any, res: any) => {
          res.setHeader("Content-Type", "application/json");

          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Method not allowed" }));
            return;
          }

          const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
          const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

          if (!SERVICE_KEY) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "SUPABASE_SERVICE_ROLE_KEY manquante." }));
            return;
          }

          let rawBody = "";
          await new Promise<void>((resolve) => {
            req.on("data", (c: Buffer) => (rawBody += c.toString()));
            req.on("end", resolve);
          });

          let body: Record<string, unknown>;
          try { body = JSON.parse(rawBody); } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Corps JSON invalide" }));
            return;
          }

          const { userId } = body;
          if (!userId || typeof userId !== "string") {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "userId manquant" }));
            return;
          }

          const { createClient } = await import("@supabase/supabase-js");
          const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          // Vérifier le token du demandeur
          const authHeader = req.headers["authorization"] as string | undefined;
          if (!authHeader?.startsWith("Bearer ")) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: "Non authentifié" }));
            return;
          }
          const { data: { user: caller }, error: verifyErr } =
            await adminClient.auth.getUser(authHeader.replace("Bearer ", ""));
          if (verifyErr || !caller) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: "Token invalide" }));
            return;
          }
          const { data: callerData } = await adminClient
            .from("users")
            .select("role")
            .eq("id", caller.id)
            .single();
          if (!callerData || !["super-admin", "admin"].includes(callerData.role as string)) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: "Accès interdit" }));
            return;
          }

          // Supprimer le compte Auth
          const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId);
          if (deleteErr) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: `Erreur Auth : ${deleteErr.message}` }));
            return;
          }

          res.statusCode = 200;
          res.end(JSON.stringify({ success: true }));
        }
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Charger TOUTES les variables (sans filtre de préfixe) depuis .env et .env.local
  // et les injecter dans process.env pour que le middleware Vite y ait accès.
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    adminApiPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    global: 'globalThis',
    'process.env': process.env,
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
          charts: ['recharts'],
          utils: ['date-fns', 'clsx', 'tailwind-merge'],
          xlsx: ['xlsx'],
          supabase: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query'],
        }
      }
    },
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      '@tanstack/react-query'
    ]
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : []
  }
  });
});
