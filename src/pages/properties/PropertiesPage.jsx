import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { propertiesApi, ownersApi, lookupApi } from '../../api/services';
import { PageHeader } from '../../components/layout/Layout';
import {
  PhoneText, MoneyInput, formatMoney, Btn, Badge, StatCard, Card, Modal, Input, Select,
  Textarea, Loading, ErrorMsg, InfoRow, Avatar,
  Table, Tr, Td, CountBox, BoxSection, FilterPanel,
} from '../../components/ui';
import { RichText } from '../../components/ui/RichText';
// المحرر (TipTap) تقيل — بينحمّل بس لما ينفتح فورم العقار
const RichTextEditor = lazy(() => import('../../components/ui/RichTextEditor'));
import { Plus, Pencil, Trash2, Building2, Eye, CheckCircle, Clock, XCircle, ChevronRight, ChevronLeft, ChevronDown, MessageCircle, Phone, MapPin, Home, X, Download, Compass, TrendingUp } from 'lucide-react';

const STATUS_COLOR = { 'متاح': 'green', 'محجوز': 'amber', 'مباع': 'red', 'قيد المراجعة': 'purple' };
const MEDIA_COLOR  = { 'تم': 'green', 'جاري': 'amber', 'معلق': 'red', 'ملغي': 'gray', 'جديد': 'blue' };
const todayISO      = () => new Date().toISOString().slice(0, 10);

// واجهة العقار: بتنحفظ كنص "شمالية، شرقية" (عقار زاوية = أكتر من واجهة)
const FACADES = ['شمالية', 'جنوبية', 'شرقية', 'غربية'];
const parseFacade  = (s) => (s || '').split(/[،,]/).map(x => x.trim()).filter(Boolean);
const toggleFacade = (s, f) => {
  const cur = parseFacade(s);
  const next = cur.includes(f) ? cur.filter(x => x !== f) : [...cur, f];
  return FACADES.filter(x => next.includes(x)).join('، ');
};

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

// فئات السعر (نفس تقسيم المهتمين)
const PRICE_RANGES = [
  { value: 'lt4',   label: 'أقل من 4M' },
  { value: '4to10', label: 'بين 4M-10M' },
  { value: 'gt10',  label: 'أعلى من 10M' },
];
const PROPERTY_STATUSES = ['متاح', 'محجوز', 'مباع', 'قيد المراجعة'];

export default function PropertiesPage() {
  const qc = useQueryClient();
  const [filters, setFilters]       = useState({});
  const [showForm, setShowForm]     = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [editing, setEditing]       = useState(null);
  const [exporting, setExporting]   = useState(false);

  // حفظ مسودة الإضافة بين فتحات الـ popup
  const [draftForm, setDraftForm]   = useState(null);
  const [draftOwner, setDraftOwner] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['properties', filters],
    queryFn: () => propertiesApi.list({ ...filters }).then(r => r.data),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  // أي تغيير بالفلاتر بيرجّع لأول صفحة
  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v || undefined, page: undefined }));
  const toggleF = (k, v) => setFilters(f => ({ ...f, [k]: String(f[k]) === String(v) ? undefined : v, page: undefined }));
  const hasDate    = !!(filters.date_from || filters.date_to);
  const activeFilters = ['status', 'property_type_id', 'direction', 'price_range', 'code'].filter(k => filters[k]).length;
  const hasFilters = activeFilters > 0;
  const clearFilters = () => setFilters(f => ({ date_from: f.date_from, date_to: f.date_to }));

  const deleteMut = useMutation({
    mutationFn: propertiesApi.delete,
    onSuccess: () => { toast.success('تم حذف العقار'); qc.invalidateQueries(['properties']); },
  });

  const stats       = data?.stats        || {};
  const byType      = data?.by_type      || [];
  const byDirection = data?.by_direction || [];

  // التصدير بياخد نفس الفترة والفلاتر المطبّقة على الصفحة
  const handleExport = async () => {
    setExporting(true);
    try {
      const res     = await propertiesApi.export(filters);
      const records = res.data?.data || [];

      if (!records.length) {
        toast.error('لا توجد بيانات ضمن الفترة المحددة');
        return;
      }

      const rows = records.map(p => ({
        'الكود':          p.property_code,
        'الاسم':          p.name,
        'نوع العقار':      p.property_type?.name || '—',
        'المالك':         p.owner?.name || '—',
        'المدينة':        p.city?.name || '—',
        'الحي':           p.neighborhood?.name || '—',
        'الاتجاه':        p.direction || '—',
        'الواجهة':        p.facade || '—',
        'رقم المخطط':     p.plan_number || '—',
        'رقم القطعة':     p.plot_number || '—',
        'عقد وساطة':      p.has_brokerage_contract ? 'نعم' : 'لا',
        'رقم الترخيص':    p.license_number || '—',
        'عرض الشارع':     Number(p.street_width) || '—',
        'الحالة':         p.status,
        'السعر المعروض':  p.listed_price,
        'المساحة':        p.total_area,
        'تاريخ الإضافة':  p.created_at?.slice(0, 10),
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'العقارات');
      const period = hasDate ? `${filters.date_from || 'start'}-${filters.date_to || todayISO()}` : 'all';
      XLSX.writeFile(wb, `properties-${period}.xlsx`);
      toast.success(`تم تصدير ${records.length} عقار`);
    } catch { toast.error('فشل التصدير'); }
    finally { setExporting(false); }
  };

  if (error)     return <ErrorMsg />;

  return (
    <div>
      <PageHeader
        title="إدارة العقارات"
        subtitle="عرض وإدارة جميع العقارات المسجلة"
        actions={
          <Btn onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus size={16}/> إضافة عقار جديد
          </Btn>
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
              {hasDate ? 'الأرقام والقائمة والتصدير حسب الفترة المحددة' : 'بدون فترة = كل العقارات'}
            </p>
          </div>
        </div>

        {/* ② العدادات */}
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <StatCard label="العقارات الجاري تسويقها" value={stats.marketing} icon={<TrendingUp size={18}/>} color="purple" />
            <StatCard label="إجمالي العقارات"          value={stats.total}     icon={<Building2 size={18}/>}  color="blue" />
            <StatCard label="المتاحة"                  value={stats.available} icon={<CheckCircle size={18}/>} color="green" />
          </div>

          <div className="space-y-2">
            <BoxSection icon={<Building2 size={13}/>} title="أنواع العقارات">
              {byType.map(t => (
                <CountBox key={t.id} label={t.label} count={t.count}
                  active={String(filters.property_type_id) === String(t.id)}
                  onClick={() => toggleF('property_type_id', t.id)} />
              ))}
            </BoxSection>
            <BoxSection icon={<Compass size={13}/>} title="الاتجاهات">
              {byDirection.map(d => (
                <CountBox key={d.label} label={d.label} count={d.count}
                  active={filters.direction === d.label}
                  onClick={() => toggleF('direction', d.label)} />
              ))}
            </BoxSection>
          </div>
        </div>

        {/* ③ الفلاتر */}
        <FilterPanel activeCount={activeFilters} onClear={clearFilters}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Select label="الحالة" value={filters.status || ''} onChange={e => setF('status', e.target.value)}
              options={PROPERTY_STATUSES.map(v => ({ value: v, label: v }))} />
            <Select label="نوع العقار" value={filters.property_type_id || ''} onChange={e => setF('property_type_id', e.target.value)}
              options={byType.map(t => ({ value: String(t.id), label: t.label }))} />
            <Select label="الاتجاه" value={filters.direction || ''} onChange={e => setF('direction', e.target.value)}
              options={byDirection.map(d => ({ value: d.label, label: d.label }))} />
            <Select label="سعر العقار" value={filters.price_range || ''} onChange={e => setF('price_range', e.target.value)}
              options={PRICE_RANGES} />
            <Input label="بحث بالكود" placeholder="مثال: RE-2026-001" value={filters.code || ''}
              onChange={e => setF('code', e.target.value)} />
          </div>
        </FilterPanel>

        {/* Cards Grid */}
        {isLoading && <Loading />}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      {Number(prop.listed_price).toLocaleString('en-US')} ريال
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatMoney(prop.total_area)} م² •{Number(prop.price_per_meter).toLocaleString('en-US')} ريال/م²
                    </p>
                  </div>
                </div>

                {/* Owner + WhatsApp */}
                <div className="border-t border-gray-700 pt-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar name={prop.owner?.name || ''} size="sm" />
                      <div>
                        <p className="text-xs font-semibold text-gray-200">{prop.owner?.name || <span className="text-gray-500 font-normal">بدون اسم</span>}</p>
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
                        <Phone size={10}/> <PhoneText value={prop.owner.phone} />
                      </p>
                    )}
                    {prop.owner?.whatsapp && prop.owner.whatsapp !== prop.owner.phone && (
                      <p className="text-xs text-green-400 font-mono flex items-center gap-1">
                        <MessageCircle size={10}/> <PhoneText value={prop.owner.whatsapp} />
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

        {!isLoading && data?.data?.data?.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-10">لا توجد عقارات مطابقة</p>
        )}

        {/* الصفحات */}
        {(data?.data?.last_page || 1) > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm">
            <Btn size="sm" variant="outline" disabled={(data.data.current_page || 1) <= 1}
              onClick={() => setFilters(f => ({ ...f, page: (data.data.current_page || 1) - 1 }))}>
              <ChevronRight size={14}/> السابق
            </Btn>
            <span className="text-gray-400">
              صفحة {data.data.current_page} من {data.data.last_page} · {data.data.total} عقار
            </span>
            <Btn size="sm" variant="outline" disabled={data.data.current_page >= data.data.last_page}
              onClick={() => setFilters(f => ({ ...f, page: data.data.current_page + 1 }))}>
              التالي <ChevronLeft size={14}/>
            </Btn>
          </div>
        )}
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
  has_brokerage_contract: false, license_number: '',
  city_id: '', neighborhood_id: '', plan_number: '', plot_number: '', street_width: '', direction: '', facade: '',
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

// ── فحص فورم العقار تاب تاب (نفس قواعد السيرفر) ─────────────────
const isEmpty   = (v) => v === '' || v === null || v === undefined;
const isUrl     = (v) => { try { return /^https?:$/.test(new URL(v).protocol); } catch { return false; } };
const negative  = (v) => !isEmpty(v) && Number(v) < 0;
const badInt    = (v) => !isEmpty(v) && (!Number.isInteger(Number(v)) || Number(v) < 0);
const tooLong   = (v, n) => String(v ?? '').length > n;
const outOf     = (v, min, max) => !isEmpty(v) && (isNaN(Number(v)) || Number(v) < min || Number(v) > max);

const TAB_RULES = {
  basic: (f) => ({
    name:             !String(f.name || '').trim() && 'اسم العقار مطلوب',
    property_type_id: !f.property_type_id && 'اختار نوع العقار',
    listed_price:     negative(f.listed_price) && 'السعر ما بيصير سالب',
    net_price:        negative(f.net_price) && 'السعر ما بيصير سالب',
    total_area:       negative(f.total_area) && 'المساحة ما بتصير سالبة',
    license_number:   tooLong(f.license_number, 50) && 'رقم الترخيص طويل (50 حرف كحد أقصى)',
  }),
  location: (f) => ({
    plan_number:  tooLong(f.plan_number, 50) && 'رقم المخطط طويل (50 حرف كحد أقصى)',
    plot_number:  tooLong(f.plot_number, 50) && 'رقم القطعة طويل (50 حرف كحد أقصى)',
    street_width: negative(f.street_width) && 'عرض الشارع ما بيصير سالب',
    map_url:      !isEmpty(f.map_url) && !isUrl(f.map_url) && 'الرابط لازم يكون كامل ويبلّش بـ https://',
    latitude:     outOf(f.latitude, -90, 90) && 'خط الطول لازم يكون بين -90 و 90',
    longitude:    outOf(f.longitude, -180, 180) && 'خط العرض لازم يكون بين -180 و 180',
  }),
  owner: (f) => ({
    mortgage_amount: f.mortgage_status === 'مرهون' && negative(f.mortgage_amount) && 'مبلغ الرهن ما بيصير سالب',
    annual_income:   negative(f.annual_income) && 'الإيراد ما بيصير سالب',
  }),
  details: (f) => ({
    rooms_count:     badInt(f.rooms_count) && 'لازم رقم صحيح (0 أو أكتر)',
    bathrooms_count: badInt(f.bathrooms_count) && 'لازم رقم صحيح (0 أو أكتر)',
    halls_count:     badInt(f.halls_count) && 'لازم رقم صحيح (0 أو أكتر)',
    floors_count:    badInt(f.floors_count) && 'لازم رقم صحيح (0 أو أكتر)',
    building_age:    badInt(f.building_age) && 'لازم رقم صحيح (0 أو أكتر)',
  }),
  media: (f) => ({
    photos_url:      !isEmpty(f.photos_url) && !isUrl(f.photos_url) && 'الرابط لازم يكون كامل ويبلّش بـ https://',
    video_url:       !isEmpty(f.video_url) && !isUrl(f.video_url) && 'الرابط لازم يكون كامل ويبلّش بـ https://',
    commission_rate: outOf(f.commission_rate, 0, 100) && 'العمولة لازم تكون بين 0 و 100',
  }),
};

// أي حقل بأي تاب (لأخطاء السيرفر)
const FIELD_TAB = Object.fromEntries(
  Object.entries(TAB_RULES).flatMap(([tab, rule]) => Object.keys(rule({})).map(k => [k, tab]))
);

const tabErrors = (tab, form) =>
  Object.fromEntries(Object.entries(TAB_RULES[tab]?.(form) || {}).filter(([, msg]) => msg));



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
      setTriedSave(false);
      setErrors({});
      setNewOwner(null);
      if (editing) {
        setForm(editing);
        setSelectedOwner(editing.owner || null);
        setOwnerSearch(editing.owner?.name || '');
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

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => (e[k] ? { ...e, [k]: undefined } : e));
  };
  const [errors, setErrors] = useState({});

  // بيفحص تاب (أو مجموعة تابات) وبيعرض الأخطاء تحت الحقول. بيرجّع أول تاب فيه غلط (أو null)
  const validateTabs = (tabs) => {
    let firstBad = null, firstMsg = null;
    const next = { ...errors };
    for (const t of tabs) {
      for (const k of Object.keys(TAB_RULES[t]({}))) delete next[k];
      const errs = tabErrors(t, form);
      Object.assign(next, errs);
      if (!firstBad && Object.keys(errs).length) { firstBad = t; firstMsg = Object.values(errs)[0]; }
    }
    setErrors(next);
    if (firstBad) {
      setTab(firstBad);
      toast.error(firstMsg, { id: 'property-form-validation', duration: 4000 });
    }
    return firstBad;
  };

  // التالي / الضغط على تاب لقدّام: لازم التابات اللي قبله تكون سليمة. لورا مسموح دايماً
  const goToTab = (target) => {
    const from = TAB_KEYS.indexOf(tab), to = TAB_KEYS.indexOf(target);
    if (to <= from) { setTab(target); return; }
    if (!validateTabs(TAB_KEYS.slice(from, to))) setTab(target);
  };

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
  const { data: ownersData, isFetching: ownersFetching } = useQuery({
    queryKey: ['owners-search', ownerSearch],
    queryFn: () => ownersApi.list({ search: ownerSearch }).then(r => r.data),
    enabled: ownerSearch.length > 1 && !selectedOwner,
  });
  const ownerResults = ownerSearch.length > 1 ? (ownersData?.data?.data || []) : [];

  const handleOwnerSelect = (owner) => {
    setSelectedOwner(owner);
    set('owner_id', owner.id);
    setOwnerSearch(owner.name || owner.owner_code || '');
    setNewOwner(null);
  };

  // إضافة مالك جديد من جوّا الفورم (لما المالك مش موجود بالنظام)
  const [newOwner, setNewOwner] = useState(null);   // { name, phone, type }
  const [savingOwner, setSavingOwner] = useState(false);
  const createOwner = async () => {
    if (!newOwner.phone?.trim() || !newOwner.whatsapp?.trim()) {
      toast.error('رقم الجوال ورقم الواتساب مطلوبين');
      return;
    }
    setSavingOwner(true);
    try {
      const res = await ownersApi.create({ name: newOwner.name?.trim() || null, phone: newOwner.phone.trim(), whatsapp: newOwner.whatsapp.trim(), type: newOwner.type || 'مالك' });
      handleOwnerSelect(res.data.data);
      qc.invalidateQueries(['owners']);
      toast.success('تم إضافة المالك واختياره للعقار');
    } catch (err) {
      const errors = err.response?.data?.errors;
      toast.error(errors ? Object.values(errors).flat()[0] : 'تعذّر إضافة المالك');
    } finally { setSavingOwner(false); }
  };
  const [triedSave, setTriedSave] = useState(false);

  // أنواع العقارات من الإعدادات (مش قائمة ثابتة)
  const { data: typesData } = useQuery({
    queryKey: ['lookup-property-types'],
    queryFn: () => lookupApi.propertyTypes().then(r => r.data),
    staleTime: 300_000,
  });
  const propertyTypeOptions = (Array.isArray(typesData?.data) ? typesData.data : Array.isArray(typesData) ? typesData : [])
    .filter(t => t.is_active !== false || String(t.id) === String(form.property_type_id))
    .map(t => ({ value: String(t.id), label: t.name }));

  const handleSave = async () => {
    // فحص كل التابات، وبيوقف على أول تاب فيه غلط
    setTriedSave(true);
    if (validateTabs(TAB_KEYS)) return;
    setLoading(true);
    try {
      if (editing) await propertiesApi.update(editing.id, form);
      else         await propertiesApi.create(form);
      toast.success(editing ? 'تم التحديث' : 'تم إضافة العقار');
      qc.invalidateQueries(['properties']);
      onClearDraft?.();
      onClose();
    } catch (err) {
      const serverErrors = err.response?.data?.errors;
      if (serverErrors) {
        const mapped = Object.fromEntries(Object.entries(serverErrors).map(([k, v]) => [k, [].concat(v)[0]]));
        setErrors(mapped);
        const firstField = Object.keys(mapped).find(k => FIELD_TAB[k]) || Object.keys(mapped)[0];
        if (FIELD_TAB[firstField]) setTab(FIELD_TAB[firstField]);
        toast.error(mapped[firstField], { id: 'property-form-validation' });
      } else {
        toast.error(err.response?.data?.message || 'تعذّر حفظ العقار، حاول مرة تانية');
      }
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
    basic:    !!form.name && !!form.property_type_id,
    location: true,
    owner:    true,
    details:  true,
    media:    true,
  };

  return (
    <Modal open={open} onClose={handleClose}
      title={editing ? 'تعديل بيانات العقار' : 'إضافة عقار جديد'}
      width="max-w-3xl"
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
          {/* التنقل بين التابات */}
          <div className="flex gap-2">
            {tabIdx > 0 && (
              <Btn variant="outline" className="flex-1 sm:flex-none justify-center" onClick={() => setTab(TAB_KEYS[tabIdx - 1])}>
                <ChevronRight size={14}/> السابق
              </Btn>
            )}
            {tabIdx < TAB_KEYS.length - 1 && (
              <Btn variant="outline" className="flex-1 sm:flex-none justify-center" onClick={() => goToTab(TAB_KEYS[tabIdx + 1])}>
                التالي <ChevronLeft size={14}/>
              </Btn>
            )}
          </div>
          {/* أزرار الحفظ والإلغاء */}
          <div className="flex gap-2">
            <Btn onClick={handleSave} loading={loading} className="flex-1 sm:flex-none justify-center">
              💾 {editing ? 'حفظ التعديلات' : 'إضافة العقار'}
            </Btn>
            <Btn variant="outline" onClick={handleClose}>إلغاء</Btn>
          </div>
        </div>
      }>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1 mb-5 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => goToTab(t.key)}
            className={`flex-1 whitespace-nowrap px-2.5 py-2 rounded-md text-xs font-semibold transition-all relative ${
              tab === t.key ? 'bg-gray-700 text-gray-100' : 'text-gray-400 hover:text-gray-200'
            }`}>
            {t.label}
            {/* نقطة خضراء إذا التاب مكتمل، وحمرا إذا ناقص بعد محاولة الحفظ */}
            {Object.keys(TAB_RULES[t.key]({})).some(k => errors[k]) ? (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            ) : tabComplete[t.key] && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400" />
            )}
          </button>
        ))}
      </div>

      {/* Tab: المعلومات الأساسية */}
      {tab === 'basic' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input error={errors.name} label="اسم العقار *"    value={form.name}        onChange={e => set('name', e.target.value)} />
          <Select error={errors.property_type_id} label="نوع العقار *"   value={form.property_type_id ? String(form.property_type_id) : ''} onChange={e => set('property_type_id', e.target.value)}
            options={propertyTypeOptions} />
          <Select label="نوع التسويق"    value={form.marketing_type_id} onChange={e => set('marketing_type_id', e.target.value)}
            options={[{value:'1',label:'ملاك أفراد'},{value:'2',label:'مزادات'},{value:'3',label:'مشاريع على الخارطة'},{value:'4',label:'مشاريع جاهزة'}]} />
          <Select label="الاستخدام"      value={form.usage_type_id} onChange={e => set('usage_type_id', e.target.value)}
            options={[{value:'1',label:'سكني'},{value:'2',label:'تجاري'},{value:'3',label:'سكني تجاري'},{value:'4',label:'مستودعات'},{value:'5',label:'زراعي'}]} />
          <Select label="الحالة"         value={form.status} onChange={e => set('status', e.target.value)}
            options={['متاح','محجوز','مباع','قيد المراجعة'].map(v => ({ value: v, label: v }))} />
          <MoneyInput error={errors.listed_price} label="السعر المعروض (ريال)" value={form.listed_price} onChange={e => set('listed_price', e.target.value)} />
          <MoneyInput error={errors.net_price} label="السعر الصافي (ريال)"  value={form.net_price}    onChange={e => set('net_price', e.target.value)} />
          <MoneyInput error={errors.total_area} label="المساحة (م²)"     value={form.total_area}   onChange={e => set('total_area', e.target.value)} />
          <Select label="هل انعمل عقد وساطة؟" clearable={false}
            value={form.has_brokerage_contract ? 'نعم' : 'لا'}
            onChange={e => set('has_brokerage_contract', e.target.value === 'نعم')}
            options={[{ value: 'نعم', label: 'نعم' }, { value: 'لا', label: 'لا' }]} />
          <Input error={errors.license_number} label="رقم الترخيص" value={form.license_number || ''} onChange={e => set('license_number', e.target.value)} dir="ltr" />
        </div>
      )}

      {/* Tab: الموقع */}
      {tab === 'location' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="المدينة" value={form.city_id}
            onChange={e => { set('city_id', e.target.value); set('neighborhood_id', ''); }}
            options={(citiesData || []).map(c => ({ value: String(c.id), label: c.name }))} />
          <Select label="الحي" value={form.neighborhood_id}
            onChange={e => set('neighborhood_id', e.target.value)}
            options={(neighborhoodsData || []).map(n => ({ value: String(n.id), label: n.name }))}
            disabled={!form.city_id} />
          <Input error={errors.plan_number} label="رقم المخطط" value={form.plan_number || ''} onChange={e => set('plan_number', e.target.value)} dir="ltr" />
          <Input error={errors.plot_number} label="رقم القطعة" value={form.plot_number || ''} onChange={e => set('plot_number', e.target.value)} dir="ltr" />
          <Input error={errors.street_width} label="عرض الشارع (متر)" value={form.street_width || ''} onChange={e => set('street_width', e.target.value)}
            type="number" min="0" step="0.5" placeholder="مثلاً 20" />
          <Select label="الاتجاه" value={form.direction || ''} onChange={e => set('direction', e.target.value)}
            options={['شمالية','جنوبية','شرقية','غربية','شمالية شرقية','شمالية غربية','جنوبية شرقية','جنوبية غربية','وسطى'].map(v => ({ value: v, label: v }))} />
          <div className="sm:col-span-2 space-y-1">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">
              واجهة العقار <span className="normal-case font-normal text-gray-500">(اختار أكتر من وحدة إذا العقار زاوية)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {FACADES.map(f => {
                const on = parseFacade(form.facade).includes(f);
                return (
                  <button key={f} type="button" onClick={() => set('facade', toggleFacade(form.facade, f))}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors
                      ${on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}>
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Input error={errors.map_url} label="رابط الموقع (Google Maps)" value={form.map_url || ''} onChange={e => set('map_url', e.target.value)} />
          </div>
          <Input error={errors.latitude} label="خط الطول" value={form.latitude  || ''} onChange={e => set('latitude',  e.target.value)} type="number" />
          <Input error={errors.longitude} label="خط العرض" value={form.longitude || ''} onChange={e => set('longitude', e.target.value)} type="number" />
          <div className="sm:col-span-2">
            <Textarea label="المواقع القريبة" value={form.nearby_places || ''} onChange={e => set('nearby_places', e.target.value)} placeholder="مدارس، مساجد، أسواق..." />
          </div>
        </div>
      )}

      {/* Tab: المالك */}
      {tab === 'owner' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">مالك العقار <span className="normal-case font-normal text-gray-500">(اختياري)</span></label>
            {!selectedOwner && (
              <input
                value={ownerSearch}
                onChange={e => { setOwnerSearch(e.target.value); set('owner_id', ''); setSelectedOwner(null); }}
                placeholder="اكتب اسم المالك أو رقمه أو الكود…"
                autoFocus
                className={`w-full bg-gray-800 border rounded-lg px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-blue-500
                  ${errors.owner_id ? 'border-red-500' : 'border-gray-700'}`}
              />
            )}
            {errors.owner_id && <p className="text-xs text-red-400">{errors.owner_id}</p>}
            {!selectedOwner && (
              <p className="text-xs text-gray-500">
                {ownerSearch.length < 2
                  ? 'اكتب حرفين على الأقل، وبعدين اضغط على اسم المالك من القائمة اللي بتطلع.'
                  : ownersFetching ? 'عم يبحث…'
                  : ownerResults.length > 0 ? <span className="text-amber-300">👆 اضغط على اسم المالك من القائمة لتختاره — الكتابة لحالها ما بتكفي.</span>
                  : null}
              </p>
            )}
            {/* ما في نتائج: إضافة مالك جديد من هون */}
            {!selectedOwner && ownerSearch.length >= 2 && !ownersFetching && ownerResults.length === 0 && !newOwner && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-200">
                ما لقينا مالك بهالاسم.
                <Btn size="sm" onClick={() => setNewOwner({ name: ownerSearch, phone: '', whatsapp: '', type: 'مالك' })}>
                  <Plus size={14}/> إضافة "{ownerSearch}" كمالك جديد
                </Btn>
              </div>
            )}
            {!selectedOwner && newOwner && (
              <div className="p-3 rounded-lg bg-gray-800 border border-blue-500/40 space-y-3">
                <p className="text-sm font-semibold text-gray-100">مالك جديد</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="الاسم" value={newOwner.name} onChange={e => setNewOwner(o => ({ ...o, name: e.target.value }))} />
                  <Input label="رقم الجوال *" value={newOwner.phone} onChange={e => setNewOwner(o => ({ ...o, phone: e.target.value }))} dir="ltr" placeholder="05xxxxxxxx" />
                  <Input dir="ltr" label="رقم الواتساب *" value={newOwner.whatsapp || ''} onChange={e => setNewOwner(o => ({ ...o, whatsapp: e.target.value }))} placeholder="05xxxxxxxx" />
                  <Select label="الصفة" clearable={false} value={newOwner.type} onChange={e => setNewOwner(o => ({ ...o, type: e.target.value }))}
                    options={['مالك','وكيل','وسيط','مكتب','مطور','مشروع'].map(v => ({ value: v, label: v }))} />
                </div>
                <div className="flex gap-2">
                  <Btn size="sm" loading={savingOwner} onClick={createOwner}>حفظ المالك واختياره</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setNewOwner(null)}>إلغاء</Btn>
                </div>
                <p className="text-xs text-gray-500">باقي بيانات المالك بتقدر تكمّلها بعدين من صفحة الملاك.</p>
              </div>
            )}
            {ownerResults.length > 0 && !selectedOwner && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden mt-1">
                {ownerResults.slice(0, 8).map(owner => (
                  <div key={owner.id} onClick={() => handleOwnerSelect(owner)}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-0">
                    <Avatar name={owner.name} size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-gray-100">{owner.name || <span className="text-gray-500 font-normal">بدون اسم</span>}</p>
                      <p className="text-xs text-gray-500">{owner.owner_code} · <PhoneText value={owner.phone} /></p>
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
                    <p className="font-bold text-gray-100">{selectedOwner.name || <span className="text-gray-500 font-normal">بدون اسم</span>}</p>
                    <p className="text-xs text-gray-400">{selectedOwner.owner_code} · <PhoneText value={selectedOwner.phone} /></p>
                  </div>
                </div>
                <Btn size="sm" variant="ghost" onClick={() => { setSelectedOwner(null); setOwnerSearch(''); set('owner_id', ''); }}>
                  تغيير
                </Btn>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Select label="صفة المعلن"   value={form.advertiser_role}   onChange={e => set('advertiser_role', e.target.value)}
              options={['مالك','وكيل','مطور'].map(v => ({ value: v, label: v }))} />
            <Select label="حالة الرهن"   value={form.mortgage_status}   onChange={e => set('mortgage_status', e.target.value)}
              options={['مرهون','غير مرهون'].map(v => ({ value: v, label: v }))} />
            {form.mortgage_status === 'مرهون' && (
              <MoneyInput error={errors.mortgage_amount} label="مبلغ الرهن" value={form.mortgage_amount} onChange={e => set('mortgage_amount', e.target.value)} />
            )}
            <Select label="حالة التأجير" value={form.rental_status}    onChange={e => set('rental_status', e.target.value)}
              options={['مؤجر','غير مؤجر','جزئي'].map(v => ({ value: v, label: v }))} />
            {form.rental_status !== 'غير مؤجر' && (
              <MoneyInput error={errors.annual_income} label="الإيراد السنوي" value={form.annual_income} onChange={e => set('annual_income', e.target.value)} />
            )}
          </div>
        </div>
      )}

      {/* Tab: التفاصيل */}
      {tab === 'details' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Input error={errors.rooms_count} label="عدد الغرف"      value={form.rooms_count}     onChange={e => set('rooms_count',     e.target.value)} type="number" />
          <Input error={errors.bathrooms_count} label="عدد الحمامات"   value={form.bathrooms_count} onChange={e => set('bathrooms_count', e.target.value)} type="number" />
          <Input error={errors.halls_count} label="عدد الصالات"    value={form.halls_count}     onChange={e => set('halls_count',     e.target.value)} type="number" />
          <Input error={errors.floors_count} label="عدد الأدوار"    value={form.floors_count}    onChange={e => set('floors_count',    e.target.value)} type="number" />
          <Input error={errors.building_age} label="عمر العقار (سنة)" value={form.building_age}  onChange={e => set('building_age',    e.target.value)} type="number" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="حالة التصوير"  value={form.photo_status}     onChange={e => set('photo_status',     e.target.value)} options={mediaOpts} />
            <Select label="حالة التصميم"  value={form.design_status}    onChange={e => set('design_status',    e.target.value)} options={mediaOpts} />
            <Select label="حالة الفيديو"  value={form.video_status}     onChange={e => set('video_status',     e.target.value)} options={mediaOpts} />
            <Select label="حالة النشر"    value={form.marketing_status} onChange={e => set('marketing_status', e.target.value)} options={mediaOpts} />
            <Input error={errors.photos_url}  label="رابط الصور"    value={form.photos_url || ''} onChange={e => set('photos_url', e.target.value)} placeholder="https://..." />
            <Input error={errors.video_url}  label="رابط الفيديو"  value={form.video_url  || ''} onChange={e => set('video_url',  e.target.value)} placeholder="https://..." />
            <Input error={errors.commission_rate}  label="العمولة (%)"   value={form.commission_rate}  onChange={e => set('commission_rate', e.target.value)} type="number" />
          </div>
          <Suspense fallback={<Loading />}>
            <RichTextEditor label="وصف العقار"    value={form.description || ''} onChange={v => set('description', v)} minHeight={160} />
            <RichTextEditor label="مميزات العقار" value={form.features    || ''} onChange={v => set('features',    v)} minHeight={110} />
            <RichTextEditor label="مكونات العقار" value={form.components  || ''} onChange={v => set('components',  v)} minHeight={110} />
          </Suspense>
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
const fmt = (n) => n ? Number(n).toLocaleString('en-US') : '—';

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
            <p className="text-xs text-gray-500">{formatMoney(p.total_area)} م² •{fmt(p.price_per_meter)} ريال/م²</p>
          </div>
        </div>
        <MediaBar photo={p.photo_status} design={p.design_status} video={p.video_status} marketing={p.marketing_status} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">

        {/* ─── العمود الأيمن ─── */}
        <div>
          <SectionTitle>الموقع</SectionTitle>
          <InfoRow label="المدينة"       value={p.city?.name} />
          <InfoRow label="الحي"          value={p.neighborhood?.name} />
          <InfoRow label="رقم المخطط"    value={p.plan_number} />
          <InfoRow label="رقم القطعة"    value={p.plot_number} />
          {p.street && <InfoRow label="الشارع" value={p.street} />}
          <InfoRow label="عرض الشارع"    value={Number(p.street_width) ? `${Number(p.street_width)} م` : null} />
          <InfoRow label="الاتجاه"       value={p.direction} />
          <InfoRow label="الواجهة"       value={p.facade} />
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
          <InfoRow label="عقد الوساطة"   value={p.has_brokerage_contract ? 'تم ✓' : 'لا'}
            valueClass={p.has_brokerage_contract ? 'text-green-400' : 'text-gray-400'} />
          <InfoRow label="رقم الترخيص"   value={p.license_number} />
          <InfoRow label="المساحة"       value={p.total_area ? `${formatMoney(p.total_area)} م²` : null} />
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
          {!p.owner ? (
            <p className="bg-gray-800 rounded-xl p-3 mb-3 text-sm text-gray-500">لم يُحدَّد مالك لهذا العقار</p>
          ) : (
          <div className="bg-gray-800 rounded-xl p-3 mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={p.owner?.name || ''} size="md" />
                <div>
                  <p className="font-bold text-gray-100 text-sm">{p.owner?.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{p.owner?.owner_code}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Phone size={10}/> <PhoneText value={p.owner?.phone} />
                  </p>
                  {p.owner?.whatsapp && p.owner.whatsapp !== p.owner.phone && (
                    <p className="text-xs text-green-400 flex items-center gap-1">
                      <MessageCircle size={10}/> <PhoneText value={p.owner.whatsapp} />
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
          )}
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
              <InfoRow label="الهاتف" value={<PhoneText value={p.assignedEmployee.phone} />} />
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
              <RichText html={p.description} className="text-sm text-gray-300 bg-gray-800 rounded-xl p-3" />
            </div>
          )}
          {p.features && (
            <div>
              <SectionTitle>المميزات</SectionTitle>
              <RichText html={p.features} className="text-sm text-gray-300 bg-gray-800 rounded-xl p-3" />
            </div>
          )}
          {p.components && (
            <div>
              <SectionTitle>المكونات</SectionTitle>
              <RichText html={p.components} className="text-sm text-gray-300 bg-gray-800 rounded-xl p-3" />
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
