import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { attendanceApi, pushApi } from '../../api/services';
import { pushSupported, enablePush, syncPush, isIOS, isStandalone } from '../../lib/push';
import { Avatar } from '../ui';
import {
  Home, Building2, Users, UserCheck, Clock, Calendar,
  FileCheck, Bell, BellRing, LogOut, Menu, X, Fingerprint, Settings, BarChart2, ShieldCheck,
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

        <OnlineBar />
        <PushPrompt />

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

// ── شريط "متصل الآن" — الموظفون الحاضرون حالياً (بصموا حضور ولسا ما بصموا انصراف) ──
const fmtHM = (t) => t ? t.slice(0, 5) : '';

// "4 س 15 د" / "35 د"
const fmtDuration = (mins) => {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m} د`;
  return m === 0 ? `${h} س` : `${h} س ${m} د`;
};

// الدقائق المتبقية لنهاية الدوام (سالبة = تجاوز نهاية الدوام).
// لو الدوام ليلي (نهايته قبل وقت البصمة) منعتبر النهاية باليوم التالي.
const minutesUntilShiftEnd = (shiftEnd, checkIn, now) => {
  const [eh, em] = shiftEnd.split(':').map(Number);
  const end = new Date(now);
  end.setHours(eh, em, 0, 0);
  const inMatch = checkIn && String(checkIn).match(/(\d{1,2}):(\d{2})/);
  if (inMatch) {
    const inMins = Number(inMatch[1]) * 60 + Number(inMatch[2]);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    if (eh * 60 + em < inMins && nowMins >= inMins) end.setDate(end.getDate() + 1);
  }
  return Math.round((end - now) / 60000);
};

const remainingLabel = (o, now) => {
  if (!o.shift_end) return '';
  const mins = minutesUntilShiftEnd(o.shift_end, o.check_in, now);
  const status = mins > 0
    ? `المتبقي من الدوام: ${fmtDuration(mins)}`
    : mins === 0 ? 'دوامه خالص هلق' : `تجاوز نهاية الدوام بـ ${fmtDuration(-mins)}`;
  return `\nيخلص دوامه: ${fmtHM(o.shift_end)}\n${status}`;
};

function OnlineBar() {
  // تحديث الوقت الحالي كل 30 ثانية حتى يضل "المتبقي" دقيق
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { data } = useQuery({
    queryKey: ['attendance-online'],
    queryFn:  () => attendanceApi.online().then(r => r.data.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const online = data || [];

  if (online.length === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/60 border-b border-gray-800 flex-shrink-0 overflow-x-auto">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        متصل الآن ({online.length})
      </span>
      <div className="flex items-center gap-3">
        {online.map(o => (
          <div key={o.employee_id} className="relative flex-shrink-0"
            title={`${o.full_name}${o.job_title ? ' — ' + o.job_title : ''}${o.department ? ' · ' + o.department : ''}${remainingLabel(o, now)}`}>
            <Avatar name={o.full_name} size="sm" />
            <span className="absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-gray-900" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── شريط تفعيل إشعارات الجهاز (تذكير بداية/نهاية الدوام) ──
const PUSH_DISMISS_KEY = 'push-prompt-dismissed';

const readDismissed = () => {
  try { return localStorage.getItem(PUSH_DISMISS_KEY) === new Date().toDateString(); } catch { return false; }
};

function PushPrompt() {
  const [hidden,  setHidden]  = useState(readDismissed);
  const [loading, setLoading] = useState(false);
  const [perm,    setPerm]    = useState(() => (pushSupported() ? Notification.permission : 'unsupported'));

  // الإذن معطى مسبقاً → منتأكد إن الاشتراك مربوط بالحساب الحالي
  useEffect(() => { if (perm === 'granted') syncPush(); }, [perm]);

  const dismiss = () => {
    try { localStorage.setItem(PUSH_DISMISS_KEY, new Date().toDateString()); } catch {}
    setHidden(true);
  };

  const enable = async () => {
    setLoading(true);
    try {
      await enablePush();
      setPerm('granted');
      toast.success('تم تفعيل الإشعارات على هذا الجهاز');
      pushApi.test().catch(() => {});
    } catch (e) {
      setPerm(pushSupported() ? Notification.permission : 'unsupported');
      toast.error(e.message === 'denied'
        ? 'تم رفض الإذن — فعّل الإشعارات من إعدادات المتصفح للموقع'
        : 'تعذّر تفعيل الإشعارات على هذا المتصفح');
    } finally {
      setLoading(false);
    }
  };

  if (hidden) return null;

  // آيفون بدون إضافة للشاشة الرئيسية: Safari ما بيدعم الإشعارات إلا هيك
  const iosHint = perm === 'unsupported' && isIOS() && !isStandalone();
  const denied  = perm === 'denied';
  if (perm !== 'default' && !iosHint && !denied) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-500/10 border-b border-blue-500/20 flex-shrink-0">
      <BellRing size={16} className="text-blue-400 flex-shrink-0" />
      <p className="flex-1 text-xs sm:text-sm text-gray-200">
        {iosHint
          ? 'لتوصلك تذكيرات الدوام على الآيفون: اضغط زر المشاركة ثم "إضافة إلى الشاشة الرئيسية" وافتح النظام من هناك.'
          : denied
            ? 'الإشعارات محظورة لهذا الموقع — اضغط على أيقونة القفل 🔒 جنب الرابط واسمح بالإشعارات حتى يوصلك تذكير بداية ونهاية الدوام.'
            : 'فعّل إشعارات الجهاز ليوصلك تذكير قبل بداية دوامك بـ10 دقائق وعند نهايته.'}
      </p>
      {!iosHint && !denied && (
        <button onClick={enable} disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex-shrink-0 disabled:opacity-60">
          {loading ? 'جارٍ التفعيل…' : 'تفعيل'}
        </button>
      )}
      <button onClick={dismiss} className="text-gray-500 hover:text-gray-300 flex-shrink-0" title="لاحقاً">
        <X size={16} />
      </button>
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
