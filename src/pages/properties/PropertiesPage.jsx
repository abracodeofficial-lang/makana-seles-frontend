import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { propertiesApi, ownersApi, lookupApi } from '../../api/services';
import { PageHeader } from '../../components/layout/Layout';
import {
  Btn, Badge, StatCard, Card, Modal, Input, Select,
  Textarea, SearchBox, Loading, ErrorMsg, InfoRow, Avatar,
  Table, Tr, Td,
} from '../../components/ui';
import { Plus, Pencil, Trash2, Building2, Eye, CheckCircle, Clock, XCircle, ChevronRight, ChevronLeft, MessageCircle, Phone, MapPin, Home } from 'lucide-react';

const STATUS_COLOR = { 'متاح': 'green', 'محجوز': 'amber', 'مباع': 'red', 'قيد المراجعة': 'purple' };
const MEDIA_COLOR  = { 'تم': 'green', 'جاري': 'amber', 'معلق': 'red', 'ملغي': 'gray', 'جديد': 'blue' };

const waPhone = (phone = '') => {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('966')) return d;
  if (d.startsWith('0'))   return '966' + d.slice(1);
  return '966' + d;
};

function MediaBar({ photo, design, video, marketing }) {
  const items = [
    { label: 'تصوير', value: photo },
    { label: 'تصميم', value: design },
    { label: 'فيديو',  value: video },
    { label: 'نشر',    value: marketing },
  ];
  return (
    <div className="flex gap-1 mt-2">
      {items.map(item => (
        <div key={item.label} className="flex-1">
          <div className={`h-1 rounded-full ${
            item.value === 'تم'    ? 'bg-green-500' :
            item.value === 'جاري' ? 'bg-amber-500' :
            item.value === 'معلق' ? 'bg-red-500'   :
            item.value === 'ملغي' ? 'bg-gray-600'  : 'bg-gray-700'
          }`} />
          <p className="text-[9px] text-gray-500 mt-0.5 text-center">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

export default function PropertiesPage() {
  const qc = useQueryClient();
  const [search, setSearch]         = useState('');
  const [filters, setFilters]       = useState({});
  const [showForm, setShowForm]     = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [editing, setEditing]       = useState(null);

  // حفظ مسودة الإضافة بين فتحات الـ popup
  const [draftForm, setDraftForm]   = useState(null);
  const [draftOwner, setDraftOwner] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['properties', search, filters],
    queryFn: () => propertiesApi.list({ search, ...filters }).then(r => r.data),
    staleTime: 30_000,
  });

  const deleteMut = useMutation({
    mutationFn: propertiesApi.delete,
    onSuccess: () => { toast.success('تم حذف العقار'); qc.invalidateQueries(['properties']); },
  });

  const stats = data?.stats || {};

  if (isLoading) return <Loading />;
  if (error)     return <ErrorMsg />;

  return (
    <div>
      <PageHeader
        title="إدارة العقارات"
        subtitle="عرض وإدارة جميع العقارات المسجلة"
        actions={
          <>
            <SearchBox value={search} onChange={setSearch} placeholder="بحث بالاسم أو الكود أو المالك..." />
            <Btn onClick={() => { setEditing(null); setShowForm(true); }}>
              <Plus size={16}/> إضافة عقار جديد
            </Btn>
          </>
        }
      />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">اسم المالك</label>
              <Input
                placeholder="ابحث باسم المالك..."
                value={filters.owner_name || ''}
                onChange={e => setFilters(f => ({ ...f, owner_name: e.target.value }))}
                className="text-xs py-1.5 w-full"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">من تاريخ</label>
              <Input
                type="date"
                value={filters.date_from || ''}
                onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                className="text-xs py-1.5 w-full"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">إلى تاريخ</label>
              <Input
                type="date"
                value={filters.date_to || ''}
                onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                className="text-xs py-1.5 w-full"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">الحالة</label>
              <Select
                options={['متاح','محجوز','مباع','قيد المراجعة'].map(v => ({ value: v, label: v }))}
                value={filters.status || ''}
                onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                className="text-xs py-1.5 w-full"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">نوع العقار</label>
              <Select
                options={[
                  { value: '1', label: 'شقة' }, { value: '2', label: 'فلة' },
                  { value: '3', label: 'عمارة' }, { value: '4', label: 'أرض' },
                ]}
                value={filters.property_type_id || ''}
                onChange={e => setFilters(f => ({ ...f, property_type_id: e.target.value }))}
                className="text-xs py-1.5 w-full"
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="إجمالي العقارات" value={stats.total}        icon={<Building2 size={18}/>} color="blue" />
          <StatCard label="متاح"             value={stats.available}    icon={<CheckCircle size={18}/>} color="green" />
          <StatCard label="محجوز"            value={stats.reserved}     icon={<Clock size={18}/>}       color="amber" />
          <StatCard label="مباع"             value={stats.sold}         icon={<XCircle size={18}/>}     color="red" />
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-3 gap-4">
          {data?.data?.data?.map(prop => (
            <div key={prop.id}
              className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-gray-600 transition-all">

              {/* Header */}
              <div className="bg-gradient-to-l from-blue-600/20 to-purple-600/20 p-3">
                <MediaBar
                  photo={prop.photo_status}
                  design={prop.design_status}
                  video={prop.video_status}
                  marketing={prop.marketing_status}
                />
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge label={prop.property_type?.name || '—'} color="blue" />
                      <Badge label={prop.status} color={STATUS_COLOR[prop.status]} />
                      {prop.is_verified && <Badge label="محقق" color="green" />}
                    </div>
                    <h3 className="font-bold text-gray-100 text-sm">{prop.name}</h3>
                    <p className="text-xs text-gray-500 font-mono">{prop.property_code}</p>
                  </div>
                </div>

                <p className="text-xs text-gray-400 mb-2">
                  📍 {prop.neighborhood?.name}{prop.city?.name ? `، ${prop.city.name}` : ''}
                </p>

                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-lg font-black text-blue-400">
                      {Number(prop.listed_price).toLocaleString('ar-SA-u-nu-latn')} ريال
                    </p>
                    <p className="text-xs text-gray-500">
                      {prop.total_area} م² • {Number(prop.price_per_meter).toLocaleString('ar-SA-u-nu-latn')} ريال/م²
                    </p>
                  </div>
                </div>

                {/* Owner + WhatsApp */}
                <div className="border-t border-gray-700 pt-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar name={prop.owner?.name || ''} size="sm" />
                      <div>
                        <p className="text-xs font-semibold text-gray-200">{prop.owner?.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{prop.owner?.owner_code}</p>
                      </div>
                    </div>
                    {(prop.owner?.whatsapp || prop.owner?.phone) && (
                      <a
                        href={`https://wa.me/${waPhone(prop.owner.whatsapp || prop.owner.phone)}?text=${encodeURIComponent(`السلام عليكم، بخصوص العقار: ${prop.name} (${prop.property_code})`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
                      >
                        <MessageCircle size={11}/> واتساب
                      </a>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {prop.owner?.phone && (
                      <p className="text-xs text-gray-500 font-mono flex items-center gap-1">
                        <Phone size={10}/> {prop.owner.phone}
                      </p>
                    )}
                    {prop.owner?.whatsapp && prop.owner.whatsapp !== prop.owner.phone && (
                      <p className="text-xs text-green-400 font-mono flex items-center gap-1">
                        <MessageCircle size={10}/> {prop.owner.whatsapp}
                      </p>
                    )}
                  </div>
                </div>

                {/* Usage + Action Buttons */}
                <div className="flex items-center justify-between mt-3">
                  <div className="text-xs text-gray-500">
                    <span>{prop.usage_type?.name || '—'}</span>
                    {prop.marketing_type?.name && <><span className="mx-1">·</span><span>{prop.marketing_type.name}</span></>}
                  </div>
                  <div className="flex gap-1">
                    <Btn size="sm" onClick={() => setShowDetail(prop.id)}>
                      <Eye size={12}/> عرض
                    </Btn>
                    <Btn size="sm" variant="outline" onClick={() => { setEditing(prop); setShowForm(true); }}>
                      <Pencil size={12}/> تعديل
                    </Btn>
                    <Btn size="sm" variant="ghost" className="hover:text-red-400"
                      onClick={() => confirm('حذف العقار؟') && deleteMut.mutate(prop.id)}>
                      <Trash2 size={12}/>
                    </Btn>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <PropertyForm
        open={showForm}
        onClose={() => setShowForm(false)}
        editing={editing}
        draft={editing ? null : draftForm}
        draftOwner={editing ? null : draftOwner}
        onSaveDraft={(f, o) => { setDraftForm(f); setDraftOwner(o); }}
        onClearDraft={() => { setDraftForm(null); setDraftOwner(null); }}
      />
      {showDetail && <PropertyDetail id={showDetail} onClose={() => setShowDetail(null)} />}
    </div>
  );
}

// ── Property Form (5 تبويبات) ─────────────────────────────────
const FORM_DEFAULTS = {
  name: '', property_type_id: '', marketing_type_id: '', usage_type_id: '',
  status: 'متاح', listed_price: 0, net_price: 0, total_area: 0,
  city_id: '', neighborhood_id: '', street: '', direction: '',
  map_url: '', latitude: '', longitude: '', nearby_places: '',
  owner_id: '', advertiser_role: 'مالك', mortgage_status: 'غير مرهون',
  mortgage_amount: 0, rental_status: 'غير مؤجر', annual_income: 0,
  rooms_count: 0, bathrooms_count: 0, halls_count: 0, floors_count: 0,
  building_age: 0, is_furnished: false, has_pool: false, has_garden: false,
  has_elevator: false, parking: 'غير متوفر',
  description: '', features: '', components: '',
  photo_status: 'جديد', design_status: 'جديد',
  video_status: 'جديد', marketing_status: 'جديد',
  photos_url: '', video_url: '', commission_rate: 0,
};

const TAB_KEYS = ['basic', 'location', 'owner', 'details', 'media'];

function PropertyForm({ open, onClose, editing, draft, draftOwner, onSaveDraft, onClearDraft }) {
  const qc = useQueryClient();
  const [tab, setTab]               = useState('basic');
  const [loading, setLoading]       = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [form, setForm]             = useState(FORM_DEFAULTS);
  const wasOpen = useRef(false);

  // عند كل فتح للـ modal: نحمّل المسودة أو بيانات التعديل أو نبدأ من جديد
  useEffect(() => {
    if (open && !wasOpen.current) {
      setTab('basic');
      if (editing) {
        setForm(editing);
        setSelectedOwner(null);
        setOwnerSearch('');
      } else if (draft) {
        setForm(draft);
        if (draftOwner) {
          setSelectedOwner(draftOwner);
          setOwnerSearch(draftOwner.name);
        }
      } else {
        setForm(FORM_DEFAULTS);
        setSelectedOwner(null);
        setOwnerSearch('');
      }
    }
    wasOpen.current = open;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // إغلاق مع حفظ المسودة
  const handleClose = () => {
    if (!editing) onSaveDraft?.(form, selectedOwner);
    onClose();
  };

  // تحميل المدن
  const { data: citiesData } = useQuery({
    queryKey: ['lookup-cities'],
    queryFn: () => lookupApi.cities().then(r => r.data),
    staleTime: Infinity,
  });

  // تحميل الأحياء بناءً على المدينة المختارة
  const { data: neighborhoodsData } = useQuery({
    queryKey: ['lookup-neighborhoods', form.city_id],
    queryFn: () => lookupApi.neighborhoods(form.city_id).then(r => r.data),
    enabled: !!form.city_id,
    staleTime: Infinity,
  });

  // البحث عن الملاك
  const { data: ownersData } = useQuery({
    queryKey: ['owners-search', ownerSearch],
    queryFn: () => ownersApi.list({ search: ownerSearch }).then(r => r.data),
    enabled: ownerSearch.length > 1,
  });

  const handleOwnerSelect = (owner) => {
    setSelectedOwner(owner);
    set('owner_id', owner.id);
    setOwnerSearch(owner.name);
  };

  const handleSave = async () => {
    // validation مع توجيه للتاب الصح
    if (!form.name) {
      toast.error('اسم العقار مطلوب');
      setTab('basic');
      return;
    }
    if (!form.property_type_id) {
      toast.error('نوع العقار مطلوب');
      setTab('basic');
      return;
    }
    if (!form.owner_id) {
      toast.error('يرجى اختيار المالك');
      setTab('owner');
      return;
    }
    setLoading(true);
    try {
      if (editing) await propertiesApi.update(editing.id, form);
      else         await propertiesApi.create(form);
      toast.success(editing ? 'تم التحديث' : 'تم إضافة العقار');
      qc.invalidateQueries(['properties']);
      onClearDraft?.();
      onClose();
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(e => toast.error(e));
    } finally { setLoading(false); }
  };

  const tabIdx = TAB_KEYS.indexOf(tab);
  const tabs = [
    { key: 'basic',    label: 'معلومات أساسية' },
    { key: 'location', label: 'الموقع' },
    { key: 'owner',    label: 'المالك' },
    { key: 'details',  label: 'التفاصيل' },
    { key: 'media',    label: 'المميزات' },
  ];

  const mediaOpts = ['جديد','تم','جاري','معلق','ملغي'].map(v => ({ value: v, label: v }));

  // مؤشر اكتمال التابات — فقط الحقول الإلزامية
  const tabComplete = {
    basic:    !!form.name,
    location: true,
    owner:    !!form.owner_id,
    details:  true,
    media:    true,
  };

  return (
    <Modal open={open} onClose={handleClose}
      title={editing ? 'تعديل بيانات العقار' : 'إضافة عقار جديد'}
      width="max-w-3xl"
      footer={
        <div className="flex items-center justify-between w-full">
          {/* التنقل بين التابات */}
          <div className="flex gap-2">
            {tabIdx > 0 && (
              <Btn variant="outline" onClick={() => setTab(TAB_KEYS[tabIdx - 1])}>
                <ChevronRight size={14}/> السابق
              </Btn>
            )}
            {tabIdx < TAB_KEYS.length - 1 && (
              <Btn variant="outline" onClick={() => setTab(TAB_KEYS[tabIdx + 1])}>
                التالي <ChevronLeft size={14}/>
              </Btn>
            )}
          </div>
          {/* أزرار الحفظ والإلغاء */}
          <div className="flex gap-2">
            <Btn onClick={handleSave} loading={loading}>
              💾 {editing ? 'حفظ التعديلات' : 'إضافة العقار'}
            </Btn>
            <Btn variant="outline" onClick={handleClose}>إلغاء</Btn>
          </div>
        </div>
      }>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1 mb-5">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all relative ${
              tab === t.key ? 'bg-gray-700 text-gray-100' : 'text-gray-400 hover:text-gray-200'
            }`}>
            {t.label}
            {/* نقطة خضراء إذا التاب مكتمل */}
            {tabComplete[t.key] && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400" />
            )}
          </button>
        ))}
      </div>

      {/* Tab: المعلومات الأساسية */}
      {tab === 'basic' && (
        <div className="grid grid-cols-2 gap-4">
          <Input label="اسم العقار *"    value={form.name}        onChange={e => set('name', e.target.value)} />
          <Select label="نوع العقار *"   value={form.property_type_id} onChange={e => set('property_type_id', e.target.value)}
            options={[{value:'1',label:'شقة'},{value:'2',label:'فلة'},{value:'3',label:'عمارة'},{value:'4',label:'أرض'},{value:'5',label:'أدوار'},{value:'6',label:'بلك'}]} />
          <Select label="نوع التسويق"    value={form.marketing_type_id} onChange={e => set('marketing_type_id', e.target.value)}
            options={[{value:'1',label:'ملاك أفراد'},{value:'2',label:'مزادات'},{value:'3',label:'مشاريع على الخارطة'},{value:'4',label:'مشاريع جاهزة'}]} />
          <Select label="الاستخدام"      value={form.usage_type_id} onChange={e => set('usage_type_id', e.target.value)}
            options={[{value:'1',label:'سكني'},{value:'2',label:'تجاري'},{value:'3',label:'سكني تجاري'},{value:'4',label:'مستودعات'},{value:'5',label:'زراعي'}]} />
          <Select label="الحالة"         value={form.status} onChange={e => set('status', e.target.value)}
            options={['متاح','محجوز','مباع','قيد المراجعة'].map(v => ({ value: v, label: v }))} />
          <Input label="السعر المعروض (ريال)" value={form.listed_price} onChange={e => set('listed_price', e.target.value)} type="number" />
          <Input label="السعر الصافي (ريال)"  value={form.net_price}    onChange={e => set('net_price', e.target.value)}    type="number" />
          <Input label="المساحة (م²)"          value={form.total_area}   onChange={e => set('total_area', e.target.value)}   type="number" />
        </div>
      )}

      {/* Tab: الموقع */}
      {tab === 'location' && (
        <div className="grid grid-cols-2 gap-4">
          <Select label="المدينة" value={form.city_id}
            onChange={e => { set('city_id', e.target.value); set('neighborhood_id', ''); }}
            options={(citiesData || []).map(c => ({ value: String(c.id), label: c.name }))} />
          <Select label="الحي" value={form.neighborhood_id}
            onChange={e => set('neighborhood_id', e.target.value)}
            options={(neighborhoodsData || []).map(n => ({ value: String(n.id), label: n.name }))}
            disabled={!form.city_id} />
          <Input label="الشارع"  value={form.street || ''}   onChange={e => set('street', e.target.value)} />
          <Select label="الاتجاه" value={form.direction || ''} onChange={e => set('direction', e.target.value)}
            options={['شمالية','جنوبية','شرقية','غربية','شمالية شرقية','شمالية غربية','جنوبية شرقية','جنوبية غربية'].map(v => ({ value: v, label: v }))} />
          <Input label="رابط الموقع (Google Maps)" value={form.map_url || ''} onChange={e => set('map_url', e.target.value)} className="col-span-2" />
          <Input label="خط الطول" value={form.latitude  || ''} onChange={e => set('latitude',  e.target.value)} type="number" />
          <Input label="خط العرض" value={form.longitude || ''} onChange={e => set('longitude', e.target.value)} type="number" />
          <div className="col-span-2">
            <Textarea label="المواقع القريبة" value={form.nearby_places || ''} onChange={e => set('nearby_places', e.target.value)} placeholder="مدارس، مساجد، أسواق..." />
          </div>
        </div>
      )}

      {/* Tab: المالك */}
      {tab === 'owner' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">البحث عن مالك *</label>
            <input
              value={ownerSearch}
              onChange={e => { setOwnerSearch(e.target.value); set('owner_id', ''); setSelectedOwner(null); }}
              placeholder="ابحث بالاسم أو الكود..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-blue-500"
            />
            {ownersData?.data?.data?.length > 0 && !selectedOwner && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden mt-1">
                {ownersData.data.data.slice(0, 5).map(owner => (
                  <div key={owner.id} onClick={() => handleOwnerSelect(owner)}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-0">
                    <Avatar name={owner.name} size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-gray-100">{owner.name}</p>
                      <p className="text-xs text-gray-500">{owner.owner_code} · {owner.phone}</p>
                    </div>
                    <Badge label={owner.type} color="blue" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedOwner && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={selectedOwner.name} size="md" />
                  <div>
                    <p className="font-bold text-gray-100">{selectedOwner.name}</p>
                    <p className="text-xs text-gray-400">{selectedOwner.owner_code} · {selectedOwner.phone}</p>
                  </div>
                </div>
                <Btn size="sm" variant="ghost" onClick={() => { setSelectedOwner(null); setOwnerSearch(''); set('owner_id', ''); }}>
                  تغيير
                </Btn>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mt-4">
            <Select label="صفة المعلن"   value={form.advertiser_role}   onChange={e => set('advertiser_role', e.target.value)}
              options={['مالك','وكيل','مطور'].map(v => ({ value: v, label: v }))} />
            <Select label="حالة الرهن"   value={form.mortgage_status}   onChange={e => set('mortgage_status', e.target.value)}
              options={['مرهون','غير مرهون'].map(v => ({ value: v, label: v }))} />
            {form.mortgage_status === 'مرهون' && (
              <Input label="مبلغ الرهن" value={form.mortgage_amount} onChange={e => set('mortgage_amount', e.target.value)} type="number" />
            )}
            <Select label="حالة التأجير" value={form.rental_status}    onChange={e => set('rental_status', e.target.value)}
              options={['مؤجر','غير مؤجر','جزئي'].map(v => ({ value: v, label: v }))} />
            {form.rental_status !== 'غير مؤجر' && (
              <Input label="الإيراد السنوي" value={form.annual_income} onChange={e => set('annual_income', e.target.value)} type="number" />
            )}
          </div>
        </div>
      )}

      {/* Tab: التفاصيل */}
      {tab === 'details' && (
        <div className="grid grid-cols-3 gap-4">
          <Input label="عدد الغرف"      value={form.rooms_count}     onChange={e => set('rooms_count',     e.target.value)} type="number" />
          <Input label="عدد الحمامات"   value={form.bathrooms_count} onChange={e => set('bathrooms_count', e.target.value)} type="number" />
          <Input label="عدد الصالات"    value={form.halls_count}     onChange={e => set('halls_count',     e.target.value)} type="number" />
          <Input label="عدد الأدوار"    value={form.floors_count}    onChange={e => set('floors_count',    e.target.value)} type="number" />
          <Input label="عمر العقار (سنة)" value={form.building_age}  onChange={e => set('building_age',    e.target.value)} type="number" />
          <Select label="موقف سيارات"   value={form.parking}         onChange={e => set('parking', e.target.value)}
            options={['متوفر','غير متوفر'].map(v => ({ value: v, label: v }))} />
          <Select label="مفروش"         value={form.is_furnished ? 'نعم' : 'لا'} onChange={e => set('is_furnished', e.target.value === 'نعم')}
            options={[{value:'نعم',label:'نعم'},{value:'لا',label:'لا'}]} />
          <Select label="مسبح"          value={form.has_pool    ? 'نعم' : 'لا'} onChange={e => set('has_pool',     e.target.value === 'نعم')}
            options={[{value:'نعم',label:'نعم'},{value:'لا',label:'لا'}]} />
          <Select label="حديقة"         value={form.has_garden  ? 'نعم' : 'لا'} onChange={e => set('has_garden',   e.target.value === 'نعم')}
            options={[{value:'نعم',label:'نعم'},{value:'لا',label:'لا'}]} />
          <Select label="مصعد"          value={form.has_elevator? 'نعم' : 'لا'} onChange={e => set('has_elevator', e.target.value === 'نعم')}
            options={[{value:'نعم',label:'نعم'},{value:'لا',label:'لا'}]} />
        </div>
      )}

      {/* Tab: المميزات والوسائط */}
      {tab === 'media' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="حالة التصوير"  value={form.photo_status}     onChange={e => set('photo_status',     e.target.value)} options={mediaOpts} />
            <Select label="حالة التصميم"  value={form.design_status}    onChange={e => set('design_status',    e.target.value)} options={mediaOpts} />
            <Select label="حالة الفيديو"  value={form.video_status}     onChange={e => set('video_status',     e.target.value)} options={mediaOpts} />
            <Select label="حالة النشر"    value={form.marketing_status} onChange={e => set('marketing_status', e.target.value)} options={mediaOpts} />
            <Input  label="رابط الصور"    value={form.photos_url || ''} onChange={e => set('photos_url', e.target.value)} placeholder="https://..." />
            <Input  label="رابط الفيديو"  value={form.video_url  || ''} onChange={e => set('video_url',  e.target.value)} placeholder="https://..." />
            <Input  label="العمولة (%)"   value={form.commission_rate}  onChange={e => set('commission_rate', e.target.value)} type="number" />
          </div>
          <Textarea label="وصف العقار"     value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3} />
          <Textarea label="مميزات العقار"  value={form.features    || ''} onChange={e => set('features',    e.target.value)} rows={2} />
          <Textarea label="مكونات العقار"  value={form.components  || ''} onChange={e => set('components',  e.target.value)} rows={2} />
        </div>
      )}
    </Modal>
  );
}

// ── Property Detail ───────────────────────────────────────────
const SectionTitle = ({ children }) => (
  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-4 first:mt-0">{children}</p>
);

const yn = (v) => v ? 'نعم' : 'لا';
const fmt = (n) => n ? Number(n).toLocaleString('ar-SA-u-nu-latn') : '—';

function PropertyDetail({ id, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => propertiesApi.show(id).then(r => r.data.data),
  });

  if (isLoading) return <Modal open onClose={onClose} title="تفاصيل العقار"><Loading /></Modal>;
  const p = data;
  if (!p) return null;

  const waMsg     = encodeURIComponent(`السلام عليكم، بخصوص العقار: ${p.name} (${p.property_code})`);
  const ownerWa   = p.owner?.whatsapp || p.owner?.phone;

  return (
    <Modal open onClose={onClose} title="تفاصيل العقار" width="max-w-3xl"
      footer={
        <div className="flex items-center gap-2">
          {ownerWa && (
            <a
              href={`https://wa.me/${waPhone(ownerWa)}?text=${waMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
            >
              <MessageCircle size={14}/> واتساب المالك
            </a>
          )}
          <Btn variant="outline" onClick={onClose}>إغلاق</Btn>
        </div>
      }>

      {/* ─── Header ─── */}
      <div className="bg-gradient-to-l from-blue-600/20 to-purple-600/20 rounded-xl p-4 mb-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex gap-2 mb-1 flex-wrap">
              <Badge label={p.property_type?.name || '—'} color="blue" />
              <Badge label={p.status} color={STATUS_COLOR[p.status]} />
              {p.is_verified && <Badge label="محقق" color="green" />}
              {p.usage_type?.name && <Badge label={p.usage_type.name} color="gray" />}
            </div>
            <h2 className="text-xl font-black text-gray-100">{p.name}</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{p.property_code}</p>
          </div>
          <div className="text-left">
            <p className="text-2xl font-black text-blue-400">{fmt(p.listed_price)} ريال</p>
            <p className="text-xs text-gray-400">صافي: {fmt(p.net_price)} ريال</p>
            <p className="text-xs text-gray-500">{p.total_area} م² • {fmt(p.price_per_meter)} ريال/م²</p>
          </div>
        </div>
        <MediaBar photo={p.photo_status} design={p.design_status} video={p.video_status} marketing={p.marketing_status} />
      </div>

      <div className="grid grid-cols-2 gap-x-6">

        {/* ─── العمود الأيمن ─── */}
        <div>
          <SectionTitle>الموقع</SectionTitle>
          <InfoRow label="المدينة"       value={p.city?.name} />
          <InfoRow label="الحي"          value={p.neighborhood?.name} />
          <InfoRow label="الشارع"        value={p.street} />
          <InfoRow label="الاتجاه"       value={p.direction} />
          {p.nearby_places && <InfoRow label="مواقع قريبة" value={p.nearby_places} />}
          {p.map_url && (
            <div className="flex items-center justify-between py-1 border-b border-gray-800 text-xs">
              <span className="text-gray-500">الخريطة</span>
              <a href={p.map_url} target="_blank" rel="noopener noreferrer"
                className="text-blue-400 hover:underline flex items-center gap-1">
                <MapPin size={11}/> عرض الموقع
              </a>
            </div>
          )}

          <SectionTitle>تفاصيل العقار</SectionTitle>
          <InfoRow label="نوع التسويق"  value={p.marketing_type?.name} />
          <InfoRow label="المساحة"       value={p.total_area ? `${p.total_area} م²` : null} />
          <InfoRow label="الغرف"         value={p.rooms_count} />
          <InfoRow label="الحمامات"      value={p.bathrooms_count} />
          <InfoRow label="الصالات"       value={p.halls_count} />
          <InfoRow label="الأدوار"       value={p.floors_count} />
          <InfoRow label="عمر العقار"    value={p.building_age ? `${p.building_age} سنة` : null} />
          <InfoRow label="موقف سيارات"   value={p.parking} />
          <InfoRow label="مفروش"         value={p.rooms_count !== null ? yn(p.is_furnished) : null} />
          <InfoRow label="مسبح"          value={yn(p.has_pool)} />
          <InfoRow label="حديقة"         value={yn(p.has_garden)} />
          <InfoRow label="مصعد"          value={yn(p.has_elevator)} />

          <SectionTitle>التجهيز الإعلامي</SectionTitle>
          {[
            ['التصوير', p.photo_status],
            ['التصميم', p.design_status],
            ['الفيديو',  p.video_status],
            ['النشر',    p.marketing_status],
          ].map(([label, val]) => (
            <div key={label} className="flex items-center justify-between py-1 border-b border-gray-800 text-xs">
              <span className="text-gray-500">{label}</span>
              <Badge label={val || 'جديد'} color={MEDIA_COLOR[val] || 'blue'} />
            </div>
          ))}
          {p.photos_url && <InfoRow label="رابط الصور"  value={<a href={p.photos_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">فتح</a>} />}
          {p.video_url  && <InfoRow label="رابط الفيديو" value={<a href={p.video_url}  target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">فتح</a>} />}
        </div>

        {/* ─── العمود الأيسر ─── */}
        <div>
          <SectionTitle>المالك</SectionTitle>
          <div className="bg-gray-800 rounded-xl p-3 mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={p.owner?.name || ''} size="md" />
                <div>
                  <p className="font-bold text-gray-100 text-sm">{p.owner?.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{p.owner?.owner_code}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Phone size={10}/> {p.owner?.phone}
                  </p>
                  {p.owner?.whatsapp && p.owner.whatsapp !== p.owner.phone && (
                    <p className="text-xs text-green-400 flex items-center gap-1">
                      <MessageCircle size={10}/> {p.owner.whatsapp}
                    </p>
                  )}
                </div>
              </div>
              {p.owner?.phone && (
                <a
                  href={`https://wa.me/${waPhone(p.owner.phone)}?text=${waMsg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-2 py-1.5 rounded-lg transition-colors"
                >
                  <MessageCircle size={11}/> واتساب
                </a>
              )}
            </div>
          </div>
          <InfoRow label="صفة المعلن"     value={p.advertiser_role} />
          <InfoRow label="حالة الرهن"     value={p.mortgage_status} />
          {p.mortgage_amount > 0 && <InfoRow label="مبلغ الرهن" value={`${fmt(p.mortgage_amount)} ريال`} />}
          <InfoRow label="حالة التأجير"   value={p.rental_status} />
          {p.annual_income > 0 && <InfoRow label="الإيراد السنوي" value={`${fmt(p.annual_income)} ريال`} />}
          {p.tenants_count > 0 && <InfoRow label="عدد المستأجرين" value={p.tenants_count} />}
          {p.contract_end_date  && <InfoRow label="نهاية العقد"   value={p.contract_end_date} />}

          <SectionTitle>المعلومات المالية</SectionTitle>
          <InfoRow label="السعر المعروض"  value={`${fmt(p.listed_price)} ريال`} />
          <InfoRow label="السعر الصافي"   value={`${fmt(p.net_price)} ريال`} />
          <InfoRow label="سعر المتر"      value={`${fmt(p.price_per_meter)} ريال/م²`} />
          {p.commission_rate > 0 && <InfoRow label="العمولة" value={`${p.commission_rate}%`} />}
          {p.market_price_3months > 0 && <InfoRow label="سعر السوق (3 أشهر)" value={`${fmt(p.market_price_3months)} ريال`} />}
          {p.discount_amount > 0 && <InfoRow label="الخصم" value={`${fmt(p.discount_amount)} ريال`} />}

          {p.assignedEmployee && (
            <>
              <SectionTitle>الموظف المسؤول</SectionTitle>
              <InfoRow label="الاسم"  value={p.assignedEmployee.full_name} />
              <InfoRow label="الهاتف" value={p.assignedEmployee.phone} />
            </>
          )}

          <SectionTitle>أُنشئ بواسطة</SectionTitle>
          <InfoRow label="الموظف" value={p.createdBy?.full_name} />
        </div>
      </div>

      {/* ─── الوصف والمميزات ─── */}
      {(p.description || p.features || p.components) && (
        <div className="mt-4 space-y-3">
          {p.description && (
            <div>
              <SectionTitle>الوصف</SectionTitle>
              <p className="text-sm text-gray-300 bg-gray-800 rounded-xl p-3 leading-relaxed">{p.description}</p>
            </div>
          )}
          {p.features && (
            <div>
              <SectionTitle>المميزات</SectionTitle>
              <p className="text-sm text-gray-300 bg-gray-800 rounded-xl p-3 leading-relaxed">{p.features}</p>
            </div>
          )}
          {p.components && (
            <div>
              <SectionTitle>المكونات</SectionTitle>
              <p className="text-sm text-gray-300 bg-gray-800 rounded-xl p-3 leading-relaxed">{p.components}</p>
            </div>
          )}
        </div>
      )}

      {/* ─── المستندات ─── */}
      {p.documents?.length > 0 && (
        <div className="mt-4">
          <SectionTitle>المستندات المرفقة ({p.documents.length})</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {p.documents.map(doc => (
              <a key={doc.id}
                href={doc.file_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                <Home size={14} className="text-blue-400 flex-shrink-0"/>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-200 truncate">{doc.type}</p>
                  <p className="text-xs text-gray-500 truncate">{doc.file_name}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
