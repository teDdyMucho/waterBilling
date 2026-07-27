import { supabase } from '@/lib/supabase'

// ---- Dashboard KPIs -------------------------------------------------

export interface DashboardStats {
  billed: number
  collected: number
  outstanding: number
  collectionRate: number // 0..1
}

const ACTIVE_BILL = ['unpaid', 'partially_paid', 'overdue', 'payment_pending']

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase
    .from('bills')
    .select('total_amount, amount_paid, balance, status')
    .neq('status', 'draft')
    .neq('status', 'voided')
  if (error) throw error
  const rows = (data ?? []) as {
    total_amount: number
    amount_paid: number
    balance: number
    status: string
  }[]

  let billed = 0
  let collected = 0
  let outstanding = 0
  for (const b of rows) {
    billed += Number(b.total_amount)
    collected += Number(b.amount_paid)
    if (ACTIVE_BILL.includes(b.status)) outstanding += Number(b.balance)
  }
  return {
    billed,
    collected,
    outstanding,
    collectionRate: billed > 0 ? collected / billed : 0,
  }
}

// ---- Collection per cycle ------------------------------------------

export interface CollectionRow {
  cycle: string
  billed: number
  collected: number
  outstanding: number
  rate: number
}

export async function fetchCollectionByCycle(): Promise<CollectionRow[]> {
  const { data, error } = await supabase
    .from('bills')
    .select('total_amount, amount_paid, balance, status, cycle:billing_cycles(code)')
    .neq('status', 'draft')
    .neq('status', 'voided')
  if (error) throw error

  const map = new Map<string, CollectionRow>()
  for (const b of (data ?? []) as unknown as {
    total_amount: number
    amount_paid: number
    balance: number
    status: string
    cycle: { code: string } | null
  }[]) {
    const code = b.cycle?.code ?? '—'
    if (!map.has(code)) map.set(code, { cycle: code, billed: 0, collected: 0, outstanding: 0, rate: 0 })
    const r = map.get(code)!
    r.billed += Number(b.total_amount)
    r.collected += Number(b.amount_paid)
    if (ACTIVE_BILL.includes(b.status)) r.outstanding += Number(b.balance)
  }
  const rows = [...map.values()].sort((a, b) => b.cycle.localeCompare(a.cycle))
  rows.forEach((r) => (r.rate = r.billed > 0 ? r.collected / r.billed : 0))
  return rows
}

// ---- Aging (outstanding by days overdue) ---------------------------

export interface AgingRow {
  bill_no: string
  property: string
  balance: number
  daysOverdue: number
  bucket: string
}

function bucketFor(days: number): string {
  if (days <= 0) return 'Current'
  if (days <= 30) return '1–30'
  if (days <= 60) return '31–60'
  if (days <= 90) return '61–90'
  return '90+'
}

export async function fetchAging(): Promise<AgingRow[]> {
  const { data, error } = await supabase
    .from('bills')
    .select('bill_no, balance, due_date, status, property:properties(block, lot)')
    .in('status', ACTIVE_BILL)
    .gt('balance', 0)
  if (error) throw error

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return ((data ?? []) as unknown as {
    bill_no: string
    balance: number
    due_date: string | null
    property: { block: string; lot: string } | null
  }[]).map((b) => {
    const days = b.due_date
      ? Math.round((today.getTime() - new Date(b.due_date).getTime()) / 86_400_000)
      : 0
    return {
      bill_no: b.bill_no,
      property: b.property ? `Blk ${b.property.block} Lot ${b.property.lot}` : '—',
      balance: Number(b.balance),
      daysOverdue: Math.max(0, days),
      bucket: bucketFor(days),
    }
  })
}

// ---- Payment log (confirmed) ---------------------------------------

export interface PaymentLogRow {
  or_no: string
  payment_no: string
  payer: string
  amount: number
  method: string
  date: string
  confirmed_at: string
}

export async function fetchPaymentLog(): Promise<PaymentLogRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(
      'payment_no, official_receipt_no, amount, method, payment_date, confirmed_at, submitter:profiles!payments_submitted_by_fkey(full_name)',
    )
    .eq('status', 'confirmed')
    .order('confirmed_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as {
    payment_no: string
    official_receipt_no: string | null
    amount: number
    method: string
    payment_date: string
    confirmed_at: string
    submitter: { full_name: string } | null
  }[]).map((p) => ({
    or_no: p.official_receipt_no ?? '—',
    payment_no: p.payment_no,
    payer: p.submitter?.full_name ?? '—',
    amount: Number(p.amount),
    method: p.method,
    date: p.payment_date,
    confirmed_at: p.confirmed_at,
  }))
}

// ---- Audit log ------------------------------------------------------

export interface AuditRow {
  id: string
  action: string
  entity_table: string | null
  entity_id: string | null
  new_values: unknown
  created_at: string
  actor: { full_name: string } | null
}

export async function fetchAuditLogs(): Promise<AuditRow[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, actor:profiles!audit_logs_actor_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as unknown as AuditRow[]
}
