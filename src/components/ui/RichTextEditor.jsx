// محرر نصوص منسّقة (وصف/مميزات/مكونات العقار) — TipTap
import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import {
  Undo2, Redo2, Heading2, Heading3, Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, AlignRight, AlignCenter, AlignLeft, AlignJustify,
  Highlighter, Baseline, Minus, RemoveFormatting,
} from 'lucide-react';
import { toHtml } from './RichText';

const TEXT_COLORS = [
  { label: 'افتراضي', value: null },
  { label: 'كراميل',  value: '#BF8857' },
  { label: 'بني',     value: '#8B6259' },
  { label: 'وردي',    value: '#B86964' },
  { label: 'أخضر',    value: '#68A178' },
  { label: 'أزرق',    value: '#7A85A3' },
];
const HIGHLIGHTS = ['#F7EAD2', '#F5DEDC', '#DDEDE1', '#E6E9F0'];

// ── محرر ────────────────────────────────────────────────────────
function ToolBtn({ active, disabled, onClick, title, children }) {
  return (
    <button type="button" title={title} disabled={disabled}
      onMouseDown={e => e.preventDefault()}   // ما يضيع التحديد من المحرر
      onClick={onClick}
      className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors disabled:opacity-30
        ${active ? 'bg-blue-500/20 text-blue-300' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-100'}`}>
      {children}
    </button>
  );
}

const Sep = () => <span className="w-px h-5 bg-gray-700 mx-1" />;

function Swatches({ items, onPick, onClose }) {
  return (
    <div className="absolute top-full mt-1 right-0 z-20 flex gap-1.5 p-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl"
      onMouseLeave={onClose}>
      {items.map(({ label, value }) => (
        <button key={label} type="button" title={label} onMouseDown={e => e.preventDefault()}
          onClick={() => { onPick(value); onClose(); }}
          className="w-6 h-6 rounded-full border border-gray-600 hover:scale-110 transition-transform"
          style={{ background: value || 'transparent' }}>
          {!value && <span className="text-[10px] text-gray-400">✕</span>}
        </button>
      ))}
    </div>
  );
}

export default function RichTextEditor({ label, value, onChange, placeholder, minHeight = 140 }) {
  const [menu, setMenu] = useState(null);   // 'color' | 'highlight'

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'], defaultAlignment: 'right' }),
      TextStyle, Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: toHtml(value),
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        dir: 'rtl',
        class: 'rich-content outline-none px-3 py-2.5 text-sm text-gray-100',
        style: `min-height:${minHeight}px`,
        'data-placeholder': placeholder || '',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  });

  // لما تتغير القيمة من برا (فتح عقار تاني) منحدّث المحرر بدون ما نطلق onChange
  useEffect(() => {
    // بعد إعادة التركيب (StrictMode/Suspense) ممكن يكون المحرر القديم انتلف
    if (!editor || editor.isDestroyed) return;
    const incoming = toHtml(value);
    if (incoming !== editor.getHTML() && !(editor.isEmpty && !incoming)) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor || editor.isDestroyed) return null;
  const chain = () => editor.chain().focus();

  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</label>}
      <div className="bg-gray-800 border border-gray-700 rounded-lg focus-within:border-blue-500 transition-colors">
        <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-gray-700 relative">
          <ToolBtn title="تراجع" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}><Undo2 size={15} /></ToolBtn>
          <ToolBtn title="إعادة" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}><Redo2 size={15} /></ToolBtn>
          <Sep />
          <ToolBtn title="عنوان" active={editor.isActive('heading', { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></ToolBtn>
          <ToolBtn title="عنوان فرعي" active={editor.isActive('heading', { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></ToolBtn>
          <Sep />
          <ToolBtn title="عريض" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}><Bold size={15} /></ToolBtn>
          <ToolBtn title="مائل" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}><Italic size={15} /></ToolBtn>
          <ToolBtn title="تسطير" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}><Underline size={15} /></ToolBtn>
          <ToolBtn title="يتوسطه خط" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}><Strikethrough size={15} /></ToolBtn>
          <span className="relative">
            <ToolBtn title="لون النص" active={!!editor.getAttributes('textStyle').color} onClick={() => setMenu(m => m === 'color' ? null : 'color')}><Baseline size={15} /></ToolBtn>
            {menu === 'color' && <Swatches items={TEXT_COLORS} onClose={() => setMenu(null)}
              onPick={v => v ? chain().setColor(v).run() : chain().unsetColor().run()} />}
          </span>
          <span className="relative">
            <ToolBtn title="تظليل" active={editor.isActive('highlight')} onClick={() => setMenu(m => m === 'highlight' ? null : 'highlight')}><Highlighter size={15} /></ToolBtn>
            {menu === 'highlight' && <Swatches items={[{ label: 'بدون', value: null }, ...HIGHLIGHTS.map(h => ({ label: h, value: h }))]}
              onClose={() => setMenu(null)}
              onPick={v => v ? chain().setHighlight({ color: v }).run() : chain().unsetHighlight().run()} />}
          </span>
          <Sep />
          <ToolBtn title="قائمة نقطية" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}><List size={16} /></ToolBtn>
          <ToolBtn title="قائمة مرقمة" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}><ListOrdered size={16} /></ToolBtn>
          <Sep />
          <ToolBtn title="محاذاة لليمين" active={editor.isActive({ textAlign: 'right' })} onClick={() => chain().setTextAlign('right').run()}><AlignRight size={15} /></ToolBtn>
          <ToolBtn title="توسيط" active={editor.isActive({ textAlign: 'center' })} onClick={() => chain().setTextAlign('center').run()}><AlignCenter size={15} /></ToolBtn>
          <ToolBtn title="محاذاة لليسار" active={editor.isActive({ textAlign: 'left' })} onClick={() => chain().setTextAlign('left').run()}><AlignLeft size={15} /></ToolBtn>
          <ToolBtn title="ضبط" active={editor.isActive({ textAlign: 'justify' })} onClick={() => chain().setTextAlign('justify').run()}><AlignJustify size={15} /></ToolBtn>
          <Sep />
          <ToolBtn title="خط فاصل" onClick={() => chain().setHorizontalRule().run()}><Minus size={15} /></ToolBtn>
          <ToolBtn title="إزالة التنسيق" onClick={() => chain().unsetAllMarks().clearNodes().run()}><RemoveFormatting size={15} /></ToolBtn>
        </div>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
