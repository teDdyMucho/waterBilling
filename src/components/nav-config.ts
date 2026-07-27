import {
  Building2,
  CalendarClock,
  CreditCard,
  Droplets,
  FileBarChart,
  Gauge,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  Camera,
  ShieldCheck,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/types/domain'

export interface NavItem {
  to: string
  /** key sa locales (sidebar.*) */
  labelKey: string
  icon: LucideIcon
  /** Exact match lang ang active (para sa index/home routes). */
  end?: boolean
  /** Hindi pa tapos — ipapakita bilang disabled na may "Soon" badge. */
  soon?: boolean
}

export interface NavGroup {
  /** key sa locales (sidebar.*) o null kung walang heading */
  labelKey: string | null
  items: NavItem[]
}

/** Nav bawat role. Ang may `soon:true` ay preview ng darating na phase. */
export const NAV_BY_ROLE: Record<Role, NavGroup[]> = {
  homeowner: [
    {
      labelKey: null,
      items: [
        { to: '/dashboard', labelKey: 'sidebar.dashboard', icon: LayoutDashboard, end: true },
        { to: '/dashboard/bills', labelKey: 'sidebar.bills', icon: Receipt },
        { to: '/dashboard/consumption', labelKey: 'sidebar.consumption', icon: Droplets },
        { to: '/dashboard/profile', labelKey: 'sidebar.profile', icon: UserCircle },
        {
          to: '/dashboard/payments',
          labelKey: 'sidebar.payments',
          icon: CreditCard,
          soon: true,
        },
        {
          to: '/dashboard/messages',
          labelKey: 'sidebar.messages',
          icon: MessageSquare,
          soon: true,
        },
      ],
    },
  ],
  staff: [
    {
      labelKey: null,
      items: [
        { to: '/staff', labelKey: 'sidebar.workspace', icon: LayoutDashboard, end: true },
        { to: '/staff/properties', labelKey: 'sidebar.properties', icon: Building2 },
        { to: '/staff/readings', labelKey: 'sidebar.readings', icon: Camera },
        { to: '/staff/bills', labelKey: 'sidebar.bills', icon: Receipt, soon: true },
        {
          to: '/staff/concerns',
          labelKey: 'sidebar.concerns',
          icon: MessageSquare,
          soon: true,
        },
      ],
    },
  ],
  admin: [
    {
      labelKey: 'sidebar.main',
      items: [
        { to: '/admin', labelKey: 'sidebar.dashboard', icon: LayoutDashboard, end: true },
        { to: '/admin/accounts', labelKey: 'sidebar.accounts', icon: Users },
      ],
    },
    {
      labelKey: 'sidebar.manage',
      items: [
        { to: '/admin/properties', labelKey: 'sidebar.properties', icon: Building2 },
        { to: '/admin/cycles', labelKey: 'sidebar.cycles', icon: CalendarClock },
        { to: '/admin/review', labelKey: 'sidebar.review', icon: ShieldCheck },
        { to: '/admin/rates', labelKey: 'sidebar.rates', icon: Gauge },
        {
          to: '/admin/payments',
          labelKey: 'sidebar.payments',
          icon: CreditCard,
          soon: true,
        },
        { to: '/admin/reports', labelKey: 'sidebar.reports', icon: FileBarChart, soon: true },
      ],
    },
  ],
}
