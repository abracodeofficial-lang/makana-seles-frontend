import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { authApi } from '../../api/services';
import { Btn, Input } from '../../components/ui';
import toast from 'react-hot-toast';
import { ThemeToggle } from '../../components/layout/Layout';

// إطار صفحات الدخول (الشعار + الكارد)
function AuthShell({ children }) {
  return (
    <div className="relative min-h-screen bg-gray-950 flex items-center justify-center font-[Cairo] px-4" dir="rtl">
      <ThemeToggle size={20} className="absolute top-4 left-4 p-2" />
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">🏢</div>
          <h1 className="text-2xl font-black text-gray-100">نظام الإدارة</h1>
          <p className="text-gray-500 text-sm mt-1">المبيعات والموارد البشرية</p>
        </div>

        {children}
      </div>
    </div>
  );
}

const linkClass = 'text-xs text-blue-400 hover:text-blue-300 hover:underline';

export default function Login() {
  const [form, setForm]     = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [mode, setMode]     = useState('login'); // login | forgot | sent
  const { login }  = useAuthStore();
  const navigate   = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form);
      toast.success('أهلاً بك!');
      navigate('/');
    } catch {}
    finally { setLoading(false); }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(form.email);
      setMode('sent');
    } catch {}
    finally { setLoading(false); }
  };

  if (mode === 'sent') {
    return (
      <AuthShell>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4 text-center">
          <p className="text-4xl">📧</p>
          <p className="text-sm text-gray-200 leading-relaxed">
            إذا الإيميل <span dir="ltr" className="font-semibold">{form.email}</span> مسجل عنا، رح يوصلك رابط لتعيين كلمة مرور جديدة خلال دقائق.
          </p>
          <p className="text-xs text-gray-500">ما وصلك؟ شيك على مجلد الرسائل غير المرغوب فيها (Spam).</p>
          <button type="button" className={linkClass} onClick={() => setMode('login')}>رجوع لتسجيل الدخول</button>
        </div>
      </AuthShell>
    );
  }

  if (mode === 'forgot') {
    return (
      <AuthShell>
        <form onSubmit={handleForgot} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div>
            <p className="text-sm font-bold text-gray-100">نسيت كلمة المرور؟</p>
            <p className="text-xs text-gray-500 mt-1">اكتب إيميلك وبنبعتلك رابط تعيّن فيه كلمة مرور جديدة.</p>
          </div>
          <Input
            label="البريد الإلكتروني"
            type="email"
            dir="ltr"
            placeholder="name@makanasa.com"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            required
            autoFocus
          />
          <Btn type="submit" loading={loading} className="w-full justify-center">
            إرسال رابط الاستعادة
          </Btn>
          <div className="text-center">
            <button type="button" className={linkClass} onClick={() => setMode('login')}>رجوع لتسجيل الدخول</button>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <Input
          label="البريد الإلكتروني"
          type="email"
          placeholder="name@makanasa.com"
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          required
        />
        <Input
          label="كلمة المرور"
          type="password"
          placeholder="••••••••"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          required
        />
        <div className="text-left -mt-2">
          <button type="button" className={linkClass} onClick={() => setMode('forgot')}>نسيت كلمة المرور؟</button>
        </div>
        <Btn type="submit" loading={loading} className="w-full justify-center">
          تسجيل الدخول
        </Btn>
      </form>
    </AuthShell>
  );
}

// صفحة الرابط اللي بيوصل عالإيميل: /reset-password?token=...&email=...
export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  const [form, setForm] = useState({ password: '', password_confirmation: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) return setError('كلمة المرور لازم تكون 8 أحرف على الأقل');
    if (form.password !== form.password_confirmation) return setError('تأكيد كلمة المرور مش مطابق');
    setError('');
    setLoading(true);
    try {
      await authApi.resetPassword({ token, email, ...form });
      // الجلسات القديمة انلغت بالسيرفر
      localStorage.removeItem('token');
      useAuthStore.setState({ token: null, employee: null, permissions: {} });
      toast.success('تم تغيير كلمة المرور، سجّل دخولك');
      navigate('/login', { replace: true });
    } catch {}
    finally { setLoading(false); }
  };

  if (!token || !email) {
    return (
      <AuthShell>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4 text-center">
          <p className="text-sm text-gray-200">الرابط ناقص. افتح الرابط كامل من الإيميل، أو اطلب رابط جديد.</p>
          <Link to="/login" className={linkClass}>رجوع لتسجيل الدخول</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div>
          <p className="text-sm font-bold text-gray-100">تعيين كلمة مرور جديدة</p>
          <p className="text-xs text-gray-500 mt-1" dir="ltr">{email}</p>
        </div>
        <Input
          label="كلمة المرور الجديدة"
          type="password"
          autoComplete="new-password"
          placeholder="8 أحرف على الأقل"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          required
          autoFocus
        />
        <Input
          label="تأكيد كلمة المرور"
          type="password"
          autoComplete="new-password"
          value={form.password_confirmation}
          onChange={e => setForm({ ...form, password_confirmation: e.target.value })}
          error={error}
          required
        />
        <Btn type="submit" loading={loading} className="w-full justify-center">
          حفظ كلمة المرور
        </Btn>
        <div className="text-center">
          <Link to="/login" className={linkClass}>رجوع لتسجيل الدخول</Link>
        </div>
      </form>
    </AuthShell>
  );
}

export function ProtectedRoute({ children, page, action = 'view' }) {
  const { token, can } = useAuthStore();

  if (!token) {
    window.location.href = '/login';
    return null;
  }

  if (page && !can(page, action)) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 font-[Cairo]" dir="rtl">
        <div className="text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="text-sm">ليس لديك صلاحية لعرض هذه الصفحة</p>
        </div>
      </div>
    );
  }

  return children;
}
