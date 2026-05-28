import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, ChevronDown, ChevronUp } from 'lucide-react';

interface Message {
  from: 'user' | 'bot';
  text: string;
}

const FAQ = [
  {
    question: "Comment sont calculés les résultats ?",
    answer: "Les résultats sont calculés par l'algorithme légal CSE. Pour 1 siège : le syndicat avec le plus de voix l'emporte. Pour 2 sièges : quotient électoral (suffrages / 2) puis attribution des sièges restants par plus forte moyenne. Les données proviennent des PV publiés par les agents de saisie.",
  },
  {
    question: "Qui peut accéder aux résultats ?",
    answer: "Les résultats publiés sont accessibles à tous publiquement sur ce site. Pour accéder à l'interface d'administration (saisie, validation, publication), un compte autorisé est nécessaire. Contactez votre administrateur pour obtenir un accès.",
  },
  {
    question: "Quand les résultats sont-ils mis à jour ?",
    answer: "Les résultats sont mis à jour dès qu'un PV est validé et publié par l'administration. Rafraîchissez la page pour afficher les dernières données. La mise à jour se fait en temps réel, bureau par bureau.",
  },
  {
    question: "Qu'est-ce qu'un collège électoral ?",
    answer: "Un collège électoral regroupe des électeurs selon leur catégorie professionnelle : Encadrement (général), Cadres, Maîtrise (employés), Exécution (ouvriers). Chaque collège dispose de ses propres sièges et élit ses représentants indépendamment.",
  },
  {
    question: "Comment contacter l'équipe ?",
    answer: "Pour toute assistance technique, contactez CNX 4.0 : edi@cnx4-0.com. Pour les questions relatives à l'élection elle-même, adressez-vous à la commission électorale compétente.",
  },
];

const WELCOME = "Bonjour 👋 Je suis l'assistant o'Hitu. Je peux répondre à vos questions sur la plateforme et les résultats électoraux. Comment puis-je vous aider ?";

const FloatingChatbot: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ from: 'bot', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [showFAQ, setShowFAQ] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const addMsg = (from: 'user' | 'bot', text: string) =>
    setMessages(prev => [...prev, { from, text }]);

  const handleFAQ = (item: typeof FAQ[0]) => {
    setShowFAQ(false);
    addMsg('user', item.question);
    setTimeout(() => addMsg('bot', item.answer), 350);
  };

  const handleSend = () => {
    const q = input.trim();
    if (!q) return;
    setInput('');
    setShowFAQ(false);
    addMsg('user', q);
    const ql = q.toLowerCase();
    const match = FAQ.find(f =>
      f.question.toLowerCase().split(' ').some(w => w.length > 3 && ql.includes(w))
    );
    setTimeout(() => {
      addMsg('bot', match?.answer ?? "Je n'ai pas de réponse précise à cette question. Pour une aide personnalisée, contactez-nous à edi@cnx4-0.com.");
    }, 350);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {open && (
        <div className="mb-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="bg-gov-blue text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              <span className="font-semibold text-sm">Assistant o'Hitu</span>
              <span className="w-2 h-2 bg-green-400 rounded-full" />
            </div>
            <button onClick={() => setOpen(false)} className="hover:bg-white/20 rounded p-0.5 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: '220px', minHeight: '80px' }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[82%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                    m.from === 'user'
                      ? 'bg-gov-blue text-white rounded-br-none'
                      : 'bg-gray-100 text-gray-800 rounded-bl-none'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* FAQ suggestions */}
          <div className="border-t border-gray-100 px-3 py-2 flex-shrink-0">
            <button
              onClick={() => setShowFAQ(v => !v)}
              className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 mb-1 transition-colors"
            >
              {showFAQ ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Questions fréquentes
            </button>
            {showFAQ && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {FAQ.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleFAQ(item)}
                    className="w-full text-left text-[11px] px-2 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-100 transition-colors leading-snug"
                  >
                    {item.question}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-1 flex gap-2 flex-shrink-0">
            <input
              className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 transition-colors"
              placeholder="Votre question…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <button
              onClick={handleSend}
              className="bg-gov-blue text-white rounded-lg px-2.5 py-2 hover:bg-blue-700 transition-colors flex-shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-12 h-12 bg-gov-blue text-white rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-110 flex items-center justify-center relative"
        aria-label="Ouvrir l'assistant"
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
        {!open && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white" />
        )}
      </button>
    </div>
  );
};

export default FloatingChatbot;
