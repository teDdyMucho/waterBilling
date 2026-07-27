import { supabase } from '@/lib/supabase'
import type { Bill, BillWithRelations, Rate, RateKind } from '@/types/domain'

// ---- Rates ----------------------------------------------------------

export async function fetchRates(): Promise<Rate[]> {
  const { data, error } = await supabase
    .from('rates')
    .select('*')
    .order('kind', { ascending: true })
    .order('effective_from', { ascending: false })
  if (error) throw error
  return (data ?? []) as Rate[]
}

export interface RateInput {
  kind: RateKind
  rate_per_unit?: number
  minimum_charge?: number
  fixed_amount?: number
  penalty_percent?: number
  penalty_fixed?: number
  effective_from: string
}

/**
 * Magtakda ng bagong rate. Isinasara ang lumang aktibong rate ng parehong
 * kind (effective_to = kahapon ng bagong effective_from) para effective-dated.
 */
export async function setRate(input: RateInput): Promise<void> {
  // Isara ang kasalukuyang bukas na rate ng parehong kind
  const dayBefore = new Date(input.effective_from)
  dayBefore.setDate(dayBefore.getDate() - 1)
  const closeDate = dayBefore.toISOString().slice(0, 10)

  await supabase
    .from('rates')
    .update({ effective_to: closeDate })
    .eq('kind', input.kind)
    .is('effective_to', null)

  const { error } = await supabase.from('rates').insert({
    kind: input.kind,
    rate_type: input.kind === 'assoc_dues' ? 'fixed' : 'flat',
    rate_per_unit: input.rate_per_unit ?? 0,
    minimum_charge: input.minimum_charge ?? 0,
    fixed_amount: input.fixed_amount ?? 0,
    penalty_percent: input.penalty_percent ?? 0,
    penalty_fixed: input.penalty_fixed ?? 0,
    effective_from: input.effective_from,
    is_active: true,
  })
  if (error) throw error
}

// ---- Bills (admin) --------------------------------------------------

export async function generateBills(cycleId: string): Promise<number> {
  const { data, error } = await supabase.rpc('generate_bills', { p_cycle_id: cycleId })
  if (error) throw error
  return Number(data ?? 0)
}

export async function releaseBills(cycleId: string): Promise<number> {
  const { data, error } = await supabase.rpc('release_cycle_bills', { p_cycle_id: cycleId })
  if (error) throw error
  return Number(data ?? 0)
}

export async function applyPenalties(): Promise<number> {
  const { data, error } = await supabase.rpc('apply_penalties')
  if (error) throw error
  return Number(data ?? 0)
}

export async function fetchBillsForCycle(cycleId: string): Promise<
  (Bill & { property: { block: string; lot: string } | null })[]
> {
  const { data, error } = await supabase
    .from('bills')
    .select('*, property:properties(block, lot)')
    .eq('billing_cycle_id', cycleId)
    .order('bill_no', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as (Bill & {
    property: { block: string; lot: string } | null
  })[]
}

export interface BillListRow extends Bill {
  cycle: { code: string } | null
  property: { block: string; lot: string } | null
  ownerName: string | null
  ownerAvatar: string | null
}

/** Lahat ng released na bill (staff/admin read-only view) — kasama ang pangalan ng homeowner. */
export async function fetchAllBills(): Promise<BillListRow[]> {
  const { data, error } = await supabase
    .from('bills')
    .select(
      '*, cycle:billing_cycles(code), property:properties(block, lot, owners:property_owners(end_date, profile:profiles(full_name, avatar_url)))',
    )
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (
    (data ?? []) as unknown as (Bill & {
      cycle: { code: string } | null
      property: {
        block: string
        lot: string
        owners: {
          end_date: string | null
          profile: { full_name: string; avatar_url: string | null } | null
        }[]
      } | null
    })[]
  ).map((b) => {
    // Kasalukuyang may-ari = walang end_date (hindi pa lumipat/umalis).
    const owner = b.property?.owners?.find((o) => !o.end_date)?.profile ?? null
    return {
      ...b,
      property: b.property ? { block: b.property.block, lot: b.property.lot } : null,
      ownerName: owner?.full_name ?? null,
      ownerAvatar: owner?.avatar_url ?? null,
    }
  })
}

export async function voidBill(id: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('bills')
    .update({ status: 'voided', void_reason: reason })
    .eq('id', id)
  if (error) throw error
}

// ---- Bills (homeowner) ----------------------------------------------

/** Mga bill ng kasalukuyang homeowner (hindi kasama ang draft — RLS). */
export async function fetchMyBills(): Promise<
  (Bill & { cycle: { code: string } | null })[]
> {
  const { data, error } = await supabase
    .from('bills')
    .select('*, cycle:billing_cycles(code)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as (Bill & { cycle: { code: string } | null })[]
}

export async function fetchBill(id: string): Promise<BillWithRelations | null> {
  const { data, error } = await supabase
    .from('bills')
    .select(
      '*, items:bill_items(*), cycle:billing_cycles(code), property:properties(block, lot, owners:property_owners(end_date, profile:profiles(full_name, avatar_url)))',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as BillWithRelations) ?? null
}

/**
 * Buong history ng bill ng isang property (staff/admin read-only).
 * Kasama ang line items ng bawat bill + pangalan/avatar ng kasalukuyang may-ari.
 */
export async function fetchBillsForProperty(propertyId: string): Promise<{
  owner: { name: string | null; avatar: string | null; block: string | null; lot: string | null }
  bills: BillWithRelations[]
}> {
  const { data, error } = await supabase
    .from('bills')
    .select(
      '*, items:bill_items(*), cycle:billing_cycles(code), property:properties(block, lot, owners:property_owners(end_date, profile:profiles(full_name, avatar_url)))',
    )
    .eq('property_id', propertyId)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
  if (error) throw error
  const bills = (data ?? []) as unknown as BillWithRelations[]
  const prop = bills[0]?.property ?? null
  const owner = prop?.owners?.find((o) => !o.end_date)?.profile ?? null
  return {
    owner: {
      name: owner?.full_name ?? null,
      avatar: owner?.avatar_url ?? null,
      block: prop?.block ?? null,
      lot: prop?.lot ?? null,
    },
    bills,
  }
}

/** Kabuuang balanse ng homeowner (para sa dashboard). */
export async function fetchMyBalance(): Promise<number> {
  const { data, error } = await supabase
    .from('bills')
    .select('balance')
    .in('status', ['unpaid', 'partially_paid', 'overdue', 'payment_pending'])
  if (error) throw error
  return (data ?? []).reduce((sum, b) => sum + Number((b as { balance: number }).balance), 0)
}

/** Babayaran ngayong buwan: kabuuang balanse + pinakamalapit na due date. */
export async function fetchAmountDue(): Promise<{
  total: number
  dueDate: string | null
  overdue: boolean
}> {
  const { data, error } = await supabase
    .from('bills')
    .select('balance, due_date, status')
    .in('status', ['unpaid', 'partially_paid', 'overdue', 'payment_pending'])
  if (error) throw error
  const rows = (data ?? []) as { balance: number; due_date: string | null; status: string }[]
  const total = rows.reduce((s, b) => s + Number(b.balance), 0)
  const dueDates = rows.map((b) => b.due_date).filter((d): d is string => Boolean(d)).sort()
  return {
    total,
    dueDate: dueDates[0] ?? null,
    overdue: rows.some((b) => b.status === 'overdue'),
  }
}
