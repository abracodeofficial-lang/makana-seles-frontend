import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { History } from 'lucide-react';
import { auditApi } from '../../api/services';
import { PageHeader, useIsAdmin } from '../../components/layout/Layout';
import { Badge, Btn, Card, FilterPanel, Input, Loading, Select, Table, Td, Tr } from '../../components/ui';

const ACTIONS = {
  created:  { label: 'إضافة',   color: 'green' },
  updated:  { label: 'تعديل',   color: 'amber' },
  deleted:  { label: 'حذف',     color: 'red' },
  restored: { label: 'استرجاع', color: 'blue' },
};

const formatDateTime = (str) => {
  if (!str) return '—';
  const d = new Date(str);
  return isNaN(d) ? str : d.toLocaleString('ar-SA-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// التغييرات: أول 3 ظاهرين، والباقي بكبسة
function Changes({ action, changes }) {
  const [open, setOpen] = useState(false);
  if (!changes.length) return <span className="text-gray-600 text-xs">—</span>;

  const shown = open ? changes : changes.slice(0, 3);
  return (
    <div className="space-y-1 text-xs min-w-[220px] max-w-[420px]">
      {shown.map((c, i) => (
        <p key={i} className="leading-relaxed break-words">
          <span className="text-gray-400">{c.label}: </span>
          {action === 'updated' && (
            <><span className="text-gray-500 line-through"><bdi>{c.old ?? 'فاضي'}</bdi></span><span className="text-gray-500"> ← </span></>
          )}
          <span className="text-gray-200 font-semibold"><bdi>{c.new ?? 'فاضي'}</bdi></span>
        </p>
      ))}
      {changes.length > 3 && (
        <button type="button" onClick={() => setOpen(o => !o)} className="text-blue-400 hover:underline">
          {open ? 'عرض أقل' : `عرض الكل (${changes.length})`}
        </button>
      )}
    </div>
  );
}

export default function AuditLogPage() {
  const { isAdmin, isLoading: checking } = useIsAdmin();
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const setF = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn:  () => auditApi.list({ ...filters, page }).then(r => r.data),
    enabled:  isAdmin,
    placeholderData: keepPreviousData,
  });

  if (checking) return <Loading />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const rows = data?.data || [];
  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <div className="font-[Cairo]" dir="rtl">
      <PageHeader title="سجل العمليات" subtitle="كل إضافة وتعديل وحذف: مين عملها، وأي ساعة، وشو تغيّر" />

      <div className="p-4 sm:p-6 space-y-4">
        <FilterPanel activeCount={activeFilters} onClear={() => { setFilters({}); setPage(1); }}>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <Select label="الموظف" value={filters.employee_id || ''} onChange={e => setF('employee_id', e.target.value)}
              options={(data?.employees || []).map(e => ({ value: String(e.id), label: e.name }))} />
            <Select label="الإجراء" value={filters.action || ''} onChange={e => setF('action', e.target.value)}
              options={Object.entries(ACTIONS).map(([value, a]) => ({ value, label: a.label }))} />
            <Select label="القسم" value={filters.subject_type || ''} onChange={e => setF('subject_type', e.target.value)}
              options={data?.types || []} />
            <Input label="من تاريخ" type="date" value={filters.date_from || ''} onChange={e => setF('date_from', e.target.value)} />
            <Input label="إلى تاريخ" type="date" value={filters.date_to || ''} onChange={e => setF('date_to', e.target.value)} />
            <Input label="بحث" placeholder="اسم السجل أو كوده" value={filters.search || ''} onChange={e => setF('search', e.target.value)} />
          </div>
        </FilterPanel>

        <Card title={`العمليات${data?.total != null ? ` (${data.total.toLocaleString('en-US')})` : ''}`}>
          {isLoading ? <Loading /> : rows.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <History size={28} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">ما في عمليات مطابقة</p>
            </div>
          ) : (
            <Table headers={['الوقت', 'الموظف', 'الإجراء', 'القسم', 'السجل', 'التفاصيل']}>
              {rows.map(l => (
                <Tr key={l.id}>
                  <Td className="text-xs whitespace-nowrap">{formatDateTime(l.created_at)}</Td>
                  <Td className="text-xs font-semibold text-gray-100">{l.employee_name || '—'}</Td>
                  <Td><Badge label={ACTIONS[l.action]?.label || l.action} color={ACTIONS[l.action]?.color || 'gray'} /></Td>
                  <Td className="text-xs">{l.type_label}</Td>
                  <Td className="text-xs"><bdi>{l.subject_label || '—'}</bdi></Td>
                  <Td><Changes action={l.action} changes={l.changes} /></Td>
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
    </div>
  );
}
