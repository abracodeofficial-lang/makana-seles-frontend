import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { employeesApi, authApi } from '../../api/services';
import client from '../../api/client';
import useAuthStore from '../../store/authStore';
import { Badge, Modal, Input, Btn, Loading, Avatar, InfoRow } from '../../components/ui';
import {
  User, FileText, DollarSign, Palmtree,
  Download, Eye, Calendar, Building2, CreditCard,
  Briefcase, TrendingUp, AlertCircle, KeyRound,
} from 'lucide-react';

// ── helpers ───────────────────────────────────────────────────
const numFmt  = (n) => Number(n || 0).toLocaleString('ar-SA');
const dateFmt = (d) => d ? new Date(d).toLocaleDateString('ar-SA') : '—';

const now         = new Date();
const MONTH_FROM  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
const TODAY       = now.toISOString().slice(0, 10);

// ── تبويبات ───────────────────────────────────────────────────
const TABS = [
  { id: 'info',    label: 'البيانات العامة', icon: User       },
  { id: 'docs',    label: 'المستندات',       icon: FileText   },
  { id: 'finance', label: 'المالية',         icon: DollarSign },
  { id: 'leaves',  label: 'الإجازات',        icon: Palmtree   },
];

// لون شريط نوع الإجازة
const leaveBarColor = (typeName, pct) => {
  if (pct >= 70) return 'bg-red-500';
  if (typeName.includes('سنوية'))    return 'bg-blue-500';
  if (typeName.includes('مرضية'))    return 'bg-green-500';
  if (typeName.includes('اعتيادية')) return 'bg-yellow-500';
  if (typeName.includes('عارضة'))    return 'bg-orange-500';
  return 'bg-blue-500';
};

// ── الصفحة ───────────────────────────────────────────────────
export default function ProfilePage() {
  const { employee: me } = useAuthStore();
  const [tab,         setTab]         = useState('info');
  const [showPassModal, setShowPassModal] = useState(false);

  // جلب بيانات الموظف — response: { data: { employee: {...}, total_salary } }
  const { data: profileData, isLoading } = useQuery({
    queryKey: ['my-profile', me?.id],
    queryFn:  () => employeesApi.show(me.id).then(r => r.data.data),
    enabled:  !!me?.id,
    staleTime: 60_000,
  });

  // جلب رصيد الإجازات — response: { data: [{...}] }
  const { data: balancesData } = useQuery({
    queryKey: ['my-leave-balances', me?.id],
    queryFn:  () => employeesApi.leaveBalances(me.id).then(r => r.data.data),
    enabled:  !!me?.id,
    staleTime: 60_000,
  });

  // سجلات الحضور للشهر الحالي → لحساب أيام الغياب
  const { data: attendData } = useQuery({
    queryKey: ['my-attendance-month', me?.id, MONTH_FROM],
    queryFn:  () => client.get('/attendance', { params: {
      employee_id: me.id,
      from: MONTH_FROM,
      to:   TODAY,
      per_page: 999,
    }}).then(r => r.data),
    enabled:  !!me?.id,
    staleTime: 60_000,
  });

  if (isLoading) return <Loading />;

  // تفكيك بيانات الـ response بشكل صحيح
  const emp         = profileData?.employee || {};
  const totalSalary = profileData?.total_salary || 0;
  const documents   = emp.documents     || [];
  const salaryHist  = emp.salary_history || [];

  const leaveBalances = balancesData || emp.leave_balances || [];

  // إحصائيات الإجازات السنوية
  const annual       = leaveBalances.find(b => (b.leave_type?.name || b.type || '').includes('سنوية'));
  const remainDays   = annual?.remaining_days ?? '—';
  const usedDays     = annual?.used_days      ?? '—';

  // أيام الغياب هذا الشهر
  const attendRecs = attendData?.data?.data ?? attendData?.data ?? [];
  const absentDays = attendRecs.filter(a => a.status === 'غياب').length;

  return (
    <div dir="rtl" className="font-[Cairo]">

      {/* ── Header Gradient ── */}
      <div className="relative bg-gradient-to-br from-green-900/40 via-blue-900/30 to-gray-950 px-4 sm:px-8 pt-8 pb-6 border-b border-gray-800">

        {/* زر تغيير كلمة المرور */}
        <button
          onClick={() => setShowPassModal(true)}
          className="absolute top-4 left-4 sm:top-6 sm:left-8 flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-400 border border-gray-700 hover:border-blue-500/50 rounded-lg px-3 py-1.5 transition-all"
        >
          <KeyRound size={12}/>
          تعديل كلمة المرور
        </button>

        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 max-w-3xl mx-auto">

          <div className="ring-4 ring-green-500/30 rounded-2xl flex-shrink-0">
            <Avatar name={emp.full_name || me?.full_name} size="lg" />
          </div>

          <div className="flex-1 text-center sm:text-right">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1 justify-center sm:justify-start">
              <h1 className="text-xl sm:text-2xl font-black text-gray-100">
                {emp.full_name || me?.full_name}
              </h1>
              <Badge
                label={emp.status || 'نشط'}
                color={emp.status === 'موقوف' ? 'red' : 'green'}
              />
            </div>
            <p className="text-green-400 font-semibold text-sm mb-3">
              {emp.job_title || me?.job_title}
            </p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-gray-400">
              {(emp.department?.name || me?.department?.name) && (
                <span className="flex items-center gap-1">
                  <Building2 size={11}/>
                  {emp.department?.name || me?.department?.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <CreditCard size={11}/>
                {emp.employee_number || me?.employee_number}
              </span>
              {emp.hire_date && (
                <span className="flex items-center gap-1">
                  <Calendar size={11}/>
                  تعيين: {dateFmt(emp.hire_date)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5 max-w-3xl mx-auto">

        {/* ── إحصائيات سريعة ── */}
        <div className="grid grid-cols-3 gap-3">
          <StatMini
            value={remainDays}
            label="رصيد الإجازات"
            sub="من أصل 30 يوم"
            color="text-green-400"
          />
          <StatMini
            value={usedDays}
            label="إجازات مستخدمة"
            sub="هذا العام"
            color="text-amber-400"
          />
          <StatMini
            value={absentDays}
            label="أيام الغياب"
            sub="هذا الشهر"
            color={absentDays > 0 ? 'text-red-400' : 'text-blue-400'}
          />
        </div>

        {/* ── التبويبات ── */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">

          <div className="flex border-b border-gray-700 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all border-b-2 -mb-px flex-shrink-0
                  ${tab === t.id
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-700/30'
                  }`}
              >
                <t.icon size={13}/>
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-6">
            {tab === 'info'    && <TabInfo    emp={emp} />}
            {tab === 'docs'    && <TabDocs    docs={documents} />}
            {tab === 'finance' && <TabFinance emp={emp} totalSalary={totalSalary} history={salaryHist} />}
            {tab === 'leaves'  && <TabLeaves  balances={leaveBalances} emp={emp} />}
          </div>
        </div>
      </div>

      {/* ── Modal تغيير كلمة المرور ── */}
      {showPassModal && (
        <PasswordModal onClose={() => setShowPassModal(false)} />
      )}
    </div>
  );
}

// ── بطاقة إحصائية صغيرة ──────────────────────────────────────
function StatMini({ value, label, sub, color }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
      <p className="text-[10px] text-gray-600">{sub}</p>
    </div>
  );
}

// ── تبويب 1: البيانات العامة ─────────────────────────────────
function TabInfo({ emp }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <User size={11}/> البيانات الشخصية
        </p>
        <InfoRow label="رقم الهوية"         value={emp.national_id}    />
        <InfoRow label="رقم الهاتف"         value={emp.phone}          />
        <InfoRow label="البريد الإلكتروني"  value={emp.email}          />
        <InfoRow label="العنوان"            value={emp.address}        />
        <InfoRow label="الحالة الاجتماعية"  value={emp.marital_status} />
      </div>

      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Briefcase size={11}/> البيانات الوظيفية
        </p>
        <InfoRow label="القسم"            value={emp.department?.name}    />
        <InfoRow label="المسمى الوظيفي"   value={emp.job_title}           />
        <InfoRow label="نوع التعاقد"      value={emp.contract_type?.name} />
        <InfoRow label="الشفت المخصص"     value={emp.shift?.name}         />
        <InfoRow label="تاريخ التعيين"    value={dateFmt(emp.hire_date)}  />
      </div>
    </div>
  );
}

// ── تبويب 2: المستندات ───────────────────────────────────────
function TabDocs({ docs }) {
  if (!docs.length) return (
    <div className="text-center py-14">
      <FileText size={36} className="text-gray-700 mx-auto mb-3"/>
      <p className="text-gray-500 text-sm font-medium">لا توجد مستندات مرفوعة</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {docs.map(doc => (
        <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-900/60 rounded-xl border border-gray-700">
          <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText size={15} className="text-blue-400"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-200 truncate">{doc.name}</p>
            <p className="text-xs text-gray-500">{doc.type} · {dateFmt(doc.created_at)}</p>
          </div>
          {doc.file_url && (
            <div className="flex gap-2 flex-shrink-0">
              <a href={doc.file_url} target="_blank" rel="noreferrer"
                className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-gray-200 transition-all"
                title="عرض">
                <Eye size={13}/>
              </a>
              <a href={doc.file_url} download
                className="p-1.5 rounded-lg bg-gray-700 hover:bg-blue-600 text-gray-400 hover:text-white transition-all"
                title="تحميل">
                <Download size={13}/>
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── تبويب 3: المالية ─────────────────────────────────────────
function TabFinance({ emp, totalSalary, history }) {
  const rows = [
    { label: 'الراتب الأساسي',  value: emp.basic_salary,        primary: true },
    { label: 'بدل السكن',        value: emp.housing_allowance              },
    { label: 'بدل المواصلات',   value: emp.transport_allowance            },
    { label: 'بدل الاتصالات',   value: emp.phone_allowance                },
    { label: 'بدلات أخرى',      value: emp.other_allowances               },
  ].filter(r => Number(r.value) > 0 || r.primary);

  return (
    <div className="space-y-6">

      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">الراتب والبدلات</p>
        <div className="bg-gray-900/60 rounded-xl border border-gray-700 overflow-hidden">
          {rows.map((row, i) => (
            <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-gray-800 last:border-0">
              <span className="text-sm text-gray-400">{row.label}</span>
              <span className={`font-bold text-sm ${row.primary ? 'text-green-400' : 'text-blue-400'}`}>
                {numFmt(row.value)}{' '}
                <span className="text-gray-500 font-normal text-xs">ر.س</span>
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center px-4 py-4 bg-green-500/10 border-t border-green-500/20">
            <span className="text-sm font-bold text-gray-200">إجمالي الدخل الشهري</span>
            <span className="font-black text-green-400 text-lg">{numFmt(totalSalary)} ر.س</span>
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">سجل تعديلات الراتب</p>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-900/60 rounded-xl border border-gray-700">
                <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <TrendingUp size={14} className="text-amber-400"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500 line-through">{numFmt(h.old_salary)}</span>
                    <span className="text-gray-600 text-xs">←</span>
                    <span className="text-sm font-bold text-green-400">{numFmt(h.new_salary)} ر.س</span>
                    <span className="text-xs text-gray-500 mr-auto">{dateFmt(h.effective_date)}</span>
                  </div>
                  {h.reason && <p className="text-xs text-gray-400 mt-1">{h.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── تبويب 4: الإجازات ────────────────────────────────────────
function TabLeaves({ balances, emp }) {
  const leaveRequests = (emp?.leave_requests || []).slice(0, 5);

  const STATUS_COLOR = {
    'معتمدة':       'green',
    'مرفوضة':       'red',
    'قيد المراجعة': 'amber',
  };

  return (
    <div className="space-y-6">

      {/* رصيد الإجازات */}
      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">رصيد الإجازات</p>

        {balances.length === 0 ? (
          <p className="text-gray-500 text-sm">لا يوجد رصيد إجازات مسجّل</p>
        ) : (
          <div className="space-y-3">
            {balances.map((b, i) => {
              const typeName  = b.leave_type?.name || b.type || '';
              const total     = b.total_days     || 0;
              const used      = b.used_days      || 0;
              const remaining = b.remaining_days ?? (total - used);
              const pct       = b.usage_pct ?? (total > 0 ? Math.round(used / total * 100) : 0);
              const barColor  = leaveBarColor(typeName, pct);
              const isLow     = pct >= 70 || b.is_low;

              return (
                <div key={i} className={`bg-gray-900/60 rounded-xl border p-4 transition-all ${
                  isLow ? 'border-red-500/30' : 'border-gray-700'
                }`}>
                  <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-200">{typeName}</span>
                      {isLow && (
                        <span className="text-xs text-red-400 flex items-center gap-1">
                          <AlertCircle size={11}/> الرصيد منخفض ⚠️
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{remaining} / {total} يوم</span>
                  </div>
                  <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-[10px] text-gray-500">
                    <span>مستخدم: {used} يوم</span>
                    <span>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* آخر 5 طلبات إجازة */}
      {leaveRequests.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">آخر 5 طلبات إجازة</p>
          <div className="space-y-2">
            {leaveRequests.map((req, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-900/60 rounded-xl border border-gray-700">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200">
                    {req.leave_type?.name || req.leave_type}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {dateFmt(req.from_date)} — {dateFmt(req.to_date)}
                    {req.days_count ? ` · ${req.days_count} أيام` : ''}
                  </p>
                </div>
                <Badge
                  label={req.final_status || 'قيد المراجعة'}
                  color={STATUS_COLOR[req.final_status] || 'amber'}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal تغيير كلمة المرور ───────────────────────────────────
function PasswordModal({ onClose }) {
  const [form, setForm] = useState({
    current_password:             '',
    new_password:                 '',
    new_password_confirmation:    '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: (data) => authApi.changePassword(data),
    onSuccess: () => {
      toast.success('تم تغيير كلمة المرور بنجاح');
      onClose();
    },
    onError: (err) => {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(e => toast.error(e));
      else toast.error(err.response?.data?.message || 'فشل تغيير كلمة المرور');
    },
  });

  const handleSave = () => {
    if (!form.current_password)          { toast.error('كلمة المرور الحالية مطلوبة'); return; }
    if (!form.new_password)              { toast.error('كلمة المرور الجديدة مطلوبة'); return; }
    if (form.new_password.length < 8)   { toast.error('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل'); return; }
    if (form.new_password !== form.new_password_confirmation) {
      toast.error('كلمتا المرور غير متطابقتين');
      return;
    }
    mut.mutate(form);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="تغيير كلمة المرور"
      footer={
        <>
          <Btn onClick={handleSave} loading={mut.isPending}>
            <KeyRound size={14}/> حفظ
          </Btn>
          <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="كلمة المرور الحالية *"
          type="password"
          value={form.current_password}
          onChange={e => set('current_password', e.target.value)}
          placeholder="أدخل كلمة المرور الحالية"
        />
        <Input
          label="كلمة المرور الجديدة *"
          type="password"
          value={form.new_password}
          onChange={e => set('new_password', e.target.value)}
          placeholder="8 أحرف على الأقل"
        />
        <Input
          label="تأكيد كلمة المرور الجديدة *"
          type="password"
          value={form.new_password_confirmation}
          onChange={e => set('new_password_confirmation', e.target.value)}
          placeholder="أعد إدخال كلمة المرور الجديدة"
        />
      </div>
    </Modal>
  );
}
