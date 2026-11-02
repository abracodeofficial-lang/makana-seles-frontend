import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

// رابط مباشر لسجل: /leads?open=12 بيفتح تفاصيله (مستعمل من سجل العمليات)
export function useOpenParam(open) {
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    const id = Number(params.get('open'));
    if (!id) return;
    open(id);
    params.delete('open');
    setParams(params, { replace: true });
  }, [params]);
}
