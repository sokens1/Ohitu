import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Shield, Database, Eye, Lock, Clock,
  Users, FileCheck, Scale, Mail, RefreshCw, AlertCircle, ChevronDown,
} from 'lucide-react';

// ── Données des sections ──────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: '01', icon: FileCheck, color: '#1B2E5A', light: '#EEF2FF',
    title: 'Objet',
    body: (
      <p>
        La présente politique décrit la manière dont la plateforme <strong>o'Hitu</strong>, développée
        par le cabinet <strong>CNX 4.0</strong> et mise à disposition de la <strong>SEEG</strong> pour
        les Élections des Délégués du Personnel 2026, collecte, traite et publie les données dans le
        respect des droits des personnes concernées.
      </p>
    ),
  },
  {
    id: '02', icon: Users, color: '#0D9488', light: '#F0FDF9',
    title: 'Responsable du traitement',
    body: (
      <div className="space-y-3">
        <p>
          Le responsable du traitement est <strong>CNX 4.0</strong>, cabinet spécialisé en architecture
          d'affaires, développeur et opérateur de la plateforme <em>o'Hitu</em>.
        </p>
        <p>
          La <strong>SEEG</strong> est l'organisation cliente. Elle est destinataire des résultats publiés
          et responsable du processus électoral, mais n'intervient pas dans les aspects techniques du
          traitement des données.
        </p>
        <a href="mailto:support@cnx4-0.com"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-sm font-medium hover:bg-teal-100 transition-colors">
          <Mail className="w-4 h-4" /> support@cnx4-0.com
        </a>
      </div>
    ),
  },
  {
    id: '03', icon: Database, color: '#4F46E5', light: '#EEF2FF',
    title: 'Données collectées et finalités',
    body: (
      <div className="space-y-5">
        <Section3Block
          title="Données publiées — résultats électoraux"
          note="Conformément à l'Arrêté n°000147/MTEFP/SG/DGTMOE/DTR du 26 avril 2001"
          items={[
            'Nom, prénom et syndicat des candidats élus',
            'Collège électoral et établissement pour lesquels ils ont été élus',
            'Résultats agrégés par syndicat, par collège et par établissement',
            'Statistiques de participation (inscrits, votants, taux, suffrages exprimés)',
          ]}
        />
        <Section3Block
          title="Données personnelles des candidats"
          note="Conservées uniquement en interne (art. 17 et 18 de l'Arrêté n°000147)"
          items={[
            'Non publiées sur la partie publique de la plateforme',
            'Conservées à des fins de traçabilité et de départage en cas d\'égalité',
          ]}
        />
        <Section3Block
          title="Données de connexion des administrateurs"
          note="Piste d'audit"
          items={[
            'Identité de l\'utilisateur, date et heure de connexion',
            'Actions effectuées — exclusivement pour garantir l\'intégrité du processus',
          ]}
        />
      </div>
    ),
  },
  {
    id: '04', icon: AlertCircle, color: '#059669', light: '#ECFDF5',
    title: 'Données non collectées',
    body: (
      <p>
        La plateforme ne collecte <strong>aucune donnée sur les visiteurs de la partie publique</strong>.
        Aucun cookie de traçage, aucun identifiant de navigation et aucune donnée personnelle n'est
        collecté auprès du public consultant les résultats.
      </p>
    ),
  },
  {
    id: '05', icon: Shield, color: '#1B2E5A', light: '#F1F5F9',
    title: 'Secret du vote et listes d\'émargement',
    body: (
      <div className="space-y-4">
        <p>
          La plateforme ne collecte, ne publie et ne conserve <strong>aucune donnée permettant d'identifier
          le choix individuel d'un électeur</strong>. Les résultats sont publiés uniquement sous forme
          agrégée par syndicat, collège et établissement.
        </p>
        <p>
          Les listes d'émargement ne sont <strong>pas accessibles au public</strong>. Elles sont
          consultables uniquement par l'employeur et la Commission Technique Bipartite, conformément
          au Protocole d'Accord Préélectoral.
        </p>
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#1B2E5A]/6 border border-[#1B2E5A]/12">
          <Shield className="w-5 h-5 text-[#1B2E5A] flex-shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-[#1B2E5A] leading-snug">
            Le secret du scrutin est une garantie substantielle du processus électoral à laquelle
            il ne peut être dérogé.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: '06', icon: Scale, color: '#D97706', light: '#FFFBEB',
    title: 'Base légale du traitement',
    body: (
      <div className="space-y-2.5">
        {[
          { ref: 'Loi n°022/2021 du 19 novembre 2021', detail: 'Code du Travail en République Gabonaise — art. 327, 328 et 329' },
          { ref: 'Arrêté n°000147/MTEFP/SG/DGTMOE/DTR du 26 avril 2001', detail: 'Réglementant l\'institution des Délégués du Personnel' },
          { ref: 'Arrêté n°0009/MTPEDSFP/MFPRC du 09 avril 2026', detail: 'Portant convocation du collège électoral' },
          { ref: 'Protocole d\'Accord Préélectoral SEEG 2026', detail: 'Modalités pratiques validées par les parties prenantes' },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-100">
            <span className="w-6 h-6 rounded-lg bg-amber-200 text-amber-800 text-xs font-black flex items-center justify-center flex-shrink-0">
              {i + 1}
            </span>
            <div className="text-sm leading-snug">
              <p className="font-semibold text-gray-900">{item.ref}</p>
              <p className="text-gray-500 mt-0.5">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: '07', icon: Clock, color: '#EA580C', light: '#FFF7ED',
    title: 'Durée de conservation',
    body: (
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { label: 'Données des élus', duration: '3 ans', sub: 'Durée du mandat, puis archivées' },
          { label: 'Piste d\'audit', duration: '1 mois', sub: 'À compter de la publication des résultats (art. 328)' },
          { label: 'Données candidates', duration: '1 mois', sub: 'Supprimées une fois le processus clos' },
        ].map((d, i) => (
          <div key={i} className="rounded-2xl bg-orange-50 border border-orange-100 p-4 text-center">
            <p className="text-3xl font-black text-orange-600 leading-none">{d.duration}</p>
            <p className="text-sm font-semibold text-gray-800 mt-1.5">{d.label}</p>
            <p className="text-[11px] text-gray-400 mt-1 leading-snug">{d.sub}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: '08', icon: Users, color: '#7C3AED', light: '#F5F3FF',
    title: 'Destinataires des données',
    body: (
      <div className="space-y-2.5">
        {[
          {
            who: 'Grand public',
            badge: 'Public',
            badgeColor: 'bg-violet-100 text-violet-700',
            what: 'Résultats agrégés publiés sur la partie publique, accessibles à toute personne disposant d\'un accès internet.',
          },
          {
            who: 'Direction SEEG & Commission Bipartite',
            badge: 'Restreint',
            badgeColor: 'bg-amber-100 text-amber-700',
            what: 'Données internes (piste d\'audit, données candidates). En cas de contentieux : Inspecteur du Travail.',
          },
          {
            who: 'Équipes techniques CNX 4.0',
            badge: 'Technique',
            badgeColor: 'bg-slate-100 text-slate-600',
            what: 'Accès strictement limité aux obligations d\'administration, maintenance et support.',
          },
        ].map((d, i) => (
          <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-violet-100 shadow-sm">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="text-sm font-semibold text-gray-900">{d.who}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${d.badgeColor}`}>{d.badge}</span>
              </div>
              <p className="text-xs text-gray-500 leading-snug">{d.what}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: '09', icon: Eye, color: '#0891B2', light: '#ECFEFF',
    title: 'Droits des personnes concernées',
    body: (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { right: 'Accès', desc: 'Obtenir confirmation et copie des données vous concernant.' },
            { right: 'Rectification', desc: 'Demander la correction de données inexactes.' },
            { right: 'Opposition', desc: 'S\'opposer à un traitement dans les cas prévus par la loi.' },
          ].map((d, i) => (
            <div key={i} className="p-4 rounded-2xl bg-cyan-50 border border-cyan-100 text-center">
              <p className="text-sm font-bold text-cyan-700 mb-1">Droit de {d.right}</p>
              <p className="text-xs text-gray-500 leading-snug">{d.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-cyan-100">
          <Mail className="w-4 h-4 text-cyan-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600 leading-snug">
            <strong>Exercice des droits :</strong> adresser une demande écrite à la Direction du Capital
            Humain de la SEEG, Avenue Félix Éboué, BP 2187, Libreville. Toute réclamation sur les
            résultats relève de la Commission Technique Bipartite puis de l'Inspection du Travail.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: '10', icon: Lock, color: '#16A34A', light: '#F0FDF4',
    title: 'Sécurité',
    body: (
      <div className="space-y-3">
        {[
          { label: 'Gestion des rôles', desc: 'Système d\'authentification et de contrôle d\'accès par rôles (RBAC) pour tous les utilisateurs administrateurs.' },
          { label: 'Piste d\'audit horodatée', desc: 'Toutes les actions effectuées sur les données sont enregistrées avec identité, date et heure.' },
          { label: 'Chiffrement en transit', desc: 'Les communications entre la plateforme et les utilisateurs sont sécurisées par HTTPS.' },
        ].map((d, i) => (
          <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-green-50 border border-green-100">
            <Lock className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-gray-800">{d.label}</p>
              <p className="text-gray-500 text-xs mt-0.5">{d.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: '11', icon: RefreshCw, color: '#64748B', light: '#F8FAFC',
    title: 'Modification de la présente politique',
    body: (
      <p>
        La présente politique peut être mise à jour pour refléter d'éventuelles évolutions du traitement.
        Toute modification substantielle sera portée à la connaissance des personnes concernées par voie
        d'affichage interne.
      </p>
    ),
  },
];

// ── Sous-composant bloc Section 3 ─────────────────────────────────────────────
function Section3Block({ title, note, items }: { title: string; note: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-indigo-100 overflow-hidden">
      <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
        <p className="text-xs font-bold text-indigo-700">{title}</p>
        <p className="text-[11px] text-indigo-400 italic mt-0.5">{note}</p>
      </div>
      <ul className="px-4 py-3 space-y-1.5 bg-white">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
            <span className="w-1 h-1 rounded-full bg-indigo-300 flex-shrink-0 mt-1.5" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Accordion item ─────────────────────────────────────────────────────────────
function SectionCard({ section }: { section: typeof SECTIONS[0] }) {
  const [open, setOpen] = useState(true);
  const Icon = section.icon;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        {/* Numéro + icône */}
        <div className="flex-shrink-0 flex items-center gap-3">
          <span className="text-[11px] font-black tabular-nums" style={{ color: section.color }}>{section.id}</span>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: section.light }}>
            <Icon className="w-4 h-4" style={{ color: section.color }} />
          </div>
        </div>
        <h2 className="flex-1 text-left text-sm font-bold text-gray-900">{section.title}</h2>
        <ChevronDown
          className="w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 text-sm text-gray-600 leading-relaxed border-t border-gray-50">
          {section.body}
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
const PrivacyPolicy: React.FC = () => (
  <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #f0f4ff 0%, #f8fafc 60%)' }}>

    {/* ── Hero ── */}
    <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f1f3d 0%, #1B2E5A 60%, #1e3a6e 100%)' }}>
      {/* Cercles décoratifs */}
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #60a5fa, transparent)' }} />
      <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full opacity-8"
        style={{ background: 'radial-gradient(circle, #34d399, transparent)' }} />

      <div className="relative max-w-3xl mx-auto px-5 sm:px-8 pt-8 pb-12">
        <Link to="/"
          className="inline-flex items-center gap-1.5 text-blue-300 hover:text-white text-xs font-medium mb-8 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour à l'accueil
        </Link>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold text-blue-200">
            <Clock className="w-3 h-3" /> Juin 2026
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/25 text-[11px] font-semibold text-emerald-300">
            <FileCheck className="w-3 h-3" /> Loi n°022/2021
          </span>
        </div>

        {/* Titre */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              Politique de confidentialité
            </h1>
            <p className="text-blue-300 text-sm mt-1.5 font-medium">
              Élections des Délégués du Personnel SEEG · Édition 2026
            </p>
            <p className="text-blue-400 text-xs mt-1">
              Plateforme o'Hitu — développée et opérée par CNX 4.0
            </p>
          </div>
        </div>

        {/* Résumé en 3 points */}
        <div className="grid grid-cols-3 gap-3 mt-8 pt-6 border-t border-white/10">
          {[
            { icon: Eye,      label: 'Transparence', sub: 'Résultats publics' },
            { icon: Lock,     label: 'Sécurité',     sub: 'RBAC + audit' },
            { icon: Shield,   label: 'Secret',       sub: 'Vote individuel protégé' },
          ].map(({ icon: I, label, sub }) => (
            <div key={label} className="text-center">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-1.5">
                <I className="w-4 h-4 text-blue-300" />
              </div>
              <p className="text-[11px] font-bold text-white">{label}</p>
              <p className="text-[10px] text-blue-400">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* ── Sections ── */}
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 space-y-3">
      {SECTIONS.map(s => <SectionCard key={s.id} section={s} />)}

      {/* Footer */}
      <div className="rounded-2xl overflow-hidden mt-6" style={{ background: 'linear-gradient(135deg, #0f1f3d, #1B2E5A)' }}>
        <div className="px-6 py-6 text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3">
            <Shield className="w-5 h-5 text-blue-300" />
          </div>
          <p className="text-sm text-blue-100 font-medium leading-snug max-w-md mx-auto">
            Cette politique s'applique exclusivement à la plateforme o'Hitu dans le cadre des Élections
            des Délégués du Personnel SEEG 2026.
          </p>
          <p className="text-xs text-blue-400 mt-2">
            CNX 4.0 ·{' '}
            <a href="mailto:support@cnx4-0.com" className="hover:text-white transition-colors underline underline-offset-2">
              support@cnx4-0.com
            </a>
          </p>
        </div>
      </div>

      <p className="text-center text-[11px] text-gray-400 pb-6">
        © 2026 CNX 4.0 · o'Hitu — Plateforme de gestion des élections professionnelles
      </p>
    </div>
  </div>
);

export default PrivacyPolicy;
