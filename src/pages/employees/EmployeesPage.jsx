import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { employeesApi, lookupApi, permissionGroupsApi } from '../../api/services';
import { PageHeader } from '../../components/layout/Layout';
import useAuthStore from '../../store/authStore';
import {
  Btn, Badge, StatCard, Card, Modal, Input, Select,
  Textarea, SearchBox, Loading, InfoRow, Avatar,
  Table, Tr, Td, ProgressBar,
} from '../../components/ui';
import {
  Plus, Pencil, Eye, Users, UserCheck, UserX,
  FileText, DollarSign, Calendar, Upload, Trash2, Download,
  ChevronRight, ChevronLeft, Wallet, ShieldCheck,
} from 'lucide-react';

const PERM_ACTIONS = [
  { short: 'view',    label: 'عرض'    },
  { short: 'add',     label: 'إضافة'  },
  { short: 'edit',    label: 'تعديل'  },
  { short: 'delete',  label: 'حذف'    },
  { short: 'export',  label: 'تصدير'  },
  { short: 'approve', label: 'اعتماد' },
];

const STATUS_COLOR = { نشط: 'green', 'إيقاف مؤقت': 'red', إجازة: 'amber' };

const fmt = (n) => n ? Number(n).toLocaleString('ar-SA-u-nu-latn') : '0';

// ── الصفحة الرئيسية ───────────────────────────────────────────
export default function EmployeesPage() {
  const qc = useQueryClient();
  const [search, setSearch]         = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [profileId, setProfileId]   = useState(null);
  const [profileMode, setProfileMode] = useState('view');

  const openProfile = (id, mode = 'view') => { setProfileId(id); setProfileMode(mode); };

  const { data, isLoading } = useQuery({
    queryKey: ['employees', search, deptFilter, statusFilter],
    queryFn: () => employeesApi.list({ search, department_id: deptFilter, status: statusFilter }).then(r => r.data),
    staleTime: 30_000,
  });

  const { data: hrLookup } = useQuery({
    queryKey: ['lookup-hr'],
    queryFn: () => lookupApi.hr().then(r => r.data),
    staleTime: Infinity,
  });

  const stats = data?.stats || {};
  const employees = data?.data?.data || [];

  return (
    <div>
      <PageHeader
        title="إدارة الموظفين"
        subtitle="الموارد البشرية وبيانات الكادر الوظيفي"
        actions={
          <>
            <SearchBox value={search} onChange={setSearch} placeholder="بحث بالاسم أو الرقم أو المسمى..." />
            <Btn onClick={() => setShowWizard(true)}>
              <Plus size={16}/> إضافة موظف
            </Btn>
          </>
        }
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="إجمالي الموظفين" value={stats.total}        icon={<Users size={18}/>}    color="blue"   />
          <StatCard label="نشط"              value={stats.active}       icon={<UserCheck size={18}/>} color="green"  />
          <StatCard label="إجازة"            value={stats.on_leave}     icon={<Calendar size={18}/>}  color="amber"  />
          <StatCard label="إجمالي الرواتب"  value={`${fmt(stats.total_salaries)} ﷼`} icon={<Wallet size={18}/>} color="purple" />
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <Select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            options={(hrLookup?.departments || []).map(d => ({ value: String(d.id), label: d.name }))}
            className="text-xs py-1.5 w-44"
          />
          <Select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            options={['نشط','إيقاف مؤقت','إجازة'].map(v => ({ value: v, label: v }))}
            className="text-xs py-1.5 w-36"
          />
        </div>

        {/* Table */}
        <Card title="قائمة الموظفين">
          {isLoading ? <Loading /> : (
            <Table headers={['الموظف','رقم الهاتف','القسم','المسمى الوظيفي','الراتب الأساسي','الحالة','إجراءات']}>
              {employees.map(emp => (
                <Tr key={emp.id} onClick={() => openProfile(emp.id, 'view')}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar name={emp.full_name} size="sm" />
                      <div>
                        <p className="font-semibold text-gray-100 text-xs">{emp.full_name}</p>
                        <p className="text-xs text-gray-500 font-mono">{emp.employee_number}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-gray-400">{emp.phone}</Td>
                  <Td>{emp.department?.name || '—'}</Td>
                  <Td className="text-gray-300">{emp.job_title}</Td>
                  <Td className="font-semibold text-blue-400">{fmt(emp.basic_salary)} ﷼</Td>
                  <Td><Badge label={emp.status} color={STATUS_COLOR[emp.status] || 'gray'}/></Td>
                  <Td>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Btn size="sm" variant="ghost" title="عرض" onClick={() => openProfile(emp.id, 'view')}>
                        <Eye size={12}/>
                      </Btn>
                      <Btn size="sm" variant="ghost" title="تعديل" onClick={() => openProfile(emp.id, 'edit')}>
                        <Pencil size={12}/>
                      </Btn>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      {showWizard && (
        <EmployeeWizard
          hrLookup={hrLookup}
          onClose={() => setShowWizard(false)}
          onSaved={() => { qc.invalidateQueries(['employees']); setShowWizard(false); }}
        />
      )}
      {profileId && (
        <EmployeeProfile
          id={profileId}
          hrLookup={hrLookup}
          initialEditMode={profileMode === 'edit'}
          onClose={() => setProfileId(null)}
          onSaved={() => qc.invalidateQueries(['employees'])}
        />
      )}
    </div>
  );
}

// ── Wizard إضافة موظف (3 خطوات) ──────────────────────────────
const WIZARD_DEFAULTS = {
  full_name: '', national_id: '', phone: '', email: '', password: '',
  address: '', marital_status: '',
  department_id: '', job_title: '', contract_type_id: '', shift_id: '', hire_date: '',
  basic_salary: '', housing_allowance: '', transport_allowance: '',
  phone_allowance: '', other_allowances: '', commission_rate: '',
};

const WIZARD_STEPS = ['المعلومات الأساسية', 'المعلومات الوظيفية', 'المعلومات المالية'];

function EmployeeWizard({ hrLookup, onClose, onSaved }) {
  const [step, setStep]       = useState(0);
  const [form, setForm]       = useState(WIZARD_DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setFieldErrors(e => ({ ...e, [k]: null })); };

  const validateStep = () => {
    if (step === 0) {
      if (!form.full_name.trim())  { toast.error('الاسم الكامل مطلوب'); return false; }
      if (!form.national_id.trim()){ toast.error('رقم الهوية مطلوب'); return false; }
      if (!form.phone.trim())      { toast.error('رقم الهاتف مطلوب'); return false; }
      if (!form.email.trim())      { toast.error('البريد الإلكتروني مطلوب'); return false; }
      if (!form.password || form.password.length < 8) { toast.error('كلمة المرور 8 أحرف على الأقل'); return false; }
      if (!form.marital_status)    { toast.error('الحالة الاجتماعية مطلوبة'); return false; }
      if (!form.address.trim())    { toast.error('العنوان مطلوب'); return false; }
    }
    return true;
  };

  const handleNext = () => { if (validateStep()) setStep(s => s + 1); };
  const handleBack = () => setStep(s => s - 1);

  const handleSave = async () => {
    if (!validateStep()) return;
    setLoading(true);
    setFieldErrors({});
    try {
      await employeesApi.create(form);
      toast.success('تم إضافة الموظف بنجاح');
      onSaved();
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) {
        setFieldErrors(errors);
        const step0Fields = ['full_name','national_id','phone','email','password','address','marital_status'];
        const step1Fields = ['department_id','job_title','contract_type_id','shift_id','hire_date'];
        const keys = Object.keys(errors);
        if (keys.some(k => step0Fields.includes(k))) setStep(0);
        else if (keys.some(k => step1Fields.includes(k))) setStep(1);
        else setStep(2);
        Object.values(errors).flat().forEach(e => toast.error(e));
      }
    } finally { setLoading(false); }
  };

  const ErrMsg = ({ field }) => fieldErrors[field]?.[0]
    ? <p className="text-red-400 text-xs mt-1">{fieldErrors[field][0]}</p>
    : null;

  const depts    = (hrLookup?.departments    || []).map(d => ({ value: String(d.id), label: d.name }));
  const contracts= (hrLookup?.contract_types || []).map(c => ({ value: String(c.id), label: c.name }));
  const shifts   = (hrLookup?.shifts         || []).map(s => ({ value: String(s.id), label: s.name }));

  return (
    <Modal open onClose={onClose} title="إضافة موظف جديد" width="max-w-2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {step > 0 && <Btn variant="outline" onClick={handleBack}><ChevronRight size={14}/> السابق</Btn>}
          </div>
          <div className="flex gap-2">
            {step < 2
              ? <Btn onClick={handleNext}>التالي <ChevronLeft size={14}/></Btn>
              : <Btn onClick={handleSave} loading={loading}>💾 حفظ الموظف</Btn>
            }
            <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
          </div>
        </div>
      }>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-6">
        {WIZARD_STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'
            }`}>{i < step ? '✓' : i + 1}</div>
            <span className={`text-xs ${i === step ? 'text-gray-100 font-semibold' : 'text-gray-500'}`}>{label}</span>
            {i < WIZARD_STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? 'bg-green-500' : 'bg-gray-700'}`}/>}
          </div>
        ))}
      </div>

      {/* Step 1 — المعلومات الأساسية (مطلوبة) */}
      {step === 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div><Input label="الاسم الكامل *"       value={form.full_name}      onChange={e => set('full_name', e.target.value)} /><ErrMsg field="full_name"/></div>
          <div><Input label="رقم الهوية *"         value={form.national_id}    onChange={e => set('national_id', e.target.value)} /><ErrMsg field="national_id"/></div>
          <div><Input label="رقم الهاتف *"         value={form.phone}          onChange={e => set('phone', e.target.value)} /><ErrMsg field="phone"/></div>
          <div><Input label="البريد الإلكتروني *"  value={form.email}          onChange={e => set('email', e.target.value)} type="email" /><ErrMsg field="email"/></div>
          <div><Input label="كلمة المرور *"        value={form.password}       onChange={e => set('password', e.target.value)} type="password" /><ErrMsg field="password"/></div>
          <div>
            <Select label="الحالة الاجتماعية *" value={form.marital_status} onChange={e => set('marital_status', e.target.value)}
              options={[{ value: '', label: 'اختر...' }, ...['أعزب','متزوج','مطلق','أرمل'].map(v => ({ value: v, label: v }))]} />
            <ErrMsg field="marital_status"/>
          </div>
          <div className="col-span-2">
            <Input label="العنوان *" value={form.address} onChange={e => set('address', e.target.value)} />
            <ErrMsg field="address"/>
          </div>
        </div>
      )}

      {/* Step 2 — المعلومات الوظيفية (اختيارية) */}
      {step === 1 && (
        <div className="grid grid-cols-2 gap-4">
          <div><Select label="القسم"          value={form.department_id}    onChange={e => set('department_id', e.target.value)} options={depts} /><ErrMsg field="department_id"/></div>
          <div><Input  label="المسمى الوظيفي" value={form.job_title}        onChange={e => set('job_title', e.target.value)} /><ErrMsg field="job_title"/></div>
          <div><Select label="نوع التعاقد"    value={form.contract_type_id} onChange={e => set('contract_type_id', e.target.value)} options={contracts} /><ErrMsg field="contract_type_id"/></div>
          <div><Select label="الشفت"          value={form.shift_id}         onChange={e => set('shift_id', e.target.value)} options={shifts} /><ErrMsg field="shift_id"/></div>
          <div><Input  label="تاريخ التعيين"  value={form.hire_date}        onChange={e => set('hire_date', e.target.value)} type="date" /><ErrMsg field="hire_date"/></div>
        </div>
      )}

      {/* Step 3 — المعلومات المالية (اختيارية) */}
      {step === 2 && (
        <div className="grid grid-cols-2 gap-4">
          <div><Input label="الراتب الأساسي (﷼)"   value={form.basic_salary}        onChange={e => set('basic_salary', e.target.value)} type="number" /><ErrMsg field="basic_salary"/></div>
          <div><Input label="بدل السكن (﷼)"         value={form.housing_allowance}   onChange={e => set('housing_allowance', e.target.value)} type="number" /><ErrMsg field="housing_allowance"/></div>
          <div><Input label="بدل المواصلات (﷼)"     value={form.transport_allowance} onChange={e => set('transport_allowance', e.target.value)} type="number" /><ErrMsg field="transport_allowance"/></div>
          <div><Input label="بدل الاتصالات (﷼)"     value={form.phone_allowance}     onChange={e => set('phone_allowance', e.target.value)} type="number" /><ErrMsg field="phone_allowance"/></div>
          <div><Input label="بدلات أخرى (﷼)"        value={form.other_allowances}    onChange={e => set('other_allowances', e.target.value)} type="number" /><ErrMsg field="other_allowances"/></div>
          <div><Input label="نسبة العمولة (%)"       value={form.commission_rate}     onChange={e => set('commission_rate', e.target.value)} type="number" /><ErrMsg field="commission_rate"/></div>

          {/* ملخص الراتب */}
          <div className="col-span-2 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-2 font-semibold">إجمالي الراتب</p>
            <p className="text-2xl font-black text-blue-400">
              {fmt(
                (+form.basic_salary || 0) + (+form.housing_allowance || 0) +
                (+form.transport_allowance || 0) + (+form.phone_allowance || 0) + (+form.other_allowances || 0)
              )} ﷼
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── بروفايل الموظف (4 تبويبات) ────────────────────────────────
function EmployeeProfile({ id, hrLookup, onClose, onSaved, initialEditMode = false }) {
  const qc = useQueryClient();
  const [tab, setTab]           = useState('info');
  const [editMode, setEditMode] = useState(initialEditMode);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving]     = useState(false);
  const [showSalary, setShowSalary] = useState(false);
  const fileRef = useRef();
  const [docForm, setDocForm] = useState({ type: 'سيرة ذاتية', name: '', file: null });
  const [uploading, setUploading] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesApi.show(id).then(r => r.data.data),
  });

  const { data: leaveData } = useQuery({
    queryKey: ['employee-leaves', id],
    queryFn: () => employeesApi.leaveBalances(id).then(r => r.data.data),
    enabled: tab === 'leaves',
  });

  useEffect(() => {
    if (data?.employee) setEditForm(data.employee);
  }, [data]);

  useEffect(() => {
    setEditMode(initialEditMode);
  }, [initialEditMode]);

  const emp = data?.employee;

  const suspendMut = useMutation({
    mutationFn: () => employeesApi.suspend(id),
    onSuccess: () => { toast.success('تم إيقاف الموظف مؤقتاً'); refetch(); onSaved(); },
  });

  const activateMut = useMutation({
    mutationFn: () => employeesApi.activate(id),
    onSuccess: () => { toast.success('تم تفعيل الموظف'); refetch(); onSaved(); },
  });

  const deleteDocMut = useMutation({
    mutationFn: (docId) => employeesApi.deleteDoc(id, docId),
    onSuccess: () => { toast.success('تم حذف المستند'); refetch(); },
  });

  const handleSaveInfo = async () => {
    if (!editForm.full_name?.trim())    { toast.error('الاسم الكامل مطلوب'); return; }
    if (!editForm.phone?.trim())        { toast.error('رقم الهاتف مطلوب'); return; }
    if (!editForm.email?.trim())        { toast.error('البريد الإلكتروني مطلوب'); return; }
    if (!editForm.marital_status)       { toast.error('الحالة الاجتماعية مطلوبة'); return; }
    if (!editForm.address?.trim())      { toast.error('العنوان مطلوب'); return; }
    setSaving(true);
    try {
      await employeesApi.update(id, editForm);
      toast.success('تم حفظ البيانات');
      setEditMode(false);
      refetch();
      onSaved();
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(e => toast.error(e));
    } finally { setSaving(false); }
  };

  const handleUploadDoc = async () => {
    if (!docForm.file) { toast.error('اختر ملفاً'); return; }
    if (!docForm.name.trim()) { toast.error('اسم المستند مطلوب'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', docForm.file);
      fd.append('type', docForm.type);
      fd.append('name', docForm.name);
      await employeesApi.uploadDoc(id, fd);
      toast.success('تم رفع المستند');
      setDocForm({ type: 'سيرة ذاتية', name: '', file: null });
      if (fileRef.current) fileRef.current.value = '';
      refetch();
    } catch { toast.error('فشل رفع الملف'); }
    finally { setUploading(false); }
  };

  const set = (k, v) => setEditForm(f => ({ ...f, [k]: v }));
  const depts    = (hrLookup?.departments    || []).map(d => ({ value: String(d.id), label: d.name }));
  const contracts= (hrLookup?.contract_types || []).map(c => ({ value: String(c.id), label: c.name }));
  const shifts   = (hrLookup?.shifts         || []).map(s => ({ value: String(s.id), label: s.name }));

  const { can } = useAuthStore();
  const canManagePerms = can('roles', 'edit');

  const TABS = [
    { key: 'info',  label: 'البيانات العامة',     icon: <Users size={13}/> },
    { key: 'docs',  label: 'المستندات',            icon: <FileText size={13}/> },
    { key: 'salary',label: 'المالية',              icon: <DollarSign size={13}/> },
    { key: 'leaves',label: 'الإجازات والجزاءات',  icon: <Calendar size={13}/> },
    ...(canManagePerms ? [{ key: 'perm', label: 'الصلاحيات', icon: <ShieldCheck size={13}/> }] : []),
  ];

  return (
    <Modal open onClose={onClose} title="بروفايل الموظف" width="max-w-3xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex gap-2">
            {tab === 'info' && !editMode && (
              <>
                <Btn variant="outline" size="sm" onClick={() => setEditMode(true)}><Pencil size={12}/> تعديل</Btn>
                {emp?.status === 'نشط'
                  ? <Btn variant="danger" size="sm" onClick={() => confirm('إيقاف الموظف مؤقتاً؟') && suspendMut.mutate()} loading={suspendMut.isPending}>
                      <UserX size={12}/> إيقاف مؤقت
                    </Btn>
                  : <Btn variant="success" size="sm" onClick={() => activateMut.mutate()} loading={activateMut.isPending}>
                      <UserCheck size={12}/> تفعيل
                    </Btn>
                }
              </>
            )}
            {tab === 'info' && editMode && (
              <>
                <Btn size="sm" onClick={handleSaveInfo} loading={saving}>💾 حفظ</Btn>
                <Btn variant="outline" size="sm" onClick={() => { setEditMode(false); setEditForm(emp); }}>إلغاء</Btn>
              </>
            )}
            {tab === 'salary' && (
              <Btn size="sm" onClick={() => setShowSalary(true)}><DollarSign size={12}/> تعديل الراتب</Btn>
            )}
          </div>
          <Btn variant="outline" size="sm" onClick={onClose}>إغلاق</Btn>
        </div>
      }>

      {isLoading ? <Loading /> : emp ? (
        <>
          {/* Header */}
          <div className="flex items-center gap-4 pb-4 mb-4 border-b border-gray-800">
            <Avatar name={emp.full_name} size="lg" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-black text-gray-100">{emp.full_name}</h2>
                <Badge label={emp.status} color={STATUS_COLOR[emp.status] || 'gray'} />
              </div>
              <p className="text-sm text-gray-400">{emp.job_title} — {emp.department?.name}</p>
              <p className="text-xs text-gray-500 font-mono">{emp.employee_number} · {emp.phone}</p>
            </div>
            <div className="text-left">
              <p className="text-xs text-gray-500">إجمالي الراتب</p>
              <p className="text-xl font-black text-blue-400">{fmt(data?.total_salary)} ﷼</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1 mb-5">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                  tab === t.key ? 'bg-gray-700 text-gray-100' : 'text-gray-400 hover:text-gray-200'
                }`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* Tab: البيانات العامة */}
          {tab === 'info' && (
            editMode ? (
              <div className="grid grid-cols-2 gap-4">
                <Input label="الاسم الكامل"       value={editForm.full_name || ''}   onChange={e => set('full_name', e.target.value)} />
                <Input label="رقم الهاتف"          value={editForm.phone || ''}       onChange={e => set('phone', e.target.value)} />
                <Input label="البريد الإلكتروني"   value={editForm.email || ''}       onChange={e => set('email', e.target.value)} type="email" />
                <Select label="الحالة الاجتماعية *" value={editForm.marital_status || ''} onChange={e => set('marital_status', e.target.value)}
                  options={[{ value: '', label: 'اختر...' }, ...['أعزب','متزوج','مطلق','أرمل'].map(v => ({ value: v, label: v }))]} />
                <Select label="القسم"              value={String(editForm.department_id || '')} onChange={e => set('department_id', e.target.value)} options={depts} />
                <Input  label="المسمى الوظيفي"    value={editForm.job_title || ''}   onChange={e => set('job_title', e.target.value)} />
                <Select label="نوع التعاقد"        value={String(editForm.contract_type_id || '')} onChange={e => set('contract_type_id', e.target.value)} options={contracts} />
                <Select label="الشفت"              value={String(editForm.shift_id || '')} onChange={e => set('shift_id', e.target.value)} options={shifts} />
                <div className="col-span-2">
                  <Input label="العنوان *" value={editForm.address || ''} onChange={e => set('address', e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-3">البيانات الشخصية</p>
                  <InfoRow label="الاسم"             value={emp.full_name} />
                  <InfoRow label="رقم الهوية"        value={emp.national_id} />
                  <InfoRow label="الهاتف"            value={emp.phone} />
                  <InfoRow label="البريد"            value={emp.email} />
                  <InfoRow label="الحالة الاجتماعية" value={emp.marital_status} />
                  <InfoRow label="العنوان"           value={emp.address} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-3">البيانات الوظيفية</p>
                  <InfoRow label="القسم"        value={emp.department?.name} />
                  <InfoRow label="المسمى"       value={emp.job_title} />
                  <InfoRow label="نوع التعاقد"  value={emp.contractType?.name} />
                  <InfoRow label="الشفت"        value={emp.shift?.name} />
                  <InfoRow label="تاريخ التعيين" value={emp.hire_date} />
                  <InfoRow label="رقم الموظف"   value={emp.employee_number} />
                </div>
              </div>
            )
          )}

          {/* Tab: المستندات */}
          {tab === 'docs' && (
            <div className="space-y-4">
              {/* رفع مستند جديد */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                <p className="text-sm font-bold text-gray-200 flex items-center gap-2">
                  <Upload size={14} className="text-blue-400"/> رفع مستند جديد
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="نوع المستند"
                    value={docForm.type}
                    onChange={e => setDocForm(f => ({ ...f, type: e.target.value }))}
                    options={['سيرة ذاتية','هوية','جواز سفر','عقد وظيفي','شهادات','أخرى'].map(v => ({ value: v, label: v }))}
                  />
                  <Input
                    label="اسم المستند"
                    value={docForm.name}
                    onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="مثال: سيرة ذاتية 2024"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex-1 cursor-pointer">
                    <div className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
                      docForm.file ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500'
                    }`}>
                      {docForm.file ? (
                        <p className="text-xs text-blue-400 font-semibold">{docForm.file.name}</p>
                      ) : (
                        <p className="text-xs text-gray-500">اضغط لاختيار ملف (PDF, Word, صورة)</p>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={e => setDocForm(f => ({ ...f, file: e.target.files[0] }))}
                    />
                  </label>
                  <Btn size="sm" onClick={handleUploadDoc} loading={uploading}>
                    <Upload size={12}/> رفع
                  </Btn>
                </div>
              </div>

              {/* قائمة المستندات */}
              {emp.documents?.length > 0 ? (
                <div className="space-y-2">
                  {emp.documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText size={16} className="text-blue-400"/>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-200 truncate">{doc.name}</p>
                          <p className="text-xs text-gray-500">{doc.type} · {doc.file_name}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0 mr-2">
                        {doc.file_url && (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <Btn size="sm" variant="ghost" title="عرض / تحميل">
                              <Download size={12}/>
                            </Btn>
                          </a>
                        )}
                        <Btn size="sm" variant="ghost" className="hover:text-red-400" title="حذف"
                          onClick={() => confirm('حذف المستند؟') && deleteDocMut.mutate(doc.id)}>
                          <Trash2 size={12}/>
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <FileText size={32} className="text-gray-600 mx-auto mb-2"/>
                  <p className="text-gray-500 text-sm">لا توجد مستندات مرفوعة</p>
                  <p className="text-gray-600 text-xs mt-1">استخدم النموذج أعلاه لرفع مستندات الموظف</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: المالية */}
          {tab === 'salary' && (
            <div className="space-y-4">
              {/* الراتب الحالي */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-3 font-semibold uppercase">الراتب الحالي</p>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    ['الراتب الأساسي', emp.basic_salary],
                    ['بدل السكن',      emp.housing_allowance],
                    ['بدل المواصلات',  emp.transport_allowance],
                    ['بدل الاتصالات',  emp.phone_allowance],
                    ['بدلات أخرى',    emp.other_allowances],
                    ['الإجمالي',       data?.total_salary],
                  ].map(([label, val]) => (
                    <div key={label} className={label === 'الإجمالي' ? 'col-span-3 border-t border-blue-500/20 pt-3 mt-1' : ''}>
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className={`font-bold ${label === 'الإجمالي' ? 'text-2xl text-blue-400' : 'text-gray-100'}`}>
                        {fmt(val)} ﷼
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* سجل تعديلات الراتب */}
              {emp.salaryHistory?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-3">سجل تعديلات الراتب</p>
                  <div className="space-y-2">
                    {emp.salaryHistory.map(h => (
                      <div key={h.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg text-sm">
                        <div>
                          <p className="text-gray-200 font-semibold">{h.reason}</p>
                          <p className="text-xs text-gray-500">{h.effective_date} · {h.approvedBy?.full_name}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-xs text-gray-500 line-through">{fmt(h.old_salary)} ﷼</p>
                          <p className="text-green-400 font-bold">{fmt(h.new_salary)} ﷼</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: الإجازات */}
          {tab === 'leaves' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-3">رصيد الإجازات — {new Date().getFullYear()}</p>
              {leaveData?.map((b, i) => (
                <div key={i} className="bg-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-200">{b.type}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400">مستخدم: <span className="text-amber-400 font-bold">{b.used_days}</span></span>
                      <span className="text-gray-400">متبقي: <span className={`font-bold ${b.is_low ? 'text-red-400' : 'text-green-400'}`}>{b.remaining_days}</span></span>
                      <span className="text-gray-500">/ {b.total_days}</span>
                    </div>
                  </div>
                  {b.total_days !== '∞' && <ProgressBar value={b.used_days} max={b.total_days} />}
                </div>
              ))}
              {(!leaveData || leaveData.length === 0) && (
                <p className="text-center text-gray-500 text-sm py-8">لا يوجد رصيد إجازات مسجل</p>
              )}
            </div>
          )}

          {/* Tab: الصلاحيات */}
          {tab === 'perm' && canManagePerms && (
            <PermissionsTab employeeId={id} />
          )}
        </>
      ) : null}

      {showSalary && (
        <SalaryModal id={id} currentSalary={emp?.basic_salary} onClose={() => setShowSalary(false)}
          onSaved={() => { setShowSalary(false); refetch(); }} />
      )}
    </Modal>
  );
}

// ── Modal تعديل الراتب ────────────────────────────────────────
function SalaryModal({ id, currentSalary, onClose, onSaved }) {
  const [form, setForm] = useState({ new_salary: '', reason: '', effective_date: '' });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.new_salary)      { toast.error('الراتب الجديد مطلوب'); return; }
    if (!form.reason.trim())   { toast.error('سبب التعديل مطلوب'); return; }
    if (!form.effective_date)  { toast.error('تاريخ التطبيق مطلوب'); return; }
    setLoading(true);
    try {
      await employeesApi.updateSalary(id, form);
      toast.success('تم تحديث الراتب بنجاح');
      onSaved();
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(e => toast.error(e));
    } finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title="تعديل الراتب الأساسي"
      footer={
        <>
          <Btn onClick={handleSave} loading={loading}>💾 حفظ التعديل</Btn>
          <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
        </>
      }>
      <div className="space-y-4">
        <div className="bg-gray-800 rounded-xl p-3 text-sm">
          <p className="text-gray-400">الراتب الحالي</p>
          <p className="text-xl font-black text-gray-100">{fmt(currentSalary)} ﷼</p>
        </div>
        <Input  label="الراتب الجديد (﷼) *" value={form.new_salary}     onChange={e => set('new_salary', e.target.value)} type="number" />
        <Input  label="تاريخ التطبيق *"      value={form.effective_date} onChange={e => set('effective_date', e.target.value)} type="date" />
        <Textarea label="سبب التعديل *"      value={form.reason}         onChange={e => set('reason', e.target.value)} rows={2} />
      </div>
    </Modal>
  );
}

// ── تبويب صلاحيات الموظف (مجموعة + استثناءات فردية) ─────────────
function PermissionsTab({ employeeId }) {
  const [groupId, setGroupId]         = useState('');
  const [pages, setPages]             = useState([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const [savingPages, setSavingPages] = useState(false);

  const { data: groupsData } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: () => permissionGroupsApi.list().then(r => r.data.data),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['employee-permissions', employeeId],
    queryFn: () => employeesApi.getPermissions(employeeId).then(r => r.data.data),
  });

  useEffect(() => {
    if (data) {
      setGroupId(data.permission_group_id ? String(data.permission_group_id) : '');
      setPages(data.pages);
    }
  }, [data]);

  const handleSaveGroup = async () => {
    setSavingGroup(true);
    try {
      await employeesApi.updateGroup(employeeId, { permission_group_id: groupId || null });
      toast.success('تم تحديث مجموعة الصلاحيات');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل تحديث المجموعة');
    } finally { setSavingGroup(false); }
  };

  const setOverride = (pageKey, actionKey, value) => {
    setPages(prev => prev.map(p => p.page_key === pageKey
      ? { ...p, override: { ...p.override, [actionKey]: value } }
      : p));
  };

  const handleSaveOverrides = async () => {
    setSavingPages(true);
    try {
      await employeesApi.updatePermissions(employeeId, {
        pages: pages.map(p => ({
          page_key:    p.page_key,
          can_view:    p.override.view,
          can_add:     p.override.add,
          can_edit:    p.override.edit,
          can_delete:  p.override.delete,
          can_export:  p.override.export,
          can_approve: p.override.approve,
        })),
      });
      toast.success('تم حفظ استثناءات الصلاحيات');
      refetch();
    } catch {
      toast.error('فشل حفظ الاستثناءات');
    } finally { setSavingPages(false); }
  };

  const groups = (groupsData || []).map(g => ({ value: String(g.id), label: g.name }));

  return (
    <div className="space-y-5">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-3">مجموعة الصلاحيات</p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Select value={groupId} onChange={e => setGroupId(e.target.value)} options={groups} />
          </div>
          <Btn size="sm" onClick={handleSaveGroup} loading={savingGroup}>حفظ</Btn>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase">استثناءات فردية (تتجاوز صلاحيات المجموعة)</p>
          <Btn size="sm" onClick={handleSaveOverrides} loading={savingPages}>حفظ الاستثناءات</Btn>
        </div>
        {isLoading ? <Loading /> : (
          <div className="overflow-x-auto border border-gray-700 rounded-xl">
            <table className="w-full border-collapse min-w-max">
              <thead>
                <tr className="bg-gray-800/80">
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-400 whitespace-nowrap">الصفحة</th>
                  {PERM_ACTIONS.map(a => (
                    <th key={a.short} className="px-3 py-2.5 text-center text-xs font-semibold text-gray-400 whitespace-nowrap">{a.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pages.map(p => (
                  <tr key={p.page_key} className="border-t border-gray-800">
                    <td className="px-3 py-2 text-xs font-semibold text-gray-200 whitespace-nowrap">{p.page_name}</td>
                    {PERM_ACTIONS.map(a => (
                      <td key={a.short} className="px-3 py-2">
                        <TriCell
                          value={p.override[a.short]}
                          groupValue={p.group[a.short]}
                          onChange={(v) => setOverride(p.page_key, a.short, v)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-600 mt-2">رمادي = يتبع المجموعة · أخضر = مسموح دائماً · أحمر = ممنوع دائماً — اضغط للتبديل</p>
      </div>
    </div>
  );
}

// ── خلية ثلاثية الحالة: موروث من المجموعة / مسموح / ممنوع ────────
function TriCell({ value, groupValue, onChange }) {
  const cycle = () => onChange(value === null || value === undefined ? true : value === true ? false : null);

  let cls, content, title;
  if (value === true) {
    cls = 'bg-green-500/20 text-green-400 border-green-500/40';
    content = '✓'; title = 'مسموح دائماً (استثناء) — اضغط للتبديل';
  } else if (value === false) {
    cls = 'bg-red-500/20 text-red-400 border-red-500/40';
    content = '✕'; title = 'ممنوع دائماً (استثناء) — اضغط للتبديل';
  } else {
    cls = groupValue ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-800 text-gray-600 border-gray-700';
    content = groupValue ? '✓' : '—';
    title = `يتبع المجموعة (${groupValue ? 'مسموح' : 'ممنوع'}) — اضغط للتخصيص`;
  }

  return (
    <button type="button" title={title} onClick={cycle}
      className={`w-7 h-7 rounded-md border text-xs font-bold flex items-center justify-center mx-auto transition-colors ${cls}`}>
      {content}
    </button>
  );
}
