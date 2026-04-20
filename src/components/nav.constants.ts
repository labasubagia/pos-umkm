import { ShoppingCart, Package, Archive, Users, BarChart2, Settings } from 'lucide-react'
import type { Role } from '../lib/adapters/types'

export const NAV_ITEMS = [
  { to: '/cashier', label: 'Kasir', icon: ShoppingCart, minRole: 'cashier' as Role },
  { to: '/catalog', label: 'Katalog', icon: Package, minRole: 'manager' as Role },
  { to: '/inventory', label: 'Inventori', icon: Archive, minRole: 'manager' as Role },
  { to: '/customers', label: 'Pelanggan', icon: Users, minRole: 'manager' as Role },
  { to: '/reports', label: 'Laporan', icon: BarChart2, minRole: 'manager' as Role },
  { to: '/settings', label: 'Pengaturan', icon: Settings, minRole: 'owner' as Role },
]
