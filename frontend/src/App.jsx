import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import AuthPage from './AuthPage';
import FloorDashboard from './FloorDashboard';
import AdminDashboard from './AdminDashboard';
import ProfilePage from './ProfilePage';
import RequireAuth from './RequireAuth';

function AuthRoute() {
  const navigate = useNavigate();
  return <AuthPage onAuthed={() => navigate('/home')} />;
}


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthRoute />} />
        <Route
          path="/home"
          element={
            <RequireAuth>
              <FloorDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}