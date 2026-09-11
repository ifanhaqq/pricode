import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AdminRoute, StudentRoute } from './components/RouteGuards'

import LoginPage from './pages/LoginPage'
import StudentDashboardPage from './pages/student/StudentDashboardPage'
import StudentActivityPlayerPage from './pages/student/StudentActivityPlayerPage'
import FinalQuizPlayerPage from './pages/student/FinalQuizPlayerPage'
import AdminLayout from './pages/admin/AdminLayout'
import StudentManagementPage from './pages/admin/StudentManagementPage'
import InstructorProgressPage from './pages/admin/InstructorProgressPage'
import CourseListPage from './pages/admin/CourseListPage'
import CourseDetailPage from './pages/admin/CourseDetailPage'
import TextActivityEditor from './pages/admin/editors/TextActivityEditor'
import VideoActivityEditor from './pages/admin/editors/VideoActivityEditor'
import IABlockEditor from './pages/admin/editors/IABlockEditor'
import SubCourseQuizEditor from './pages/admin/editors/SubCourseQuizEditor'
import FinalQuizEditor from './pages/admin/editors/FinalQuizEditor'
import InfraTestPage from './pages/InfraTestPage'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Student Protected Routes */}
          <Route element={<StudentRoute />}>
            <Route path="/dashboard" element={<StudentDashboardPage />} />
            <Route path="/learn/:subcourseId" element={<StudentActivityPlayerPage />} />
            <Route path="/learn/:subcourseId/:activityType" element={<StudentActivityPlayerPage />} />
            <Route path="/courses/:courseId/final-quiz" element={<FinalQuizPlayerPage />} />
          </Route>

          {/* Admin Protected Routes */}
          <Route path="/admin" element={<AdminRoute />}>
            <Route index element={<Navigate to="/admin/courses" replace />} />
            <Route element={<AdminLayout />}>
              {/* Course & Content Authoring CMS */}
              <Route path="courses" element={<CourseListPage />} />
              <Route path="courses/:courseId" element={<CourseDetailPage />} />
              <Route path="courses/:courseId/final-quiz" element={<FinalQuizEditor />} />
              <Route
                path="courses/:courseId/subcourses/:subcourseId/activity/text"
                element={<TextActivityEditor />}
              />
              <Route
                path="courses/:courseId/subcourses/:subcourseId/activity/video"
                element={<VideoActivityEditor />}
              />
              <Route
                path="courses/:courseId/subcourses/:subcourseId/activity/ia1"
                element={<IABlockEditor />}
              />
              <Route
                path="courses/:courseId/subcourses/:subcourseId/activity/ia2"
                element={<IABlockEditor />}
              />
              <Route
                path="courses/:courseId/subcourses/:subcourseId/activity/quiz"
                element={<SubCourseQuizEditor />}
              />

              {/* Student Management */}
              <Route path="students" element={<StudentManagementPage />} />

              {/* Instructor Progress Dashboard */}
              <Route path="progress" element={<InstructorProgressPage />} />
            </Route>
          </Route>

          {/* Diagnostic Route */}
          <Route path="/infra-test" element={<InfraTestPage />} />

          {/* Default Fallback */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
