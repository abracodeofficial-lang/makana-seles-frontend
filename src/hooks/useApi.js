import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export function useFetch(key, fetcher, options = {}) {
  return useQuery({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: () => fetcher().then(r => r.data),
    staleTime: 30_000,
    ...options,
  });
}

export function useMutate(mutFn, options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mutFn,
    onSuccess: (data, _vars, ctx) => {
      if (options.invalidate) {
        const keys = Array.isArray(options.invalidate) ? options.invalidate : [options.invalidate];
        keys.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
      }
      if (options.successMsg) toast.success(options.successMsg);
      options.onSuccess?.(data, _vars, ctx);
    },
    onError: (err, _vars, ctx) => {
      const msg = err.response?.data?.message || 'حدث خطأ';
      toast.error(msg);
      options.onError?.(err, _vars, ctx);
    },
  });
}