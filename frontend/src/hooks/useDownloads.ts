import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDownloads, DownloadTask } from '../services/api';

/**
 * Hook to fetch download tasks
 */
export function useDownloads() {
  return useQuery<DownloadTask[]>({
    queryKey: ['downloads'],
    queryFn: fetchDownloads,
    staleTime: 5 * 1000, // 5 seconds
    refetchInterval: 10 * 1000, // Refetch every 10 seconds for active downloads
  });
}

/**
 * Hook to refresh downloads
 */
export function useRefreshDownloads() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['downloads'] });
  };
}
