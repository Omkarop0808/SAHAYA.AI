import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import DashHeader from '../components/DashHeader';
import { LoadingSkeleton, ErrorState } from '../components/PageStates';
import api from '../utils/api';
import { Play, Send, Flag } from 'lucide-react';

export default function ExamSimulator() {
  const [subject, setSubject] = useState('Mathematics');
  const [examDate, setExamDate] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const start = async () => {
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post('/study/exam/start', { subject, examDate });
      setSessionId(data.sessionId);
      setQuestion(data.question);
      setSelected('');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const answer = async () => {
    if (!sessionId || !question) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/study/exam/answer', {
        sessionId,
        questionId: question.id,
        selectedOption: selected,
      });
      setQuestion(data.nextQuestion);
      setSelected('');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const finish = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const { data } = await api.post('/study/exam/finish', { sessionId });
      setResult(data);
      setSessionId(null);
      setQuestion(null);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col bg-[#F9F9F9] min-w-0">
        <DashHeader title="Adaptive Exam Simulator" />
        <div className="p-8 max-w-3xl mx-auto w-full space-y-6 max-sm:p-4">
          <p className="text-sm text-[#555555]">Wrong answers steer the next question toward weak areas. Finish to get a weakness map and 3-day revision plan (Gemini JSON).</p>

          {!sessionId && !result && (
            <div className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-6 space-y-4">
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full border-2 rounded-xl px-4 py-3" placeholder="Subject" />
              <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="w-full border-2 rounded-xl px-4 py-3" />
              <button type="button" onClick={start} disabled={loading} className="inline-flex items-center gap-2 bg-[#0D0D0D] text-[#FFFF66] font-bold px-5 py-3 rounded-xl border-none cursor-pointer">
                <Play size={18} /> Start mock exam
              </button>
            </div>
          )}

          {loading && <LoadingSkeleton />}

          {error && <ErrorState message={error} onRetry={() => setError('')} />}

          {sessionId && question && (
            <div className="bg-white border-2 border-[#FFFF66] rounded-[20px] p-6 space-y-4">
              <p className="font-display font-bold text-lg">{question.question}</p>
              <div className="space-y-2">
                {(question.options || []).map((o) => (
                  <label key={o} className="flex items-center gap-2 cursor-pointer text-[15px]">
                    <input type="radio" name="mcq" checked={selected === o} onChange={() => setSelected(o)} />
                    {o}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={answer} disabled={loading || !selected} className="inline-flex items-center gap-2 bg-[#0D0D0D] text-[#FFFF66] font-bold px-4 py-2 rounded-xl border-none cursor-pointer disabled:opacity-50">
                  <Send size={16} /> Submit & next
                </button>
                <button type="button" onClick={finish} disabled={loading} className="inline-flex items-center gap-2 bg-white border-2 border-[#0D0D0D] font-bold px-4 py-2 rounded-xl cursor-pointer">
                  <Flag size={16} /> End & analyze
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-6">
                <h3 className="font-display font-bold text-lg mb-2">Weakness map</h3>
                <ul className="space-y-2">
                  {(result.weakness_map || []).map((w, i) => (
                    <li key={i} className="text-sm border border-[#E0E0E0] rounded-lg p-3">
                      <span className="font-bold">{w.topic}</span> · severity {w.severity}
                      <p className="text-[#555555]">{w.hint}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white border-2 border-[#0D0D0D] rounded-[20px] p-6">
                <h3 className="font-display font-bold text-lg mb-2">3-day revision</h3>
                <ul className="space-y-3">
                  {(result.revision_plan || []).map((d) => (
                    <li key={d.day}>
                      <p className="font-bold">Day {d.day}</p>
                      <ul className="list-disc pl-5 text-sm">{d.tasks?.map((t, i) => <li key={i}>{t}</li>)}</ul>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => { setResult(null); }} className="mt-4 text-sm font-bold underline cursor-pointer bg-transparent border-none">Start over</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
