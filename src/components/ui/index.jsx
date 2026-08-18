import { Loader2, AlertCircle } from 'lucide-react';

export function Btn({ children, variant = 'primary', size = 'md', loading, className = '', ...props }) {
  const base  = 'inline-flex items-center gap-1.5 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-[Cairo] whitespace-nowrap';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' };
  const vars  = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    outline: 'border border-gray-700 hover:bg-gray-800 text-gray-300',
    danger:  'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    ghost:   'hover:bg-gray-800 text-gray-400',
  };
  return (
    <button className={`${base} ${sizes[size]} ${vars[variant]} ${className}`} disabled={loading} {...props}>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Badge({ label, color = 'blue' }) {
  const colors = {
    green:  'bg-green-500/15 text-green-400',
    red:    'bg-red-500/15 text-red-400',
    amber:  'bg-amber-500/15 text-amber-400',
    blue:   'bg-blue-500/15 text-blue-400',
    purple: 'bg-purple-500/15 text-purple-400',
    teal:   'bg-teal-500/15 text-teal-400',
    gray:   'bg-gray-500/15 text-gray-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colors[color] || colors.gray}`}>
      {label}
    </span>
  );
}

export function StatCard({ label, value, icon, color = 'blue' }) {
  const colors = {
    blue:   'text-blue-400 bg-blue-500/10',
    green:  'text-green-400 bg-green-500/10',
    amber:  'text-amber-400 bg-amber-500/10',
    red:    'text-red-400 bg-red-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
  };
  const colorClass = colors[color] || colors.blue;
  const textColor  = colorClass.split(' ')[0];
  const bgColor    = colorClass.split(' ')[1];

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-5 hover:border-gray-600 transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1.5">{label}</p>
          <p className={`text-xl sm:text-2xl font-black ${textColor}`}>{value ?? 0}</p>
        </div>
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${bgColor}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</label>}
      <input
        className={`w-full bg-gray-800 border ${error ? 'border-red-500' : 'border-gray-700'} rounded-lg px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600 ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function Select({ label, error, options = [], className = '', ...props }) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</label>}
      <select
        className={`w-full bg-gray-800 border ${error ? 'border-red-500' : 'border-gray-700'} rounded-lg px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        {...props}
      >
        <option value="">اختر...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</label>}
      <textarea
        rows={3}
        className={`w-full bg-gray-800 border ${error ? 'border-red-500' : 'border-gray-700'} rounded-lg px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600 resize-none ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// Modal — centered on desktop, bottom-sheet on mobile
export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className={`
        bg-gray-900 border border-gray-700 w-full ${width}
        rounded-t-2xl sm:rounded-2xl
        sm:mx-4
        max-h-[92vh] sm:max-h-[85vh]
        flex flex-col shadow-2xl
        animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-200
      `}>
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800">
          {/* drag handle on mobile */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-700 rounded-full sm:hidden" />
          <h3 className="text-base font-bold text-gray-100">{title}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors"
          >✕</button>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="p-3 sm:p-4 border-t border-gray-800 flex flex-wrap gap-2 pb-safe">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Table({ headers, children }) {
  return (
    <div className="overflow-x-auto -mx-0">
      <table className="w-full border-collapse min-w-max">
        <thead>
          <tr className="bg-gray-800/80">
            {headers.map((h, i) => (
              <th key={i} className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-700 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ children, onClick }) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${onClick ? 'cursor-pointer' : ''}`}
    >
      {children}
    </tr>
  );
}

export function Td({ children, className = '' }) {
  return (
    <td className={`px-3 sm:px-4 py-3 text-sm text-gray-300 ${className}`}>
      {children}
    </td>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center h-40 sm:h-64">
      <Loader2 size={28} className="animate-spin text-blue-500" />
    </div>
  );
}

export function ErrorMsg({ message = 'حدث خطأ في تحميل البيانات' }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
      <AlertCircle size={18} />{message}
    </div>
  );
}

export function Avatar({ name = '', size = 'md' }) {
  const safeName = name || '';
  const colors   = ['bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-purple-600', 'bg-rose-600', 'bg-teal-600'];
  const color    = safeName.length > 0 ? colors[safeName.charCodeAt(0) % colors.length] : colors[0];
  const sizes    = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-base' };
  const initials = safeName.split(' ').slice(0, 2).map(w => w[0]).join('');
  return (
    <div className={`${sizes[size]} ${color} rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {initials}
    </div>
  );
}

export function ProgressBar({ value = 0, max = 100 }) {
  const pct      = Math.min(100, Math.round((value / max) * 100));
  const barColor = pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// Card — accepts both `action` and `extra` as header slot
export function Card({ title, action, extra, children, className = '' }) {
  const headerSlot = action || extra;
  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-xl overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-700">
          <h3 className="text-sm font-bold text-gray-100">{title}</h3>
          {headerSlot}
        </div>
      )}
      {children}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'بحث...' }) {
  return (
    <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 flex-1 min-w-0 max-w-xs sm:max-w-xs">
      <span className="text-gray-500 text-sm flex-shrink-0">🔍</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent text-sm text-gray-200 outline-none w-full placeholder:text-gray-600"
      />
    </div>
  );
}

export function InfoRow({ label, value, valueClass = '' }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-gray-800 last:border-0 text-sm gap-3">
      <span className="text-gray-400 flex-shrink-0">{label}</span>
      <span className={`font-semibold text-gray-200 text-right ${valueClass}`}>{value ?? '—'}</span>
    </div>
  );
}
