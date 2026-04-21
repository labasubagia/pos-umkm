import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { fetchVariants } from '../modules/catalog/catalog.service'

export const VARIANTS_QUERY_KEY = (storeId: string | null) => ['variants', storeId]

export function useVariants() {
  const activeStoreId = useAuthStore((s) => s.activeStoreId)
  return useQuery({
    queryKey: VARIANTS_QUERY_KEY(activeStoreId),
    queryFn: fetchVariants,
    enabled: !!activeStoreId,
  })
}
