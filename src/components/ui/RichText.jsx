// عرض آمن لمحتوى المحرر المنسّق + تحويلات (المحرر نفسه بـ RichTextEditor.jsx — بينحمّل عند الطلب)
import DOMPurify from 'dompurify';

const isHtml = (s) => /<\/?[a-z][\s\S]*>/i.test(s || '');
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// النصوص القديمة (قبل المحرر) كانت نص عادي بأسطر — منحوّلها لفقرات
export const toHtml = (value) => {
  if (!value) return '';
  if (isHtml(value)) return value;
  return value.split(/\r?\n/).map(l => `<p>${escape(l) || '<br>'}</p>`).join('');
};

// ── عرض ─────────────────────────────────────────────────────────
export function RichText({ html, className = '' }) {
  if (!html) return null;
  const clean = DOMPurify.sanitize(toHtml(html), { ALLOWED_ATTR: ['style', 'dir'] });
  return <div dir="rtl" className={`rich-content ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}

