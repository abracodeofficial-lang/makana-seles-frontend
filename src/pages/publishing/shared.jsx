import { Badge } from '../../components/ui';

// شارة حالة النشر على منصة
const STATUS = {
  published:    { label: 'منشور',        color: 'green' },
  pending:      { label: 'قيد الانتظار', color: 'amber' },
  queued:       { label: 'قيد الانتظار', color: 'amber' },
  publishing:   { label: 'جاري النشر',   color: 'amber' },
  failed:       { label: 'فشل',          color: 'red' },
  needs_update: { label: 'يحتاج تحديث',  color: 'blue' },
  unpublished:  { label: 'غير منشور',    color: 'gray' },
};

export function PublicationBadge({ status }) {
  const s = STATUS[status] || { label: 'غير منشور', color: 'gray' };
  return <Badge label={s.label} color={s.color} />;
}

export const formatDate = (str) => {
  if (!str) return '—';
  const d = new Date(str);
  return isNaN(d) ? str : d.toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const formatDateTime = (str) => {
  if (!str) return '—';
  const d = new Date(str);
  return isNaN(d) ? str : d.toLocaleString('ar-SA-u-nu-latn', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
