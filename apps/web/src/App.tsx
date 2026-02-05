import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import ShareView from './pages/ShareView';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import VideoPreview from './pages/VideoPreview';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          {/* Editor and VideoPreview accessible without login, but with limited features */}
          <Route path="/editor/:id?" element={<Editor />} />
          <Route path="/video-preview/:id?" element={<VideoPreview />} />
          <Route path="/v/:id" element={<ShareView />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
