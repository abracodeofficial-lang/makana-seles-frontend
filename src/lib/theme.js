import { useEffect, useState } from 'react';

// الوضع الفاتح/الداكن — بيتخزّن بالمتصفح، وأول مرة بيتبع إعداد الجهاز.
// الكلاس بينضاف على <html> من سكربت بـ index.html قبل ما الصفحة تترسم (بدون وميض).
const KEY = 'theme';
const META = { dark: '#19130F', light: '#F6F0E7' };

export const getTheme = () => (document.documentElement.classList.contains('light') ? 'light' : 'dark');

export function applyTheme(theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META[theme]);
  try { localStorage.setItem(KEY, theme); } catch {}
  window.dispatchEvent(new Event('themechange'));
}

export function useTheme() {
  const [theme, setTheme] = useState(getTheme);
  useEffect(() => {
    const sync = () => setTheme(getTheme());
    window.addEventListener('themechange', sync);
    return () => window.removeEventListener('themechange', sync);
  }, []);
  return [theme, () => applyTheme(theme === 'light' ? 'dark' : 'light')];
}
