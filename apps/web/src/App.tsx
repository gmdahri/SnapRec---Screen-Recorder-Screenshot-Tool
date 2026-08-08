import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import Library from './pages/Library';
import Projects from './pages/Projects';
import Shared from './pages/Shared';
import ClaimCaptures from './pages/ClaimCaptures';
import Home from './pages/Home';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import ShareView from './pages/ShareView';

const Editor = React.lazy(() => import('./pages/Editor'));
const VideoEditorPage = React.lazy(() => import('./pages/VideoEditor/VideoEditorPage'));
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Privacy from './pages/Privacy';
import Landing from './pages/Landing';
import Changelog from './pages/Changelog';
import HowItWorks from './pages/HowItWorks';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import About from './pages/About';
import Terms from './pages/Terms';
import Contact from './pages/Contact';
import LoomAlternative from './pages/LoomAlternative';
import ScreencastifyAlternative from './pages/ScreencastifyAlternative';
import WebcamOverlayPresentation from './pages/WebcamOverlayPresentation';
import ScreenRecorderForTeachers from './pages/ScreenRecorderForTeachers';
import AuthorPage from './pages/AuthorPage';

import { HelmetProvider } from 'react-helmet-async';
import { CookieConsent } from './components';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <NotificationProvider>
          <AuthProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                {/* Auth-adjacent: deliberately absent from prerender.mjs,
                    sitemap.xml and indexnow.yml — see src/__tests__/routes.test.ts */}
                <Route path="/claim" element={
                  <ProtectedRoute>
                    <ClaimCaptures />
                  </ProtectedRoute>
                } />
                {/* /dashboard was the old Home. Redirect rather than
                    duplicate — existing links and bookmarks still work. */}
                <Route path="/dashboard" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                } />
                <Route path="/library" element={
                  <ProtectedRoute>
                    <Library />
                  </ProtectedRoute>
                } />
                <Route path="/projects" element={
                  <ProtectedRoute>
                    <Projects />
                  </ProtectedRoute>
                } />
                <Route path="/shared" element={
                  <ProtectedRoute>
                    <Shared />
                  </ProtectedRoute>
                } />
                <Route path="/analytics" element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } />
                {/* Editor and VideoPreview accessible without login, but with limited features */}
                <Route path="/editor/:id?" element={
                  <Suspense fallback={
                    <div className="h-screen flex flex-col items-center justify-center bg-background-light text-slate-600">
                      <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                      <p className="text-sm font-medium">Loading editor...</p>
                    </div>
                  }>
                    <Editor />
                  </Suspense>
                } />
                <Route
                  path="/video-editor/project/:projectId"
                  element={
                    <ProtectedRoute>
                      <Suspense
                        fallback={
                          <div className="h-screen flex items-center justify-center bg-[#f8fafc] text-slate-600">
                            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        }
                      >
                        <VideoEditorPage />
                      </Suspense>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/video-editor"
                  element={
                    <ProtectedRoute>
                      <Suspense
                        fallback={
                          <div className="h-screen flex items-center justify-center bg-[#f8fafc] text-slate-600">
                            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        }
                      >
                        <VideoEditorPage />
                      </Suspense>
                    </ProtectedRoute>
                  }
                />
                <Route path="/video-preview/:id" element={<Navigate to="/v/:id" replace />} />
                <Route path="/v/:id?" element={<ShareView />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/changelog" element={<Changelog />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
                <Route path="/loom-alternative" element={<LoomAlternative />} />
                <Route path="/screencastify-alternative" element={<ScreencastifyAlternative />} />
                <Route path="/webcam-overlay-presentation" element={<WebcamOverlayPresentation />} />
                <Route path="/screen-recorder-for-teachers" element={<ScreenRecorderForTeachers />} />
                <Route path="/about/ghulam-muhammad" element={<AuthorPage />} />
                <Route path="/" element={<Landing />} />
              </Routes>
              <CookieConsent />
            </Router>
          </AuthProvider>
        </NotificationProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
