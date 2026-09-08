import { supabase } from '@/lib/supabase'
import type { Bill, BillStatus, BillWithRelations, Rate, RateKind, ReadingStatus } from '@/types/domain'

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

/** Bilang kada cycle: para malaman kung pwede nang mag-generate/release. */
export interface CycleStats {
  /** Reading na 'verified' — ito ang ginagamit ng generate_bills. */
  verified: number
  /** Hati ng verified ayon sa uri ng metro. */
  verifiedWater: number
  verifiedElectric: number
  /** Reading na naka-encode pero hindi pa verified (for_review). */
  forReview: number
  /** Draft bills na na-generate na — pwede nang i-release. */
  draftBills: number
  /**
   * Ilang property ang aktuwal na may magagawa ang Generate: wala pang bill,
   * O may DRAFT na bill na may basang hindi pa kasama rito (hal. na-encode
   * o na-assign mula sa Unknown pagkatapos mag-generate).
   * Kapag 0, walang mangyayari kahit pindutin — kaya patay ang button.
   */
  generatable: number
  /** Nailabas na at hinihintay pa ang bayad (kasama ang overdue). */
  releasedBills: number
  /** Bayad na. */
  paidBills: number
}

/** Stats ng lahat ng cycle sa isang tawag (map by cycle id). */
export async function fetchCycleStats(): Promise<Record<string, CycleStats>> {
  const [readingsRes, billsRes, itemsRes] = await Promise.all([
    supabase
      .from('meter_readings')
      .select('id, billing_cycle_id, status, meter:meters(utility_type, property_id)')
      .in('status', ['verified', 'for_review']),
    // Lahat ng bill — para makita kung ano na ang meron kada cycle.
    supabase.from('bills').select('billing_cycle_id, status, property_id'),
    // Aling basa ang NAKAPASOK na sa isang bill — ito ang paraan para
    // malaman kung may bago pang dapat isama.
    supabase
      .from('bill_items')
      .select('meter_reading_id, bill:bills(billing_cycle_id)')
      .not('meter_reading_id', 'is', null),
  ])
  if (readingsRes.error) throw readingsRes.error
  if (billsRes.error) throw billsRes.error
  if (itemsRes.error) throw itemsRes.error

  const map: Record<string, CycleStats> = {}
  const at = (id: string) =>
    (map[id] ??= {
      verified: 0,
      verifiedWater: 0,
      verifiedElectric: 0,
      forReview: 0,
      draftBills: 0,
      generatable: 0,
      releasedBills: 0,
      paidBills: 0,
    })

  // cycle -> property -> mga verified na reading id
  const readyProps = new Map<string, Map<string, Set<string>>>()
  // cycle -> property -> status ng bill nito
  const billStatus = new Map<string, Map<string, string>>()
  // cycle -> mga reading id na nakapasok na sa isang bill
  const billedReadings = new Map<string, Set<string>>()

  for (const r of (readingsRes.data ?? []) as unknown as {
    id: string
    billing_cycle_id: string | null
    status: string
    meter: { utility_type: string; property_id: string } | null
  }[]) {
    if (!r.billing_cycle_id) continue
    const c = at(r.billing_cycle_id)
    if (r.status === 'verified') {
      c.verified++
      if (r.meter?.utility_type === 'electric') c.verifiedElectric++
      else c.verifiedWater++
      if (r.meter?.property_id) {
        const byProp = readyProps.get(r.billing_cycle_id) ?? new Map<string, Set<string>>()
        readyProps.set(r.billing_cycle_id, byProp)
        const set = byProp.get(r.meter.property_id) ?? new Set<string>()
        byProp.set(r.meter.property_id, set)
        set.add(r.id)
      }
    } else if (r.status === 'for_review') c.forReview++
  }

  for (const it of (itemsRes.data ?? []) as unknown as {
    meter_reading_id: string | null
    bill: { billing_cycle_id: string } | null
  }[]) {
    if (!it.meter_reading_id || !it.bill?.billing_cycle_id) continue
    const set = billedReadings.get(it.bill.billing_cycle_id) ?? new Set<string>()
    billedReadings.set(it.bill.billing_cycle_id, set)
    set.add(it.meter_reading_id)
  }
  for (const b of (billsRes.data ?? []) as {
    billing_cycle_id: string | null
    status: string
    property_id: string | null
  }[]) {
    if (!b.billing_cycle_id) continue
    const c = at(b.billing_cycle_id)
    if (b.status === 'draft') c.draftBills++
    else if (b.status === 'paid') c.paidBills++
    else if (b.status !== 'voided') c.releasedBills++
    if (b.property_id) {
      const byProp = billStatus.get(b.billing_cycle_id) ?? new Map<string, string>()
      billStatus.set(b.billing_cycle_id, byProp)
      byProp.set(b.property_id, b.status)
    }
  }

  // Magagawan pa ba ng bill? Oo kung: wala pang bill ang property, o draft
  // pa ito at may basang hindi pa kasama. Ang nailabas na ay hindi na
  // ginagalaw ng generate_bills (tingnan ang migration 0022).
  for (const [cycleId, byProp] of readyProps) {
    const statuses = billStatus.get(cycleId)
    const billed = billedReadings.get(cycleId)
    let n = 0
    for (const [propId, readingIds] of byProp) {
      const status = statuses?.get(propId)
      if (!status) {
        n++
      } else if (status === 'draft') {
        for (const id of readingIds) {
          if (!billed?.has(id)) {
            n++
            break
          }
        }
      }
    }
    at(cycleId).generatable = n
  }
  return map
}

/** Item na may kaakibat na basa ng metro (water / electric). */
export interface BillPhotoItem {
  id: string
  item_type: string
  meter_reading_id: string | null
  reading?: {
    previous_reading: number
    present_reading: number
    consumption: number
    status: ReadingStatus
    photo_path: string
  } | null
}

export type CycleBillRow = Bill & {
  property: { block: string; lot: string } | null
  items: BillPhotoItem[]
}

export async function fetchBillsForCycle(cycleId: string): Promise<CycleBillRow[]> {
  const { data, error } = await supabase
    .from('bills')
    .select(
      '*, property:properties(block, lot), items:bill_items(id, item_type, meter_reading_id, reading:meter_readings(previous_reading, present_reading, consumption, status, photo_path))',
    )
    .eq('billing_cycle_id', cycleId)
    .order('bill_no', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as CycleBillRow[]
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
/** Isang buwan sa kasaysayan ng homeowner. */
export type MyBillRow = Bill & {
  cycle: { code: string; reading_start: string | null; reading_end: string | null } | null
  /** Konsumo kada utility — para makita ang buwan-buwan na paggamit. */
  items: { item_type: string; quantity: number | null }[]
}

export async function fetchMyBills(): Promise<MyBillRow[]> {
  const { data, error } = await supabase
    .from('bills')
    .select(
      '*, cycle:billing_cycles(code, reading_start, reading_end), items:bill_items(item_type, quantity)',
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as MyBillRow[]
}

export async function fetchBill(id: string): Promise<BillWithRelations | null> {
  const { data, error } = await supabase
    .from('bills')
    .select(
      '*, items:bill_items(*, reading:meter_readings(previous_reading, present_reading, consumption, status, photo_path)), cycle:billing_cycles(code), property:properties(block, lot, owners:property_owners(end_date, profile:profiles(full_name, avatar_url)))',
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
      '*, items:bill_items(*, reading:meter_readings(previous_reading, present_reading, consumption, status, photo_path)), cycle:billing_cycles(code), property:properties(block, lot, owners:property_owners(end_date, profile:profiles(full_name, avatar_url)))',
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

/**
 * Buwan-buwang kasaysayan ng ISANG property (admin/staff view).
 * Kasama ang draft — kailangang makita ng admin ang kabuuan, hindi lang
 * ang mga nailabas na.
 */
export interface PropertyHistoryRow {
  id: string
  bill_no: string
  status: BillStatus
  total_amount: number
  amount_paid: number
  cycle: { code: string } | null
  items: { item_type: string; quantity: number | null }[]
}

export async function fetchPropertyBillHistory(propertyId: string): Promise<PropertyHistoryRow[]> {
  const { data, error } = await supabase
    .from('bills')
    .select(
      'id, bill_no, status, total_amount, amount_paid, cycle:billing_cycles(code), items:bill_items(item_type, quantity)',
    )
    .eq('property_id', propertyId)
    .neq('status', 'voided')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as PropertyHistoryRow[]
}
