import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { leadsApi, visitsApi, employeesApi, lookupApi, operationAssignmentsApi } from '../../api/services';
import { PageHeader } from '../../components/layout/Layout';
import {
  PhoneText, MoneyInput, formatMoney, Btn, Badge, StatCard, Table, Tr, Td, Modal, Input, Select,
  Textarea, SearchBox, Avatar, Card, Loading, InfoRow, CountBox, FilterPanel, BoxSection,
} from '../../components/ui';
import { Plus, Pencil, Trash2, Calendar, Users, MessageSquare, TrendingUp, X, UserCheck, Home, Download, Compass, Banknote, CircleDot } from 'lucide-react';

const formatDate = (str) => {
  if (!str) return '—';
  const d = new Date(str);
  return isNaN(d) ? str : d.toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
};

const toDateInput = (d) => d ? String(d).slice(0, 10) : '';

const CLASS_COLOR  = { جاد: 'green', استفسار: 'blue', بحث: 'gray' };
const STATUS_COLOR = { مفتوح: 'green', مغلق: 'gray' };
const FOLLOW_COLOR = { اليوم: 'amber', قادم: 'blue', متأخر: 'red' };
const SOURCES = ['حراج','عقار','بيوت','ديل','موقع مكانة','مباشر','اتصال','تيك توك','سناب','تويتر','انستجرام','برودكاست','لوحة','يوتيوب','مجتمع','إعادة استهداف','سيتي سكيب','أخرى'];
const DIRECTIONS = ['شمالية','جنوبية','شرقية','غربية','شمالية شرقية','شمالية غربية','جنوبية شرقية','جنوبية غربية'];
const todayISO = () => new Date().toISOString().slice(0, 10);

const OPERATION_STATUSES = ['يبغى تواصل هاتفي', 'عنده استفسارات أكثر', 'اهتمام مبدئي'];
const SPECIALIST_STAGES  = ['تواصل', 'معلومات واستفسارات', 'زيارة', 'إقناع', 'تفاوض', 'تفاهم', 'حجز'];
const OP_STATUS_COLOR    = { 'يبغى تواصل هاتفي': 'gray', 'عنده استفسارات أكثر': 'blue', 'اهتمام مبدئي': 'amber' };
const STAGE_COLOR        = { تواصل: 'gray', 'معلومات واستفسارات': 'blue', زيارة: 'purple', إقناع: 'amber', تفاوض: 'amber', تفاهم: 'teal', حجز: 'green' };

const APPLICANT_TYPES = ['مهتم', 'مشتري', 'مستأجر', 'وسيط', 'وكيل', 'مطور'];

export default function LeadsPage() {
  const qc = useQueryClient();
  const [tab, setTab]               = useState('leads');
  const [search, setSearch]         = useState('');
  const [filters, setFilters]       = useState({});
  const [showForm, setShowForm]     = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [editing, setEditing]       = useState(null);
  const [exporting, setExporting]   = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['leads', search, filters],
    queryFn: () => leadsApi.list({ search, ...filters }).then(r => r.data),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  // أي تغيير بالفلاتر بيرجّع لأول صفحة
  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v || undefined, page: undefined }));
  const toggleF = (k, v) => setFilters(f => ({ ...f, [k]: String(f[k]) === String(v) ? undefined : v, page: undefined }));
  const hasDate    = !!(filters.date_from || filters.date_to);
  const FILTER_KEYS = ['employee_id', 'specialist_id', 'applicant_type', 'phone', 'seriousness_level', 'property_type_id', 'direction', 'price_category', 'request_status'];
  const activeFilters = FILTER_KEYS.filter(k => filters[k]).length;
  const hasFilters = activeFilters > 0;
  const clearFilters = () => setFilters(f => ({ date_from: f.date_from, date_to: f.date_to }));

  const { data: visitsData } = useQuery({
    queryKey: ['visits'],
    queryFn: () => visitsApi.list().then(r => r.data),
    enabled: tab === 'visits',
  });

  const deleteMut = useMutation({
    mutationFn: leadsApi.delete,
    onSuccess: () => { toast.success('تم حذف المهتم'); qc.invalidateQueries(['leads']); },
  });

  const stats        = data?.stats         || {};
  const byBudget     = data?.by_budget     || [];
  const byDirection  = data?.by_direction  || [];
  const byStatus     = data?.by_status     || [];
  const byType       = data?.by_type       || [];
  const byOperation  = data?.by_operation  || [];
  const bySpecialist = data?.by_specialist || [];

  // التصدير بياخد نفس الفترة والفلاتر المطبّقة على الصفحة
  const handleExport = async () => {
    setExporting(true);
    try {
      const res     = await leadsApi.export({ search, ...filters });
      const records = res.data?.data || [];

      if (!records.length) {
        toast.error('لا توجد بيانات ضمن الفترة المحددة');
        return;
      }

      const rows = records.map(l => ({
        'الكود':            l.lead_code,
        'الاسم':            l.name,
        'الهاتف':           l.phone,
        'الصفة':            l.applicant_type,
        'نوع العقار':        l.property_type?.name || '—',
        'الاتجاه':          l.direction || '—',
        'الميزانية':         l.budget,
        'فئة السعر':        l.price_category || '—',
        'درجة الاهتمام':    l.seriousness_level ? `${l.seriousness_level}/4` : '—',
        'التصنيف':          l.classification,
        'حالة الطلب':       l.request_status,
        'الأوبريشن':        l.operation_employee?.full_name || '—',
        'الأخصائي':         l.broker_employee?.full_name || '—',
        'تاريخ الإضافة':    l.created_at?.slice(0, 10),
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'المهتمون');
      const period = hasDate ? `${filters.date_from || 'start'}-${filters.date_to || todayISO()}` : 'all';
      XLSX.writeFile(wb, `leads-${period}.xlsx`);
      toast.success(`تم تصدير ${records.length} مهتم`);
    } catch { toast.error('فشل التصدير'); }
    finally { setExporting(false); }
  };

  return (
    <div>
      <PageHeader
        title="إدارة المهتمين"
        subtitle="إدارة قاعدة بيانات العملاء المهتمين"
        actions={
          <>
            <SearchBox value={search} onChange={v => { setSearch(v); setFilters(f => ({ ...f, page: undefined })); }} placeholder="بحث بالاسم أو الكود..." />
            <Btn onClick={() => { setEditing(null); setShowForm(true); }}>
              <Plus size={16}/> إضافة مهتم جديد
            </Btn>
          </>
        }
      />

      <div className="p-4 sm:p-6 space-y-6">
        {/* ① الفترة + التصدير */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-[calc(50%-6px)] sm:w-44">
              <Input label="من تاريخ" type="date" value={filters.date_from || ''} onChange={e => setF('date_from', e.target.value)} />
            </div>
            <div className="w-[calc(50%-6px)] sm:w-44">
              <Input label="إلى تاريخ" type="date" value={filters.date_to || ''} onChange={e => setF('date_to', e.target.value)} />
            </div>
            <Btn variant="outline" loading={exporting} onClick={handleExport} className="h-[42px] w-full sm:w-auto justify-center">
              <Download size={14}/> تصدير إكسل
            </Btn>
            {hasDate && (
              <Btn variant="ghost" onClick={() => setFilters(f => ({ ...f, date_from: undefined, date_to: undefined, page: undefined }))} className="h-[42px]">
                <X size={13}/> كل الفترات
              </Btn>
            )}
            <p className="text-xs text-gray-500 sm:mr-auto pb-2.5">
              {hasDate ? 'الأرقام والقائمة والتصدير حسب المهتمين المضافين بالفترة المحددة' : 'بدون فترة = كل المهتمين'}
            </p>
          </div>
        </div>

        {/* ② الداشبورد */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="عدد العملاء"   value={stats.total}        icon={<Users size={18}/>}         color="blue" />
            <StatCard label="عملاء جادون"  value={stats.serious}      icon={<TrendingUp size={18}/>}    color="green" />
            <StatCard label="زيارات اليوم" value={stats.today_visits} icon={<Calendar size={18}/>}      color="amber" />
            <StatCard label="استفسارات"    value={stats.inquiries}    icon={<MessageSquare size={18}/>} color="purple" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BoxSection icon={<Banknote size={13}/>} title="حسب الميزانية" cols="sm:grid-cols-3" fixed>
              {byBudget.map(b => (
                <CountBox key={b.label} label={b.label} count={b.count}
                  active={filters.price_category === b.label} onClick={() => toggleF('price_category', b.label)} />
              ))}
            </BoxSection>
            <BoxSection icon={<CircleDot size={13}/>} title="حسب الحالة" cols="sm:grid-cols-3" fixed>
              {byStatus.map(s => (
                <CountBox key={s.label} label={s.label} count={s.count}
                  active={filters.request_status === s.label} onClick={() => toggleF('request_status', s.label)} />
              ))}
            </BoxSection>
          </div>

          <BoxSection icon={<Home size={13}/>} title="حسب النوع" cols="lg:grid-cols-6">
            {byType.map(t => (
              <CountBox key={t.id} label={t.label} count={t.count}
                active={String(filters.property_type_id) === String(t.id)} onClick={() => toggleF('property_type_id', t.id)} />
            ))}
          </BoxSection>

          <BoxSection icon={<Compass size={13}/>} title="حسب الاتجاه" cols="2xl:grid-cols-8">
            {byDirection.map(d => (
              <CountBox key={d.label} label={d.label} count={d.count}
                active={filters.direction === d.label} onClick={() => toggleF('direction', d.label)} />
            ))}
          </BoxSection>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BoxSection icon={<UserCheck size={13}/>} title="حسب الأوبريشن" cols="sm:grid-cols-3" fixed>
              {byOperation.length === 0 && <p className="text-xs text-gray-600 col-span-full">لا يوجد موظفين أوبريشن</p>}
              {byOperation.map(e => (
                <CountBox key={e.id} label={e.label} count={e.count}
                  active={String(filters.employee_id) === String(e.id)} onClick={() => toggleF('employee_id', e.id)} />
              ))}
            </BoxSection>
            <BoxSection icon={<Users size={13}/>} title="حسب الأخصائيين" cols="sm:grid-cols-3" fixed>
              {bySpecialist.length === 0 && <p className="text-xs text-gray-600 col-span-full">ما في مهتمين انحوّلوا لأخصائي لهلق</p>}
              {bySpecialist.map(e => (
                <CountBox key={e.id} label={e.label} count={e.count}
                  active={String(filters.specialist_id) === String(e.id)} onClick={() => toggleF('specialist_id', e.id)} />
              ))}
            </BoxSection>
          </div>
        </div>

        {/* ③ الفلاتر */}
        <FilterPanel activeCount={activeFilters} onClear={clearFilters}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Select label="الأوبريشن" value={filters.employee_id || ''} onChange={e => setF('employee_id', e.target.value)}
              options={byOperation.map(e => ({ value: String(e.id), label: e.label }))} />
            <Select label="الأخصائي" value={filters.specialist_id || ''} onChange={e => setF('specialist_id', e.target.value)}
              options={bySpecialist.map(e => ({ value: String(e.id), label: e.label }))} />
            <Select label="الصفة" value={filters.applicant_type || ''} onChange={e => setF('applicant_type', e.target.value)}
              options={APPLICANT_TYPES.map(v => ({ value: v, label: v }))} />
            <Input label="بحث برقم الجوال" placeholder="05xxxxxxxx" value={filters.phone || ''}
              onChange={e => setF('phone', e.target.value)} dir="ltr" />
            <Select label="درجة الاهتمام" value={filters.seriousness_level || ''} onChange={e => setF('seriousness_level', e.target.value)}
              options={['1', '2', '3', '4'].map(v => ({ value: v, label: `${v}/4` }))} />
            <Select label="نوع العقار" value={filters.property_type_id || ''} onChange={e => setF('property_type_id', e.target.value)}
              options={byType.map(t => ({ value: String(t.id), label: t.label }))} />
            <Select label="الاتجاه" value={filters.direction || ''} onChange={e => setF('direction', e.target.value)}
              options={DIRECTIONS.map(v => ({ value: v, label: v }))} />
            <Select label="السعر" value={filters.price_category || ''} onChange={e => setF('price_category', e.target.value)}
              options={byBudget.map(b => ({ value: b.label, label: b.label }))} />
            <Select label="حالة الطلب" value={filters.request_status || ''} onChange={e => setF('request_status', e.target.value)}
              options={byStatus.map(s => ({ value: s.label, label: s.label }))} />
          </div>
        </FilterPanel>

        {/* Tabs */}
        <div className="flex bg-gray-800 rounded-lg p-1 w-full sm:w-fit overflow-x-auto">
          {[['leads','قائمة المهتمين'],['visits','الزيارات المجدولة'],['operation','لوحة الأوبريشن']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 sm:flex-none whitespace-nowrap px-3 sm:px-5 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all ${tab === key ? 'bg-gray-700 text-gray-100' : 'text-gray-400 hover:text-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Leads Table */}
        {tab === 'leads' && (
          <Card title="قائمة المهتمين">
            {isLoading ? <Loading /> : (
              <Table headers={['الكود','اسم العميل','الهاتف','نوع العقار','الميزانية','التصنيف','مرحلة الأوبريشن/الأخصائي','حالة الطلب','إجراءات']}>
                {data?.data?.data?.map(lead => (
                  <Tr key={lead.id} onClick={() => setShowDetail(lead.id)}>
                    <Td><span className="text-blue-400 font-mono text-xs">{lead.lead_code}</span></Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={lead.name} size="sm" />
                        <p className="font-semibold text-gray-100 text-xs">{lead.name || <span className="text-gray-500 font-normal">بدون اسم</span>}</p>
                      </div>
                    </Td>
                    <Td className="text-gray-400"><PhoneText value={lead.phone} /></Td>
                    <Td>{lead.property_type?.name || '—'}</Td>
                    <Td className="font-semibold text-blue-400">
                      {lead.budget ? `${Number(lead.budget).toLocaleString('en-US')} ريال` : '—'}
                    </Td>
                    <Td><Badge label={lead.classification} color={CLASS_COLOR[lead.classification]}/></Td>
                    <Td>
                      {lead.broker_employee_id ? (
                        <Badge label={lead.specialist_stage || 'تواصل'} color={STAGE_COLOR[lead.specialist_stage] || 'gray'} />
                      ) : lead.operation_status ? (
                        <Badge label={lead.operation_status} color={OP_STATUS_COLOR[lead.operation_status] || 'gray'} />
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </Td>
                    <Td><Badge label={lead.request_status} color={STATUS_COLOR[lead.request_status]}/></Td>
                    <Td>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Btn size="sm" variant="ghost" onClick={() => { setEditing(lead); setShowForm(true); }}>
                          <Pencil size={13}/>
                        </Btn>
                        <Btn size="sm" variant="ghost" className="hover:text-red-400"
                          onClick={() => confirm('حذف المهتم؟') && deleteMut.mutate(lead.id)}>
                          <Trash2 size={13}/>
                        </Btn>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Table>
            )}
            {!isLoading && data?.data?.data?.length === 0 && (
              <p className="text-center text-sm text-gray-500 py-10">لا يوجد مهتمين مطابقين</p>
            )}
            {(data?.data?.last_page || 1) > 1 && (
              <div className="flex items-center justify-center gap-3 text-sm p-3 border-t border-gray-700">
                <Btn size="sm" variant="outline" disabled={(data.data.current_page || 1) <= 1}
                  onClick={() => setFilters(f => ({ ...f, page: (data.data.current_page || 1) - 1 }))}>السابق</Btn>
                <span className="text-gray-400">صفحة {data.data.current_page} من {data.data.last_page} · {data.data.total} مهتم</span>
                <Btn size="sm" variant="outline" disabled={data.data.current_page >= data.data.last_page}
                  onClick={() => setFilters(f => ({ ...f, page: data.data.current_page + 1 }))}>التالي</Btn>
              </div>
            )}
          </Card>
        )}

        {/* Visits Table */}
        {tab === 'visits' && (
          <Card title="الزيارات المجدولة">
            <Table headers={['الرقم','اسم العميل','العقار','التاريخ','الوقت','الموظف المسؤول','الحالة']}>
              {visitsData?.data?.data?.map(v => (
                <Tr key={v.id}>
                  <Td><span className="font-mono text-xs text-blue-400">{v.visit_code}</span></Td>
                  <Td className="font-semibold">{v.lead?.name}</Td>
                  <Td className="text-gray-400">{v.property?.name || v.location}</Td>
                  <Td>{formatDate(v.visit_date)}</Td>
                  <Td>{v.visit_time?.slice(0,5)}</Td>
                  <Td>{v.assigned_employee?.full_name || '—'}</Td>
                  <Td><Badge label={v.status} color={v.status === 'مؤكدة' ? 'green' : 'blue'}/></Td>
                </Tr>
              ))}
            </Table>
          </Card>
        )}

        {/* Operation Dashboard */}
        {tab === 'operation' && <OperationDashboard />}
      </div>

      <LeadForm open={showForm} onClose={() => setShowForm(false)} editing={editing} />
      {showDetail && <LeadDetail id={showDetail} onClose={() => setShowDetail(null)} />}

    </div>
  );
}

const LEAD_DEFAULTS = {
  name: '', phone: '', applicant_type: 'مهتم', source: 'مباشر',
  classification: 'استفسار', seriousness_level: '1',
  purchase_goal: 'سكن', request_status: 'مفتوح',
  property_type_id: '', operation_employee_id: '', direction: '',
  properties: [],
};

// بطاقة عقار مختصرة: الكود - الحي - المنطقة - السعر - النوع
function PropertyChip({ p, onRemove }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-800 border border-gray-700">
      <Home size={16} className="text-blue-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-5 gap-x-3 gap-y-1 text-xs">
        <div><p className="text-gray-500">الكود</p><p className="font-mono font-bold text-gray-100" dir="ltr">{p.property_code}</p></div>
        <div><p className="text-gray-500">الحي</p><p className="text-gray-200">{p.neighborhood?.name || '—'}</p></div>
        <div><p className="text-gray-500">المنطقة</p><p className="text-gray-200">{p.city?.name || '—'}</p></div>
        <div><p className="text-gray-500">السعر</p><p className="text-blue-300 font-semibold">{p.listed_price ? `${formatMoney(p.listed_price)} ريال` : '—'}</p></div>
        <div><p className="text-gray-500">النوع</p><p className="text-gray-200">{p.property_type?.name || '—'}</p></div>
      </div>
      {onRemove && (
        <button type="button" onClick={onRemove} title="إزالة" className="text-gray-500 hover:text-red-400 shrink-0">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

// العقارات اللي المهتم مهتم فيها — بيكتب الكود وبتنجاب بيانات العقار تلقائياً
function InterestedProperties({ value = [], onChange }) {
  const [code, setCode]       = useState('');
  const [looking, setLooking] = useState(false);

  const add = async () => {
    const c = code.trim();
    if (!c) return;
    setLooking(true);
    try {
      const p = (await leadsApi.propertyLookup(c)).data.data;
      if (value.some(x => x.id === p.id)) toast.error('العقار مضاف من قبل');
      else { onChange([...value, p]); setCode(''); }
    } catch (err) {
      if (!err.response?.data?.message) toast.error('ما في عقار بهاد الكود');   // غير هيك الرسالة بتطلع من client.js
    } finally { setLooking(false); }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input dir="ltr" label="كود العقار المهتم فيه" value={code} placeholder="RE-2026-001"
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        </div>
        <Btn variant="outline" onClick={add} loading={looking}><Plus size={14} /> إضافة</Btn>
      </div>
      {value.map(p => (
        <PropertyChip key={p.id} p={p} onRemove={() => onChange(value.filter(x => x.id !== p.id))} />
      ))}
    </div>
  );
}

function LeadForm({ open, onClose, editing }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(LEAD_DEFAULTS);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: typesData } = useQuery({
    queryKey: ['property-types'],
    queryFn:  () => lookupApi.propertyTypes().then(r => r.data),
    enabled:  open,
  });
  const propertyTypes = typesData?.data || [];

  const { data: assignData } = useQuery({
    queryKey: ['operation-assignments'],
    queryFn:  () => operationAssignmentsApi.list().then(r => r.data),
    enabled:  open,
  });
  const assignments = assignData?.data || [];

  const { data: employeesData } = useQuery({
    queryKey: ['employees-all'],
    queryFn:  () => employeesApi.list({ per_page: 200, status: 'نشط' }).then(r => r.data),
    enabled:  open,
  });
  const allEmployees = employeesData?.data?.data || [];

  // موظفو الأوبريشن المسؤولون عن نوع العقار المختار (حسب تخصيص الإعدادات)
  const operationEmployeesForType = form.property_type_id
    ? [...new Map(
        assignments
          .filter(a => String(a.property_type_id) === String(form.property_type_id))
          .map(a => [a.employee_id, a.employee])
      ).values()]
    : [];
  const operationEmployeeOptions = (operationEmployeesForType.length > 0 ? operationEmployeesForType : allEmployees)
    .map(e => ({ value: String(e.id), label: e.full_name }));

  const handlePropertyTypeChange = (value) => {
    const matches = assignments.filter(a => String(a.property_type_id) === value);
    const uniqueEmployeeIds = [...new Set(matches.map(a => String(a.employee_id)))];
    setForm(f => ({
      ...f,
      property_type_id: value,
      operation_employee_id: uniqueEmployeeIds.length === 1 ? uniqueEmployeeIds[0] : f.operation_employee_id,
    }));
  };

  useEffect(() => {
    if (open) {
      setForm(editing ? {
        ...LEAD_DEFAULTS,
        ...editing,
        property_type_id:      editing.property_type_id      != null ? String(editing.property_type_id)      : '',
        operation_employee_id: editing.operation_employee_id != null ? String(editing.operation_employee_id) : '',
        follow_up_date: toDateInput(editing.follow_up_date),
        properties: editing.properties || [],
      } : LEAD_DEFAULTS);
    }
  }, [open, editing]);

  const handleSave = async () => {
    if (!form.phone?.trim()) { toast.error('رقم التواصل مطلوب'); return; }
    setLoading(true);
    const { properties, ...rest } = form;
    const payload = { ...rest, property_ids: properties.map(p => p.id) };
    try {
      if (editing) await leadsApi.update(editing.id, payload);
      else         await leadsApi.create(payload);
      toast.success(editing ? 'تم التحديث' : 'تم إضافة المهتم');
      qc.invalidateQueries(['leads']);
      onClose();
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(e => toast.error(e));
    } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose}
      title={editing ? 'تعديل المهتم' : 'إضافة مهتم جديد'}
      width="max-w-2xl"
      footer={
        <>
          <Btn onClick={handleSave} loading={loading}>💾 حفظ</Btn>
          <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
        </>
      }>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input  label="الاسم الكامل"  value={form.name}  onChange={e => set('name', e.target.value)} />
        <Input dir="ltr"  label="رقم التواصل *"   value={form.phone} onChange={e => set('phone', e.target.value)} />
        <div className="sm:col-span-2">
          <InterestedProperties value={form.properties} onChange={v => set('properties', v)} />
        </div>
        <Select label="صفة المتقدم"     value={form.applicant_type}    onChange={e => set('applicant_type', e.target.value)}
          options={['مهتم','مشتري','مستأجر','وسيط','وكيل','مطور'].map(v => ({ value: v, label: v }))} />
        <Select label="مصدر الطلب"      value={form.source}            onChange={e => set('source', e.target.value)}
          options={SOURCES.map(v => ({ value: v, label: v }))} />
        <Select label="نوع العقار"       value={form.property_type_id} onChange={e => handlePropertyTypeChange(e.target.value)}
          options={propertyTypes.map(t => ({ value: String(t.id), label: t.name }))} />
        <Select label="الاتجاه"          value={form.direction || ''} onChange={e => set('direction', e.target.value)}
          options={DIRECTIONS.map(v => ({ value: v, label: v }))} />
        <Select label="موظف الأوبريشن"  value={form.operation_employee_id} onChange={e => set('operation_employee_id', e.target.value)}
          options={operationEmployeeOptions} />
        <MoneyInput  label="الميزانية (ريال)" value={form.budget || ''}     onChange={e => set('budget', e.target.value)} />
        <Select label="فئة السعر"        value={form.price_category || ''} onChange={e => set('price_category', e.target.value)}
          options={['أقل من 4M','بين 4-10M','أعلى من 10M'].map(v => ({ value: v, label: v }))} />
        <Select label="التصنيف"          value={form.classification}   onChange={e => set('classification', e.target.value)}
          options={['جاد','استفسار','بحث'].map(v => ({ value: v, label: v }))} />
        <Select label="نسبة الجدية"      value={form.seriousness_level} onChange={e => set('seriousness_level', e.target.value)}
          options={['1','2','3','4'].map(v => ({ value: v, label: `${v}/4` }))} />
        <Select label="هدف الشراء"       value={form.purchase_goal || ''} onChange={e => set('purchase_goal', e.target.value)}
          options={['استثمار','سكن','سكن واستثمار'].map(v => ({ value: v, label: v }))} />
        <Input  label="تاريخ المتابعة"   value={form.follow_up_date || ''} onChange={e => set('follow_up_date', e.target.value)} type="date" />
        <div className="sm:col-span-2">
          <Textarea label="ملاحظات" value={form.update_notes || ''} onChange={e => set('update_notes', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function LeadDetail({ id, onClose }) {
  const qc = useQueryClient();
  const [showVisitForm, setShowVisitForm]   = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [visitForm, setVisitForm]         = useState({ location: '', visit_date: '', visit_time: '', notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.show(id).then(r => r.data.data),
  });

  const invalidate = () => { qc.invalidateQueries(['lead', id]); qc.invalidateQueries(['leads']); };

  const visitMut = useMutation({
    mutationFn: (data) => visitsApi.create({ ...data, lead_id: id }),
    onSuccess: () => {
      toast.success('تم حجز الزيارة');
      qc.invalidateQueries(['visits']);
      setShowVisitForm(false);
    },
  });

  const opStatusMut = useMutation({
    mutationFn: (operation_status) => leadsApi.updateOperationStatus(id, { operation_status }),
    onSuccess: () => { toast.success('تم تحديث حالة الأوبريشن'); invalidate(); },
  });

  const stageMut = useMutation({
    mutationFn: (payload) => leadsApi.updateSpecialistStage(id, payload),
    onSuccess: () => { toast.success('تم تحديث مرحلة الأخصائي'); invalidate(); },
    onError:   (err) => {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(e => toast.error(e));
    },
  });

  if (isLoading) return <Modal open onClose={onClose} title="تفاصيل المهتم"><Loading /></Modal>;
  const l = data;

  return (
    <Modal open onClose={onClose} title="تفاصيل المهتم" width="max-w-xl"
      footer={
        <>
          <Btn onClick={() => setShowVisitForm(true)}><Calendar size={14}/> حجز زيارة</Btn>
          {!l.broker_employee_id && (
            <Btn variant="outline" onClick={() => setShowAssignForm(true)}><UserCheck size={14}/> تحويل لأخصائي</Btn>
          )}
          <Btn variant="outline" onClick={onClose}>إغلاق</Btn>
        </>
      }>
      <div className="flex items-center gap-4 mb-5 pb-4 border-b border-gray-800">
        <Avatar name={l.name} size="lg" />
        <div>
          <p className="text-lg font-bold text-gray-100">{l.name || <span className="text-gray-500 font-normal">بدون اسم</span>}</p>
          <p className="text-xs text-gray-500 font-mono">{l.lead_code} · <PhoneText value={l.phone} /></p>
          <div className="flex gap-2 mt-1">
            <Badge label={l.classification} color={CLASS_COLOR[l.classification]}/>
            <Badge label={l.request_status} color={STATUS_COLOR[l.request_status]}/>
          </div>
        </div>
      </div>
      <InfoRow label="صفة المتقدم"     value={l.applicant_type} />
      <InfoRow label="المصدر"          value={l.source} />
      <InfoRow label="الميزانية"       value={l.budget ? `${Number(l.budget).toLocaleString('en-US')} ريال` : '—'} valueClass="text-blue-400" />
      <InfoRow label="هدف الشراء"     value={l.purchase_goal} />
      <InfoRow label="موظف الأوبريشن" value={l.operation_employee?.full_name} />
      <InfoRow label="آخر تحديث"      value={l.update_status} />
      <InfoRow label="ملاحظات"        value={l.update_notes} />

      {l.properties?.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-gray-400">العقارات المهتم فيها ({l.properties.length})</p>
          {l.properties.map(p => <PropertyChip key={p.id} p={p} />)}
        </div>
      )}

      {/* رحلة المهتم: الأوبريشن ← الأخصائي */}
      <div className="mt-4 p-4 bg-gray-800 rounded-xl">
        {!l.broker_employee_id ? (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">حالة الأوبريشن</p>
            <div className="flex flex-wrap gap-2">
              {OPERATION_STATUSES.map(status => (
                <button key={status} onClick={() => opStatusMut.mutate(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                    ${l.operation_status === status
                      ? 'bg-blue-500/15 border-blue-500 text-blue-300'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                  {status}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase">مرحلة الأخصائي</p>
              <span className="text-xs text-gray-500">الأخصائي: {l.broker_employee?.full_name || '—'}</span>
            </div>
            <SpecialistStepper
              current={l.specialist_stage || 'تواصل'}
              onSelect={(stage) => {
                if (stage === 'حجز') setShowAmountModal(true);
                else stageMut.mutate({ specialist_stage: stage });
              }}
            />
            {l.specialist_stage === 'حجز' && l.agreed_amount && (
              <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-300 font-semibold">
                المبلغ المتفق عليه: {Number(l.agreed_amount).toLocaleString('en-US')} ريال
              </div>
            )}
          </>
        )}
      </div>

      {l.visits?.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">الزيارات السابقة</p>
          {l.visits.map(v => (
            <div key={v.id} className="flex items-center justify-between p-2.5 bg-gray-800 rounded-lg mb-2 text-xs">
              <span className="text-gray-300">{formatDate(v.visit_date)} — {v.visit_time?.slice(0,5)}</span>
              <Badge label={v.status} color={v.status === 'مؤكدة' ? 'green' : 'blue'} />
            </div>
          ))}
        </div>
      )}

      {showVisitForm && (
        <div className="mt-4 p-4 bg-gray-800 rounded-xl space-y-3">
          <p className="text-sm font-bold text-gray-200">حجز زيارة جديدة</p>
          <Input label="العقار / الموقع *" value={visitForm.location}    onChange={e => setVisitForm(f => ({ ...f, location: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="التاريخ *" value={visitForm.visit_date} onChange={e => setVisitForm(f => ({ ...f, visit_date: e.target.value }))} type="date" />
            <Input label="الوقت *"   value={visitForm.visit_time} onChange={e => setVisitForm(f => ({ ...f, visit_time: e.target.value }))} type="time" />
          </div>
          <Textarea label="ملاحظات" value={visitForm.notes} onChange={e => setVisitForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          <div className="flex gap-2">
            <Btn size="sm" onClick={() => visitMut.mutate(visitForm)} loading={visitMut.isPending}>📅 حجز الزيارة</Btn>
            <Btn size="sm" variant="outline" onClick={() => setShowVisitForm(false)}>إلغاء</Btn>
          </div>
        </div>
      )}

      {showAssignForm && (
        <AssignSpecialistModal
          leadId={id}
          onClose={() => setShowAssignForm(false)}
          onAssigned={() => { invalidate(); setShowAssignForm(false); }}
        />
      )}

      {showAmountModal && (
        <AgreedAmountModal
          defaultValue={l.agreed_amount}
          loading={stageMut.isPending}
          onClose={() => setShowAmountModal(false)}
          onConfirm={(amount) => stageMut.mutate(
            { specialist_stage: 'حجز', agreed_amount: amount },
            { onSuccess: () => setShowAmountModal(false) }
          )}
        />
      )}
    </Modal>
  );
}

function SpecialistStepper({ current, onSelect }) {
  const currentIndex = SPECIALIST_STAGES.indexOf(current);
  return (
    <div className="flex flex-wrap gap-2">
      {SPECIALIST_STAGES.map((stage, i) => (
        <button key={stage} onClick={() => onSelect(stage)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
            ${stage === current
              ? 'bg-blue-500/15 border-blue-500 text-blue-300'
              : i < currentIndex
                ? 'border-gray-700 text-gray-500 hover:border-gray-600'
                : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
          {stage}
        </button>
      ))}
    </div>
  );
}

function AssignSpecialistModal({ leadId, onClose, onAssigned }) {
  const [specialistId, setSpecialistId] = useState('');

  const { data: employeesData, isLoading } = useQuery({
    queryKey: ['employees-all'],
    queryFn:  () => employeesApi.list({ per_page: 200, status: 'نشط' }).then(r => r.data),
  });
  const employees = employeesData?.data?.data || [];

  const mut = useMutation({
    mutationFn: () => leadsApi.assignSpecialist(leadId, { broker_employee_id: specialistId }),
    onSuccess: () => { toast.success('تم تحويل المهتم للأخصائي'); onAssigned(); },
    onError:   (err) => {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(e => toast.error(e));
    },
  });

  return (
    <Modal open onClose={onClose} title="تحويل المهتم لأخصائي"
      footer={
        <>
          <Btn onClick={() => { if (!specialistId) { toast.error('اختر الأخصائي'); return; } mut.mutate(); }} loading={mut.isPending}>
            <UserCheck size={14}/> تحويل
          </Btn>
          <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
        </>
      }>
      {isLoading ? <Loading /> : (
        <Select label="اختر الأخصائي *" value={specialistId} onChange={e => setSpecialistId(e.target.value)}
          options={employees.map(e => ({ value: String(e.id), label: e.full_name }))} />
      )}
    </Modal>
  );
}

function AgreedAmountModal({ defaultValue, onClose, onConfirm, loading }) {
  const [amount, setAmount] = useState(defaultValue || '');

  return (
    <Modal open onClose={onClose} title="المبلغ المتفق عليه"
      footer={
        <>
          <Btn onClick={() => {
            if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { toast.error('أدخل مبلغاً صحيحاً'); return; }
            onConfirm(Number(amount));
          }} loading={loading}>💾 تأكيد الحجز</Btn>
          <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
        </>
      }>
      <p className="text-xs text-gray-500 mb-3">سيتم إرسال إشعار للمالية بمجرد التأكيد.</p>
      <MoneyInput label="المبلغ (ريال) *" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
    </Modal>
  );
}

function OperationDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['operation-dashboard'],
    queryFn:  () => leadsApi.operationDashboard().then(r => r.data),
  });
  const items = data?.data || [];

  if (isLoading) return <Card title="لوحة الأوبريشن"><Loading /></Card>;

  return (
    <Card title="لوحة الأوبريشن — العدد النشط لكل موظف">
      {items.length === 0 ? (
        <p className="text-center py-10 text-gray-500 text-sm">لا توجد بيانات بعد</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(emp => (
            <div key={emp.employee_id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Avatar name={emp.full_name} size="sm" />
                <p className="font-semibold text-gray-100 text-sm">{emp.full_name}</p>
              </div>
              {emp.property_types?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {emp.property_types.map(pt => <Badge key={pt} label={pt} color="gray" />)}
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-gray-400"><Users size={14}/> مهتمون نشطون</span>
                <span className="font-bold text-blue-400">{emp.active_leads_count}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1.5">
                <span className="flex items-center gap-1.5 text-gray-400"><Home size={14}/> ملاك نشطون</span>
                <span className="font-bold text-green-400">{emp.active_owners_count}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}