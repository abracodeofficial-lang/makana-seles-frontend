import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Navigate, useSearchParams } from 'react-router-dom';
import { RotateCcw, Trash2 } from 'lucide-react';
import { trashApi } from '../../api/services';
import { PageHeader, useIsAdmin } from '../../components/layout/Layout';
import { Btn, Card, CountBox, Loading, Table, Td, Tr } from '../../components/ui';

const formatDateTime = (str) => {
  if (!str) return '—';
  const d = new Date(str);
  return isNaN(d) ? str : d.toLocaleString('ar-SA-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function TrashPage() {
  const { isAdmin, isLoading: checking } = useIsAdmin();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [type, setType] = useState(params.get('type'));
  const [page, setPage] = useState(1);

  const { data: summary } = useQuery({
    queryKey: ['trash-summary'],
    queryFn:  () => trashApi.summary().then(r => r.data.data),
    enabled:  isAdmin,
  });

  // أول نوع فيه محذوفات يفتح تلقائياً
  useEffect(() => {
    if (!type && summary) setType((summary.find(t => t.count > 0) || summary[0])?.key);
  }, [summary, type]);

  const { data, isLoading } = useQuery({
    queryKey: ['trash', type, page],
    queryFn:  () => trashApi.list({ type, page }).then(r => r.data),
    enabled:  isAdmin && !!type,
    placeholderData: keepPreviousData,
  });

  const restoreMut = useMutation({
    mutationFn: (id) => trashApi.restore(type, id),
    onSuccess: () => {
      toast.success('تم الاسترجاع');
      qc.invalidateQueries({ queryKey: ['trash'] });
      qc.invalidateQueries({ queryKey: ['trash-summary'] });
    },
  });

  if (checking) return <Loading />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const rows  = data?.data || [];
  const label = summary?.find(t => t.key === type)?.label;

  return (
    <div className="font-[Cairo]" dir="rtl">
      <PageHeader title="المحذوفات" subtitle="كل اللي انحذف من النظام — بتقدر تسترجعه بأي وقت" />

      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {summary?.map(t => (
            <CountBox key={t.key} label={t.label} count={t.count} active={t.key === type}
              onClick={() => { setType(t.key); setPage(1); }} />
          ))}
        </div>

        <Card title={label || 'المحذوفات'}>
          {isLoading || !summary ? <Loading /> : rows.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Trash2 size={28} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">ما في محذوفات هون</p>
            </div>
          ) : (
            <Table headers={['الاسم', 'التفاصيل', 'تاريخ الحذف', 'حذفه', '']}>
              {rows.map(r => (
                <Tr key={r.id}>
                  <Td className="font-semibold text-gray-100 text-xs">{r.title || '—'}</Td>
                  <Td className="text-xs text-gray-400"><bdi>{r.subtitle || '—'}</bdi></Td>
                  <Td className="text-xs whitespace-nowrap">{formatDateTime(r.deleted_at)}</Td>
                  <Td className="text-xs">{r.deleted_by || '—'}</Td>
                  <Td>
                    <Btn size="sm" variant="outline" loading={restoreMut.isPending && restoreMut.variables === r.id}
                      onClick={() => restoreMut.mutate(r.id)}>
                      <RotateCcw size={13} /> استرجاع
                    </Btn>
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
          {(data?.last_page || 1) > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm p-3 border-t border-gray-700">
              <Btn size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>السابق</Btn>
              <span className="text-gray-400">صفحة {data.current_page} من {data.last_page} · {data.total}</span>
              <Btn size="sm" variant="outline" disabled={page >= data.last_page} onClick={() => setPage(p => p + 1)}>التالي</Btn>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
