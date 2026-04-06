import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import DashHeader from '../components/DashHeader';
import { LoadingSkeleton, EmptyState, ErrorState } from '../components/PageStates';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Send, BookOpen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

export default function ConceptExplainerPage() {
  const { eduData } = useAuth();
  const subjects = eduData?.subjects || ['General'];
  const [subject, setSubject] = useState(subjects[0] || 'General');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState(null);
  const [chat, setChat] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api
      .get('/study/companion/explain/notes')
      .then(({ data }) => setHistory(data.notes || []))
      .catch(() => setHistory([]));
  }, [note?.id]);

  const explain = async () => {
    if (!question.trim()) return;
    setError('');
    setLoading(true);
    setNote(null);
    try {
      const { data } = await api.post('/study/companion/explain', { question: question.trim(), subject });
      setNote(data.note);
    } catch (e) {
      setError(e.message || 'Explanation failed');
    }
    setLoading(false);
  };

  const sendChat = async () => {
    if (!note?.id || !chat.trim()) return;
    setChatLoading(true);
    try {
      const { data } = await api.post(`/study/companion/explain/${note.id}/chat`, { message: chat.trim() });
      setNote(data.note);
      setChat('');
    } catch (e) {
      setError(e.message || 'Chat failed');
    }
    setChatLoading(false);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9]">
        <DashHeader title="Concept Explainer" />
        <div className="p-8 flex-1 max-w-4xl w-full mx-auto max-sm:p-4 space-y-6">
          <p className="text-sm text-[#555555]">
            Ask anything — you get a <strong>simple analogy</strong>, a <strong>technical explanation</strong>, and a{' '}
            <strong>worked example</strong> at once. Everything auto-saves as a note; follow-ups stay in chat.
          </p>

          <div className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-6 space-y-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#555555] mb-1">Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="border-2 border-[#E0E0E0] rounded-xl px-3 py-2 text-sm font-medium min-w-[160px]"
                >
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              placeholder="e.g. Why does gradient descent oscillate in ravines?"
              className="w-full border-2 border-[#E0E0E0] rounded-xl px-4 py-3 text-sm"
            />
            {error && <ErrorState message={error} onRetry={() => setError('')} />}
            <button
              type="button"
              disabled={loading}
              onClick={explain}
              className="inline-flex items-center gap-2 bg-[#0D0D0D] text-[#FFFF66] font-bold px-6 py-3 rounded-xl border-none cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-[#FFFF66] border-t-transparent rounded-full animate-spin" />
              ) : (
                <BookOpen size={18} />
              )}
              Explain in three ways
            </button>
          </div>

          {loading && <LoadingSkeleton lines={6} />}

          {!loading && !note && !error && (
            <EmptyState
              title="Ask your first question"
              hint="Try something you’re shaky on from lecture — the more specific, the better the worked example."
            />
          )}

          <AnimatePresence>
            {note && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-white border-2 border-[#FFFF66] rounded-[20px] overflow-hidden"
              >
                <Tabs defaultValue="analogy" className="p-6">
                  <TabsList className="flex flex-wrap h-auto gap-1">
                    <TabsTrigger value="analogy">Analogy</TabsTrigger>
                    <TabsTrigger value="technical">Technical</TabsTrigger>
                    <TabsTrigger value="example">Worked example</TabsTrigger>
                  </TabsList>
                  <TabsContent value="analogy" className="text-[15px] leading-relaxed text-[#333] whitespace-pre-wrap">
                    {note.analogy}
                  </TabsContent>
                  <TabsContent value="technical" className="text-[15px] leading-relaxed text-[#333] whitespace-pre-wrap">
                    {note.technical}
                  </TabsContent>
                  <TabsContent value="example" className="text-[15px] leading-relaxed text-[#333] whitespace-pre-wrap">
                    {note.worked_example}
                  </TabsContent>
                </Tabs>

                <div className="border-t border-[#E0E0E0] px-6 py-4 bg-[#FAFAFA]">
                  <p className="text-xs font-bold uppercase text-[#555555] mb-2">Follow-up chat</p>
                  <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                    {(note.messages || []).map((m, i) => (
                      <div
                        key={i}
                        className={`text-sm rounded-xl px-3 py-2 ${m.role === 'user' ? 'bg-[#E8F4FF] ml-8' : 'bg-white border border-[#E0E0E0] mr-8'}`}
                      >
                        <span className="text-[10px] font-bold text-[#888] uppercase">{m.role}</span>
                        <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={chat}
                      onChange={(e) => setChat(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendChat())}
                      placeholder="Ask a follow-up…"
                      className="flex-1 border-2 border-[#E0E0E0] rounded-xl px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      disabled={chatLoading}
                      onClick={sendChat}
                      className="bg-[#0D0D0D] text-[#FFFF66] p-3 rounded-xl border-none cursor-pointer disabled:opacity-50"
                    >
                      {chatLoading ? (
                        <span className="w-4 h-4 border-2 border-[#FFFF66] border-t-transparent rounded-full animate-spin inline-block" />
                      ) : (
                        <Send size={18} />
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {history.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase text-[#555555] mb-2">Recent saved notes</p>
              <ul className="space-y-2">
                {history.slice(0, 6).map((n) => (
                  <li key={n.id} className="text-sm bg-white border border-[#E0E0E0] rounded-xl px-4 py-2">
                    <span className="text-[#888] text-xs">{n.subject}</span>
                    <p className="font-medium truncate">{n.question}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
