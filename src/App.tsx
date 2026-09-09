import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AdminRoute, StudentRoute } from './components/RouteGuards'

import LoginPage from './pages/LoginPage'
import StudentDashboardPage from './pages/student/StudentDashboardPage'
import AdminLayout from './pages/admin/AdminLayout'
import StudentManagementPage from './pages/admin/StudentManagementPage'
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
          </Route>

          {/* Admin Protected Routes */}
          <Route path="/admin" element={<AdminRoute />}>
            <Route index element={<Navigate to="/admin/students" replace />} />
            <Route element={<AdminLayout />}>
              <Route path="students" element={<StudentManagementPage />} />
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
