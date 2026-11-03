import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import client from '../../api/client';
import { PageHeader } from '../../components/layout/Layout';
import {
  Btn, Badge, StatCard, Card, Input, Select,
  Table, Tr, Td, Loading, Avatar,
} from '../../components/ui';
import {
  Building2, Users, TrendingUp, DollarSign,
  Calendar, Clock, FileDown, UserX, Palmtree, CheckCircle,
} from 'lucide-react';

// ── helpers ───────────────────────────────────────────────────
const numFmt  = (n) => Number(n || 0).toLocaleString('en-US');
const dateFmt = (d) => d ? new Date(d).toLocaleDateString('ar-SA-u-nu-latn') : '—';

const todayISO = () => new Date().toISOString().slice(0, 10);
const localToday = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};
const firstOfMonth = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
};
const currentMonth = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
};

// هل السجل ضمن فلتر القسم والموظف؟ (منبع واحد للأرقام والجداول والتصدير)
const inScope = (employee, employeeId, { department, employee_id }) =>
  (!employee_id || String(employeeId) === String(employee_id)) &&
  (!department || employee?.department?.name === department);

// فلترا القسم والموظف: قائمة الموظفين بتتبع القسم، وتغيير القسم بيلغي موظف من برّاه
function ScopeFilters({ filters, setFilters, employees }) {
  const departments = useMemo(
    () => [...new Set(employees.map(e => e.department?.name).filter(Boolean))],
    [employees]
  );
  const options = employees
    .filter(e => !filters.department || e.department?.name === filters.department)
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'ar'))
    .map(e => ({ value: String(e.id), label: e.full_name }));

  const changeDepartment = (department) => setFilters(f => {
    const emp = employees.find(e => String(e.id) === String(f.employee_id));
    return { ...f, department, employee_id: !department || emp?.department?.name === department ? f.employee_id : '' };
  });

  return (
    <>
      <Select label="القسم" value={filters.department} onChange={e => changeDepartment(e.target.value)}
        options={departments.map(d => ({ value: d, label: d }))} />
      <Select label="اسم الموظف" value={filters.employee_id} onChange={e => setFilters(f => ({ ...f, employee_id: e.target.value }))}
        options={options} />
    </>
  );
}

// التصدير بيمر عبر client (بالتوكن بالهيدر) وبينزّل ملف إكسل — رابط مفتوح بتبويب ما بيوصله التوكن
const exportSheet = async ({ url, params, employees, employeeKey, filters, mapRow, sheet, file }) => {
  try {
    const res = await client.get(url, { params });
    let records = res.data?.data || [];
    const byId = Object.fromEntries(employees.map(e => [e.id, e]));
    records = records.filter(r => inScope(byId[r[employeeKey]], r[employeeKey], filters));
    if (!records.length) { toast.error('لا توجد بيانات ضمن الفترة المحددة'); return; }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(records.map(mapRow)), sheet);
    XLSX.writeFile(wb, file);
    toast.success(`تم تصدير ${records.length} سجل`);
  } catch { toast.error('فشل التصدير'); }
};

const LEAVE_STATUS = {
  'معتمدة':       'green',
  'مرفوضة':       'red',
  'قيد المراجعة': 'amber',
  approved:       'green',
  rejected:       'red',
  pending:        'amber',
};

const LEAVE_BAR_COLORS = [
  'bg-blue-500', 'bg-teal-500', 'bg-purple-500',
  'bg-rose-500', 'bg-amber-500', 'bg-green-500',
];

const ATTEND_COLORS = {
  حاضر:  'bg-green-500',
  متأخر: 'bg-amber-500',
  غياب:  'bg-red-500',
  إجازة: 'bg-blue-500',
};

// ── الصفحة ───────────────────────────────────────────────────
const TABS = [
  { id: 'sales', label: 'تقارير المبيعات',         icon: Building2 },
  { id: 'hr',    label: 'تقارير الموارد البشرية',  icon: Users     },
];

export default function ReportsPage() {
  const [tab, setTab] = useState('sales');

  return (
    <div>
      <PageHeader
        title="التقارير"
        subtitle="تحليلات وإحصائيات المبيعات والموارد البشرية"
      />

      <div className="p-4 sm:p-6 space-y-5">

        {/* مفتاح التبويبات */}
        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 sm:flex-none justify-center whitespace-nowrap flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all
                ${tab === t.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'text-gray-400 hover:text-gray-200'
                }`}
            >
              <t.icon size={15}/>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'sales' && <SalesReports />}
        {tab === 'hr'    && <HRReports />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// تقارير المبيعات
// ══════════════════════════════════════════════════════════════
function SalesReports() {
  const [filters, setFilters] = useState({ from: firstOfMonth(), to: todayISO(), department: '', employee_id: '' });
  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  // جلب العقارات
  const { data: propsData, isLoading: propsLoading } = useQuery({
    queryKey: ['rpt-properties', filters.from, filters.to],
    // /export بيرجّع كل سجلات الفترة (القائمة العادية مقسمة صفحات)
    queryFn:  () => client.get('/properties/export', { params: {
      date_from: filters.from,
      date_to:   filters.to,
    }}).then(r => r.data.data || []),
    staleTime: 60_000,
  });

  // جلب الموظفين (للفلترة بالقسم)
  const { data: empsData } = useQuery({
    queryKey: ['rpt-employees'],
    queryFn:  () => client.get('/employees', { params: { per_page: 999 } }).then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const employees = empsData?.data?.data  ?? empsData?.data  ?? [];
  const rawProps = useMemo(() => {
    const byId = Object.fromEntries(employees.map(e => [e.id, e]));
    return (propsData || []).map(p => ({ ...p, employee: byId[p.assigned_employee_id] }));
  }, [propsData, employees]);

  // فلترة العقارات حسب القسم والموظف المسؤول
  const properties = useMemo(
    () => rawProps.filter(p => inScope(p.employee, p.assigned_employee_id, filters)),
    [rawProps, filters.department, filters.employee_id]
  );

  // إحصائيات
  const total      = properties.length;
  const available  = properties.filter(p => ['متاح', 'available'].includes(p.status)).length;
  const sold       = properties.filter(p => ['مباع', 'sold'].includes(p.status)).length;
  const totalValue = properties
    .filter(p => ['مباع', 'sold'].includes(p.status))
    .reduce((s, p) => s + Number(p.listed_price || 0), 0);

  // أفضل الموظفين
  const performers = useMemo(() => {
    const map = {};
    properties.forEach(p => {
      const emp = p.employee;
      if (!emp?.id) return;
      if (!map[emp.id]) map[emp.id] = { employee: emp, count: 0, total: 0 };
      map[emp.id].count++;
      if (['مباع', 'sold'].includes(p.status))
        map[emp.id].total += Number(p.listed_price || 0);
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [properties]);

  // توزيع الحالات
  const statusDist = useMemo(() => {
    const map = {};
    properties.forEach(p => { const s = p.status || 'غير محدد'; map[s] = (map[s] || 0) + 1; });
    return Object.entries(map)
      .map(([status, count]) => ({ status, count, pct: total > 0 ? (count / total * 100).toFixed(1) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [properties, total]);

  const STATUS_BAR = {
    متاح: 'bg-green-500', available: 'bg-green-500',
    مباع: 'bg-blue-500',  sold: 'bg-blue-500',
    محجوز: 'bg-amber-500',
  };

  const exportProperties = () => exportSheet({
    url: '/properties/export',
    params: { date_from: filters.from, date_to: filters.to },
    employees, employeeKey: 'assigned_employee_id', filters,
    sheet: 'العقارات',
    file: `properties-${filters.from}-${filters.to}.xlsx`,
    mapRow: p => ({
      'الكود':         p.property_code,
      'الاسم':         p.name,
      'نوع العقار':    p.property_type?.name || '—',
      'المالك':        p.owner?.name || '—',
      'المدينة':       p.city?.name || '—',
      'الحي':          p.neighborhood?.name || '—',
      'الحالة':        p.status,
      'السعر المعروض': p.listed_price,
      'المساحة':       p.total_area,
      'تاريخ الإضافة': p.created_at?.slice(0, 10),
    }),
  });

  return (
    <div className="space-y-5">

      {/* فلترة */}
      <Card>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <Input label="من تاريخ" type="date" value={filters.from}
            onChange={e => setF('from', e.target.value)} className="w-40" />
          <Input label="إلى تاريخ" type="date" value={filters.to}
            onChange={e => setF('to', e.target.value)} className="w-40" />
          <ScopeFilters filters={filters} setFilters={setFilters} employees={employees} />
          <Btn variant="outline" onClick={exportProperties}>
            <FileDown size={14}/> تصدير Excel
          </Btn>
        </div>
      </Card>

      {propsLoading ? <Loading /> : (
        <>
          {/* إحصائيات */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <StatCard label="إجمالي العقارات"      value={total     || 0} icon={<Building2 size={18}/>}    color="blue"  />
            <StatCard label="عقارات متاحة"         value={available  || 0} icon={<CheckCircle size={18}/>}  color="green" />
            <StatCard label="عقارات مباعة"         value={sold       || 0} icon={<TrendingUp size={18}/>}   color="amber" />
            <StatCard label="قيمة المبيعات (ر.س)"  value={numFmt(totalValue)} icon={<DollarSign size={18}/>} color="teal" />
          </div>

          {/* أفضل الموظفين */}
          <Card title="أفضل الموظفين أداءً">
            {performers.length === 0 ? (
              <EmptyState msg="لا توجد بيانات للفترة المحددة" />
            ) : (
              <Table headers={['#', 'الموظف', 'القسم', 'العقارات المدارة', 'إجمالي المبيعات (ر.س)']}>
                {performers.map((p, i) => (
                  <Tr key={i}>
                    <Td>
                      <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs flex items-center justify-center font-bold">
                        {i + 1}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={p.employee?.full_name} size="sm"/>
                        <div>
                          <p className="text-xs font-semibold text-gray-100">{p.employee?.full_name}</p>
                          <p className="text-xs text-gray-500 font-mono">{p.employee?.employee_number}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-gray-400 text-xs">{p.employee?.department?.name || '—'}</Td>
                    <Td className="font-mono text-blue-400 text-center">{p.count}</Td>
                    <Td className="font-bold text-green-400">{numFmt(p.total)}</Td>
                  </Tr>
                ))}
              </Table>
            )}
          </Card>

          {/* توزيع حالة العقارات */}
          <Card title="توزيع حالة العقارات">
            {statusDist.length === 0 ? (
              <EmptyState msg="لا توجد بيانات" />
            ) : (
              <Table headers={['الحالة', 'العدد', 'النسبة', '']}>
                {statusDist.map((s, i) => (
                  <Tr key={i}>
                    <Td className="font-semibold text-gray-200">{s.status}</Td>
                    <Td className="font-mono text-center text-blue-400">{s.count}</Td>
                    <Td className="text-gray-500 text-xs w-16">{s.pct}%</Td>
                    <Td className="min-w-32">
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${STATUS_BAR[s.status] || 'bg-gray-500'}`}
                          style={{ width: `${s.pct}%` }}
                        />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// تقارير الموارد البشرية
// ══════════════════════════════════════════════════════════════
function HRReports() {
  const [filters, setFilters] = useState({
    month:      currentMonth(),
    department: '',
    employee_id: '',
    type:       'monthly',
  });
  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  // حساب نطاق التاريخ من الشهر المختار
  const [year, mon] = filters.month.split('-').map(Number);
  const monthStart = `${year}-${String(mon).padStart(2, '0')}-01`;
  const lastDay  = new Date(year, mon, 0).getDate();
  const yearly   = filters.type === 'yearly';
  const fromDate = yearly ? `${year}-01-01` : monthStart;
  const toDate   = yearly ? `${year}-12-31` : `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const periodLabel = yearly ? String(year) : filters.month;
  const today    = localToday();

  // جلب طلبات الإجازات
  const { data: leavesData, isLoading: leavesLoading } = useQuery({
    queryKey: ['rpt-leaves', fromDate, toDate],
    queryFn:  () => client.get('/leave-requests/export', { params: { from: fromDate, to: toDate } }).then(r => r.data.data || []),
    staleTime: 60_000,
  });

  // جلب الموظفين
  const { data: empsData } = useQuery({
    queryKey: ['rpt-employees'],
    queryFn:  () => client.get('/employees', { params: { per_page: 999 } }).then(r => r.data),
    staleTime: 5 * 60_000,
  });

  // جلب سجلات الحضور للفترة
  const { data: attendData } = useQuery({
    queryKey: ['rpt-attendance', fromDate, toDate],
    queryFn:  () => client.get('/attendance/export', { params: { from: fromDate, to: toDate } }).then(r => r.data.data || []),
    staleTime: 60_000,
  });

  // المجازون اليوم — مستقل عن الفترة المختارة
  const { data: todayLeavesData } = useQuery({
    queryKey: ['rpt-leaves-today', today],
    queryFn:  () => client.get('/leave-requests/export', { params: { from: today, to: today } }).then(r => r.data.data || []),
    staleTime: 60_000,
  });

  const employees  = empsData?.data?.data    ?? empsData?.data    ?? [];

  // ربط كل سجل بموظفه الكامل (فيه القسم) + فلترة القسم
  const withEmployee = (rows) => {
    const byId = Object.fromEntries(employees.map(e => [e.id, e]));
    const out  = (rows || []).map(r => ({ ...r, employee: byId[r.employee_id] || r.employee }));
    return out.filter(r => inScope(r.employee, r.employee_id, filters));
  };

  const leaves     = useMemo(() => withEmployee(leavesData), [leavesData, employees, filters.department, filters.employee_id]);
  const attendance = useMemo(() => withEmployee(attendData), [attendData, employees, filters.department, filters.employee_id]);

  // ── إحصائيات ──
  const approved = leaves.filter(l =>
    ['معتمدة', 'approved'].includes(l.final_status || l.status)
  );
  const totalDaysUsed = approved.reduce((s, l) => s + Number(l.days_count || 0), 0);

  const onLeave = new Set(
    withEmployee(todayLeavesData).filter(l => l.final_status === 'معتمدة').map(l => l.employee_id)
  ).size;

  const pending = leaves.filter(l =>
    ['قيد المراجعة', 'pending'].includes(l.final_status || l.status)
  ).length;

  const absentRecs  = attendance.filter(a => a.status === 'غياب');
  const absenceRate = attendance.length > 0
    ? (absentRecs.length / attendance.length * 100).toFixed(1)
    : '0.0';

  // ── توزيع الإجازات حسب النوع ──
  const leaveByType = useMemo(() => {
    const map = {};
    leaves.forEach(l => {
      const type = l.leave_type?.name || l.leave_type || 'أخرى';
      if (!map[type]) map[type] = { count: 0, days: 0 };
      map[type].count++;
      map[type].days += Number(l.days_count || 0);
    });
    return Object.entries(map)
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.days - a.days);
  }, [leaves]);
  const maxLeaveDays = leaveByType.reduce((m, l) => Math.max(m, l.days), 1);

  // ── توزيع الحضور ──
  const attendDist = useMemo(() => {
    const map = {};
    attendance.forEach(a => { const s = a.status || '—'; map[s] = (map[s] || 0) + 1; });
    return Object.entries(map)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [attendance]);
  const maxAttend = attendDist.reduce((m, a) => Math.max(m, a.count), 1);

  // ── أكثر الموظفين استخداماً للإجازات ──
  const topUsers = useMemo(() => {
    const map = {};
    approved.forEach(l => {
      const emp = l.employee;
      if (!emp?.id) return;
      if (!map[emp.id]) map[emp.id] = { employee: emp, count: 0, days: 0 };
      map[emp.id].count++;
      map[emp.id].days += Number(l.days_count || 0);
    });
    return Object.values(map).sort((a, b) => b.days - a.days).slice(0, 10);
  }, [approved]);

  // التصدير
  const exportLeaves = () => exportSheet({
    url: '/leave-requests/export',
    params: { from: fromDate, to: toDate },
    employees, employeeKey: 'employee_id', filters,
    sheet: 'الإجازات',
    file: `leaves-${periodLabel}.xlsx`,
    mapRow: l => ({
      'رقم الطلب':  l.request_number,
      'الموظف':     l.employee?.full_name || '—',
      'نوع الإجازة': l.leave_type?.name || '—',
      'من تاريخ':   l.from_date?.slice(0, 10),
      'إلى تاريخ':  l.to_date?.slice(0, 10),
      'عدد الأيام': l.days_count,
      'الحالة':     l.final_status,
      'السبب':      l.reason || '',
    }),
  });
  const exportAttendance = () => exportSheet({
    url: '/attendance/export',
    params: { from: fromDate, to: toDate },
    employees, employeeKey: 'employee_id', filters,
    sheet: 'الحضور',
    file: `attendance-${periodLabel}.xlsx`,
    mapRow: a => ({
      'الموظف':      a.employee?.full_name || '—',
      'رقم الموظف':  a.employee?.employee_number || '—',
      'التاريخ':     String(a.date || '').slice(0, 10),
      'الحضور':      a.check_in?.slice(0, 5) || '—',
      'الانصراف':    a.check_out?.slice(0, 5) || '—',
      'ساعات العمل': a.worked_hours,
      'الحالة':      a.status,
      'دقائق التأخير': a.late_minutes || 0,
      'ملاحظات':     a.notes || '',
    }),
  });

  return (
    <div className="space-y-5">

      {/* فلترة */}
      <Card>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <Input
            label="الشهر"
            type="month"
            value={filters.month}
            onChange={e => setF('month', e.target.value)}
            className="w-44"
          />
          <ScopeFilters filters={filters} setFilters={setFilters} employees={employees} />
          <Select
            label="نوع التقرير"
            value={filters.type}
            onChange={e => setF('type', e.target.value)}
            options={[
              { value: 'monthly', label: 'شهري' },
              { value: 'yearly',  label: 'سنوي' },
            ]}
          />
          <div className="flex gap-2 flex-wrap">
            <Btn variant="outline" onClick={exportLeaves}>
              <FileDown size={14}/> تصدير الإجازات
            </Btn>
            <Btn variant="outline" onClick={exportAttendance}>
              <FileDown size={14}/> تصدير الحضور
            </Btn>
          </div>
        </div>
      </Card>

      {leavesLoading ? <Loading /> : (
        <>
          {/* إحصائيات */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <StatCard label="أيام الإجازة المستخدمة" value={totalDaysUsed || 0} icon={<Calendar size={18}/>}  color="blue"  />
            <StatCard label="موظفون في إجازة الآن"   value={onLeave       || 0} icon={<Palmtree size={18}/>} color="green" />
            <StatCard label="طلبات قيد الانتظار"     value={pending        || 0} icon={<Clock size={18}/>}    color="amber" />
            <StatCard label="معدل الغياب"            value={`${absenceRate}%`}  icon={<UserX size={18}/>}    color="red"   />
          </div>

          {/* الرسوم البيانية */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* توزيع الإجازات حسب النوع */}
            <Card title="توزيع الإجازات حسب النوع">
              {leaveByType.length === 0 ? <EmptyState msg="لا توجد إجازات للفترة المحددة" /> : (
                <div className="space-y-4 p-4">
                  {leaveByType.map((item, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5 text-xs">
                        <span className="text-gray-300 font-medium">{item.type}</span>
                        <span className="text-gray-500">
                          {numFmt(item.days)} يوم · {item.count} طلب
                        </span>
                      </div>
                      <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${LEAVE_BAR_COLORS[i % LEAVE_BAR_COLORS.length]}`}
                          style={{ width: `${(item.days / maxLeaveDays) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* توزيع الحضور */}
            <Card title="توزيع الحضور للفترة">
              {attendDist.length === 0 ? <EmptyState msg="لا توجد سجلات حضور للفترة" /> : (
                <div className="space-y-4 p-4">
                  {attendDist.map((item, i) => {
                    const pct = attendance.length > 0
                      ? (item.count / attendance.length * 100).toFixed(1) : 0;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5 text-xs">
                          <span className="text-gray-300 font-medium">{item.status}</span>
                          <span className="text-gray-500">{numFmt(item.count)} · {pct}%</span>
                        </div>
                        <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${ATTEND_COLORS[item.status] || 'bg-gray-500'}`}
                            style={{ width: `${(item.count / maxAttend) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* جدول تفصيلي للإجازات */}
          <Card title={`تفاصيل الإجازات — ${periodLabel}`}>
            {leaves.length === 0 ? (
              <EmptyState msg="لا توجد طلبات إجازة للفترة المحددة" />
            ) : (
              <Table headers={['الموظف', 'القسم', 'نوع الإجازة', 'الأيام', 'من', 'إلى', 'الحالة']}>
                {leaves.slice(0, 50).map((l, i) => (
                  <Tr key={i}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={l.employee?.full_name} size="sm"/>
                        <p className="text-xs font-semibold text-gray-100">{l.employee?.full_name}</p>
                      </div>
                    </Td>
                    <Td className="text-gray-400 text-xs">{l.employee?.department?.name || '—'}</Td>
                    <Td className="text-blue-400 text-xs">{l.leave_type?.name || l.leave_type || '—'}</Td>
                    <Td className="font-mono text-center text-gray-300">{l.days_count ?? '—'}</Td>
                    <Td className="text-gray-400 text-xs">{dateFmt(l.from_date)}</Td>
                    <Td className="text-gray-400 text-xs">{dateFmt(l.to_date)}</Td>
                    <Td>
                      <Badge
                        label={l.final_status || l.status || 'قيد المراجعة'}
                        color={LEAVE_STATUS[l.final_status || l.status] || 'amber'}
                      />
                    </Td>
                  </Tr>
                ))}
              </Table>
            )}
            {leaves.length > 50 && (
              <p className="text-xs text-gray-500 text-center py-3">
                يُعرض 50 سجل من أصل {leaves.length} — صدّر الملف لرؤية الكل
              </p>
            )}
          </Card>

          {/* أكثر الموظفين استخداماً للإجازات */}
          <Card title="أكثر الموظفين استخداماً للإجازات">
            {topUsers.length === 0 ? (
              <EmptyState msg="لا توجد إجازات معتمدة للفترة" />
            ) : (
              <Table headers={['#', 'الموظف', 'القسم', 'عدد الطلبات', 'إجمالي الأيام']}>
                {topUsers.map((u, i) => (
                  <Tr key={i}>
                    <Td>
                      <span className="w-6 h-6 rounded-full bg-amber-600/20 text-amber-400 text-xs flex items-center justify-center font-bold">
                        {i + 1}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={u.employee?.full_name} size="sm"/>
                        <div>
                          <p className="text-xs font-semibold text-gray-100">{u.employee?.full_name}</p>
                          <p className="text-xs text-gray-500 font-mono">{u.employee?.employee_number}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-gray-400 text-xs">{u.employee?.department?.name || '—'}</Td>
                    <Td className="font-mono text-center text-blue-400">{u.count}</Td>
                    <Td className="font-bold text-amber-400">{numFmt(u.days)} يوم</Td>
                  </Tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

// ── مكوّن مساعد ───────────────────────────────────────────────
function EmptyState({ msg }) {
  return (
    <div className="text-center py-10 text-gray-500 text-sm">
      {msg}
    </div>
  );
}
