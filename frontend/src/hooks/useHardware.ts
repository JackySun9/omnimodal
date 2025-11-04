import { useQuery } from '@tanstack/react-query';
import { fetchHardwareProfile, HardwareProfile } from '../services/api';

/**
 * Hook to fetch hardware profile
 */
export function useHardware() {
  return useQuery<HardwareProfile>({
    queryKey: ['hardware'],
    queryFn: fetchHardwareProfile,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}
