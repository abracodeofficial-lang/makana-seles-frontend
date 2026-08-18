import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { Btn, Input } from '../../components/ui';
import toast from 'react-hot-toast';

export default function Login() {
  const [form, setForm]     = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
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

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center font-[Cairo]" dir="rtl">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">🏢</div>
          <h1 className="text-2xl font-black text-gray-100">نظام الإدارة</h1>
          <p className="text-gray-500 text-sm mt-1">المبيعات والموارد البشرية</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <Input
            label="البريد الإلكتروني"
            type="email"
            placeholder="admin@company.com"
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
          <Btn type="submit" loading={loading} className="w-full justify-center mt-2">
            تسجيل الدخول
          </Btn>
        </form>

        <p className="text-center text-xs text-gray-600 mt-4">
          admin@company.com / Admin@123456
        </p>
      </div>
    </div>
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