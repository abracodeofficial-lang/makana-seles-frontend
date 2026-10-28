import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  MessageCircle, Users, UserCheck, Send, SkipForward, RotateCcw, Save, Trash2,
  History, Plus, ListChecks, Timer, CheckCircle2, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/Layout';
import { broadcastApi, lookupApi } from '../../api/services';
import useAuthStore from '../../store/authStore';
import {
  Btn, Badge, Input, Select, Textarea, Modal, Card, Loading, ProgressBar, StatCard,
} from '../../components/ui';

// ── ثوابت ─────────────────────────────────────────────────────────
const AUDIENCES = {
  leads:  { label: 'المهتمين', icon: UserCheck },
  owners: { label: 'الملاك',   icon: Users },
};
const OWNER_TYPES        = ['مالك', 'وكيل', 'وسيط', 'مكتب', 'مطور', 'مشروع'];
const CLASSIFICATIONS    = ['جاد', 'استفسار', 'بحث'];
const REQUEST_STATUSES   = ['مفتوح', 'مغلق'];
const OPERATION_STATUSES = ['يبغى تواصل هاتفي', 'عنده استفسارات أكثر', 'اهتمام مبدئي'];
const DIRECTIONS         = ['شمالية','جنوبية','شرقية','غربية','شمالية شرقية','شمالية غربية','جنوبية شرقية','جنوبية غربية','وسطى'];
const opts = (arr) => arr.map(v => ({ value: v, label: v }));

const DAILY_SAFE_LIMIT = 50;
const STATUS_BADGE = {
  pending: ['بالانتظار', 'gray'], sending: ['جاري الإرسال', 'blue'], sent: ['انبعتت', 'green'],
  skipped: ['تخطّي', 'amber'], failed: ['فشل', 'red'],
};

// 0501234567 → 966501234567
const waPhone = (p = '') => {
  let d = String(p).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  return d.startsWith('966') ? d : d.startsWith('0') ? '966' + d.slice(1) : '966' + d;
};
const fillMessage = (msg, r) => msg.replaceAll('{الاسم}', (r?.name || '').trim() || 'عميلنا العزيز');
const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent);

const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// رابط فتح المحادثة: واتساب ويب على الكمبيوتر (بيفتح بنفس التبويب كل مرة)، أو التطبيق على الموبايل
const chatUrl = (mode, phone, text) => mode === 'web'
  ? `https://web.whatsapp.com/send?phone=${waPhone(phone)}&text=${encodeURIComponent(text)}`
  : `https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(text)}`;

// ════════════════════════════════════════════════════════════════
export default function BroadcastPage() {
  const { can } = useAuthStore();
  const allowed = Object.keys(AUDIENCES).filter(a => can(a, 'view'));

  const [audience, setAudience]     = useState(allowed[0]);
  const [view, setView]             = useState('compose');   // compose | history | run
  const [campaignId, setCampaignId] = useState(null);
  const [gatewayOpen, setGatewayOpen] = useState(false);

  if (allowed.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-500 text-sm">🔒 ليس لديك صلاحية على الملاك أو المهتمين</div>;
  }

  const openCampaign = (id) => { setCampaignId(id); setView('run'); };

  return (
    <div>
      <PageHeader
        title="رسائل واتساب جماعية"
        subtitle="رسالة وحدة لمجموعة عملاء — بتنبعت من واتساب الموظف بفواصل زمنية آمنة"
        actions={
          <div className="flex flex-wrap gap-2">
            <GatewayButton onClick={() => setGatewayOpen(true)} />
            <Btn variant={view === 'history' ? 'primary' : 'outline'} onClick={() => setView('history')}>
              <History size={15} /> سجل الحملات
            </Btn>
            <Btn variant={view === 'compose' ? 'primary' : 'outline'} onClick={() => setView('compose')}>
              <Plus size={15} /> حملة جديدة
            </Btn>
          </div>
        }
      />

      <div className="p-4 sm:p-6 space-y-5">
        {view !== 'run' && (
          <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl w-full sm:w-fit">
            {allowed.map(a => {
              const Icon = AUDIENCES[a].icon;
              return (
                <button key={a} onClick={() => setAudience(a)}
                  className={`flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors
                    ${audience === a ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}>
                  <Icon size={15} /> {AUDIENCES[a].label}
                </button>
              );
            })}
          </div>
        )}

        {view === 'compose' && <Composer key={audience} audience={audience} onCreated={openCampaign} />}
        {view === 'history' && <HistoryView audience={audience} onOpen={openCampaign} />}
        {view === 'run' && campaignId && <Runner id={campaignId} onBack={() => setView('history')} onOpenGateway={() => setGatewayOpen(true)} />}
      </div>

      <GatewayModal open={gatewayOpen} onClose={() => setGatewayOpen(false)} />
    </div>
  );
}

// ── ربط الواتساب (برنامج كمبيوتر المكتب) ─────────────────────────
const GATEWAY_LABEL = {
  connected:  ['متصل', 'green'],
  qr:         ['بانتظار مسح الكود', 'amber'],
  connecting: ['عم يتصل…', 'amber'],
  logged_out: ['بانتظار مسح الكود', 'amber'],
  offline:    ['غير مربوط', 'gray'],
};

function useGateway(fast = false) {
  return useQuery({
    queryKey: ['wa-gateway'],
    queryFn: () => broadcastApi.gateway().then(r => r.data.data),
    refetchInterval: fast ? 3_000 : 15_000,
  });
}

function GatewayButton({ onClick }) {
  const { data } = useGateway();
  const [label, color] = GATEWAY_LABEL[data?.status || 'offline'];
  const dot = { green: 'bg-green-500', amber: 'bg-amber-500 animate-pulse', gray: 'bg-gray-500' }[color];
  return (
    <Btn variant="outline" onClick={onClick}>
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      ربط واتساب{data?.status === 'connected' && data.phone ? ` (${data.phone})` : ` — ${label}`}
    </Btn>
  );
}

function QrImage({ value }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    import('qrcode').then(({ default: QR }) =>
      QR.toDataURL(value, { width: 260, margin: 1, color: { dark: '#19130F', light: '#FFFFFF' } }))
      .then(url => alive && setSrc(url));
    return () => { alive = false; };
  }, [value]);
  return src
    ? <img src={src} alt="QR" className="w-[260px] h-[260px] rounded-xl bg-white p-2" />
    : <div className="w-[260px] h-[260px] rounded-xl bg-gray-800 animate-pulse" />;
}

function GatewayModal({ open, onClose }) {
  const qc = useQueryClient();
  const { data: g, isLoading } = useGateway(open);
  const [form, setForm] = useState(null);
  useEffect(() => { if (open && g && !form) setForm(g.settings); }, [open, g, form]);
  useEffect(() => { if (!open) setForm(null); }, [open]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['wa-gateway'] });
  const save = useMutation({
    mutationFn: (data) => broadcastApi.gatewaySettings(data),
    onSuccess: () => { toast.success('تم حفظ الإعدادات'); refresh(); },
    onError: (e) => toast.error(e.response?.data?.message || 'تعذّر الحفظ'),
  });
  const logout = useMutation({
    mutationFn: () => broadcastApi.gatewayLogout(),
    onSuccess: () => toast.success('رح ينفصل الرقم خلال ثواني ويطلع كود جديد'),
  });
  const regen = useMutation({
    mutationFn: () => broadcastApi.gatewayToken(),
    onSuccess: () => { toast.success('تم تجديد المفتاح — نزّل البرنامج من جديد'); refresh(); },
  });
  const download = useMutation({
    mutationFn: () => broadcastApi.gatewayDownload(),
    onSuccess: (r) => {
      const url = URL.createObjectURL(r.data);
      const a = Object.assign(document.createElement('a'), { href: url, download: 'makana-whatsapp.zip' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
    },
    onError: () => toast.error('تعذّر تنزيل البرنامج'),
  });

  const status = g?.status || 'offline';
  const [label, color] = GATEWAY_LABEL[status];

  return (
    <Modal open={open} onClose={onClose} title="ربط واتساب للإرسال التلقائي" width="max-w-2xl">
      {isLoading || !g ? <Loading /> : (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-800 border border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-200">
              الحالة: <Badge label={label} color={color} />
              {status === 'connected' && <span className="font-mono text-gray-300" dir="ltr">+{g.phone}</span>}
            </div>
            {g.last_seen && <span className="text-xs text-gray-500">آخر اتصال: {new Date(g.last_seen).toLocaleTimeString('en-GB')}</span>}
          </div>

          {/* غير مربوط: خطوات التشغيل */}
          {status === 'offline' && (
            <div className="space-y-3 text-sm text-gray-300">
              <p>الإرسال التلقائي بيشتغل من خلال برنامج صغير على <b className="text-gray-100">كمبيوتر بالمكتب بيضل شغال</b>. خطوات أول مرة:</p>
              <ol className="list-decimal pr-5 space-y-1.5 text-gray-300">
                <li>ثبّت <a className="text-blue-400 hover:underline" href="https://nodejs.org" target="_blank" rel="noreferrer">Node.js</a> (نسخة LTS) على الكمبيوتر.</li>
                <li>نزّل البرنامج من الزر تحت، وفك الضغط بمكان ثابت (مثلاً <span dir="ltr" className="font-mono">C:\makana-whatsapp</span>).</li>
                <li>شغّل <span className="font-mono">start.bat</span> — أول مرة بياخد دقيقة.</li>
                <li>ارجع لهون: رح يطلع كود QR تمسحه من الموبايل.</li>
                <li>(مستحسن) شغّل <span className="font-mono">install-startup.bat</span> مرة وحدة ليشتغل البرنامج لحاله مع الكمبيوتر.</li>
              </ol>
              {g.can_manage ? (
                <Btn loading={download.isPending} onClick={() => download.mutate()}>تنزيل البرنامج (makana-whatsapp.zip)</Btn>
              ) : (
                <p className="text-xs text-amber-300">تنزيل البرنامج وربطه بيحتاج صلاحية تعديل الإعدادات.</p>
              )}
              {g.last_seen && <p className="text-xs text-amber-300">⚠️ البرنامج كان شغال وانقطع — تأكد إن الكمبيوتر شغال والبرنامج مفتوح.</p>}
            </div>
          )}

          {/* بانتظار المسح */}
          {(status === 'qr' || status === 'connecting' || status === 'logged_out') && (
            <div className="flex flex-col sm:flex-row items-center gap-5">
              {g.qr ? <QrImage value={g.qr} /> : <div className="w-[260px] h-[260px] rounded-xl bg-gray-800 flex items-center justify-center text-sm text-gray-500">عم يجهّز الكود…</div>}
              <ol className="list-decimal pr-5 space-y-2 text-sm text-gray-300">
                <li>افتح واتساب على الموبايل اللي عليه <b className="text-gray-100">رقم الحملات</b>.</li>
                <li>الإعدادات ← <b className="text-gray-100">الأجهزة المرتبطة</b> ← ربط جهاز.</li>
                <li>امسح الكود. الكود بيتجدد لحاله كل كم ثانية.</li>
              </ol>
            </div>
          )}

          {/* متصل: إعدادات الإرسال */}
          {status === 'connected' && form && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard label="انبعت اليوم" value={`${g.sent_today} / ${g.settings.daily_limit}`} color="green" icon={<Send size={16} className="text-green-400" />} />
                <StatCard label="ساعات الإرسال" value={<span dir="ltr">{g.settings.work_start}–{g.settings.work_end}</span>} icon={<Timer size={16} className="text-blue-400" />} />
                <StatCard label="الحالة" value={g.settings.paused ? 'موقوف' : 'شغال'} color={g.settings.paused ? 'red' : 'green'} icon={<CheckCircle2 size={16} />} />
              </div>
              {g.can_manage && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input label="الحد اليومي" type="number" min={1} value={form.daily_limit} onChange={e => setForm(f => ({ ...f, daily_limit: e.target.value }))} />
                    <Input label="من الساعة" type="time" value={form.work_start} onChange={e => setForm(f => ({ ...f, work_start: e.target.value }))} />
                    <Input label="لحد الساعة" type="time" value={form.work_end} onChange={e => setForm(f => ({ ...f, work_end: e.target.value }))} />
                  </div>
                  <p className="text-xs text-gray-500">
                    بالبداية خلّي الحد اليومي 50 أو أقل، وزيده تدريجياً. الفاصل بين الرسائل بيتحدد لكل حملة.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Btn loading={save.isPending} onClick={() => save.mutate({ ...form, daily_limit: Number(form.daily_limit) })}>حفظ الإعدادات</Btn>
                    <Btn variant="outline" onClick={() => save.mutate({ paused: !g.settings.paused })}>
                      {g.settings.paused ? 'استئناف كل الإرسال' : 'إيقاف كل الإرسال مؤقتاً'}
                    </Btn>
                    <Btn variant="ghost" loading={logout.isPending}
                      onClick={() => confirm('فصل الرقم عن النظام؟ الإرسال التلقائي بيوقف لحد ما تمسح كود جديد.') && logout.mutate()}>
                      فصل الرقم
                    </Btn>
                  </div>
                </>
              )}
            </div>
          )}

          {g.can_manage && status !== 'offline' && (
            <div className="pt-3 border-t border-gray-800 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <Btn size="sm" variant="ghost" loading={download.isPending} onClick={() => download.mutate()}>تنزيل البرنامج من جديد</Btn>
              <Btn size="sm" variant="ghost" loading={regen.isPending}
                onClick={() => confirm('تجديد مفتاح الربط؟ البرنامج الحالي بيوقف لحد ما تنزّل النسخة الجديدة.') && regen.mutate()}>
                تجديد مفتاح الربط
              </Btn>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── إنشاء حملة: اختيار المستلمين + كتابة الرسالة ───────────────────
function Composer({ audience, onCreated }) {
  const qc = useQueryClient();
  const [filters, setFilters]   = useState({});
  const [debounced, setDebounced] = useState({});
  const [listId, setListId]     = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [message, setMessage]   = useState(() => store.get('broadcast-draft', 'السلام عليكم {الاسم}،\n'));
  const [delays, setDelays]     = useState(() => store.get('broadcast-delays', { min: 30, max: 90 }));
  const [saveOpen, setSaveOpen] = useState(false);
  const textRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(filters), 350); return () => clearTimeout(t); }, [filters]);
  useEffect(() => { store.set('broadcast-draft', message); }, [message]);
  useEffect(() => { store.set('broadcast-delays', delays); }, [delays]);

  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v || undefined }));

  const { data: cities = [] } = useQuery({
    queryKey: ['cities'], queryFn: () => lookupApi.cities().then(r => r.data), staleTime: 600_000,
  });
  const { data: lists = [] } = useQuery({
    queryKey: ['broadcast-lists', audience],
    queryFn: () => broadcastApi.lists(audience).then(r => r.data.data),
  });
  const { data, isLoading } = useQuery({
    queryKey: ['broadcast-recipients', audience, debounced, listId],
    queryFn: () => broadcastApi.recipients({ audience, ...debounced, list_id: listId || undefined }).then(r => r.data.data),
    placeholderData: keepPreviousData,
  });
  const items = data?.items || [];
  const withPhone = items.filter(i => i.phone);
  const allChecked = withPhone.length > 0 && withPhone.every(i => selected.has(i.id));

  const toggle = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(s => {
    const n = new Set(s);
    withPhone.forEach(i => (allChecked ? n.delete(i.id) : n.add(i.id)));
    return n;
  });

  const currentList = lists.find(l => String(l.id) === String(listId));

  const removeFromList = useMutation({
    mutationFn: () => broadcastApi.updateList(listId, { remove_ids: [...selected] }),
    onSuccess: () => {
      toast.success('تمت إزالتهم من القائمة');
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['broadcast-lists', audience] });
      qc.invalidateQueries({ queryKey: ['broadcast-recipients', audience] });
    },
  });
  const deleteList = useMutation({
    mutationFn: () => broadcastApi.deleteList(listId),
    onSuccess: () => {
      toast.success('تم حذف القائمة');
      setListId('');
      qc.invalidateQueries({ queryKey: ['broadcast-lists', audience] });
    },
  });
  const create = useMutation({
    mutationFn: () => broadcastApi.createCampaign({
      audience, message, contact_ids: [...selected],
      min_delay: Number(delays.min) || 30, max_delay: Number(delays.max) || 90,
    }),
    onSuccess: (r) => {
      toast.success('تم إنشاء الحملة');
      qc.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      onCreated(r.data.data.id);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'تعذّر إنشاء الحملة'),
  });

  const insertVar = (v) => {
    const el = textRef.current;
    if (!el) return setMessage(m => m + v);
    const { selectionStart: s, selectionEnd: e } = el;
    setMessage(m => m.slice(0, s) + v + m.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + v.length, s + v.length); });
  };

  const firstSelected = items.find(i => selected.has(i.id));
  const count = selected.size;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
      {/* المستلمين */}
      <Card className="xl:col-span-3" title={`اختيار ${AUDIENCES[audience].label}`}
        action={<span className="text-xs text-gray-400">المحددين: <b className="text-blue-400">{count}</b></span>}>
        <div className="p-4 space-y-4">
          {/* قائمة محفوظة */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <Select label="قائمة محفوظة" value={listId} onChange={e => { setListId(e.target.value); setSelected(new Set()); }}
                options={lists.map(l => ({ value: l.id, label: `${l.name} (${l.members_count})` }))} />
            </div>
            {currentList && (
              <>
                <Btn variant="outline" size="sm" disabled={!count} loading={removeFromList.isPending}
                  onClick={() => removeFromList.mutate()}>إزالة المحددين من القائمة</Btn>
                <Btn variant="ghost" size="sm" loading={deleteList.isPending}
                  onClick={() => confirm(`حذف القائمة "${currentList.name}"؟ (العملاء نفسهم ما بينحذفوا)`) && deleteList.mutate()}>
                  <Trash2 size={14} /> حذف القائمة
                </Btn>
              </>
            )}
          </div>

          {/* فلاتر */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Input label="بحث" placeholder="اسم، كود، رقم…" value={filters.search || ''} onChange={e => setF('search', e.target.value)} />
            <Select label="المدينة" value={filters.city_id || ''} onChange={e => setF('city_id', e.target.value)}
              options={cities.map(c => ({ value: c.id, label: c.name }))} />
            {audience === 'owners' ? (
              <Select label="النوع" value={filters.type || ''} onChange={e => setF('type', e.target.value)} options={opts(OWNER_TYPES)} />
            ) : (
              <>
                <Select label="التصنيف" value={filters.classification || ''} onChange={e => setF('classification', e.target.value)} options={opts(CLASSIFICATIONS)} />
                <Select label="حالة الطلب" value={filters.request_status || ''} onChange={e => setF('request_status', e.target.value)} options={opts(REQUEST_STATUSES)} />
                <Select label="حالة الأوبريشن" value={filters.operation_status || ''} onChange={e => setF('operation_status', e.target.value)} options={opts(OPERATION_STATUSES)} />
              </>
            )}
            <Select label="الاتجاه" value={filters.direction || ''} onChange={e => setF('direction', e.target.value)} options={opts(DIRECTIONS)} />
          </div>

          {/* شريط التحديد */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
              <input type="checkbox" className="accent-blue-500 w-4 h-4" checked={allChecked} onChange={toggleAll} />
              تحديد الكل الظاهرين ({withPhone.length})
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">
                {data ? `${data.total} نتيجة${data.total > data.limit ? ` (معروض أول ${data.limit})` : ''}` : ''}
              </span>
              {count > 0 && <Btn variant="ghost" size="sm" onClick={() => setSelected(new Set())}>إلغاء التحديد</Btn>}
              <Btn variant="outline" size="sm" disabled={!count} onClick={() => setSaveOpen(true)}>
                <Save size={13} /> {currentList ? 'إضافة لقائمة' : 'حفظ كقائمة'}
              </Btn>
            </div>
          </div>

          {/* النتائج */}
          <div className="border border-gray-700 rounded-lg max-h-[420px] overflow-y-auto divide-y divide-gray-800">
            {isLoading ? <Loading /> : items.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-10">لا يوجد نتائج</p>
            ) : items.map(i => (
              <label key={i.id}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm ${i.phone ? 'cursor-pointer hover:bg-gray-700/40' : 'opacity-50'}`}>
                <input type="checkbox" className="accent-blue-500 w-4 h-4 flex-shrink-0" disabled={!i.phone}
                  checked={selected.has(i.id)} onChange={() => toggle(i.id)} />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-100 font-semibold truncate">{i.name}</p>
                  <p className="text-xs text-gray-500">{i.code}{i.city ? ` · ${i.city}` : ''}</p>
                </div>
                <span className="text-xs font-mono text-gray-400" dir="ltr">{i.phone || 'بدون رقم'}</span>
              </label>
            ))}
          </div>
        </div>
      </Card>

      {/* الرسالة */}
      <Card className="xl:col-span-2" title="الرسالة">
        <div className="p-4 space-y-4">
          <div>
            <Textarea ref={textRef} rows={8} label="نص الرسالة" value={message} onChange={e => setMessage(e.target.value)} />
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
              إدراج:
              <button onClick={() => insertVar('{الاسم}')}
                className="px-2 py-1 rounded-md bg-blue-500/15 text-blue-300 hover:bg-blue-500/25">{'{الاسم}'}</button>
              <span>بيتبدّل باسم كل عميل</span>
            </div>
          </div>

          {firstSelected && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5">معاينة ({firstSelected.name})</p>
              <div className="bg-[#1f2c24] text-[#e9edef] text-sm rounded-xl rounded-tr-sm px-3 py-2 whitespace-pre-wrap leading-relaxed">
                {fillMessage(message, firstSelected)}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1.5"><Timer size={13} /> الفاصل بين كل رسالة (ثانية)</p>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" min={5} placeholder="من" value={delays.min} onChange={e => setDelays(d => ({ ...d, min: e.target.value }))} />
              <Input type="number" min={5} placeholder="إلى" value={delays.max} onChange={e => setDelays(d => ({ ...d, max: e.target.value }))} />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">وقت عشوائي ضمن هالمدى قبل ما ينفتح العميل اللي بعده.</p>
          </div>

          {count > DAILY_SAFE_LIMIT && (
            <div className="flex gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
              اخترت {count} عميل. بالبداية الأفضل ما تتجاوز {DAILY_SAFE_LIMIT} رسالة باليوم من نفس الرقم — بتقدر تكمل الحملة على كذا يوم.
            </div>
          )}

          <Btn size="lg" className="w-full justify-center" disabled={!count || !message.trim()}
            loading={create.isPending} onClick={() => create.mutate()}>
            <Send size={16} /> إنشاء الحملة والبدء ({count})
          </Btn>
        </div>
      </Card>

      <SaveListModal open={saveOpen} onClose={() => setSaveOpen(false)} audience={audience}
        ids={[...selected]} lists={lists} defaultListId={listId}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['broadcast-lists', audience] });
          qc.invalidateQueries({ queryKey: ['broadcast-recipients', audience] });
        }} />
    </div>
  );
}

function SaveListModal({ open, onClose, audience, ids, lists, defaultListId, onSaved }) {
  const [mode, setMode]     = useState('new');
  const [name, setName]     = useState('');
  const [target, setTarget] = useState('');

  useEffect(() => {
    if (open) { setMode(defaultListId ? 'existing' : 'new'); setTarget(defaultListId || ''); setName(''); }
  }, [open, defaultListId]);

  const save = useMutation({
    mutationFn: () => mode === 'new'
      ? broadcastApi.createList({ name, audience, contact_ids: ids })
      : broadcastApi.updateList(target, { add_ids: ids }),
    onSuccess: () => { toast.success('تم حفظ القائمة'); onSaved(); onClose(); },
    onError: (e) => toast.error(e.response?.data?.message || 'تعذّر الحفظ'),
  });

  return (
    <Modal open={open} onClose={onClose} title={`حفظ ${ids.length} رقم بقائمة`}
      footer={<>
        <Btn loading={save.isPending} disabled={mode === 'new' ? !name.trim() : !target} onClick={() => save.mutate()}>
          <ListChecks size={15} /> حفظ
        </Btn>
        <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
      </>}>
      <div className="space-y-4">
        <div className="flex gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2"><input type="radio" className="accent-blue-500" checked={mode === 'new'} onChange={() => setMode('new')} /> قائمة جديدة</label>
          <label className="flex items-center gap-2"><input type="radio" className="accent-blue-500" checked={mode === 'existing'} onChange={() => setMode('existing')} disabled={!lists.length} /> إضافة لقائمة موجودة</label>
        </div>
        {mode === 'new'
          ? <Input label="اسم القائمة" placeholder="مثلاً: ملاك الرياض — فلل" value={name} onChange={e => setName(e.target.value)} autoFocus />
          : <Select label="القائمة" value={target} onChange={e => setTarget(e.target.value)}
              options={lists.map(l => ({ value: l.id, label: `${l.name} (${l.members_count})` }))} />}
      </div>
    </Modal>
  );
}

// ── سجل الحملات ─────────────────────────────────────────────────
function HistoryView({ audience, onOpen }) {
  const qc = useQueryClient();
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['broadcast-campaigns', audience],
    queryFn: () => broadcastApi.campaigns({ audience }).then(r => r.data.data),
  });
  const del = useMutation({
    mutationFn: (id) => broadcastApi.deleteCampaign(id),
    onSuccess: () => { toast.success('تم حذف الحملة'); qc.invalidateQueries({ queryKey: ['broadcast-campaigns'] }); },
  });

  if (isLoading) return <Loading />;
  if (!campaigns.length) return <Card><p className="text-center text-sm text-gray-500 py-12">ما في حملات لهلق</p></Card>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {campaigns.map(c => {
        const done = c.sent_count + c.skipped_count + (c.failed_count || 0);
        const finished = done >= c.recipients_count;
        return (
          <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3 hover:border-gray-600 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-gray-100 truncate">{c.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {c.created_by?.full_name} · {new Date(c.created_at).toLocaleDateString('en-GB')}
                </p>
              </div>
              {c.auto_status === 'running' ? <Badge label="إرسال تلقائي" color="blue" />
                : finished ? <Badge label="مكتملة" color="green" /> : <Badge label="جارية" color="amber" />}
            </div>
            <p className="text-xs text-gray-400 line-clamp-2 whitespace-pre-wrap">{c.message}</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-gray-400">
                <span>انبعتت {c.sent_count} · تخطّي {c.skipped_count}{c.failed_count ? ` · فشل ${c.failed_count}` : ''}</span>
                <span>{done}/{c.recipients_count}</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${(c.sent_count / c.recipients_count) * 100}%` }} />
              </div>
            </div>
            <div className="flex gap-2">
              <Btn size="sm" className="flex-1 justify-center" onClick={() => onOpen(c.id)}>
                {finished ? 'عرض' : 'متابعة الإرسال'}
              </Btn>
              <Btn size="sm" variant="ghost" onClick={() => confirm('حذف الحملة وسجلّها؟') && del.mutate(c.id)}>
                <Trash2 size={14} />
              </Btn>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── تشغيل الحملة: فتح محادثة كل عميل بفاصل عشوائي ──────────────────
function Runner({ id, onBack, onOpenGateway }) {
  const qc = useQueryClient();
  const { data: c, isLoading } = useQuery({
    queryKey: ['broadcast-campaign', id],
    queryFn: () => broadcastApi.campaign(id).then(r => r.data.data),
    // وهي شغالة تلقائي منحدّث كل كم ثانية لنشوف التقدّم
    refetchInterval: (q) => q.state.data?.auto_status === 'running' ? 5_000 : false,
  });
  const { data: gateway } = useGateway();
  const auto = c?.auto_status === 'running';

  const autoSend = useMutation({
    mutationFn: (action) => broadcastApi.autoSend(id, action),
    onSuccess: (r) => {
      toast.success(r.data.message);
      qc.setQueryData(['broadcast-campaign', id], r.data.data);
      qc.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'تعذّر تنفيذ الطلب'),
  });

  const [mode, setMode] = useState(() => store.get('broadcast-open-mode', isMobile() ? 'app' : 'web'));
  useEffect(() => { store.set('broadcast-open-mode', mode); }, [mode]);

  // موعد السماح بفتح العميل التالي (محفوظ حتى لو انعمل refresh)
  const waitKey = `broadcast-next-at-${id}`;
  const [nextAt, setNextAt] = useState(() => store.get(waitKey, 0));
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const waitLeft = Math.max(0, Math.ceil((nextAt - now) / 1000));

  const setStatus = useMutation({
    mutationFn: ({ rid, status }) => broadcastApi.setRecipient(id, rid, status),
    onSuccess: (r) => {
      qc.setQueryData(['broadcast-campaign', id], old => old && ({
        ...old, recipients: old.recipients.map(x => x.id === r.data.data.id ? r.data.data : x),
      }));
      qc.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
    },
  });

  const recipients = c?.recipients || [];
  const current    = recipients.find(r => r.status === 'pending');
  const stats = useMemo(() => ({
    total:   recipients.length,
    sent:    recipients.filter(r => r.status === 'sent').length,
    skipped: recipients.filter(r => r.status === 'skipped').length,
    pending: recipients.filter(r => r.status === 'pending').length,
    sending: recipients.filter(r => r.status === 'sending').length,
    failed:  recipients.filter(r => r.status === 'failed').length,
  }), [recipients]);
  const nextSendIn = c?.next_send_at ? Math.max(0, Math.ceil((new Date(c.next_send_at) - now) / 1000)) : 0;

  const startWait = () => {
    const min = c.min_delay, max = Math.max(c.min_delay, c.max_delay);
    const t = Date.now() + (min + Math.random() * (max - min)) * 1000;
    setNextAt(t); store.set(waitKey, t);
  };

  const sendCurrent = () => {
    if (!current) return;
    // لازم يكون من ضغطة زر مباشرة وإلا المتصفح بيمنع فتح النافذة
    window.open(chatUrl(mode, current.phone, fillMessage(c.message, current)), 'wa_broadcast');
    setStatus.mutate({ rid: current.id, status: 'sent' });
    startWait();
  };

  if (isLoading || !c) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-300">→ سجل الحملات</button>
          <h2 className="text-lg font-bold text-gray-100">{c.title}</h2>
        </div>
        <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl text-xs">
          {[['web', 'واتساب ويب (كمبيوتر)'], ['app', 'تطبيق واتساب']].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg font-semibold ${mode === m ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="الإجمالي" value={stats.total}   icon={<Users size={18} className="text-blue-400" />} />
        <StatCard label="انبعتت"   value={stats.sent}    color="green"  icon={<CheckCircle2 size={18} className="text-green-400" />} />
        <StatCard label="متبقي"    value={stats.pending} color="amber"  icon={<Timer size={18} className="text-amber-400" />} />
        <StatCard label="تخطّي"    value={stats.skipped} color="purple" icon={<SkipForward size={18} className="text-purple-400" />} />
      </div>

      <ProgressBar value={stats.sent + stats.skipped + stats.failed} max={stats.total || 1} />

      {/* الإرسال التلقائي (برنامج كمبيوتر المكتب) */}
      {(current || auto || stats.failed > 0) && (gateway?.status === 'connected' ? (
        <div className={`rounded-2xl p-4 border flex flex-wrap items-center justify-between gap-3
          ${auto ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-800 border-gray-700'}`}>
          <div className="text-sm space-y-1">
            <p className="font-bold text-gray-100 flex items-center gap-2">
              <Send size={16} className={auto ? 'text-green-400' : 'text-gray-400'} />
              {auto ? 'الإرسال التلقائي شغال' : 'إرسال تلقائي'}
              <span className="text-xs font-normal text-gray-400" dir="ltr">من +{gateway.phone}</span>
            </p>
            <p className="text-xs text-gray-400">
              {auto
                ? (gateway.settings.paused ? '⏸ كل الإرسال موقوف من إعدادات الربط'
                  : gateway.sent_today >= gateway.settings.daily_limit ? `⏸ وصلنا الحد اليومي (${gateway.settings.daily_limit}) — بيكمل بكرا لحاله`
                  : nextSendIn > 0 ? `الرسالة الجاية بعد ${nextSendIn} ث` : 'عم يبعت…')
                : `بيبعت لحاله بفاصل ${c.min_delay}–${c.max_delay} ث، ضمن ${gateway.settings.work_start}–${gateway.settings.work_end}، وحد ${gateway.settings.daily_limit} باليوم.`}
              {stats.failed > 0 && !auto && ` — ${stats.failed} فشلت ورح تنعاد.`}
            </p>
          </div>
          {auto
            ? <Btn variant="outline" loading={autoSend.isPending} onClick={() => autoSend.mutate('pause')}>إيقاف مؤقت</Btn>
            : <Btn variant="success" loading={autoSend.isPending} onClick={() => autoSend.mutate('start')}><Send size={15} /> ابدأ الإرسال التلقائي</Btn>}
        </div>
      ) : (
        <button onClick={onOpenGateway}
          className="w-full text-right text-xs text-gray-400 p-3 rounded-xl border border-dashed border-gray-700 hover:border-gray-500 hover:text-gray-200 transition-colors">
          💡 بدك ينبعت لحاله بدون ضغطات؟ اربط رقم واتساب من "ربط واتساب" وبيصير في زر إرسال تلقائي هون.
        </button>
      ))}

      {/* البطاقة الحالية */}
      {auto ? null : current ? (
        <div className="bg-gray-800 border border-blue-500/30 rounded-2xl p-5 grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <p className="text-xs text-gray-500">العميل التالي ({stats.sent + stats.skipped + 1} من {stats.total})</p>
            <p className="text-xl font-black text-gray-100">{current.name || '—'}</p>
            <p className="text-sm font-mono text-gray-400" dir="ltr">{current.phone}</p>
            <div className="flex flex-wrap gap-2 pt-3">
              <Btn size="lg" variant="success" disabled={waitLeft > 0} onClick={sendCurrent}>
                {waitLeft > 0
                  ? <><Timer size={16} /> انتظر {waitLeft} ث</>
                  : <><MessageCircle size={16} /> افتح المحادثة وأرسل</>}
              </Btn>
              <Btn size="lg" variant="outline" disabled={setStatus.isPending}
                onClick={() => setStatus.mutate({ rid: current.id, status: 'skipped' })}>
                <SkipForward size={16} /> تخطّي
              </Btn>
            </div>
            <p className="text-xs text-gray-500 pt-1">
              بينفتح واتساب والرسالة مكتوبة جاهزة — اضغط إرسال هناك، وارجع لهون للعميل اللي بعده.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1.5">الرسالة</p>
            <div className="bg-[#1f2c24] text-[#e9edef] text-sm rounded-xl rounded-tr-sm px-3 py-2 whitespace-pre-wrap leading-relaxed">
              {fillMessage(c.message, current)}
            </div>
          </div>
        </div>
      ) : stats.sending > 0 ? null : (
        <div className="flex items-center gap-3 p-5 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-300">
          <CheckCircle2 size={22} /> خلصت الحملة — انبعتت {stats.sent} رسالة{stats.skipped ? ` وتخطّي ${stats.skipped}` : ''}{stats.failed ? ` وفشل ${stats.failed}` : ''}.
        </div>
      )}

      {!auto && stats.sent >= DAILY_SAFE_LIMIT && stats.pending > 0 && (
        <div className="flex gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
          <AlertTriangle size={15} className="flex-shrink-0" />
          وصلت {stats.sent} رسالة — الأفضل تكمّل الباقي بكرا لحماية الرقم. الحملة محفوظة وبتقدر ترجعلها من "سجل الحملات".
        </div>
      )}

      {/* كل المستلمين */}
      <Card title="المستلمين">
        <div className="divide-y divide-gray-800 max-h-[420px] overflow-y-auto">
          {recipients.map(r => {
            const [label, color] = STATUS_BADGE[r.status];
            return (
              <div key={r.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${current?.id === r.id ? 'bg-blue-500/5' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-100 truncate">{r.name || '—'}</p>
                  <p className="text-xs font-mono text-gray-500" dir="ltr">{r.phone}</p>
                  {r.status === 'failed' && r.error && <p className="text-xs text-red-400">{r.error}</p>}
                </div>
                <Badge label={label} color={color} />
                <a href={chatUrl(mode, r.phone, fillMessage(c.message, r))} target="wa_broadcast" rel="noreferrer"
                  title="فتح المحادثة" className="p-1.5 text-gray-500 hover:text-green-400"><ExternalLink size={14} /></a>
                {!auto && r.status !== 'pending' && r.status !== 'sending' && (
                  <button title="إرجاع للانتظار" className="p-1.5 text-gray-500 hover:text-gray-200"
                    onClick={() => setStatus.mutate({ rid: r.id, status: 'pending' })}><RotateCcw size={14} /></button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
