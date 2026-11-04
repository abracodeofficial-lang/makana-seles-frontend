import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, Building2, RefreshCw, Settings } from 'lucide-react';
import { publishingApi } from '../../api/services';
import { PageHeader, useIsAdmin } from '../../components/layout/Layout';
import { Btn, Card, Input, Loading, Modal, SearchBox, Select, Table, Td, Tr } from '../../components/ui';
import { PublicationBadge, formatDate } from './shared';

const TABS = [
  ['ready', 'جاهز للنشر'],
  ['published', 'منشور'],
  ['needs_update', 'يحتاج تحديث'],
  ['failed', 'فشل'],
  ['all', 'الكل'],
];

export default function PublishingPage() {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const [tab, setTab] = useState('ready');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showSettings, setShowSettings] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['publishing', tab, search, page],
    queryFn:  () => publishingApi.list({ tab, search, page }).then(r => r.data),
    placeholderData: keepPreviousData,
    refetchInterval: 15000,
  });

  const rows      = data?.data || [];
  const platforms = data?.platforms || [];
  const alerts    = data?.alerts || [];
  const expired   = alerts.filter(a => a.expired);

  return (
    <div className="font-[Cairo]" dir="rtl">
      <PageHeader title="النشر" subtitle="نشر العقارات الجاهزة على الموقع والمنصات"
        actions={isAdmin && (
          <Btn variant="outline" onClick={() => setShowSettings(true)}><Settings size={14} /> إعدادات الربط</Btn>
        )} />

      <div className="p-4 sm:p-6 space-y-4">
        {alerts.length > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/40 bg-amber-500/10">
            <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm min-w-0">
              <p className="font-semibold text-gray-100">
                رخص الإعلان: {expired.length} منتهية · {alerts.length - expired.length} بتنتهي خلال 7 أيام
              </p>
              <p className="text-xs text-gray-400 mt-1 break-words">
                {alerts.slice(0, 6).map(a => `${a.property_code} (${a.expiry})`).join(' · ')}
                {alerts.length > 6 && ' …'}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex bg-gray-800 rounded-lg p-1 w-full sm:w-fit overflow-x-auto">
            {TABS.map(([key, label]) => (
              <button key={key} onClick={() => { setTab(key); setPage(1); }}
                className={`flex-1 sm:flex-none whitespace-nowrap px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all
                  ${tab === key ? 'bg-gray-700 text-gray-100' : 'text-gray-400 hover:text-gray-200'}`}>
                {label}{data?.counts?.[key] > 0 && <span className="ms-1.5 text-xs text-blue-400">{data.counts[key]}</span>}
              </button>
            ))}
          </div>
          <div className="sm:ms-auto sm:w-72">
            <SearchBox value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="العنوان، رقم العقار، أو الرخصة..." />
          </div>
        </div>

        <Card>
          {isLoading ? <Loading /> : rows.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Building2 size={28} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">ما في عقارات هون</p>
            </div>
          ) : (
            <Table headers={['', 'العقار', 'المدخل', 'تاريخ الجاهزية', ...platforms.map(p => p.label)]}>
              {rows.map(r => (
                <Tr key={r.id} onClick={() => navigate(`/publishing/${r.id}`)}>
                  <Td>
                    {r.thumbnail
                      ? <img src={r.thumbnail} alt="" className="w-14 h-10 rounded-md object-cover" loading="lazy" />
                      : <div className="w-14 h-10 rounded-md bg-gray-800" />}
                  </Td>
                  <Td>
                    <p className="text-xs font-semibold text-gray-100">{r.name}</p>
                    <p className="text-xs text-gray-500 font-mono" dir="ltr">{r.property_code}</p>
                    {r.workflow_status === 'returned' && <p className="text-xs text-amber-400">رجع لمدخل البيانات</p>}
                  </Td>
                  <Td className="text-xs">{r.entered_by || '—'}</Td>
                  <Td className="text-xs whitespace-nowrap">{formatDate(r.ready_at)}</Td>
                  {platforms.map(p => <Td key={p.key}><PublicationBadge status={r.statuses?.[p.key]} /></Td>)}
                </Tr>
              ))}
            </Table>
          )}
          {(data?.last_page || 1) > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm p-3 border-t border-gray-700">
              <Btn size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>السابق</Btn>
              <span className="text-gray-400">صفحة {data.current_page} من {data.last_page}</span>
              <Btn size="sm" variant="outline" disabled={page >= data.last_page} onClick={() => setPage(p => p + 1)}>التالي</Btn>
            </div>
          )}
        </Card>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function SettingsModal({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data } = useQuery({
    queryKey: ['publishing-settings'],
    queryFn:  () => publishingApi.settings().then(r => r.data.data),
  });
  useEffect(() => { if (data) setForm({ ...data, wordpress_app_password: '' }); }, [data]);

  const saveMut = useMutation({
    mutationFn: () => publishingApi.updateSettings({
      public_base_url: form.public_base_url,
      wordpress_base_url: form.wordpress_base_url,
      wordpress_username: form.wordpress_username,
      wordpress_app_password: form.wordpress_app_password,
      wordpress_mock: form.wordpress_mock,
    }),
    onSuccess: () => { toast.success('تم حفظ الإعدادات'); qc.invalidateQueries({ queryKey: ['publishing-settings'] }); onClose(); },
    onError: (err) => {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(e => toast.error(e));
    },
  });

  const tokenMut = useMutation({
    mutationFn: () => publishingApi.regenerateFeedToken(),
    onSuccess: () => { toast.success('تم تغيير التوكن'); qc.invalidateQueries({ queryKey: ['publishing-settings'] }); },
  });

  return (
    <Modal open onClose={onClose} title="إعدادات الربط" width="max-w-xl"
      footer={<>
        <Btn onClick={() => saveMut.mutate()} loading={saveMut.isPending} disabled={!form}>💾 حفظ</Btn>
        <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
      </>}>
      {!form ? <Loading /> : (
        <div className="space-y-4">
          <Input dir="ltr" label="رابط النظام العام (HTTPS) — لروابط الصور والـ Feed" value={form.public_base_url || ''} onChange={e => set('public_base_url', e.target.value)} />

          <div className="p-4 rounded-xl border border-gray-700 space-y-3">
            <p className="text-sm font-semibold text-gray-200">ووردبريس</p>
            <Select label="الوضع" clearable={false} value={form.wordpress_mock ? 'mock' : 'live'} onChange={e => set('wordpress_mock', e.target.value === 'mock')}
              options={[{ value: 'mock', label: 'تجريبي (ما بينشر فعلياً)' }, { value: 'live', label: 'فعلي' }]} />
            <Input dir="ltr" label="رابط الموقع (HTTPS)" placeholder="https://example.com" value={form.wordpress_base_url || ''} onChange={e => set('wordpress_base_url', e.target.value)} />
            <Input dir="ltr" label="اسم المستخدم" autoComplete="off" value={form.wordpress_username || ''} onChange={e => set('wordpress_username', e.target.value)} />
            <Input dir="ltr" type="password" autoComplete="new-password" label={form.has_password ? 'Application Password (محفوظة — اكتب بس لتغييرها)' : 'Application Password'}
              value={form.wordpress_app_password} onChange={e => set('wordpress_app_password', e.target.value)} />
          </div>

          <div className="p-4 rounded-xl border border-gray-700 space-y-3">
            <p className="text-sm font-semibold text-gray-200">رابط Feed بيوت</p>
            <p className="text-xs text-gray-400 font-mono break-all" dir="ltr">{form.bayut_feed_url}</p>
            <div className="flex gap-2">
              <Btn size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(form.bayut_feed_url); toast.success('تم النسخ'); }}>نسخ</Btn>
              <Btn size="sm" variant="outline" loading={tokenMut.isPending}
                onClick={() => confirm('تغيير التوكن بيوقف الرابط الحالي عند بيوت. متأكد؟') && tokenMut.mutate()}>
                <RefreshCw size={13} /> توكن جديد
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
