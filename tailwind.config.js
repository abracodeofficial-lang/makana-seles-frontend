/** @type {import('tailwindcss').Config} */

// ── هوية مكانة اللونية ──────────────────────────────────────────────
// الألوان الأساسية من البراند:
//   primary   #6E4E47  (بني)          → أساس درجات الخلفيات المحايدة (gray)
//   secondary #BF8857  (كراميل)       → لون الإجراءات الأساسي (blue)
//   text      #959FBA  (رمادي مزرق)   → لون ثانوي للحالات المعلوماتية (purple)
//   accent    #F7EAD2  (كريمي)        → لون النصوص الرئيسية (gray-100)
//   37252bb   #B86964  (وردي ترابي)   → الخطر/الحذف (red)
//
// بدل ما نغيّر مئات الكلاسات بالملفات، منعيد تعريف السلالم اللونية نفسها
// (gray/blue/red/purple) فبيتطبّق البراند على كل النظام بشكل متناسق.

const espresso = {          // محايدات دافئة مشتقة من البني الأساسي
  50:  '#FBF6EE',
  100: '#F7EAD2',           // accent — النص الأساسي
  200: '#EBDCC5',
  300: '#D7C4AC',
  400: '#BAA690',
  500: '#978371',
  600: '#7A675C',
  700: '#4B3D37',
  750: '#3F3330',
  800: '#342A26',
  900: '#251D1A',
  950: '#19130F',
};

const caramel = {           // secondary — الأزرار والروابط والتحديد
  50:  '#FBF4EC',
  100: '#F5E4CF',
  200: '#EBCBA5',
  300: '#DFB07F',
  400: '#D09C69',
  500: '#BF8857',
  600: '#A0693F',
  700: '#825434',
  800: '#64412A',
  900: '#47301F',
  950: '#2C1D12',
};

const rose = {              // 37252bb — الخطر
  50:  '#FBF1F0',
  100: '#F5DEDC',
  200: '#EBC0BD',
  300: '#E0A29D',
  400: '#D0857F',
  500: '#B86964',
  600: '#9D514C',
  700: '#7F413D',
  800: '#613331',
  900: '#462625',
  950: '#2B1716',
};

const slate = {             // text — حالات معلوماتية ثانوية
  50:  '#F4F5F9',
  100: '#E6E9F0',
  200: '#CDD2E0',
  300: '#B2B9CD',
  400: '#959FBA',
  500: '#7A85A3',
  600: '#626C88',
  700: '#4E566D',
  800: '#3A4052',
  900: '#282C39',
  950: '#181B23',
};

// ألوان الحالات (نجاح/تنبيه/...) — نسخ أهدأ من الافتراضية حتى ما تكون "نيون" فوق الخلفية البنية
const sage = {              // نجاح
  50:  '#F1F7F2',
  100: '#DDEDE1',
  200: '#BCDAC4',
  300: '#A0CBAB',
  400: '#86BB94',
  500: '#68A178',
  600: '#538662',
  700: '#436C50',
  800: '#355540',
  900: '#263D2E',
  950: '#16241B',
};

const honey = {             // تنبيه/قيد الانتظار
  50:  '#FDF7EA',
  100: '#FAEBC8',
  200: '#F3D795',
  300: '#EBC56D',
  400: '#E2B453',
  500: '#D49E35',
  600: '#B3822A',
  700: '#8E6623',
  800: '#6C4E1D',
  900: '#4D3816',
  950: '#2E210D',
};

const sea = {               // تمييز إضافي
  50:  '#EFF6F5',
  100: '#D8EAE7',
  200: '#B3D5CF',
  300: '#93C2BA',
  400: '#7AB0A7',
  500: '#5D968C',
  600: '#4A7B72',
  700: '#3C635C',
  800: '#2F4D48',
  900: '#223733',
  950: '#14211F',
};

// ── الوضع الفاتح ─────────────────────────────────────────────────────
// المحايدات بالفاتح: نفس أسماء الدرجات بس بقيم معكوسة ومضبوطة يدوياً
// (gray-950 = خلفية الصفحة، gray-900 = الكروت بيضاء، gray-100 = النص الأساسي الغامق)
const espressoLight = {
  50:  '#3B2722',           // النصوص الغامقة بني (مشتق من البني الأساسي #6E4E47) بدل الأسود
  100: '#4A322B',
  200: '#5A3F37',
  300: '#6E4E47',
  400: '#7F6157',
  500: '#937A6C',
  600: '#B3A08C',
  700: '#D9CAB7',
  750: '#E6DACB',
  800: '#EFE6D9',
  900: '#FFFFFF',
  950: '#F6F0E7',
};

// ألوان التمييز بالفاتح: الدرجات الفاتحة (نصوص 300/400) والغامقة (خلفيات شفافة 800-950) بتنقلب،
// و500-700 (أزرار صلبة بنص أبيض) بتضل متل ما هي
const FLIP = { 50: 950, 100: 900, 200: 800, 300: 700, 400: 600, 800: 200, 900: 100, 950: 50 };
const flip = (scale) => Object.fromEntries(
  Object.keys(scale).map(k => [k, scale[FLIP[k] ?? k]])
);

const PALETTES = {
  gray:   [espresso, espressoLight],
  blue:   [caramel, flip(caramel)],
  red:    [rose, flip(rose)],
  purple: [slate, flip(slate)],
  green:  [sage, flip(sage)],
  amber:  [honey, flip(honey)],
  teal:   [sea, flip(sea)],
};

const rgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(' ');

// كل درجة = متغير CSS، فبنبدّل الثيم بكلاس `light` على <html> بدون ما نلمس الكلاسات
const cssVars = (idx) => Object.fromEntries(
  Object.entries(PALETTES).flatMap(([name, pair]) =>
    Object.entries(pair[idx]).map(([shade, hex]) => [`--c-${name}-${shade}`, rgb(hex)]))
);
const varScale = (name) => Object.fromEntries(
  Object.keys(PALETTES[name][0]).map(shade => [shade, `rgb(var(--c-${name}-${shade}) / <alpha-value>)`])
);

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gray:   varScale('gray'),
        blue:   varScale('blue'),
        red:    varScale('red'),
        rose:   varScale('red'),
        purple: varScale('purple'),
        green:  varScale('green'),
        emerald: varScale('green'),
        amber:  varScale('amber'),
        teal:   varScale('teal'),
        brand: {
          primary:   '#6E4E47',
          secondary: '#BF8857',
          text:      '#959FBA',
          accent:    '#F7EAD2',
          rose:      '#B86964',
        },
      },
    },
  },
  plugins: [
    ({ addBase }) => addBase({
      ':root':      { ...cssVars(0), colorScheme: 'dark' },
      'html.light': { ...cssVars(1), colorScheme: 'light' },
    }),
  ],
};
