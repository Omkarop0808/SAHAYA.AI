import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import DashHeader from '../components/DashHeader';
import { LoadingSkeleton, EmptyState, ErrorState } from '../components/PageStates';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import api from '../utils/api';
import { Upload, Link as LinkIcon, Youtube, FileText, Sparkles } from 'lucide-react';

export default function SmartUploadHub() {
  const [subject, setSubject] = useState('General');
  const [url, setUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [doc, setDoc] = useState(null);
  const [tab, setTab] = useState('lesson');

  const process = async () => {
    setError('');
    setLoading(true);
    setDoc(null);
    try {
      const fd = new FormData();
      fd.append('subject', subject);
      if (file) fd.append('file', file);
      if (url.trim()) fd.append('url', url.trim());
      if (youtubeUrl.trim()) fd.append('youtubeUrl', youtubeUrl.trim());
      if (rawText.trim()) fd.append('rawText', rawText.trim());
      const { data } = await api.postMultipart('/study/hub/process', fd);
      setDoc(data.document);
      setTab('lesson');
    } catch (e) {
      setError(e.message || 'Processing failed');
    }
    setLoading(false);
  };

  const out = doc?.outputs;
  const lesson = out?.lesson;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9]">
        <DashHeader title="Study Studio" />
        <div className="p-8 flex-1 max-w-4xl w-full mx-auto max-sm:p-4 space-y-8">
          <p className="text-sm text-[#555555]">
            One action → a full <strong>study package</strong>: structured <strong>lesson</strong>, <strong>flashcards</strong>,{' '}
            <strong>quiz bank</strong>, <strong>practice problems</strong> with rubric hints, <strong>roadmap</strong>, and curated videos.
            Drop a PDF, URL, YouTube link, or raw notes.
          </p>

          <div className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-6 space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wide text-[#555555]">Subject / topic</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border-2 border-[#E0E0E0] rounded-xl px-4 py-3 text-[15px]"
            />

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-[#555555] mb-2">
                  <Upload size={14} /> PDF or .txt
                </label>
                <input type="file" accept=".pdf,.txt,text/plain,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-[#555555] mb-2">
                  <LinkIcon size={14} /> Article URL
                </label>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full border-2 border-[#E0E0E0] rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-[#555555] mb-2">
                  <Youtube size={14} /> YouTube URL
                </label>
                <input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full border-2 border-[#E0E0E0] rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-[#555555] mb-2">
                <FileText size={14} /> Raw text
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={5}
                className="w-full border-2 border-[#E0E0E0] rounded-xl px-4 py-3 text-sm"
                placeholder="Paste notes…"
              />
            </div>

            {error && <ErrorState message={error} onRetry={() => setError('')} />}

            <button
              type="button"
              onClick={process}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-[#0D0D0D] text-[#FFFF66] font-bold px-6 py-3 rounded-xl border-none cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-[#FFFF66] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles size={18} />
              )}
              Generate full study package
            </button>
          </div>

          {loading && <LoadingSkeleton lines={6} />}

          {!loading && !doc && !error && (
            <EmptyState
              title="Nothing generated yet"
              hint="Try a lecture PDF or a Wikipedia URL — you’ll get lesson + drills + cards in one pass, so you don’t hunt across tabs."
            />
          )}

          <AnimatePresence>
            {out && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border-2 border-[#FFFF66] rounded-[20px] overflow-hidden"
              >
                <Tabs value={tab} onValueChange={setTab} className="p-4 md:p-6">
                  <TabsList className="flex flex-wrap h-auto gap-1 w-full justify-start">
                    <TabsTrigger value="lesson">Lesson</TabsTrigger>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
                    <TabsTrigger value="questions">Quiz bank</TabsTrigger>
                    <TabsTrigger value="practice">Practice</TabsTrigger>
                    <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
                    <TabsTrigger value="videos">Videos</TabsTrigger>
                  </TabsList>

                  <div className="max-h-[560px] overflow-y-auto text-[15px] leading-relaxed mt-4">
                    <TabsContent value="lesson" className="mt-0">
                      <h4 className="font-display font-bold text-xl mb-2">{lesson?.title || subject}</h4>
                      <ul className="list-disc pl-5 text-sm text-[#555555] mb-4">
                        {(lesson?.objectives || []).map((o, i) => (
                          <li key={i}>{o}</li>
                        ))}
                      </ul>
                      {(lesson?.sections || []).map((sec, i) => (
                        <div key={i} className="mb-6 border border-[#ECECEC] rounded-xl p-4">
                          <h5 className="font-bold text-[#0D0D0D] mb-2">{sec.heading}</h5>
                          <div className="whitespace-pre-wrap text-[#333]">{sec.content}</div>
                        </div>
                      ))}
                    </TabsContent>
                    <TabsContent value="summary" className="mt-0 whitespace-pre-wrap">
                      {out.summary}
                    </TabsContent>
                    <TabsContent value="flashcards" className="mt-0">
                      <ul className="space-y-3">
                        {(out.flashcards || []).map((c, i) => (
                          <li key={i} className="border border-[#E0E0E0] rounded-xl p-4">
                            <p className="font-bold text-[#0D0D0D]">{c.front}</p>
                            <p className="text-[#555555] mt-2">{c.back}</p>
                          </li>
                        ))}
                      </ul>
                    </TabsContent>
                    <TabsContent value="questions" className="mt-0">
                      <ul className="space-y-4">
                        {[...(out.self_test_questions || []), ...(out.question_bank || [])].map((q, i) => (
                          <li key={i} className="border border-[#E0E0E0] rounded-xl p-4">
                            <p className="font-semibold">{q.question}</p>
                            {q.type === 'mcq' && q.options && (
                              <ul className="mt-2 text-sm text-[#555555] list-disc pl-5">
                                {q.options.map((o, j) => (
                                  <li key={j}>{o}</li>
                                ))}
                              </ul>
                            )}
                            <p className="mt-2 text-sm text-green-800">Answer: {String(q.answer)}</p>
                          </li>
                        ))}
                      </ul>
                    </TabsContent>
                    <TabsContent value="practice" className="mt-0">
                      <ul className="space-y-4">
                        {(out.practice_problems || []).map((p, i) => (
                          <li key={i} className="border border-[#E0E0E0] rounded-xl p-4">
                            <p className="font-bold text-[#0D0D0D]">
                              {p.title || `Problem ${i + 1}`}{' '}
                              <span className="text-xs font-normal text-[#888]">difficulty {p.difficulty ?? '—'}</span>
                            </p>
                            <p className="mt-2 whitespace-pre-wrap">{p.prompt}</p>
                            {p.hints?.length > 0 && (
                              <p className="mt-2 text-sm text-[#555555]">
                                <span className="font-bold">Hints:</span> {p.hints.join(' · ')}
                              </p>
                            )}
                            <p className="mt-2 text-sm text-[#333]">
                              <span className="font-bold">Approach:</span> {p.solution_outline}
                            </p>
                            {p.rubric_points?.length > 0 && (
                              <ul className="mt-2 text-xs list-disc pl-5 text-[#666]">
                                {p.rubric_points.map((r, j) => (
                                  <li key={j}>{r}</li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </TabsContent>
                    <TabsContent value="roadmap" className="mt-0">
                      <div>
                        <h4 className="font-display font-bold text-lg mb-3">{out.roadmap?.title}</h4>
                        <ul className="space-y-4">
                          {(out.roadmap?.phases || []).map((p, i) => (
                            <li key={i} className="border rounded-xl p-4">
                              <p className="font-bold">
                                {p.title}{' '}
                                <span className="text-xs font-normal text-[#555555]">~{p.estimated_days} days</span>
                              </p>
                              <ul className="list-disc pl-5 mt-2 text-sm">
                                {p.tasks?.map((t, j) => (
                                  <li key={j}>{t}</li>
                                ))}
                              </ul>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </TabsContent>
                    <TabsContent value="videos" className="mt-0">
                      <ul className="space-y-3">
                        {(out.recommended_videos || []).map((v, i) => (
                          <li key={i}>
                            <a href={v.url} target="_blank" rel="noreferrer" className="text-[#0D0D0D] font-bold underline">
                              {v.title || v.videoId}
                            </a>
                            {v.reason && <p className="text-sm text-[#555555]">{v.reason}</p>}
                          </li>
                        ))}
                      </ul>
                    </TabsContent>
                  </div>
                </Tabs>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
