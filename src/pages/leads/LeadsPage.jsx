import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { leadsApi, visitsApi } from '../../api/services';
import { PageHeader } from '../../components/layout/Layout';
import {
  Btn, Badge, StatCard, Table, Tr, Td, Modal, Input, Select,
  Textarea, SearchBox, Avatar, Card, Loading, InfoRow,
} from '../../components/ui';
import { Plus, Pencil, Trash2, Calendar, Users, MessageSquare, TrendingUp } from 'lucide-react';

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

export default function LeadsPage() {
  const qc = useQueryClient();
  const [tab, setTab]               = useState('leads');
  const [search, setSearch]         = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [editing, setEditing]       = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['leads', search],
    queryFn: () => leadsApi.list({ search }).then(r => r.data),
    staleTime: 30_000,
  });

  const { data: visitsData } = useQuery({
    queryKey: ['visits'],
    queryFn: () => visitsApi.list().then(r => r.data),
    enabled: tab === 'visits',
  });

  const deleteMut = useMutation({
    mutationFn: leadsApi.delete,
    onSuccess: () => { toast.success('تم حذف المهتم'); qc.invalidateQueries(['leads']); },
  });

  const stats = data?.stats || {};

  return (
    <div>
      <PageHeader
        title="إدارة المهتمين"
        subtitle="إدارة قاعدة بيانات العملاء المهتمين"
        actions={
          <>
            <SearchBox value={search} onChange={setSearch} placeholder="بحث بالاسم أو الكود..." />
            <Btn onClick={() => { setEditing(null); setShowForm(true); }}>
              <Plus size={16}/> إضافة مهتم جديد
            </Btn>
          </>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="إجمالي المهتمين" value={stats.total}        icon={<Users size={18}/>}         color="blue" />
          <StatCard label="عملاء جادون"      value={stats.serious}      icon={<TrendingUp size={18}/>}    color="green" />
          <StatCard label="زيارات اليوم"     value={stats.today_visits} icon={<Calendar size={18}/>}      color="amber" />
          <StatCard label="استفسارات"        value={stats.inquiries}    icon={<MessageSquare size={18}/>} color="purple" />
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-800 rounded-lg p-1 w-fit">
          {[['leads','قائمة المهتمين'],['visits','الزيارات المجدولة']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${tab === key ? 'bg-gray-700 text-gray-100' : 'text-gray-400 hover:text-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Leads Table */}
        {tab === 'leads' && (
          <Card title="قائمة المهتمين">
            {isLoading ? <Loading /> : (
              <Table headers={['الكود','اسم العميل','الهاتف','نوع العقار','الميزانية','التصنيف','المتابعة','حالة الطلب','إجراءات']}>
                {data?.data?.data?.map(lead => (
                  <Tr key={lead.id} onClick={() => setShowDetail(lead.id)}>
                    <Td><span className="text-blue-400 font-mono text-xs">{lead.lead_code}</span></Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={lead.name} size="sm" />
                        <p className="font-semibold text-gray-100 text-xs">{lead.name}</p>
                      </div>
                    </Td>
                    <Td className="text-gray-400">{lead.phone}</Td>
                    <Td>{lead.property_type?.name || '—'}</Td>
                    <Td className="font-semibold text-blue-400">
                      {lead.budget ? `${Number(lead.budget).toLocaleString('ar-SA-u-nu-latn')} ريال` : '—'}
                    </Td>
                    <Td><Badge label={lead.classification} color={CLASS_COLOR[lead.classification]}/></Td>
                    <Td>
                      {lead.follow_up_date && (
                        <Badge label={lead.follow_up_status_computed || '—'} color={FOLLOW_COLOR[lead.follow_up_status_computed] || 'gray'} />
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
};

function LeadForm({ open, onClose, editing }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(LEAD_DEFAULTS);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) {
      setForm(editing ? {
        ...LEAD_DEFAULTS,
        ...editing,
        follow_up_date: toDateInput(editing.follow_up_date),
      } : LEAD_DEFAULTS);
    }
  }, [open, editing]);

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error('الاسم الكامل مطلوب'); return; }
    if (!form.phone?.trim()) { toast.error('رقم التواصل مطلوب'); return; }
    setLoading(true);
    try {
      if (editing) await leadsApi.update(editing.id, form);
      else         await leadsApi.create(form);
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
      <div className="grid grid-cols-2 gap-4">
        <Input  label="الاسم الكامل *"  value={form.name}  onChange={e => set('name', e.target.value)} />
        <Input  label="رقم التواصل *"   value={form.phone} onChange={e => set('phone', e.target.value)} />
        <Select label="صفة المتقدم"     value={form.applicant_type}    onChange={e => set('applicant_type', e.target.value)}
          options={['مهتم','مشتري','مستأجر','وسيط','وكيل','مطور'].map(v => ({ value: v, label: v }))} />
        <Select label="مصدر الطلب"      value={form.source}            onChange={e => set('source', e.target.value)}
          options={SOURCES.map(v => ({ value: v, label: v }))} />
        <Input  label="الميزانية (ريال)" value={form.budget || ''}     onChange={e => set('budget', e.target.value)} type="number" />
        <Select label="فئة السعر"        value={form.price_category || ''} onChange={e => set('price_category', e.target.value)}
          options={['أقل من 4M','بين 4-10M','أعلى من 10M'].map(v => ({ value: v, label: v }))} />
        <Select label="التصنيف"          value={form.classification}   onChange={e => set('classification', e.target.value)}
          options={['جاد','استفسار','بحث'].map(v => ({ value: v, label: v }))} />
        <Select label="نسبة الجدية"      value={form.seriousness_level} onChange={e => set('seriousness_level', e.target.value)}
          options={['1','2','3','4'].map(v => ({ value: v, label: `${v}/4` }))} />
        <Select label="هدف الشراء"       value={form.purchase_goal || ''} onChange={e => set('purchase_goal', e.target.value)}
          options={['استثمار','سكن','سكن واستثمار'].map(v => ({ value: v, label: v }))} />
        <Input  label="تاريخ المتابعة"   value={form.follow_up_date || ''} onChange={e => set('follow_up_date', e.target.value)} type="date" />
        <div className="col-span-2">
          <Textarea label="ملاحظات" value={form.update_notes || ''} onChange={e => set('update_notes', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function LeadDetail({ id, onClose }) {
  const qc = useQueryClient();
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [visitForm, setVisitForm]         = useState({ location: '', visit_date: '', visit_time: '', notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.show(id).then(r => r.data.data),
  });

  const visitMut = useMutation({
    mutationFn: (data) => visitsApi.create({ ...data, lead_id: id }),
    onSuccess: () => {
      toast.success('تم حجز الزيارة');
      qc.invalidateQueries(['visits']);
      setShowVisitForm(false);
    },
  });

  if (isLoading) return <Modal open onClose={onClose} title="تفاصيل المهتم"><Loading /></Modal>;
  const l = data;

  return (
    <Modal open onClose={onClose} title="تفاصيل المهتم" width="max-w-xl"
      footer={
        <>
          <Btn onClick={() => setShowVisitForm(true)}><Calendar size={14}/> حجز زيارة</Btn>
          <Btn variant="outline" onClick={onClose}>إغلاق</Btn>
        </>
      }>
      <div className="flex items-center gap-4 mb-5 pb-4 border-b border-gray-800">
        <Avatar name={l.name} size="lg" />
        <div>
          <p className="text-lg font-bold text-gray-100">{l.name}</p>
          <p className="text-xs text-gray-500 font-mono">{l.lead_code} · {l.phone}</p>
          <div className="flex gap-2 mt-1">
            <Badge label={l.classification} color={CLASS_COLOR[l.classification]}/>
            <Badge label={l.request_status} color={STATUS_COLOR[l.request_status]}/>
          </div>
        </div>
      </div>
      <InfoRow label="صفة المتقدم"     value={l.applicant_type} />
      <InfoRow label="المصدر"          value={l.source} />
      <InfoRow label="الميزانية"       value={l.budget ? `${Number(l.budget).toLocaleString('ar-SA-u-nu-latn')} ريال` : '—'} valueClass="text-blue-400" />
      <InfoRow label="هدف الشراء"     value={l.purchase_goal} />
      <InfoRow label="الموظف المسؤول" value={l.operation_employee?.full_name} />
      <InfoRow label="آخر تحديث"      value={l.update_status} />
      <InfoRow label="ملاحظات"        value={l.update_notes} />

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
    </Modal>
  );
}