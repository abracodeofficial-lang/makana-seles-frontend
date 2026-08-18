import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { attendanceApi, employeesApi } from '../../api/services';
import { PageHeader } from '../../components/layout/Layout';
import {
  Btn, Badge, StatCard, Card, Modal, Input, Select,
  Textarea, SearchBox, Loading, Avatar, Table, Tr, Td,
} from '../../components/ui';
import {
  UserCheck, Clock, UserX, Palmtree,
  Pencil, Plus, Download, RefreshCw,
} from 'lucide-react';

// ── ثوابت ────────────────────────────────────────────────────
const STATUS_MAP = {
  حاضر:  { color: 'green', label: 'حاضر'  },
  متأخر: { color: 'amber', label: 'متأخر'  },
  غياب:  { color: 'red',   label: 'غياب'   },
  إجازة: { color: 'blue',  label: 'إجازة'  },
};

const STATUS_OPTIONS = Object.keys(STATUS_MAP).map(v => ({ value: v, label: v }));

const todayISO = () => new Date().toISOString().slice(0, 10);

// ── دوال التنسيق ──────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const fmtTime = (t) => {
  if (!t) return '—';
  return t.slice(0, 5);
};

// تنسيق دقائق التأخير بالعربي
const formatDelay = (minutes) => {
  if (!minutes || Number(minutes) <= 0) return null;
  const m = Number(minutes);
  if (m < 60) return `${m} دقيقة تأخير`;
  const h   = Math.floor(m / 60);
  const rem = m % 60;
  const hLabel =
    h === 1 ? 'ساعة' :
    h === 2 ? 'ساعتان' :
    h <= 10 ? `${h} ساعات` : `${h} ساعة`;
  if (rem === 0) return `${hLabel} تأخير`;
  const mLabel = rem <= 10 ? `${rem} دقائق` : `${rem} دقيقة`;
  return `${hLabel} و${mLabel} تأخير`;
};

// تنسيق ساعات العمل (عشري → نص عربي)
const formatWorkHours = (hours) => {
  if (!hours || Number(hours) <= 0) return '—';
  const totalMins = Math.round(Number(hours) * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const hLabel =
    h === 0 ? '' :
    h === 1 ? 'ساعة' :
    h === 2 ? 'ساعتان' :
    h <= 10 ? `${h} ساعات` : `${h} ساعة`;
  const mLabel =
    m === 0 ? '' :
    m === 1 ? 'دقيقة' :
    m === 2 ? 'دقيقتان' :
    m <= 10 ? `${m} دقائق` : `${m} دقيقة`;
  if (h > 0 && m > 0) return `${hLabel} و${mLabel}`;
  if (h > 0) return hLabel;
  return mLabel || '—';
};

// حساب ساعات العمل من وقت دخول/خروج نصي
const calcHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return '—';
  const [h1, m1] = checkIn.split(':').map(Number);
  const [h2, m2] = checkOut.split(':').map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins <= 0) return '—';
  return formatWorkHours(mins / 60);
};

// ── الصفحة الرئيسية ──────────────────────────────────────────
export default function AttendancePage() {
  const qc = useQueryClient();
  const [date,      setDate]      = useState(todayISO());
  const [search,    setSearch]    = useState('');
  const [showForm,  setShowForm]  = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [exportRange, setExportRange] = useState({ from: todayISO(), to: todayISO() });
  const [showExport,  setShowExport]  = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['attendance', date, search],
    queryFn: () => attendanceApi.list({ date, search }).then(r => r.data),
    staleTime: 30_000,
  });

  const stats       = data?.stats        || {};
  const records     = data?.data         || [];
  const autoUpdated = data?.auto_updated || [];

  const handleExport = async () => {
    try {
      const res     = await attendanceApi.export(exportRange);
      const records = res.data?.data || [];

      if (!records.length) {
        toast.error('لا توجد بيانات ضمن الفترة المحددة');
        return;
      }

      const rows = records.map(r => ({
        'اسم الموظف':    r.employee?.full_name      || '—',
        'رقم الموظف':    r.employee?.employee_number || '—',
        'التاريخ':       fmtDate(r.date),
        'الحضور':        fmtTime(r.check_in),
        'الانصراف':      fmtTime(r.check_out),
        'ساعات العمل':   calcHours(r.check_in, r.check_out),
        'الحالة':        STATUS_MAP[r.status]?.label || r.status,
        'دقائق التأخير': r.late_minutes || 0,
        'ملاحظات':       r.notes || '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
        { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 24 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الحضور');
      XLSX.writeFile(wb, `attendance-${exportRange.from}-${exportRange.to}.xlsx`);

      setShowExport(false);
      toast.success('تم تصدير التقرير');
    } catch { toast.error('فشل التصدير'); }
  };

  return (
    <div>
      <PageHeader
        title="الحضور والانصراف"
        subtitle="متابعة وتسجيل حضور الموظفين يومياً"
        actions={
          <>
            <SearchBox value={search} onChange={setSearch} placeholder="بحث باسم الموظف..." />
            <Input
              type="date" value={date}
              onChange={e => setDate(e.target.value)}
              className="text-xs py-1.5 w-40"
            />
            <Btn variant="outline" onClick={() => setShowExport(true)}>
              <Download size={14}/> تصدير
            </Btn>
            <Btn onClick={() => { setEditRecord(null); setShowForm(true); }}>
              <Plus size={14}/> تسجيل حضور
            </Btn>
          </>
        }
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

        {/* إحصائيات */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="حاضرون"   value={stats.present  || 0} icon={<UserCheck size={18}/>} color="green" />
          <StatCard label="متأخرون"  value={stats.late     || 0} icon={<Clock size={18}/>}     color="amber" />
          <StatCard label="غائبون"   value={stats.absent   || 0} icon={<UserX size={18}/>}     color="red"   />
          <StatCard label="في إجازة" value={stats.on_leave || 0} icon={<Palmtree size={18}/>}  color="blue"  />
        </div>

        {/* شريط التاريخ */}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="font-semibold text-gray-200">{fmtDate(date)}</span>
          <span>·</span>
          <span>{records.length} سجل</span>
          <button
            onClick={() => refetch()}
            className="mr-auto flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
          >
            <RefreshCw size={12}/> تحديث
          </button>
        </div>

        {/* جدول الحضور */}
        <Card title={`سجلات حضور ${fmtDate(date)}`}>
          {isLoading ? <Loading /> : records.length === 0 ? (
            <p className="text-center text-gray-500 py-10 text-sm">لا توجد سجلات لهذا اليوم</p>
          ) : (
            <Table headers={['الموظف', 'القسم', 'وقت الدخول', 'وقت الخروج', 'ساعات العمل', 'التأخير', 'الحالة', 'تعديل']}>
              {records.map(rec => {
                const delay = formatDelay(rec.late_minutes);
                return (
                  <Tr key={rec.id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={rec.employee?.full_name} size="sm"/>
                        <div>
                          <p className="text-xs font-semibold text-gray-100">{rec.employee?.full_name}</p>
                          <p className="text-xs text-gray-500 font-mono">{rec.employee?.employee_number}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-gray-400 text-xs">{rec.employee?.department?.name || '—'}</Td>
                    <Td>
                      <span className="font-mono text-green-400">{fmtTime(rec.check_in)}</span>
                    </Td>
                    <Td>
                      <span className="font-mono text-blue-400">{fmtTime(rec.check_out)}</span>
                    </Td>
                    <Td className="text-gray-300 font-semibold text-xs">
                      {rec.worked_hours
                        ? formatWorkHours(rec.worked_hours)
                        : calcHours(rec.check_in, rec.check_out)
                      }
                    </Td>
                    <Td className="text-xs">
                      {delay
                        ? <span className="text-red-400 font-semibold whitespace-nowrap">{delay}</span>
                        : <span className="text-gray-600">—</span>
                      }
                    </Td>
                    <Td>
                      <Badge
                        label={STATUS_MAP[rec.status]?.label || rec.status}
                        color={STATUS_MAP[rec.status]?.color || 'gray'}
                      />
                    </Td>
                    <Td>
                      <Btn size="sm" variant="ghost"
                        onClick={() => { setEditRecord(rec); setShowForm(true); }}>
                        <Pencil size={12}/>
                      </Btn>
                    </Td>
                  </Tr>
                );
              })}
            </Table>
          )}
        </Card>

        {/* السجلات المحدثة تلقائياً من نظام الإجازات */}
        {autoUpdated.length > 0 && (
          <Card title="سجلات محدثة تلقائياً من نظام الإجازات">
            <div className="px-4 pb-4">
              <p className="text-xs text-gray-500 mb-3">
                الموظفون التاليون تم تسجيل حضورهم تلقائياً بناءً على إجازة معتمدة
              </p>
              <Table headers={['الموظف', 'نوع الإجازة', 'التاريخ', 'الحالة']}>
                {autoUpdated.map((rec, i) => (
                  <Tr key={i}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={rec.employee?.full_name} size="sm"/>
                        <div>
                          <p className="text-xs font-semibold text-gray-100">{rec.employee?.full_name}</p>
                          <p className="text-xs text-gray-500 font-mono">{rec.employee?.employee_number}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-blue-400 text-xs">{rec.leave_type || '—'}</Td>
                    <Td className="text-gray-400 text-xs">{fmtDate(rec.date || rec.from)}</Td>
                    <Td><Badge label="تحديث تلقائي" color="blue"/></Td>
                  </Tr>
                ))}
              </Table>
            </div>
          </Card>
        )}
      </div>

      {/* Modal التسجيل / التعديل */}
      {showForm && (
        <AttendanceForm
          record={editRecord}
          defaultDate={date}
          onClose={() => { setShowForm(false); setEditRecord(null); }}
          onSaved={() => {
            qc.invalidateQueries(['attendance']);
            setShowForm(false);
            setEditRecord(null);
          }}
        />
      )}

      {/* Modal التصدير */}
      {showExport && (
        <Modal
          open
          onClose={() => setShowExport(false)}
          title="تصدير تقرير الحضور"
          footer={
            <>
              <Btn onClick={handleExport}><Download size={14}/> تصدير</Btn>
              <Btn variant="outline" onClick={() => setShowExport(false)}>إلغاء</Btn>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <Input label="من تاريخ" type="date" value={exportRange.from}
              onChange={e => setExportRange(r => ({ ...r, from: e.target.value }))} />
            <Input label="إلى تاريخ" type="date" value={exportRange.to}
              onChange={e => setExportRange(r => ({ ...r, to: e.target.value }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Modal تسجيل / تعديل الحضور ──────────────────────────────
const FORM_DEFAULTS = {
  employee_id: '', date: todayISO(),
  check_in: '', check_out: '',
  status: 'حاضر', notes: '',
};

function AttendanceForm({ record, defaultDate, onClose, onSaved }) {
  const isEdit = !!record;

  const [form, setForm] = useState(FORM_DEFAULTS);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // جلب قائمة الموظفين
  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: ['employees-mini'],
    queryFn: () => employeesApi.list({ status: 'نشط', per_page: 999 }).then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const empList = empData?.data?.data || empData?.data || [];
  const empOptions = [
    { value: '', label: empLoading ? 'جارٍ التحميل...' : 'اختر الموظف...' },
    ...empList.map(e => ({
      value: String(e.id),
      label: `${e.full_name} — ${e.employee_number}`,
    })),
  ];

  useEffect(() => {
    if (record) {
      setForm({
        employee_id: String(record.employee_id || record.employee?.id || ''),
        date:        (record.date || defaultDate).slice(0, 10),
        check_in:    (record.check_in  || '').slice(0, 5),
        check_out:   (record.check_out || '').slice(0, 5),
        status:      record.status || 'حاضر',
        notes:       record.notes  || '',
      });
    } else {
      setForm({ ...FORM_DEFAULTS, date: defaultDate });
    }
  }, [record, defaultDate]);

  const mut = useMutation({
    mutationFn: (data) => attendanceApi.store(data),
    onSuccess: () => {
      toast.success(isEdit ? 'تم تحديث السجل' : 'تم تسجيل الحضور');
      onSaved();
    },
    onError: (err) => {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(e => toast.error(e));
      else toast.error(err.response?.data?.message || 'حدث خطأ أثناء الحفظ');
    },
  });

  const handleSave = () => {
    if (!form.employee_id) { toast.error('يرجى اختيار الموظف'); return; }
    if (!form.date)        { toast.error('التاريخ مطلوب'); return; }
    if (!form.status)      { toast.error('الحالة مطلوبة'); return; }
    const payload = { ...form };
    if (isEdit) payload.id = record.id;
    mut.mutate(payload);
  };

  const workHoursPreview = calcHours(form.check_in, form.check_out);

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'تعديل سجل الحضور' : 'تسجيل حضور يدوي'}
      footer={
        <>
          <Btn onClick={handleSave} loading={mut.isPending}>
            💾 {isEdit ? 'حفظ التعديل' : 'تسجيل'}
          </Btn>
          <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
        </>
      }
    >
      <div className="space-y-4">

        {/* الموظف */}
        <Select
          label="الموظف *"
          value={form.employee_id}
          onChange={e => set('employee_id', e.target.value)}
          options={empOptions}
          disabled={isEdit}
        />

        {/* التاريخ والحالة */}
        <div className="grid grid-cols-2 gap-4">
          <Input label="التاريخ *" type="date" value={form.date}
            onChange={e => set('date', e.target.value)} />
          <Select label="الحالة *" value={form.status}
            onChange={e => set('status', e.target.value)}
            options={STATUS_OPTIONS} />
        </div>

        {/* وقت الدخول والخروج */}
        {form.status !== 'غياب' && form.status !== 'إجازة' && (
          <div className="grid grid-cols-2 gap-4">
            <Input label="وقت الدخول" type="time" value={form.check_in}
              onChange={e => set('check_in', e.target.value)} />
            <Input label="وقت الخروج" type="time" value={form.check_out}
              onChange={e => set('check_out', e.target.value)} />
          </div>
        )}

        {/* ملخص ساعات العمل */}
        {form.check_in && form.check_out && workHoursPreview !== '—' && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-sm">
            <span className="text-gray-400">إجمالي ساعات العمل: </span>
            <span className="font-bold text-green-400">{workHoursPreview}</span>
          </div>
        )}

        {/* الملاحظات */}
        <Textarea
          label="ملاحظات"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={2}
          placeholder={
            form.status === 'غياب'  ? 'غياب بدون إذن' :
            form.status === 'متأخر' ? 'سبب التأخير...' :
            form.status === 'إجازة' ? 'نوع الإجازة...' : ''
          }
        />
      </div>
    </Modal>
  );
}
