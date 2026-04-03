import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import DataCollection from './pages/DataCollection';
import Dashboard from './pages/Dashboard';
import ExamDates from './pages/ExamDates';
import GrowthAnalysis from './pages/GrowthAnalysis';
import QuestionGenerator from './pages/QuestionGenerator';
import Quiz from './pages/Quiz';
import StudyMaterials from './pages/StudyMaterials';
import SubjectPage from './pages/SubjectPage';
import Timetable from './pages/Timetable';
import Profile from './pages/Profile';
import SmartUploadHub from './pages/SmartUploadHub';
import KnowledgeGraphPage from './pages/KnowledgeGraphPage';
import ExamSimulator from './pages/ExamSimulator';
import GoalsSprints from './pages/GoalsSprints';
import CompetitiveArena from './pages/CompetitiveArena';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-[#555555]">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function RequireEdu({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.hasCompletedDataCollection && location.pathname !== '/data-collection')
    return <Navigate to="/data-collection" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/data-collection" element={<RequireAuth><DataCollection /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireEdu><Dashboard /></RequireEdu>} />
          <Route path="/exam-dates" element={<RequireEdu><ExamDates /></RequireEdu>} />
          <Route path="/growth" element={<RequireEdu><GrowthAnalysis /></RequireEdu>} />
          <Route path="/questions" element={<RequireEdu><QuestionGenerator /></RequireEdu>} />
          <Route path="/quiz" element={<RequireEdu><Quiz /></RequireEdu>} />
          <Route path="/materials" element={<RequireEdu><StudyMaterials /></RequireEdu>} />
          <Route path="/subject/:subjectName" element={<RequireEdu><SubjectPage /></RequireEdu>} />
          <Route path="/timetable" element={<RequireEdu><Timetable /></RequireEdu>} />
          <Route path="/profile" element={<RequireEdu><Profile /></RequireEdu>} />
          <Route path="/study/upload" element={<RequireEdu><SmartUploadHub /></RequireEdu>} />
          <Route path="/study/graph" element={<RequireEdu><KnowledgeGraphPage /></RequireEdu>} />
          <Route path="/study/exam" element={<RequireEdu><ExamSimulator /></RequireEdu>} />
          <Route path="/study/goals" element={<RequireEdu><GoalsSprints /></RequireEdu>} />
          <Route path="/study/arena" element={<RequireEdu><CompetitiveArena /></RequireEdu>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
