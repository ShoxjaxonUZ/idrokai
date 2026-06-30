import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/home'
import Login from './pages/login'
import Register from './pages/register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import Courses from './pages/courses'
import CourseDetail from './pages/coursedetail'
import Dashboard from './pages/dashboard'
import Admin from './pages/admin'
import Profile from './pages/profile'
import NotFound from './pages/NotFound'
import Lesson from './pages/Lesson'
import AIQuiz from './pages/AIQuiz'
import Battle from './pages/Battle'
import { ThemeProvider } from './context/ThemeContext'
import { NotificationProvider } from './context/NotificationContext'
import About from './pages/About'
import Contact from './pages/Contact'
import Help from './pages/Help'
import Privacy from './pages/Privacy'
import AITeacher from './pages/AITeacher'
import Pricing from './pages/Pricing'
import Leaderboard from './pages/Leaderboard'
import Onboarding from './pages/Onboarding'
import Daily from './pages/Daily'
import Friends from './pages/Friends'
import Portfolio from './pages/Portfolio'
import Messages from './pages/Messages'
import Notifications from './pages/Notifications'
import VerifyCertificate from './pages/VerifyCertificate'
import ModuleTest from './pages/ModuleTest'
import RequireAuth from './lib/RequireAuth'
import Loading from './components/Loading'
import InstallPrompt from './components/InstallPrompt'
import CookieConsent from './components/CookieConsent'

const Certificate = lazy(() => import('./pages/certificate'))

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <Router>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/courses/:id" element={<CourseDetail />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/help" element={<Help />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/certificate-demo" element={<Certificate demo />} />
              <Route path="/verify/:code" element={<VerifyCertificate />} />
              <Route path="/portfolio/:userId" element={<Portfolio />} />

              <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
              <Route path="/friends" element={<RequireAuth><Friends /></RequireAuth>} />
              <Route path="/portfolio" element={<RequireAuth><Portfolio /></RequireAuth>} />
              <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
              <Route path="/certificate/:id" element={<RequireAuth><Certificate /></RequireAuth>} />
              <Route path="/courses/:courseId/lessons/:lessonIndex" element={<RequireAuth><Lesson /></RequireAuth>} />
              <Route path="/courses/:courseId/module-test/:moduleIndex" element={<RequireAuth><ModuleTest /></RequireAuth>} />
              {/* Guest ham ko'ra oladi — preview rejim. Interaktiv action'lar register'ga yo'naltiradi */}
              <Route path="/ai-quiz" element={<AIQuiz />} />
              <Route path="/ai-teacher" element={<AITeacher />} />
              <Route path="/battle" element={<Battle />} />
              <Route path="/daily" element={<Daily />} />
              <Route path="/leaderboard" element={<Leaderboard />} />

              <Route path="/admin" element={<RequireAuth role="admin"><Admin /></RequireAuth>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            <InstallPrompt />
            <CookieConsent />
          </Suspense>
        </Router>
      </NotificationProvider>
    </ThemeProvider>
  )
}

export default App
