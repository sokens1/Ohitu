import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Shield, Database, Eye, Lock, Clock,
  Users, FileCheck, Scale, Mail, RefreshCw, AlertCircle, ChevronDown,
} from 'lucide-react';

// ── Sections avec texte verbatim du document ──────────────────────────────────

const SECTIONS = [
  {
    id: '01', icon: FileCheck, color: '#1B2E5A', light: '#EEF2FF',
    title: 'Objet',
    body: (
      <p>
        La présente politique de confidentialité décrit la manière dont la plateforme <em>o'Hitu</em>,
        développée par le cabinet <strong>CNX 4.0</strong> et mise à disposition de la Société d'Énergie
        et d'Eau du Gabon (<strong>SEEG</strong>) pour l'organisation des Élections des Délégués du
        Personnel de l'année 2026, collecte, traite et publie les données dans le respect des droits
        des personnes concernées.
      </p>
    ),
  },
  {
    id: '02', icon: Users, color: '#0D9488', light: '#F0FDF9',
    title: 'Responsable du traitement',
    body: (
      <div className="space-y-3">
        <p>
          Le responsable du traitement des données est <strong>CNX 4.0</strong>, cabinet spécialisé en
          architecture d'affaires, développeur et opérateur de la plateforme <em>o'Hitu</em>.
        </p>
        <p>
          La <strong>SEEG</strong> est l'organisation cliente pour le compte de laquelle la plateforme
          est déployée dans le cadre des élections des délégués du personnel 2026. À ce titre, elle est
          destinataire des résultats publiés et responsable des décisions relatives au processus électoral
          lui-même, mais elle n'intervient pas <em>a priori</em> dans les aspects techniques du traitement
          des données personnelles sur la plateforme.
        </p>
        <p>
          Pour toute question relative à la présente politique, CNX 4.0 peut être contacté à l'adresse :{' '}
          <a href="mailto:support@cnx4-0.com"
            className="text-teal-600 font-medium hover:underline">
            support@cnx4-0.com
          </a>.
        </p>
      </div>
    ),
  },
  {
    id: '03', icon: Database, color: '#4F46E5', light: '#EEF2FF',
    title: 'Données collectées et finalités',
    body: (
      <div className="space-y-4">
        <p>La plateforme traite quatre catégories distinctes de données, soumises à des régimes différents.</p>

        <div>
          <p className="font-semibold text-gray-900 mb-2">Données publiées relatives aux résultats électoraux</p>
          <p className="mb-2">
            Ces données sont rendues publiques conformément aux dispositions de l'<em>Arrêté
            n°000147/MTEFP/SG/DGTMOE/DTR du 26 avril 2001</em> réglementant l'institution des Délégués
            du Personnel, qui prévoit l'affichage des listes de candidats et la communication des résultats
            aux parties prenantes. Sont publiés :
          </p>
          <ul className="space-y-1 pl-4">
            {[
              'Le nom, le prénom et le syndicat des candidats élus à l\'issue du scrutin',
              'Le collège électoral et l\'établissement pour lesquels ils ont été élus',
              'Les résultats agrégés par syndicat, par collège et par établissement',
              'Les statistiques de participation (nombre d\'inscrits, de votants, taux de participation, taux d\'abstention, suffrages exprimés)',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mt-2" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-semibold text-gray-900 mb-2">Données personnelles des candidats</p>
          <p>
            Les données personnelles individuelles des candidats — qu'ils aient ou non obtenu un siège —
            telles que le genre, l'âge et l'ancienneté, ne sont pas publiées sur la partie
            publique de la plateforme. Elles sont conservées uniquement dans les systèmes internes à des
            fins de traçabilité du processus électoral et de départage en cas d'égalité, conformément aux
            Articles 17 et 18 de l'Arrêté n°000147.
          </p>
        </div>

        <div>
          <p className="font-semibold text-gray-900 mb-2">Données d'interactions avec la plateforme des utilisateurs administrateurs et animateurs</p>
          <p>
            Les accès à l'interface d'administration font l'objet d'une journalisation (piste d'audit)
            enregistrant l'identité de l'utilisateur, la date et l'heure de connexion, ainsi que des
            actions effectuées. Ces données sont exclusivement destinées à garantir l'intégrité du
            processus de saisie et de publication des résultats.
          </p>
        </div>

        <div>
          <p className="font-semibold text-gray-900 mb-2">Données relatives à l'entreprise et aux membres du dispositif électoral</p>
          <p className="mb-2">
            Dans le cadre de la création et de la gestion de l'élection sur la plateforme, sont collectées et conservées les données suivantes :
          </p>
          <ul className="space-y-2 pl-4">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mt-2" />
              <span><strong>Données relatives à l'entreprise organisatrice</strong> : dénomination sociale, secteur institutionnel, d'immatriculation, organisation de tutelle, établissements et bureaux de vote, collèges représentés et toute autre information renseignée lors de la configuration de l'élection sur la plateforme. Ces données sont utilisées exclusivement à des fins d'identification de l'élection concernée et de génération des documents officiels associés.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mt-2" />
              <span><strong>Données relatives aux membres du dispositif électoral</strong> : nom, prénom, adresse électronique professionnelle et numéro de téléphone professionnel des personnes désignées pour administrer le processus électoral, notamment les responsables de la Direction du Capital Humain et les Présidents de Bureau de vote, ainsi que les membres de la Commission Technique Bipartite.</span>
            </li>
          </ul>
          <p className="mt-2">
            Les données relatives aux membres du dispositif électoral sont collectées dans le strict cadre de l'organisation des opérations électorales — coordination logistique, transmission des procès-verbaux et listes d'émargements des bureaux, notifications relatives au déroulement du scrutin — et ne sont accessibles qu'aux utilisateurs habilités de la plateforme. Elles ne sont en aucun cas publiées sur la partie publique.
          </p>
          <p className="mt-2">
            Ces données sont supprimées à l'issue de la période de conservation définie à la section 7.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: '04', icon: AlertCircle, color: '#059669', light: '#ECFDF5',
    title: 'Données non collectées',
    body: (
      <p>
        La plateforme ne collecte aucune donnée sur les visiteurs de la partie publique. Aucun cookie de
        traçage, aucun identifiant de navigation et aucune donnée personnelle n'est collecté auprès du
        public consultant simplement les résultats sur la vue publique.
      </p>
    ),
  },
  {
    id: '05', icon: Shield, color: '#1B2E5A', light: '#F1F5F9',
    title: 'Secret du vote et listes d\'émargement',
    body: (
      <div className="space-y-3">
        <p>
          La plateforme ne collecte, ne publie et ne conserve aucune donnée permettant d'identifier le
          choix individuel d'un électeur. Les résultats sont publiés uniquement sous forme agrégée par
          syndicat, par collège et par établissement, de sorte qu'il soit impossible de reconstituer le
          vote d'une personne.
        </p>
        <p>
          Les listes d'émargement ne sont pas accessibles au public. Elles sont uniquement consultables
          par l'employeur et par la Commission Technique Bipartite, afin de garantir l'intégrité des
          opérations de dépouillement, de saisie et de publication des résultats, conformément aux
          dispositions du Protocole d'Accord Préélectoral.
        </p>
        <p className="font-semibold text-[#1B2E5A]">
          Le secret du scrutin est une garantie substantielle du processus électoral à laquelle il ne
          peut être dérogé.
        </p>
      </div>
    ),
  },
  {
    id: '06', icon: Scale, color: '#D97706', light: '#FFFBEB',
    title: 'Base légale du traitement',
    body: (
      <div className="space-y-2">
        <p>
          Le traitement des données relatives aux résultats électoraux repose sur les obligations légales
          suivantes :
        </p>
        <ul className="space-y-2 pl-2">
          {[
            { bold: 'Loi n°022/2021 du 19 novembre 2021 portant Code du Travail en République Gabonaise', detail: ', notamment en ses articles 327, 328 et 329 qui fixent le cadre de l\'élection des Délégués du personnel ;' },
            { bold: 'Arrêté n°000147/MTEFP/SG/DGTMOE/DTR du 26 avril 2001', detail: ' réglementant l\'institution des Délégués du Personnel ;' },
            { bold: 'Arrêté n°0009/MTPEDSFP/MFPRC du 09 avril 2026', detail: ' portant convocation du collège électoral pour les élections professionnelles de l\'année 2026 ;' },
            { bold: 'Protocole d\'Accord Préélectoral SEEG 2026', detail: ', qui fixe les modalités pratiques, validées de commun accord par les parties prenantes, pour l\'organisation de l\'élection.' },
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-2" />
              <span><strong>{item.bold}</strong>{item.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: '07', icon: Clock, color: '#EA580C', light: '#FFF7ED',
    title: 'Durée de conservation',
    body: (
      <div className="space-y-3">
        <p>
          Les données publiées relatives aux élus sont conservées par l'employeur pendant la durée du
          mandat de trois ans. À l'issue de ce mandat, elles sont archivées par l'employeur à des fins
          d'historique institutionnel.
        </p>
        <p>
          Les données de la piste d'audit sont conservées pendant une durée d'un mois à compter de la
          date de publication des résultats officiels, durée proportionnée aux délais de recours et de
          contentieux post-électoraux prévus par la <em>Loi n°022/2021 du 19 novembre 2021 portant Code
          du Travail en République Gabonaise</em> (Article 328) et par le <em>Protocole d'Accord
          Préélectoral</em> (Article 13).
        </p>
        <p>
          Les données de toutes les autres catégories citées en section 3, conservées en interne dans la
          plateforme, sont supprimées à l'issue de cette même période d'un mois, une fois le processus
          électoral définitivement clos.
        </p>
      </div>
    ),
  },
  {
    id: '08', icon: Users, color: '#7C3AED', light: '#F5F3FF',
    title: 'Destinataires des données',
    body: (
      <div className="space-y-3">
        <p>
          Les résultats publiés sur la partie publique de la plateforme sont accessibles à toute personne
          disposant d'un accès internet, conformément à l'objectif de transparence du processus électoral.
        </p>
        <p>
          Les données internes sont accessibles uniquement aux personnes habilitées au sein de la Direction
          Générale et de la Direction du Capital Humain de la SEEG, aux équipes techniques de CNX 4.0,
          ainsi qu'à la Commission Technique Bipartite prévue par le Protocole d'Accord Préélectoral et,
          en cas de contentieux, à l'Inspecteur du Travail compétent.
        </p>
        <p>
          Cet accès est limité à la période allant du lancement de l'organisation des élections jusqu'à
          un mois après la publication des résultats officiels.
        </p>
        <p>
          Les équipes techniques de CNX 4.0 peuvent accéder aux données dans le strict cadre de leurs
          obligations d'administration, d'animation, de maintenance et de support de la plateforme.
        </p>
      </div>
    ),
  },
  {
    id: '09', icon: Eye, color: '#0891B2', light: '#ECFEFF',
    title: 'Droits des personnes concernées',
    body: (
      <div className="space-y-3">
        <p>
          Toute personne dont les données sont traitées dans le cadre de ce processus électoral dispose,
          dans les limites permises par les obligations légales encadrant la publication des résultats
          d'une élection professionnelle, des droits suivants :
        </p>
        <ul className="space-y-1 pl-2">
          {[
            { right: 'Droit d\'accès', desc: ' : obtenir confirmation que des données la concernant sont traitées et en obtenir une copie' },
            { right: 'Droit de rectification', desc: ' : demander la correction de données inexactes' },
            { right: 'Droit d\'opposition', desc: ' : s\'opposer à un traitement dans les cas prévus par la loi' },
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0 mt-2" />
              <span><strong>{item.right}</strong>{item.desc}</span>
            </li>
          ))}
        </ul>
        <p>
          Ces droits peuvent être exercés en adressant une demande écrite à la Direction du Capital
          Humain de la SEEG, Avenue Félix Éboué, BP 2187, Libreville.
        </p>
        <p>
          Toute réclamation relative aux résultats électoraux publiés relève, conformément à l'Article 13
          du Protocole d'Accord Préélectoral, de la Commission Technique Bipartite puis, en dernier
          ressort, de l'Inspection du Travail du ressort.
        </p>
      </div>
    ),
  },
  {
    id: '10', icon: Lock, color: '#16A34A', light: '#F0FDF4',
    title: 'Sécurité',
    body: (
      <p>
        La plateforme met en œuvre des mesures techniques et organisationnelles appropriées pour protéger
        les données contre tout accès non autorisé, toute modification ou toute divulgation non prévue,
        notamment via un système de gestion des rôles et d'authentification des utilisateurs
        administrateurs et animateurs, ainsi qu'une piste d'audit horodatée de toutes les actions
        effectuées dans la plateforme, en particulier sur les données.
      </p>
    ),
  },
  {
    id: '11', icon: RefreshCw, color: '#64748B', light: '#F8FAFC',
    title: 'Modification de la présente politique',
    body: (
      <p>
        La présente politique peut être mise à jour pour refléter d'éventuelles évolutions du traitement.
        Toute modification substantielle sera portée à la connaissance des personnes concernées par voie
        de notification sur la page d'accueil.
      </p>
    ),
  },
];

// ── Accordion item ─────────────────────────────────────────────────────────────
function SectionCard({ section }: { section: typeof SECTIONS[0] }) {
  const [open, setOpen] = useState(true);
  const Icon = section.icon;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex-shrink-0 flex items-center gap-3">
          <span className="text-[11px] font-black tabular-nums" style={{ color: section.color }}>
            {section.id}
          </span>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: section.light }}>
            <Icon className="w-4 h-4" style={{ color: section.color }} />
          </div>
        </div>
        <h2 className="flex-1 text-sm font-bold text-gray-900">{section.title}</h2>
        <ChevronDown
          className="w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 text-sm text-gray-700 leading-relaxed border-t border-gray-50">
          {section.body}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const PrivacyPolicy: React.FC = () => (
  <div className="min-h-screen" style={{ background: 'linear-gradient(160deg,#f0f4ff 0%,#f8fafc 60%)' }}>

    {/* Hero */}
    <div className="relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg,#0f1f3d 0%,#1B2E5A 60%,#1e3a6e 100%)' }}>
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle,#60a5fa,transparent)' }} />
      <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full opacity-8"
        style={{ background: 'radial-gradient(circle,#34d399,transparent)' }} />

      <div className="relative max-w-3xl mx-auto px-5 sm:px-8 pt-8 pb-12">
        <Link to="/"
          className="inline-flex items-center gap-1.5 text-blue-300 hover:text-white text-xs font-medium mb-8 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour à l'accueil
        </Link>

        <div className="flex flex-wrap gap-2 mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold text-blue-200">
            <Clock className="w-3 h-3" /> Dernière mise à jour : juin 2026
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/25 text-[11px] font-semibold text-emerald-300">
            <FileCheck className="w-3 h-3" /> Conforme Loi n°022/2021
          </span>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              Politique de confidentialité
            </h1>
            <p className="text-blue-300 text-sm mt-1.5 font-medium">
              Élections des Délégués du Personnel SEEG — Édition 2026
            </p>
            <p className="text-blue-400 text-xs mt-1">
              Plateforme o'Hitu — développée et opérée par CNX 4.0
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-8 pt-6 border-t border-white/10">
          {[
            { icon: Eye,   label: 'Transparence', sub: 'Résultats publics' },
            { icon: Lock,  label: 'Sécurité',     sub: 'RBAC + audit' },
            { icon: Shield,label: 'Secret',       sub: 'Vote individuel protégé' },
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

    {/* Sections */}
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 space-y-3">
      {SECTIONS.map(s => <SectionCard key={s.id} section={s} />)}

      {/* Footer */}
      <div className="rounded-2xl overflow-hidden mt-6"
        style={{ background: 'linear-gradient(135deg,#0f1f3d,#1B2E5A)' }}>
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
            <a href="mailto:support@cnx4-0.com"
              className="hover:text-white transition-colors underline underline-offset-2">
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
