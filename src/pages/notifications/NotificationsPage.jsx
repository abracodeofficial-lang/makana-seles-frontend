import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { notificationsApi } from '../../api/services';
import { PageHeader } from '../../components/layout/Layout';
import { Btn, Badge, StatCard, Loading } from '../../components/ui';
import {
  Bell, CheckCheck, Trash2, X,
  CheckCircle, AlertTriangle, Info, XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ── ثوابت ────────────────────────────────────────────────────
const TYPE_CONFIG = {
  'نجاح':   { icon: CheckCircle,    color: 'text-green-400', bg: 'bg-green-500/15', ring: 'ring-green-500/30', badge: 'green' },
  'تحذير':  { icon: AlertTriangle,  color: 'text-amber-400', bg: 'bg-amber-500/15', ring: 'ring-amber-500/30', badge: 'amber' },
  'معلومة': { icon: Info,           color: 'text-blue-400',  bg: 'bg-blue-500/15',  ring: 'ring-blue-500/30',  badge: 'blue'  },
  'خطأ':    { icon: XCircle,        color: 'text-red-400',   bg: 'bg-red-500/15',   ring: 'ring-red-500/30',   badge: 'red'   },
};

const FILTER_OPTIONS = [
  { value: '',        label: 'الكل'        },
  { value: 'unread',  label: 'غير مقروء'   },
  { value: 'نجاح',   label: 'نجاح'        },
  { value: 'تحذير',  label: 'تحذير'       },
  { value: 'معلومة', label: 'معلومة'      },
  { value: 'خطأ',    label: 'خطأ'         },
];

// وقت نسبي بالعربي
const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return 'منذ لحظات';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400)return `منذ ${Math.floor(diff / 3600)} ساعة`;
  if (diff < 604800)return `منذ ${Math.floor(diff / 86400)} يوم`;
  return new Date(dateStr).toLocaleDateString('ar-SA');
};

// ── الصفحة ───────────────────────────────────────────────────
export default function NotificationsPage() {
  const qc      = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', filter],
    queryFn:  () => notificationsApi.list({
      type:   filter && filter !== 'unread' ? filter : undefined,
      unread: filter === 'unread' ? 1 : undefined,
    }).then(r => r.data),
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries(['notifications']);

  const markReadMut = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess:  invalidate,
  });

  const markAllMut = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess:  () => { toast.success('تم تحديد الكل كمقروء'); invalidate(); },
    onError:    () => toast.error('حدث خطأ'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => notificationsApi.delete(id),
    onSuccess:  invalidate,
    onError:    () => toast.error('فشل الحذف'),
  });

  const clearAllMut = useMutation({
    mutationFn: () => notificationsApi.clearAll(),
    onSuccess:  () => { toast.success('تم مسح كل الإشعارات'); invalidate(); },
    onError:    () => toast.error('حدث خطأ'),
  });

  const stats       = data?.stats || {};
  const list        = data?.data?.data ?? data?.data ?? [];

  const handleClick = (notif) => {
    if (!notif.is_read) markReadMut.mutate(notif.id);
    if (notif.url)      navigate(notif.url);
  };

  const handleClearAll = () => {
    if (!window.confirm('هل أنت متأكد من مسح كل الإشعارات؟')) return;
    clearAllMut.mutate();
  };

  return (
    <div>
      <PageHeader
        title="الإشعارات"
        subtitle="متابعة جميع تنبيهات النظام"
        actions={
          <>
            <Btn
              variant="outline"
              onClick={() => markAllMut.mutate()}
              loading={markAllMut.isPending}
            >
              <CheckCheck size={14}/> تحديد الكل كمقروء
            </Btn>
            <Btn
              variant="danger"
              onClick={handleClearAll}
              loading={clearAllMut.isPending}
            >
              <Trash2 size={14}/> مسح الكل
            </Btn>
          </>
        }
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

        {/* إحصائيات */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="إجمالي الإشعارات" value={stats.total    || 0} icon={<Bell size={18}/>}          color="blue"   />
          <StatCard label="غير مقروءة"        value={stats.unread   || 0} icon={<Info size={18}/>}          color="amber"  />
          <StatCard label="نجاح"              value={stats.success  || 0} icon={<CheckCircle size={18}/>}   color="green"  />
          <StatCard label="تحذيرات"           value={stats.warnings || 0} icon={<AlertTriangle size={18}/>} color="amber"  />
        </div>

        {/* فلترة */}
        <div className="flex items-center gap-2 flex-wrap">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* قائمة الإشعارات */}
        {isLoading ? <Loading /> : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
              <Bell size={28} className="text-gray-600"/>
            </div>
            <p className="text-gray-400 font-semibold">لا توجد إشعارات</p>
            <p className="text-gray-600 text-sm mt-1">ستظهر هنا جميع تنبيهات النظام</p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map(notif => (
              <NotifCard
                key={notif.id}
                notif={notif}
                onClick={() => handleClick(notif)}
                onDelete={() => deleteMut.mutate(notif.id)}
                deleting={deleteMut.isPending && deleteMut.variables === notif.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── بطاقة إشعار ──────────────────────────────────────────────
function NotifCard({ notif, onClick, onDelete, deleting }) {
  const cfg   = TYPE_CONFIG[notif.type] || TYPE_CONFIG['معلومة'];
  const Icon  = cfg.icon;
  const unread = !notif.is_read;

  return (
    <div
      className={`
        relative flex items-start gap-3 p-4 rounded-xl border transition-all group
        ${unread
          ? 'bg-gray-800/80 border-gray-600 hover:border-gray-500'
          : 'bg-gray-800/40 border-gray-700/50 hover:border-gray-600'
        }
      `}
    >
      {/* أيقونة النوع */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ${cfg.bg} ${cfg.ring}`}>
        <Icon size={16} className={cfg.color}/>
      </div>

      {/* المحتوى */}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-snug ${unread ? 'font-bold text-gray-100' : 'font-medium text-gray-300'}`}>
            {notif.title}
          </p>
          <span className="text-xs text-gray-600 whitespace-nowrap flex-shrink-0 mt-0.5">
            {timeAgo(notif.created_at)}
          </span>
        </div>
        {notif.body && (
          <p className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-2">{notif.body}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <Badge label={notif.type} color={cfg.badge}/>
          {unread && (
            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"/>
          )}
          {notif.url && (
            <span className="text-xs text-blue-400 hover:text-blue-300">← اضغط للانتقال</span>
          )}
        </div>
      </div>

      {/* زر الحذف */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        disabled={deleting}
        className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-gray-700 hover:bg-red-500/20 hover:text-red-400 text-gray-500 transition-all"
        title="حذف"
      >
        {deleting ? (
          <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"/>
        ) : (
          <X size={13}/>
        )}
      </button>
    </div>
  );
}
