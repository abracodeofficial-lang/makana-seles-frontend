import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { Avatar } from '../ui';
import {
  Home, Building2, Users, UserCheck, Clock, Calendar,
  FileCheck, Bell, LogOut, Menu, X, Fingerprint, Settings, BarChart2, ShieldCheck,
} from 'lucide-react';

const NAV = [
  { label: 'الرئيسية',        path: '/',             icon: Home,        section: null },
  { label: 'العقارات',         path: '/properties',   icon: Building2,   section: 'المبيعات',         perm: 'properties' },
  { label: 'الملاك',           path: '/owners',        icon: Users,       section: 'المبيعات',         perm: 'owners' },
  { label: 'المهتمون',         path: '/leads',         icon: UserCheck,   section: 'المبيعات',         perm: 'leads' },
  { label: 'الموظفون',         path: '/employees',     icon: Users,       section: 'الموارد البشرية', perm: 'employees' },
  { label: 'الحضور',           path: '/attendance',    icon: Clock,       section: 'الموارد البشرية', perm: 'attendance' },
  { label: 'بصمتي',            path: '/punch',         icon: Fingerprint, section: 'الموارد البشرية' },
  { label: 'الإجازات',         path: '/leaves',        icon: Calendar,    section: 'الموارد البشرية', perm: 'leave_requests' },
  { label: 'الإذونات',         path: '/permissions',   icon: FileCheck,   section: 'الموارد البشرية', perm: 'permissions' },
  { label: 'الأدوار والصلاحيات',path: '/roles',        icon: ShieldCheck, section: 'الموارد البشرية', perm: 'roles' },
  { label: 'الإشعارات',        path: '/notifications', icon: Bell,        section: null },
  { label: 'التقارير',         path: '/reports',       icon: BarChart2,   section: null, perm: 'reports'  },
  { label: 'الإعدادات',        path: '/settings',      icon: Settings,    section: null, perm: 'settings' },
];

export default function Layout() {
  const { employee, permissions, logout } = useAuthStore();
  const navigate   = useNavigate();
  const [collapsed,  setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleNav = NAV.filter(item => {
    if (!item.perm) return true;
    return permissions?.[item.perm]?.view === true;
  });

  const sections = ['المبيعات', 'الموارد البشرية', null];

  return (
    <div className="flex h-screen bg-gray-950 font-[Cairo] overflow-hidden" dir="rtl">

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — fixed drawer on mobile, static on desktop */}
      <aside className={`
        fixed inset-y-0 right-0 z-50
        md:relative md:inset-auto md:z-auto
        flex flex-col flex-shrink-0
        bg-gray-900 border-l border-gray-800
        transition-all duration-200
        w-64 ${collapsed ? 'md:w-16' : 'md:w-56'}
        ${mobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>

        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800 flex-shrink-0">
          <div className={collapsed ? 'md:hidden' : ''}>
            <p className="text-sm font-bold text-gray-100">نظام الإدارة</p>
            <p className="text-xs text-gray-500 hidden sm:block">المبيعات والموارد البشرية</p>
          </div>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden md:block text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Menu size={18} />
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {sections.map(section => {
            const items = visibleNav.filter(i => i.section === section);
            if (!items.length) return null;
            return (
              <div key={section ?? 'general'} className="mb-3">
                {section && (
                  <p className={`text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-3 mb-1.5 ${collapsed ? 'md:hidden' : ''}`}>
                    {section}
                  </p>
                )}
                {items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    title={item.label}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                      ${collapsed ? 'md:justify-center md:px-2' : ''}
                      ${isActive
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                      }`
                    }
                  >
                    <item.icon size={16} className="flex-shrink-0" />
                    <span className={collapsed ? 'md:hidden' : ''}>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-gray-800 flex-shrink-0">
          <div className={`flex items-center gap-1 ${collapsed ? 'md:hidden' : ''}`}>
            <NavLink
              to="/profile"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-2 py-2 flex-1 min-w-0 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Avatar name={employee?.full_name || ''} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-200 truncate">{employee?.full_name}</p>
                <p className="text-xs text-gray-500 truncate">{employee?.job_title}</p>
              </div>
            </NavLink>
            <button onClick={handleLogout} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0" title="تسجيل الخروج">
              <LogOut size={16} />
            </button>
          </div>
          {collapsed && (
            <button onClick={handleLogout} className="hidden md:flex w-full justify-center py-2 text-gray-600 hover:text-red-400 transition-colors">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between h-14 px-4 bg-gray-900 border-b border-gray-800 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-gray-400 hover:text-gray-200 transition-colors">
            <Menu size={22} />
          </button>
          <p className="text-sm font-bold text-gray-100">نظام الإدارة</p>
          <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition-colors">
            <LogOut size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 sm:px-6 py-3 sm:py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-gray-100 truncate">{title}</h1>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
