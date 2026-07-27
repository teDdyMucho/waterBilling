/** Mga uri na tumutugma sa public.profiles at sa iba pang tables. */

export type Role = 'admin' | 'staff' | 'homeowner'
export type AccountStatus = 'pending' | 'active' | 'suspended' | 'rejected'
export type Language = 'en' | 'tl'

export interface Profile {
  id: string
  email: string | null
  full_name: string
  contact_number: string | null
  role: Role
  status: AccountStatus
  block: string | null
  lot: string | null
  zone: string | null
  avatar_url: string | null
  preferred_language: Language
  rejection_reason: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

/** Saan pupunta ang bawat role kapag active na. */
export const ROLE_HOME: Record<Role, string> = {
  admin: '/admin',
  staff: '/staff',
  homeowner: '/dashboard',
}

// ---- Phase 2: Properties & Meters ----------------------------------

export type PropertyStatus = 'occupied' | 'vacant' | 'inactive'
export type UtilityType = 'water' | 'electric'
export type MeterStatus = 'active' | 'replaced' | 'inactive'

export interface Property {
  id: string
  block: string
  lot: string
  phase: string | null
  address_line: string | null
  assigned_zone: string | null
  status: PropertyStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Meter {
  id: string
  property_id: string
  utility_type: UtilityType
  meter_number: string | null
  initial_reading: number
  digits: number
  status: MeterStatus
  replaced_meter_id: string | null
  installed_at: string | null
  created_at: string
  updated_at: string
}

export interface PropertyOwner {
  id: string
  property_id: string
  profile_id: string
  is_primary: boolean
  start_date: string
  end_date: string | null
  created_at: string
}

/** Row mula sa homeowner_directory view (para sa pag-link). */
export interface HomeownerDirectoryRow {
  id: string
  full_name: string
  email: string | null
  contact_number: string | null
  block: string | null
  lot: string | null
  status: AccountStatus
}

/** Property na may kasamang meters at owner names (para sa listahan/detalye). */
export interface PropertyWithRelations extends Property {
  meters: Meter[]
  owners: (PropertyOwner & { profile: { full_name: string; email: string | null } | null })[]
}

// ---- Phase 3: Billing Cycles & Meter Readings ----------------------

export type CycleStatus = 'open' | 'reading' | 'billed' | 'closed'
export type ReadingStatus = 'draft' | 'for_review' | 'verified' | 'rejected'

export interface BillingCycle {
  id: string
  code: string
  reading_start: string | null
  reading_end: string | null
  bill_date: string | null
  due_date: string | null
  grace_days: number
  status: CycleStatus
  created_at: string
  updated_at: string
}

export interface MeterReading {
  id: string
  meter_id: string
  billing_cycle_id: string
  previous_reading: number
  present_reading: number
  consumption: number
  photo_path: string
  photo_taken_at: string | null
  read_by: string | null
  read_at: string | null
  status: ReadingStatus
  remarks: string | null
  is_anomaly: boolean
  created_at: string
  updated_at: string
}

/** Isang metro sa worklist — kasama ang property + reading (kung meron na). */
export interface WorklistItem {
  meter: Meter
  property: Pick<Property, 'id' | 'block' | 'lot' | 'phase'>
  ownerName: string | null
  reading: MeterReading | null
}

// ---- Phase 4: Rates & Bills ----------------------------------------

export type RateKind = 'water' | 'electric' | 'assoc_dues' | 'penalty'
export type BillStatus =
  | 'draft'
  | 'unpaid'
  | 'payment_pending'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'voided'
export type BillItemType =
  | 'water'
  | 'electric'
  | 'assoc_dues'
  | 'penalty'
  | 'adjustment'
  | 'previous_balance'

export interface Rate {
  id: string
  kind: RateKind
  rate_type: 'flat' | 'tiered' | 'fixed'
  rate_per_unit: number
  minimum_charge: number
  fixed_amount: number
  tiers: unknown | null
  penalty_percent: number
  penalty_fixed: number
  effective_from: string
  effective_to: string | null
  is_active: boolean
  created_at: string
}

export interface Bill {
  id: string
  bill_no: string
  property_id: string
  billing_cycle_id: string
  previous_balance: number
  water_amount: number
  electric_amount: number
  assoc_dues: number
  current_charges: number
  penalty_amount: number
  total_amount: number
  amount_paid: number
  balance: number
  due_date: string | null
  status: BillStatus
  released_at: string | null
  void_reason: string | null
  created_at: string
  updated_at: string
}

export interface BillItem {
  id: string
  bill_id: string
  item_type: BillItemType
  meter_reading_id: string | null
  rate_id: string | null
  quantity: number | null
  unit_price: number | null
  amount: number
  description: string | null
}

/** Bill na may line items + cycle code + property label (para sa detalye). */
export interface BillWithRelations extends Bill {
  items: BillItem[]
  cycle: { code: string } | null
  property: Pick<Property, 'block' | 'lot'> | null
}

// ---- Phase 6: Messaging & Notifications ----------------------------

export type ThreadCategory = 'billing' | 'meter' | 'requirements' | 'complaint' | 'others'
export type ThreadStatus = 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed'

export interface Attachment {
  path: string
  name: string
}

export interface MessageThread {
  id: string
  ticket_no: string
  property_id: string | null
  opened_by: string
  category: ThreadCategory
  subject: string
  priority: 'low' | 'normal' | 'high'
  status: ThreadStatus
  assigned_to: string | null
  last_message_at: string
  created_at: string
  updated_at: string
}

export interface ThreadMessage {
  id: string
  thread_id: string
  sender_id: string
  body: string
  attachments: Attachment[]
  is_internal_note: boolean
  created_at: string
}

/** Thread na may kasamang pangalan ng nag-open (para sa inbox). */
export interface ThreadWithOpener extends MessageThread {
  opener: { full_name: string; avatar_url: string | null } | null
}

export interface AppNotification {
  id: string
  recipient_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  audience: 'all' | 'homeowners' | 'staff' | 'block'
  target_block: string | null
  is_public: boolean
  posted_by: string | null
  published_at: string
  created_at: string
}

// ---- Phase 7: Payments ---------------------------------------------

export type PaymentMethod = 'gcash' | 'maya' | 'bank_transfer' | 'cash'
export type PaymentStatus = 'submitted' | 'endorsed' | 'confirmed' | 'rejected' | 'voided'

export interface PaymentSettings {
  id: number
  gcash_number: string | null
  gcash_name: string | null
  maya_number: string | null
  maya_name: string | null
  bank_name: string | null
  bank_account: string | null
  bank_account_name: string | null
  qr_path: string | null
  instructions: string | null
  updated_at: string
}

export interface Payment {
  id: string
  payment_no: string
  bill_id: string | null
  property_id: string | null
  submitted_by: string
  amount: number
  method: PaymentMethod
  reference_number: string | null
  payment_date: string
  proof_path: string | null
  status: PaymentStatus
  endorsed_by: string | null
  endorsed_at: string | null
  endorse_remarks: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  rejection_reason: string | null
  void_reason: string | null
  official_receipt_no: string | null
  created_at: string
  updated_at: string
}

/** Payment na may bill + submitter info (para sa staff/admin queue). */
export interface PaymentWithRelations extends Payment {
  bill: { bill_no: string; total_amount: number; balance: number } | null
  submitter: { full_name: string; avatar_url: string | null } | null
}
