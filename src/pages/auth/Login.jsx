import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

const readStored = (key) => { try { return localStorage.getItem(key); } catch { return null; } };

export default function Login() {
  const [form, setForm]     = useState({ email: readStored('remember-email') || '', password: '' });
  const [remember, setRemember] = useState(readStored('remember-me') !== '0');
  const [loading, setLoading] = useState(false);
  const [mode, setMode]     = useState('login'); // login | forgot | code
  const [sent, setSent]     = useState(null);    // {phone, resend_after}
  const [reset, setReset]   = useState({ code: '', password: '', password_confirmation: '' });
  const [resetError, setResetError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const { login }  = useAuthStore();
  const navigate   = useNavigate();

  // عدّاد إعادة إرسال الكود
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form, remember);
      try {
        if (remember) localStorage.setItem('remember-email', form.email);
        else localStorage.removeItem('remember-email');
      } catch {}
      toast.success('أهلاً بك!');
      navigate('/');
    } catch {}
    finally { setLoading(false); }
  };

  const handleForgot = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const { data } = await authApi.forgotPassword(form.email);
      setSent(data.data);
      setCooldown(data.data.resend_after || 60);
      setReset(r => ({ ...r, code: '' }));
      setResetError('');
      setMode('code');
      toast.success('بعتنالك كود على الواتساب');
    } catch {}
    finally { setLoading(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(reset.code)) return setResetError('الكود 6 أرقام');
    if (reset.password.length < 8) return setResetError('كلمة المرور لازم تكون 8 أحرف على الأقل');
    if (reset.password !== reset.password_confirmation) return setResetError('تأكيد كلمة المرور مش مطابق');
    setResetError('');
    setLoading(true);
    try {
      await authApi.resetPassword({ email: form.email, ...reset });
      toast.success('تم تغيير كلمة المرور، سجّل دخولك');
      setForm(f => ({ ...f, password: '' }));
      setReset({ code: '', password: '', password_confirmation: '' });
      setMode('login');
    } catch (err) {
      setResetError(err.response?.data?.message || '');
    }
    finally { setLoading(false); }
  };

  if (mode === 'code') {
    return (
      <AuthShell>
        <form onSubmit={handleReset} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div>
            <p className="text-sm font-bold text-gray-100">تعيين كلمة مرور جديدة</p>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              بعتنالك كود من 6 أرقام على الواتساب للرقم المنتهي بـ <span dir="ltr" className="font-semibold text-gray-200">{sent?.phone?.replace('…', '')}</span>. الكود صالح 10 دقائق.
            </p>
          </div>
          <Input
            label="الكود"
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="______"
            className="text-center tracking-[0.5em] font-bold"
            value={reset.code}
            onChange={e => setReset({ ...reset, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
            required
            autoFocus
          />
          <Input
            label="كلمة المرور الجديدة"
            type="password"
            autoComplete="new-password"
            placeholder="8 أحرف على الأقل"
            value={reset.password}
            onChange={e => setReset({ ...reset, password: e.target.value })}
            required
          />
          <Input
            label="تأكيد كلمة المرور"
            type="password"
            autoComplete="new-password"
            value={reset.password_confirmation}
            onChange={e => setReset({ ...reset, password_confirmation: e.target.value })}
            error={resetError}
            required
          />
          <Btn type="submit" loading={loading} className="w-full justify-center">
            حفظ كلمة المرور
          </Btn>
          <div className="flex items-center justify-between gap-2">
            <button type="button" className={`${linkClass} disabled:opacity-50 disabled:no-underline disabled:cursor-default`}
              disabled={cooldown > 0 || loading} onClick={handleForgot}>
              {cooldown > 0 ? `إعادة إرسال الكود بعد ${cooldown} ث` : 'ما وصلك؟ إعادة إرسال الكود'}
            </button>
            <button type="button" className={linkClass} onClick={() => setMode('login')}>رجوع لتسجيل الدخول</button>
          </div>
        </form>
      </AuthShell>
    );
  }

  if (mode === 'forgot') {
    return (
      <AuthShell>
        <form onSubmit={handleForgot} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div>
            <p className="text-sm font-bold text-gray-100">نسيت كلمة المرور؟</p>
            <p className="text-xs text-gray-500 mt-1">اكتب إيميلك وبنبعتلك كود على واتساب رقمك المسجل عندنا.</p>
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
            إرسال الكود على الواتساب
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
          name="email"
          autoComplete="username"
          placeholder="name@makanasa.com"
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          required
        />
        <Input
          label="كلمة المرور"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          required
        />
        <div className="flex items-center justify-between gap-2 -mt-1">
          <label className="inline-flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
            تذكرني
          </label>
          <button type="button" className={linkClass} onClick={() => setMode('forgot')}>نسيت كلمة المرور؟</button>
        </div>
        <Btn type="submit" loading={loading} className="w-full justify-center">
          تسجيل الدخول
        </Btn>
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
