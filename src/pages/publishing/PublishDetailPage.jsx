import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, ChevronRight, Copy, Download, ExternalLink, Package, RefreshCw, Send, Undo2, XCircle } from 'lucide-react';
import { publishingApi } from '../../api/services';
import { PageHeader } from '../../components/layout/Layout';
import { Btn, Card, InfoRow, Input, Loading, Modal, Table, Td, Textarea, Tr, formatMoney } from '../../components/ui';
import useAuthStore from '../../store/authStore';
import { PublicationBadge, formatDate, formatDateTime } from './shared';

const ACTION_LABEL = { publish: 'نشر', update: 'تحديث', unpublish: 'إيقاف', retry: 'إعادة محاولة' };
const IN_FLIGHT    = ['queued', 'publishing'];
const LIVE         = ['published', 'needs_update', 'failed', 'pending'];

export default function PublishDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const canAct = useAuthStore(s => s.can('publishing', 'edit'));
  const [selected, setSelected] = useState([]);
  const [showReturn, setShowReturn] = useState(false);
  const [packFor, setPackFor] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['publishing-property', id],
    queryFn:  () => publishingApi.show(id).then(r => r.data.data),
    // بدون Refresh: بيتحدث لحاله طول ما في عملية شغالة
    refetchInterval: (query) => query.state.data?.platforms?.some(p => IN_FLIGHT.includes(p.status)) ? 4000 : false,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['publishing-property', id] });
    qc.invalidateQueries({ queryKey: ['publishing'] });
  };

  const publishMut = useMutation({
    mutationFn: (platforms) => publishingApi.publish(id, platforms),
    onSuccess: (res) => {
      Object.values(res.data.data).forEach(r => r.ok ? toast.success(r.message) : toast.error(r.message));
      setSelected([]);
      refresh();
    },
  });

  const unpublishMut = useMutation({
    mutationFn: (platforms) => publishingApi.unpublish(id, platforms),
    onSuccess: () => { toast.success('تم إرسال طلب الإيقاف'); refresh(); },
  });

  if (isLoading || !data) return <Loading />;

  const { property: p, platforms, logs } = data;
  const ready = platforms.filter(x => x.missing.length === 0 && !IN_FLIGHT.includes(x.status));
  const toggle = (key) => setSelected(s => s.includes(key) ? s.filter(k => k !== key) : [...s, key]);

  return (
    <div className="font-[Cairo]" dir="rtl">
      <PageHeader title={p.name} subtitle={`نشر العقار ${p.property_code}`}
        actions={<Link to="/publishing" className="inline-flex items-center gap-1 text-sm text-blue-400 hover:underline"><ChevronRight size={15} /> رجوع للقائمة</Link>} />

      <div className="p-4 sm:p-6 space-y-4">
        {p.workflow_status === 'returned' && p.return_note && (
          <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-sm text-gray-200">رجع لمدخل البيانات: {p.return_note}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="ملخص العقار">
            <div className="p-4">
              <InfoRow label="النوع / الغرض" value={[p.type, p.listing_purpose].filter(Boolean).join(' · ') || '—'} />
              <InfoRow label="السعر" value={p.listed_price ? `${formatMoney(p.listed_price)} ريال` : '—'} />
              <InfoRow label="المساحة" value={p.total_area ? `${formatMoney(p.total_area)} م²` : '—'} />
              <InfoRow label="الموقع" value={[p.city, p.neighborhood].filter(Boolean).join(' · ') || '—'} />
              <InfoRow label="رخصة الإعلان" value={p.license_number ? `${p.license_number} · تنتهي ${formatDate(p.ad_license_expiry)}` : '—'} />
              <InfoRow label="رخصة فال" value={p.fal_license_number} />
              <InfoRow label="المدخل" value={p.entered_by} />
            </div>
          </Card>
          <Card title={`الصور (${p.images?.length || 0})`}>
            {p.images?.length ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-4">
                {p.images.map(img => <img key={img.id} src={img.url} alt="" loading="lazy" className="w-full h-20 object-cover rounded-lg" />)}
              </div>
            ) : <p className="text-sm text-gray-500 text-center py-10">ما في صور</p>}
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {platforms.map(x => {
            const blocked = x.missing.length > 0;
            const busy = IN_FLIGHT.includes(x.status);
            return (
              <div key={x.key} className="p-4 rounded-xl border border-gray-700 bg-gray-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className={`flex items-center gap-2 text-sm font-semibold text-gray-100 ${blocked || busy || !canAct ? 'opacity-60' : 'cursor-pointer'}`}>
                    <input type="checkbox" className="accent-[#BF8857]" disabled={blocked || busy || !canAct}
                      checked={selected.includes(x.key)} onChange={() => toggle(x.key)} />
                    {x.label}
                  </label>
                  <PublicationBadge status={x.status} />
                </div>

                {x.notice && <p className="text-xs text-amber-400">{x.notice}</p>}

                {blocked ? (
                  <ul className="space-y-1">
                    {x.missing.map(m => (
                      <li key={m} className="flex items-center gap-1.5 text-xs text-red-400"><XCircle size={13} className="shrink-0" /> {m}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-green-400"><CheckCircle2 size={13} /> جاهز للنشر</p>
                )}

                {x.error && <p className="text-xs text-red-400 break-words">{x.error}</p>}
                {x.external_url && (
                  <a href={x.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline break-all">
                    <ExternalLink size={12} className="shrink-0" /> رابط الإعلان
                  </a>
                )}

                {canAct && (
                  <div className="flex flex-wrap gap-2">
                    {x.status === 'failed' && !blocked && (
                      <Btn size="sm" variant="outline" onClick={() => publishMut.mutate([x.key])}><RefreshCw size={12} /> إعادة المحاولة</Btn>
                    )}
                    {x.status === 'needs_update' && !blocked && (
                      <Btn size="sm" onClick={() => publishMut.mutate([x.key])}><RefreshCw size={12} /> تحديث</Btn>
                    )}
                    {x.manual && (
                      <Btn size="sm" variant="outline" onClick={() => setPackFor(x)}><Package size={12} /> حزمة النشر</Btn>
                    )}
                    {LIVE.includes(x.status) && (
                      <Btn size="sm" variant="ghost" className="hover:text-red-400"
                        onClick={() => confirm(`إيقاف النشر على ${x.label}؟`) && unpublishMut.mutate([x.key])}>إيقاف النشر</Btn>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {canAct && (
          <div className="flex flex-wrap gap-2">
            <Btn disabled={!selected.length} loading={publishMut.isPending} onClick={() => publishMut.mutate(selected)}><Send size={14} /> نشر المحدد</Btn>
            <Btn variant="outline" disabled={!ready.length} onClick={() => publishMut.mutate(ready.map(x => x.key))}>نشر على الكل ({ready.length})</Btn>
            <Btn variant="outline" onClick={() => setShowReturn(true)}><Undo2 size={14} /> إرجاع لمدخل البيانات</Btn>
          </div>
        )}

        <Card title="سجل العمليات">
          {logs.length === 0 ? <p className="text-sm text-gray-500 text-center py-8">ما في عمليات لسا</p> : (
            <Table headers={['الوقت', 'المنصة', 'العملية', 'الحالة', 'الموظف', 'التفاصيل']}>
              {logs.map(l => (
                <Tr key={l.id}>
                  <Td className="text-xs whitespace-nowrap">{formatDateTime(l.created_at)}</Td>
                  <Td className="text-xs">{platforms.find(x => x.key === l.platform)?.label || l.platform}</Td>
                  <Td className="text-xs">{ACTION_LABEL[l.action] || l.action}</Td>
                  <Td>{l.status === 'retry' ? <span className="text-xs text-amber-400">إعادة محاولة</span> : <PublicationBadge status={l.status} />}</Td>
                  <Td className="text-xs">{l.user || '—'}</Td>
                  <Td className="text-xs text-gray-400 break-words max-w-[320px]">{[l.request, l.response].filter(Boolean).join(' — ') || '—'}</Td>
                </Tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      {showReturn && <ReturnModal id={id} onClose={() => setShowReturn(false)} onDone={refresh} />}
      {packFor && <PackModal id={id} platform={packFor} code={p.property_code} onClose={() => setPackFor(null)} onDone={refresh} />}
    </div>
  );
}

function ReturnModal({ id, onClose, onDone }) {
  const [note, setNote] = useState('');
  const mut = useMutation({
    mutationFn: () => publishingApi.returnToEntry(id, note),
    onSuccess: () => { toast.success('تم إرجاع العقار'); onDone(); onClose(); },
  });

  return (
    <Modal open onClose={onClose} title="إرجاع لمدخل البيانات"
      footer={<>
        <Btn disabled={!note.trim()} loading={mut.isPending} onClick={() => mut.mutate()}>إرجاع</Btn>
        <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
      </>}>
      <Textarea label="الملاحظة *" rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="شو لازم يتعدل؟" />
    </Modal>
  );
}

function PackModal({ id, platform, code, onClose, onDone }) {
  const [url, setUrl] = useState(platform.external_url || '');
  const { data: sections, isLoading } = useQuery({
    queryKey: ['publishing-pack', id],
    queryFn:  () => publishingApi.pack(id).then(r => r.data.data),
  });

  const confirmMut = useMutation({
    mutationFn: () => publishingApi.confirmManual(id, platform.key, url),
    onSuccess: () => { toast.success('تم تسجيل النشر'); onDone(); onClose(); },
  });

  const zipMut = useMutation({
    mutationFn: () => publishingApi.imagesZip(id),
    onSuccess: (res) => {
      const href = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = href; a.download = `${code}-images.zip`; a.click();
      URL.revokeObjectURL(href);
    },
    onError: () => toast.error('فشل تحميل الصور'),
  });

  const copy = (text) => { navigator.clipboard?.writeText(text); toast.success('تم النسخ'); };

  return (
    <Modal open onClose={onClose} title={`حزمة النشر — ${platform.label}`} width="max-w-2xl"
      footer={<>
        <Btn disabled={!url.trim()} loading={confirmMut.isPending} onClick={() => confirmMut.mutate()}>تم النشر</Btn>
        <Btn variant="outline" onClick={onClose}>إغلاق</Btn>
      </>}>
      {isLoading ? <Loading /> : (
        <div className="space-y-3">
          {sections?.map(s => (
            <div key={s.key} className="p-3 rounded-xl bg-gray-800 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-400">{s.label}</p>
                <Btn size="sm" variant="ghost" onClick={() => copy(s.text)}><Copy size={12} /> نسخ</Btn>
              </div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{s.text || '—'}</p>
            </div>
          ))}
          <Btn variant="outline" loading={zipMut.isPending} onClick={() => zipMut.mutate()}><Download size={14} /> تحميل الصور ZIP</Btn>
          <Input dir="ltr" label="رابط الإعلان بعد النشر" placeholder="https://sa.aqar.fm/..." value={url} onChange={e => setUrl(e.target.value)} />
        </div>
      )}
    </Modal>
  );
}
