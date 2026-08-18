import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { lazy, Suspense } from 'react';
import useAuthStore from './store/authStore';
import Layout from './components/layout/Layout';
import Login, { ProtectedRoute } from './pages/auth/Login';
import { Loading } from './components/ui';

const OwnersPage       = lazy(() => import('./pages/owners/OwnersPage'));
const LeadsPage        = lazy(() => import('./pages/leads/LeadsPage'));
const LeavesPage       = lazy(() => import('./pages/leaves/LeavesPage'));
const PropertiesPage   = lazy(() => import('./pages/properties/PropertiesPage'));
const EmployeesPage    = lazy(() => import('./pages/employees/EmployeesPage'));
const AttendancePage   = lazy(() => import('./pages/attendance/AttendancePage'));
const PunchPage        = lazy(() => import('./pages/attendance/PunchPage'));
const PermissionsPage  = lazy(() => import('./pages/permissions/PermissionsPage'));
const NotificationsPage= lazy(() => import('./pages/notifications/NotificationsPage'));
const ProfilePage      = lazy(() => import('./pages/profile/ProfilePage'));
const SettingsPage     = lazy(() => import('./pages/settings/SettingsPage'));
const ReportsPage      = lazy(() => import('./pages/reports/ReportsPage'));
const RolesPage        = lazy(() => import('./pages/roles/RolesPage'));

function Dashboard() {
  const { employee } = useAuthStore();
  return (
    <div className="p-6 font-[Cairo]" dir="rtl">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-100">
          أهلاً، {employee?.full_name} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">{employee?.job_title}</p>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {[
          { emoji: '🏢', label: 'العقارات',         path: '/properties', color: 'blue' },
          { emoji: '👥', label: 'الملاك',            path: '/owners',     color: 'green' },
          { emoji: '🎯', label: 'المهتمون',          path: '/leads',      color: 'purple' },
          { emoji: '💼', label: 'الموظفون',          path: '/employees',  color: 'amber' },
          { emoji: '⏰', label: 'الحضور والانصراف',  path: '/attendance', color: 'teal' },
          { emoji: '👆', label: 'بصمتي',             path: '/punch',      color: 'cyan' },
          { emoji: '🌴', label: 'الإجازات',          path: '/leaves',     color: 'rose' },
        ].map(item => (
          <a key={item.path} href={item.path}
            className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-all cursor-pointer group">
            <div className="text-4xl mb-3">{item.emoji}</div>
            <p className="font-bold text-gray-200 group-hover:text-white transition-colors">{item.label}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function Placeholder({ title, emoji }) {
  return (
    <div className="flex items-center justify-center h-64 font-[Cairo]" dir="rtl">
      <div className="text-center text-gray-500">
        <p className="text-5xl mb-3">{emoji}</p>
        <p className="font-semibold text-gray-300">{title}</p>
        <p className="text-sm mt-1">قريباً...</p>
      </div>
    </div>
  );
}

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  const { token } = useAuthStore();

  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Toaster
          position="top-left"
          toastOptions={{
            style: {
              background: '#1f2937',
              color: '#f3f4f6',
              border: '1px solid #374151',
              fontFamily: 'Cairo, sans-serif',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />

        <Routes>
          <Route path="/login" element={token ? <Navigate to="/" /> : <Login />} />

          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />

            <Route path="/properties" element={
              <ProtectedRoute page="properties">
                <Suspense fallback={<Loading />}>
                  <PropertiesPage />
                </Suspense>
              </ProtectedRoute>
            } />

            <Route path="/owners" element={
              <ProtectedRoute page="owners">
                <Suspense fallback={<Loading />}>
                  <OwnersPage />
                </Suspense>
              </ProtectedRoute>
            } />

            <Route path="/leads" element={
              <ProtectedRoute page="leads">
                <Suspense fallback={<Loading />}>
                  <LeadsPage />
                </Suspense>
              </ProtectedRoute>
            } />

            <Route path="/employees" element={
              <ProtectedRoute page="employees">
                <Suspense fallback={<Loading />}>
                  <EmployeesPage />
                </Suspense>
              </ProtectedRoute>
            } />

            <Route path="/attendance" element={
              <ProtectedRoute page="attendance">
                <Suspense fallback={<Loading />}>
                  <AttendancePage />
                </Suspense>
              </ProtectedRoute>
            } />

            <Route path="/punch" element={
              <Suspense fallback={<Loading />}>
                <PunchPage />
              </Suspense>
            } />

            <Route path="/leaves" element={
              <ProtectedRoute page="leave_requests">
                <Suspense fallback={<Loading />}>
                  <LeavesPage />
                </Suspense>
              </ProtectedRoute>
            } />

            <Route path="/permissions" element={
              <ProtectedRoute page="permissions">
                <Suspense fallback={<Loading />}>
                  <PermissionsPage />
                </Suspense>
              </ProtectedRoute>
            } />

            <Route path="/notifications" element={
              <Suspense fallback={<Loading />}>
                <NotificationsPage />
              </Suspense>
            } />

            <Route path="/profile" element={
              <Suspense fallback={<Loading />}>
                <ProfilePage />
              </Suspense>
            } />

            <Route path="/settings" element={
              <Suspense fallback={<Loading />}>
                <SettingsPage />
              </Suspense>
            } />

            <Route path="/reports" element={
              <Suspense fallback={<Loading />}>
                <ReportsPage />
              </Suspense>
            } />

            <Route path="/roles" element={
              <ProtectedRoute page="roles">
                <Suspense fallback={<Loading />}>
                  <RolesPage />
                </Suspense>
              </ProtectedRoute>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}