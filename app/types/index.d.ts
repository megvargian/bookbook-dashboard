import type { AvatarProps } from '@nuxt/ui'

export type UserStatus = 'subscribed' | 'unsubscribed' | 'bounced'
export type SaleStatus = 'paid' | 'failed' | 'refunded'

export interface User {
  id: number
  name: string
  email: string
  avatar?: AvatarProps
  status: UserStatus
  location: string
}

export interface Customer {
  id: string
  created_at: string
  full_name: string
  phone_number?: string
  email: string
  gender?: string
  date_of_birth?: string
  total_visits?: number
  total_spent?: number
}

export interface Mail {
  id: number
  unread?: boolean
  from: User
  subject: string
  body: string
  date: string
}

export interface Member {
  name: string
  username: string
  role: 'member' | 'owner'
  avatar: AvatarProps
}

export interface Employee {
  id: string
  created_at: string
  full_name: string
  role: string
  email: string
  phone_number?: string
  service_types?: string
  is_active: boolean
  start_working_hour?: string
  end_working_hours?: string
  working_week_days?: string | string[]
  profile_picture?: string
}

export interface Stat {
  title: string
  icon: string
  value: number | string
  variation: number
  formatter?: (value: number) => string
}

export interface Sale {
  id: string
  date: string
  status: SaleStatus
  email: string
  amount: number
}

export interface Notification {
  id: string
  created_at: string
  type: 'new_booking' | 'status_update'
  title: string
  body: string
  is_read: boolean
  booking_id: string | null
  client_profile_id: string
  metadata: Record<string, any>
}

export type Period = 'daily' | 'weekly' | 'monthly'

export interface Range {
  start: Date
  end: Date
}
