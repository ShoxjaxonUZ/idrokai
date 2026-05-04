import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/home'
import Login from './pages/login'
import Register from './pages/register'
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
import Leaderboard from './pages/Leaderboard'
import Onboarding from './pages/Onboarding'
import Daily from './pages/Daily'
import ModuleTest from './pages/ModuleTest'
import TeacherApply from './pages/TeacherApply'
import TeacherDashboard from './pages/TeacherDashboard'
import RequireAuth from './lib/RequireAuth'
import Loading from './components/Loading'
import VerifyEmail from './pages/VerifyEmail'

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
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/courses/:id" element={<CourseDetail />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/help" element={<Help />} />
              <Route path="/privacy" element={<Privacy />} />

              <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
              <Route path="/certificate/:id" element={<RequireAuth><Certificate /></RequireAuth>} />
              <Route path="/courses/:courseId/lessons/:lessonIndex" element={<RequireAuth><Lesson /></RequireAuth>} />
              <Route path="/courses/:courseId/module-test/:moduleIndex" element={<RequireAuth><ModuleTest /></RequireAuth>} />
              <Route path="/ai-quiz" element={<RequireAuth><AIQuiz /></RequireAuth>} />
              <Route path="/ai-teacher" element={<RequireAuth><AITeacher /></RequireAuth>} />
              <Route path="/battle" element={<RequireAuth><Battle /></RequireAuth>} />
              <Route path="/daily" element={<RequireAuth><Daily /></RequireAuth>} />
              <Route path="/leaderboard" element={<RequireAuth><Leaderboard /></RequireAuth>} />

              <Route path="/teacher/apply" element={<RequireAuth><TeacherApply /></RequireAuth>} />
              <Route path="/teacher/dashboard" element={<RequireAuth role={['teacher', 'admin']}><TeacherDashboard /></RequireAuth>} />

              <Route path="/admin" element={<RequireAuth role="admin"><Admin /></RequireAuth>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Router>
      </NotificationProvider>
    </ThemeProvider>
  )
}

export default App
