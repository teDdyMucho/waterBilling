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
    .select('*, items:bill_items(*), cycle:billing_cycles(code), property:properties(block, lot)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as BillWithRelations) ?? null
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
