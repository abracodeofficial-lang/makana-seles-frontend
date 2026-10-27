import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { ownersApi, operationAssignmentsApi } from '../../api/services';
import { PageHeader } from '../../components/layout/Layout';
import {
  Btn, Badge, StatCard, Table, Tr, Td, Modal, Input, Select,
  Textarea, SearchBox, Avatar, Card, Loading, ErrorMsg, InfoRow, CountBox, FilterPanel, BoxSection,
} from '../../components/ui';
import { Plus, Pencil, Trash2, Building2, Users, Star, MessageCircle, X, Download, CheckCircle, ShieldCheck, Compass, Banknote } from 'lucide-react';

const toDateInput = (d) => d ? String(d).slice(0, 10) : '';
const waPhone = (p = '') => { const d = p.replace(/\D/g,''); return d.startsWith('966') ? d : d.startsWith('0') ? '966'+d.slice(1) : '966'+d; };
const todayISO = () => new Date().toISOString().slice(0, 10);
const DIRECTIONS = ['شمالية','جنوبية','شرقية','غربية','شمالية شرقية','شمالية غربية','جنوبية شرقية','جنوبية غربية'];

const STATUS_COLOR = { تم: 'green', لا: 'gray', جاري: 'amber', ملغي: 'red' };
const TYPE_COLOR   = { مالك: 'blue', وكيل: 'teal', وسيط: 'purple', مكتب: 'amber', مطور: 'green', مشروع: 'blue' };

export default function OwnersPage() {
  const qc = useQueryClient();
  const [search, setSearch]         = useState('');
  const [filters, setFilters]       = useState({});
  const [showForm, setShowForm]     = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [showProps, setShowProps]   = useState(null);
  const [editing, setEditing]       = useState(null);
  const [exporting, setExporting]   = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['owners', search, filters],
    queryFn: () => ownersApi.list({ search, ...filters }).then(r => r.data),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  // موظفو الأوبريشن فقط = المخصصين لأنواع العقارات من الإعدادات
  const { data: assignments = [] } = useQuery({
    queryKey: ['operation-assignments'],
    queryFn: () => operationAssignmentsApi.list().then(r => r.data?.data || r.data || []),
    staleTime: 300_000,
  });
  const operationEmployees = useMemo(() => {
    const map = new Map();
    assignments.forEach(a => a.employee && map.set(a.employee.id, a.employee.full_name));
    return [...map].map(([id, name]) => ({ value: String(id), label: name }));
  }, [assignments]);

  // أي تغيير بالفلاتر بيرجّع لأول صفحة
  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v || undefined, page: undefined }));
  const toggleF = (k, v) => setFilters(f => ({ ...f, [k]: String(f[k]) === String(v) ? undefined : v, page: undefined }));
  const hasDate    = !!(filters.date_from || filters.date_to);
  const FILTER_KEYS = ['sales_employee_owners_id', 'exclusive_status', 'property_type_id', 'direction', 'price_range', 'type'];
  const activeFilters = FILTER_KEYS.filter(k => filters[k]).length;
  const hasFilters = activeFilters > 0;
  const clearFilters = () => setFilters(f => ({ date_from: f.date_from, date_to: f.date_to }));

  const deleteMut = useMutation({
    mutationFn: ownersApi.delete,
    onSuccess: () => { toast.success('تم حذف المالك'); qc.invalidateQueries(['owners']); },
  });

  const stats          = data?.stats            || {};
  const byOwnerType    = data?.by_owner_type    || [];
  const byPropertyType = data?.by_property_type || [];
  const byDirection    = data?.by_direction     || [];
  const byPrice        = data?.by_price         || [];

  // التصدير بياخد نفس الفترة والفلاتر المطبّقة على الصفحة
  const handleExport = async () => {
    setExporting(true);
    try {
      const res     = await ownersApi.export({ search, ...filters });
      const records = res.data?.data || [];

      if (!records.length) {
        toast.error('لا توجد بيانات ضمن الفترة المحددة');
        return;
      }

      const rows = records.map(o => ({
        'الكود':            o.owner_code,
        'الاسم':            o.name,
        'الصفة':            o.type,
        'الهاتف':           o.phone,
        'المدينة':          o.city?.name || '—',
        'عدد العقارات':     o.properties_count,
        'حالة الحصري':      o.exclusive_status,
        'المجموعة':         o.group || '—',
        'موظف الأوبريشن':   o.sales_employee_owners?.full_name || '—',
        'تاريخ الإضافة':    o.created_at?.slice(0, 10),
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الملاك');
      const period = hasDate ? `${filters.date_from || 'start'}-${filters.date_to || todayISO()}` : 'all';
      XLSX.writeFile(wb, `owners-${period}.xlsx`);
      toast.success(`تم تصدير ${records.length} مالك`);
    } catch { toast.error('فشل التصدير'); }
    finally { setExporting(false); }
  };

  if (isLoading && !data) return <Loading />;
  if (error)     return <ErrorMsg />;

  return (
    <div>
      <PageHeader
        title="إدارة الملاك"
        subtitle="عرض وإدارة جميع الملاك والوكلاء"
        actions={
          <>
            <SearchBox value={search} onChange={v => { setSearch(v); setFilters(f => ({ ...f, page: undefined })); }} placeholder="بحث بالاسم أو الكود..." />
            <Btn onClick={() => { setEditing(null); setShowForm(true); }}>
              <Plus size={16} /> إضافة مالك جديد
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
              {hasDate ? 'الأرقام والقائمة والتصدير حسب الملاك المضافين بالفترة المحددة' : 'بدون فترة = كل الملاك'}
            </p>
          </div>
        </div>

        {/* ② العدادات */}
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <StatCard label="العقارات المضافة"        value={stats.properties_added}    icon={<Building2 size={18}/>}   color="blue" />
            <StatCard label="العقارات المقبولة"       value={stats.properties_accepted} icon={<CheckCircle size={18}/>} color="green" />
            <StatCard label="العقارات المضافة رسمياً" value={stats.properties_verified} icon={<ShieldCheck size={18}/>} color="purple" />
          </div>

          <BoxSection icon={<Building2 size={13}/>} title="أنواع العقارات" cols="lg:grid-cols-6">
            {byPropertyType.map(t => (
              <CountBox key={t.id} label={t.label} count={t.count}
                active={String(filters.property_type_id) === String(t.id)}
                onClick={() => toggleF('property_type_id', t.id)} />
            ))}
          </BoxSection>

          <BoxSection icon={<Compass size={13}/>} title="اتجاهات العقارات" cols="2xl:grid-cols-8">
            {byDirection.map(d => (
              <CountBox key={d.label} label={d.label} count={d.count}
                active={filters.direction === d.label}
                onClick={() => toggleF('direction', d.label)} />
            ))}
          </BoxSection>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BoxSection icon={<Banknote size={13}/>} title="أسعار العقارات" cols="sm:grid-cols-3" fixed>
              {byPrice.map(p => (
                <CountBox key={p.value} label={p.label} count={p.count}
                  active={filters.price_range === p.value}
                  onClick={() => toggleF('price_range', p.value)} />
              ))}
            </BoxSection>
            <BoxSection icon={<Users size={13}/>} title={`نوع المالك (${stats.total ?? 0})`} cols="sm:grid-cols-3" fixed>
              {byOwnerType.map(t => (
                <CountBox key={t.label} label={t.label} count={t.count}
                  active={filters.type === t.label}
                  onClick={() => toggleF('type', t.label)} />
              ))}
            </BoxSection>
          </div>
        </div>

        {/* ③ الفلاتر */}
        <FilterPanel activeCount={activeFilters} onClear={clearFilters}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Select label="موظف الأوبريشن" value={filters.sales_employee_owners_id || ''}
              onChange={e => setF('sales_employee_owners_id', e.target.value)} options={operationEmployees} />
            <Select label="الحالة (حصري)" value={filters.exclusive_status || ''} onChange={e => setF('exclusive_status', e.target.value)}
              options={['تم', 'لا', 'جاري', 'ملغي'].map(v => ({ value: v, label: v }))} />
            <Select label="نوع العقار" value={filters.property_type_id || ''} onChange={e => setF('property_type_id', e.target.value)}
              options={byPropertyType.map(t => ({ value: String(t.id), label: t.label }))} />
            <Select label="الاتجاه" value={filters.direction || ''} onChange={e => setF('direction', e.target.value)}
              options={DIRECTIONS.map(v => ({ value: v, label: v }))} />
            <Select label="سعر العقار" value={filters.price_range || ''} onChange={e => setF('price_range', e.target.value)}
              options={byPrice.map(p => ({ value: p.value, label: p.label }))} />
          </div>
        </FilterPanel>

        {/* Table */}
        <Card title="قائمة الملاك">
          <Table headers={['الكود','اسم المالك','الصفة','الهاتف','العقارات','حصري','المجموعة','إجراءات']}>
            {data?.data?.data?.map(owner => (
              <Tr key={owner.id} onClick={() => setShowDetail(owner.id)}>
                <Td><span className="text-blue-400 font-mono text-xs">{owner.owner_code}</span></Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Avatar name={owner.name} size="sm" />
                    <div>
                      <p className="font-semibold text-gray-100 text-xs">{owner.name || <span className="text-gray-500 font-normal">بدون اسم</span>}</p>
                      <p className="text-gray-500 text-xs">{owner.properties_count} عقار</p>
                    </div>
                  </div>
                </Td>
                <Td><Badge label={owner.type} color={TYPE_COLOR[owner.type] || 'gray'} /></Td>
                <Td className="text-gray-400">{owner.phone}</Td>
                <Td>
                  <button onClick={e => { e.stopPropagation(); setShowProps(owner.id); }}
                    className="text-blue-400 hover:text-blue-300 text-xs font-semibold flex items-center gap-1">
                    <Building2 size={13}/> {owner.properties_count}
                  </button>
                </Td>
                <Td><Badge label={owner.exclusive_status} color={STATUS_COLOR[owner.exclusive_status]}/></Td>
                <Td>{owner.group ? <Badge label={`المجموعة ${owner.group}`} color="purple"/> : '—'}</Td>
                <Td>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Btn size="sm" variant="ghost" onClick={() => { setEditing(owner); setShowForm(true); }}>
                      <Pencil size={13}/>
                    </Btn>
                    <Btn size="sm" variant="ghost" className="hover:text-red-400"
                      onClick={() => confirm('حذف المالك؟') && deleteMut.mutate(owner.id)}>
                      <Trash2 size={13}/>
                    </Btn>
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
          {data?.data?.data?.length === 0 && (
            <p className="text-center text-sm text-gray-500 py-10">لا يوجد ملاك مطابقين</p>
          )}
        </Card>

        {/* الصفحات */}
        {(data?.data?.last_page || 1) > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm">
            <Btn size="sm" variant="outline" disabled={(data.data.current_page || 1) <= 1}
              onClick={() => setFilters(f => ({ ...f, page: (data.data.current_page || 1) - 1 }))}>
              السابق
            </Btn>
            <span className="text-gray-400">صفحة {data.data.current_page} من {data.data.last_page} · {data.data.total} مالك</span>
            <Btn size="sm" variant="outline" disabled={data.data.current_page >= data.data.last_page}
              onClick={() => setFilters(f => ({ ...f, page: data.data.current_page + 1 }))}>
              التالي
            </Btn>
          </div>
        )}
      </div>

      <OwnerForm open={showForm} onClose={() => setShowForm(false)} editing={editing} />
      {showDetail && <OwnerDetail id={showDetail} onClose={() => setShowDetail(null)} />}
      {showProps  && <OwnerProperties id={showProps} onClose={() => setShowProps(null)} />}

    </div>
  );
}

const OWNER_DEFAULTS = {
  name: '', type: 'مالك', phone: '', whatsapp: '', email: '', address: '',
  exclusive_status: 'لا', brokerage_status: 'لا', group: '',
  photo_status: 'جديد', design_status: 'جديد',
  video_status: 'جديد', publishing_status: 'جديد', notes: '',
};

function OwnerForm({ open, onClose, editing }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(OWNER_DEFAULTS);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) {
      setForm(editing ? {
        ...OWNER_DEFAULTS,
        ...editing,
        price_update_date:  toDateInput(editing.price_update_date),
        agreement_end_date: toDateInput(editing.agreement_end_date),
      } : OWNER_DEFAULTS);
    }
  }, [open, editing]);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (editing) await ownersApi.update(editing.id, form);
      else         await ownersApi.create(form);
      toast.success(editing ? 'تم التحديث' : 'تم إضافة المالك');
      qc.invalidateQueries(['owners']);
      onClose();
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(e => toast.error(e));
    } finally { setLoading(false); }
  };

  const typeOpts   = ['مالك','وكيل','وسيط','مكتب','مطور','مشروع'].map(v => ({ value: v, label: v }));
  const statusOpts = ['تم','لا','جاري','ملغي'].map(v => ({ value: v, label: v }));
  const mediaOpts  = ['جديد','تم','جاري','معلق','ملغي'].map(v => ({ value: v, label: v }));
  const groupOpts  = ['A','B','C'].map(v => ({ value: v, label: `المجموعة ${v}` }));

  return (
    <Modal open={open} onClose={onClose}
      title={editing ? 'تعديل بيانات المالك' : 'إضافة مالك جديد'}
      width="max-w-2xl"
      footer={
        <>
          <Btn onClick={handleSave} loading={loading}>💾 {editing ? 'حفظ التعديلات' : 'إضافة المالك'}</Btn>
          <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
        </>
      }>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input  label="اسم المالك"        value={form.name}  onChange={e => set('name', e.target.value)} placeholder="الاسم الكامل" />
        <Select label="صفة المالك *"         value={form.type}  onChange={e => set('type', e.target.value)} options={typeOpts} />
        <Input  label="رقم الهاتف *"         value={form.phone}     onChange={e => set('phone',     e.target.value)} placeholder="05xxxxxxxx" />
        <Input  label="رقم الواتساب"         value={form.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} placeholder="05xxxxxxxx (إن اختلف)" />
        <Input  label="البريد الإلكتروني"    value={form.email || ''}    onChange={e => set('email',    e.target.value)} type="email" />
        <Select label="حالة الحصري"          value={form.exclusive_status}  onChange={e => set('exclusive_status', e.target.value)}  options={statusOpts} />
        <Select label="حالة الوساطة"         value={form.brokerage_status}  onChange={e => set('brokerage_status', e.target.value)}  options={statusOpts} />
        <Input  label="تاريخ تحديث السعر"    value={form.price_update_date || ''}    onChange={e => set('price_update_date', e.target.value)}    type="date" />
        <Input  label="تاريخ انتهاء الاتفاق" value={form.agreement_end_date || ''}   onChange={e => set('agreement_end_date', e.target.value)}   type="date" />
        <Select label="المجموعة"             value={form.group || ''}       onChange={e => set('group', e.target.value)}             options={groupOpts} />
        <div />
        <Select label="حالة التصوير"         value={form.photo_status}      onChange={e => set('photo_status', e.target.value)}      options={mediaOpts} />
        <Select label="حالة التصميم"         value={form.design_status}     onChange={e => set('design_status', e.target.value)}     options={mediaOpts} />
        <Select label="حالة الفيديو"         value={form.video_status}      onChange={e => set('video_status', e.target.value)}      options={mediaOpts} />
        <Select label="حالة النشر"           value={form.publishing_status} onChange={e => set('publishing_status', e.target.value)} options={mediaOpts} />
        <div className="sm:col-span-2">
          <Input label="العنوان" value={form.address || ''} onChange={e => set('address', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Textarea label="ملاحظات" value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function OwnerDetail({ id, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['owner', id],
    queryFn: () => ownersApi.show(id).then(r => r.data.data),
  });

  if (isLoading) return <Modal open onClose={onClose} title="تفاصيل المالك"><Loading /></Modal>;
  const o = data;

  return (
    <Modal open onClose={onClose} title="تفاصيل المالك" width="max-w-xl"
      footer={<Btn variant="outline" onClick={onClose}>إغلاق</Btn>}>
      <div className="flex items-center gap-4 mb-5 pb-4 border-b border-gray-800">
        <Avatar name={o.name} size="lg" />
        <div>
          <p className="text-lg font-bold text-gray-100">{o.name || <span className="text-gray-500 font-normal">بدون اسم</span>}</p>
          <p className="text-xs text-gray-500">{o.owner_code}</p>
          <Badge label={o.type} color={TYPE_COLOR[o.type] || 'gray'} />
        </div>
      </div>
      <InfoRow label="الهاتف"          value={o.phone} />
      {o.whatsapp && (
        <div className="flex items-center justify-between py-1.5 border-b border-gray-800 text-xs">
          <span className="text-gray-500">واتساب</span>
          <a
            href={`https://wa.me/${waPhone(o.whatsapp)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white font-bold px-2 py-1 rounded-lg transition-colors"
          >
            <MessageCircle size={11}/> {o.whatsapp}
          </a>
        </div>
      )}
      <InfoRow label="البريد"          value={o.email} />
      <InfoRow label="المدينة"         value={o.city?.name} />
      <InfoRow label="حالة الحصري"    value={o.exclusive_status} />
      <InfoRow label="حالة الوساطة"   value={o.brokerage_status} />
      <InfoRow label="المجموعة"        value={o.group ? `المجموعة ${o.group}` : null} />
      <InfoRow label="انتهاء الاتفاق" value={o.agreement_end_date} />
      <InfoRow label="ملاحظات"        value={o.notes} />
    </Modal>
  );
}

function OwnerProperties({ id, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['owner-props', id],
    queryFn: () => ownersApi.properties(id).then(r => r.data.data),
  });

  return (
    <Modal open onClose={onClose} title={`عقارات ${data?.owner?.name || '...'}`}
      footer={<Btn variant="outline" onClick={onClose}>إغلاق</Btn>}>
      {isLoading ? <Loading /> : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 mb-3">إجمالي العقارات: {data?.total}</p>
          {data?.properties?.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-xs font-bold text-white">{i + 1}</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-100">{p.name}</p>
                <p className="text-xs text-gray-500 font-mono">{p.property_code}</p>
              </div>
              <Badge label={p.status} color={p.status === 'متاح' ? 'green' : p.status === 'محجوز' ? 'amber' : 'red'} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}