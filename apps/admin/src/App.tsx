import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './layout/AdminLayout';
import { useAuth } from './auth';
import { LoadingBlock } from './components/LoadingBlock';
import { DashboardPage } from './pages/DashboardPage';
import { GamesPage } from './pages/GamesPage';
import { LoginPage } from './pages/LoginPage';

function RequireAuth() {
  const { user, ready } = useAuth();
  if (!ready) {
    return <LoadingBlock label="正在确认登录状态" />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <AdminLayout />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route index element={<DashboardPage />} />
        <Route path="games" element={<GamesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
