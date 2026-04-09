import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  exportRoadmapPdf,
  generateRoadmap,
  getRoadmap,
  getRoadmapToday,
  updateRoadmapProgress,
} from '../../utils/careerApi';
import OnboardingQuiz from './OnboardingQuiz';
import ProgressDashboard from './ProgressDashboard';
import RoadmapVisualization from './RoadmapVisualization';

function downloadBase64File({ filename, contentBase64, mimeType }) {
  const bin = atob(contentBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download.bin';
  a.click();
  URL.revokeObjectURL(url);
}

export default function RoadmapPage() {
  const { user } = useAuth();
  const [roadmap, setRoadmap] = useState(null);
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const hasRoadmap = Boolean(roadmap?.phases?.length);
  const phases = useMemo(() => roadmap?.phases || [], [roadmap]);

  const load = async () => {
    if (!user?.id) return;
    setError('');
    try {
      const [roadmapRes, todayRes] = await Promise.all([
        getRoadmap(user.id).catch(() => null),
        getRoadmapToday(user.id).catch(() => null),
      ]);
      if (roadmapRes?.roadmap) setRoadmap(roadmapRes.roadmap);
      if (todayRes?.today) setToday(todayRes.today);
    } catch (e) {
      setError(e?.message || 'Could not load roadmap.');
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const handleGenerate = async (quizPayload) => {
    setLoading(true);
    setError('');
    try {
      const res = await generateRoadmap(quizPayload);
      setRoadmap(res.roadmap);
      const todayRes = await getRoadmapToday(user.id).catch(() => null);
      if (todayRes?.today) setToday(todayRes.today);
    } catch (e) {
      setError(e?.message || 'Roadmap generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const onToggleItem = async (itemId, completed) => {
    try {
      const res = await updateRoadmapProgress({ itemId, completed });
      setRoadmap(res.roadmap);
    } catch (e) {
      setError(e?.message || 'Could not update progress.');
    }
  };

  const onExport = async () => {
    try {
      const payload = await exportRoadmapPdf();
      if (payload?.contentBase64) downloadBase64File(payload);
    } catch (e) {
      setError(e?.message || 'Could not export roadmap.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="career-kicker">Career Roadmap</div>
          <h1 className="font-display font-extrabold text-3xl mt-1">AI-powered planning</h1>
          <p className="text-sm text-white/65 mt-2 max-w-2xl">
            Personalized phases, project milestones, progress tracking, and daily next-action recommendations.
          </p>
        </div>
        {hasRoadmap ? (
          <div className="flex gap-2">
            <button className="career-btn" onClick={() => handleGenerate(roadmap.quiz || {})}>Regenerate</button>
            <button className="career-btn" onClick={onExport}>Export PDF</button>
            <button
              className="career-btn"
              onClick={() => {
                const url = `${window.location.origin}/api/roadmap/share/${roadmap.shareId}`;
                navigator.clipboard.writeText(url).catch(() => {});
              }}
            >
              Share
            </button>
          </div>
        ) : null}
      </div>

      {error ? <div className="career-card text-red-300 border-red-500/40">{error}</div> : null}

      {!hasRoadmap ? (
        <OnboardingQuiz initial={roadmap?.quiz} loading={loading} onSubmit={handleGenerate} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <RoadmapVisualization phases={phases} expandedId={expandedId} setExpandedId={setExpandedId} onToggleItem={onToggleItem} />
          </div>
          <div>
            <ProgressDashboard roadmap={roadmap} today={today} />
          </div>
        </div>
      )}
    </div>
  );
}
