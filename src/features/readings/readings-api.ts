import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/image'
import type {
  BillingCycle,
  MeterReading,
  Meter,
  Property,
  UnassignedKind,
  UnassignedReading,
  UtilityType,
  WorklistItem,
} from '@/types/domain'

// ---- Billing cycles -------------------------------------------------

/** Kasama ang property at pangalan ng may-ari — kanino ba ang cycle. */
const CYCLE_SELECT =
  '*, property:properties(block, lot, owners:property_owners(end_date, profile:profiles(full_name)))'

type CycleRow = BillingCycle & {
  property:
    | {
        block: string
        lot: string
        owners: { end_date: string | null; profile: { full_name: string } | null }[]
      }
    | null
}

function withOwner(rows: CycleRow[]): BillingCycle[] {
  return rows.map((c) => ({
    ...c,
    property: c.property ? { block: c.property.block, lot: c.property.lot } : null,
    ownerName: c.property?.owners?.find((o) => !o.end_date)?.profile?.full_name ?? null,
  }))
}

export async function fetchCycles(): Promise<BillingCycle[]> {
  const { data, error } = await supabase
    .from('billing_cycles')
    .select(CYCLE_SELECT)
    .order('code', { ascending: false })
  if (error) throw error
  return withOwner((data ?? []) as unknown as CycleRow[])
}

/** LAHAT ng bukas na cycle — isa kada property, kaya marami ang posible. */
export async function fetchOpenCycles(): Promise<BillingCycle[]> {
  const { data, error } = await supabase
    .from('billing_cycles')
    .select(CYCLE_SELECT)
    .in('status', ['open', 'reading'])
    .order('code', { ascending: false })
  if (error) throw error
  return withOwner((data ?? []) as unknown as CycleRow[])
}

/** Ang kasalukuyang cycle na binabasa (open/reading), pinakabago. */
export async function fetchActiveCycle(): Promise<BillingCycle | null> {
  const { data, error } = await supabase
    .from('billing_cycles')
    .select('*')
    .in('status', ['open', 'reading'])
    .order('code', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as BillingCycle) ?? null
}

export interface CycleInput {
  code: string
  /** Kaninong property ang cycle na ito. */
  property_id: string | null
  reading_start?: string | null
  reading_end?: string | null
  bill_date?: string | null
  due_date?: string | null
  grace_days: number
  status: BillingCycle['status']
}

export async function createCycle(input: CycleInput): Promise<BillingCycle> {
  const { data, error } = await supabase
    .from('billing_cycles')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data as BillingCycle
}

export async function updateCycle(id: string, input: Partial<CycleInput>): Promise<void> {
  const { error } = await supabase.from('billing_cycles').update(input).eq('id', id)
  if (error) throw error
}

/** Buburahin ang cycle — cascade sa readings at bills nito (admin lang, RLS). */
export async function deleteCycle(id: string): Promise<void> {
  const { error } = await supabase.from('billing_cycles').delete().eq('id', id)
  if (error) throw error
}

// ---- Previous reading (RPC) ----------------------------------------

export async function getPreviousReading(meterId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_previous_reading', { p_meter_id: meterId })
  if (error) throw error
  return Number(data ?? 0)
}

// ---- Photo storage --------------------------------------------------

/** I-compress at i-upload ang litrato ng metro. Ibinabalik ang path. */
export async function uploadMeterPhoto(
  file: File,
  cycleCode: string,
  /** meter id, o `unassigned/<kind>` para sa walang metrong reading. */
  meterId: string,
): Promise<string> {
  const blob = await compressImage(file, { maxDim: 1280, quality: 0.7 })
  const path = `${cycleCode}/${meterId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from('meter-photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return path
}

/** Kunin ang photo_path ng isang reading (para sa bill detail viewer). */
export async function fetchReadingPhotoPath(readingId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('meter_readings')
    .select('photo_path')
    .eq('id', readingId)
    .maybeSingle()
  if (error) throw error
  return (data as { photo_path: string } | null)?.photo_path ?? null
}

/** Signed URL (5 min) para matingnan ang pribadong litrato. */
export async function getSignedPhotoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('meter-photos')
    .createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}

// ---- Readings -------------------------------------------------------

export interface CreateReadingInput {
  meterId: string
  cycleId: string
  present: number
  /**
   * Ibinigay na previous reading. Kapag null/undefined, ang server ang
   * bahalang kumuha ng huling nabasa (tingnan ang migration 0018).
   */
  previous?: number | null
  photoPath: string
  remarks?: string
  readById: string
}

export async function createReading(input: CreateReadingInput): Promise<void> {
  const { error } = await supabase.from('meter_readings').insert({
    meter_id: input.meterId,
    billing_cycle_id: input.cycleId,
    present_reading: input.present,
    previous_reading: input.previous ?? null,
    photo_path: input.photoPath,
    remarks: input.remarks?.trim() || null,
    read_by: input.readById,
  })
  if (error) throw error
}

/**
 * Worklist ng isang cycle. Kapag ang cycle ay para sa isang property
 * (migration 0026), ang metro ng property na iyon LANG ang kasama.
 */
export async function fetchWorklist(cycleId: string): Promise<WorklistItem[]> {
  const { data: cycle, error: cErr } = await supabase
    .from('billing_cycles')
    .select('property_id')
    .eq('id', cycleId)
    .maybeSingle()
  if (cErr) throw cErr
  const propertyId = (cycle as { property_id: string | null } | null)?.property_id ?? null

  let mq = supabase
    .from('meters')
    .select(
      '*, property:properties(id, block, lot, phase, owners:property_owners(end_date, profile:profiles(full_name)))',
    )
    .eq('status', 'active')
  if (propertyId) mq = mq.eq('property_id', propertyId)

  const { data: meters, error: mErr } = await mq
  if (mErr) throw mErr

  const { data: readings, error: rErr } = await supabase
    .from('meter_readings')
    .select('*')
    .eq('billing_cycle_id', cycleId)
  if (rErr) throw rErr

  const byMeter = new Map<string, MeterReading>()
  for (const r of (readings ?? []) as MeterReading[]) byMeter.set(r.meter_id, r)

  // Pangalan ng nag-encode (read_by → profiles). Isang query lang.
  const readerIds = [
    ...new Set((readings ?? []).map((r: MeterReading) => r.read_by).filter(Boolean)),
  ] as string[]
  const readerNames = new Map<string, string>()
  if (readerIds.length) {
    const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', readerIds)
    for (const p of (profs ?? []) as { id: string; full_name: string }[]) {
      readerNames.set(p.id, p.full_name)
    }
  }

  return ((meters ?? []) as unknown as (Meter & {
    property: (Pick<Property, 'id' | 'block' | 'lot' | 'phase'> & {
      owners: { end_date: string | null; profile: { full_name: string } | null }[]
    }) | null
  })[]).map((m) => {
    const activeOwner = m.property?.owners?.find((o) => !o.end_date)
    const { property: _p, ...meter } = m
    const reading = byMeter.get(m.id) ?? null
    return {
      cycle: { id: cycleId, code: '' },
      meter: meter as Meter,
      property: m.property
        ? { id: m.property.id, block: m.property.block, lot: m.property.lot, phase: m.property.phase }
        : { id: '', block: '?', lot: '?', phase: null },
      ownerName: activeOwner?.profile?.full_name ?? null,
      reading,
      readerName: reading?.read_by ? readerNames.get(reading.read_by) ?? null : null,
    }
  })
}

// ---- Admin review ---------------------------------------------------

export interface ReviewReading extends MeterReading {
  meter: (Meter & { property: Pick<Property, 'block' | 'lot'> | null }) | null
}

export async function fetchReadingsForReview(): Promise<ReviewReading[]> {
  const { data, error } = await supabase
    .from('meter_readings')
    .select('*, meter:meters(*, property:properties(block, lot))')
    .eq('status', 'for_review')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as ReviewReading[]
}

export async function verifyReading(id: string): Promise<void> {
  const { error } = await supabase
    .from('meter_readings')
    .update({ status: 'verified' })
    .eq('id', id)
  if (error) throw error
}

export async function rejectReading(id: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('meter_readings')
    .update({ status: 'rejected', remarks: reason })
    .eq('id', id)
  if (error) throw error
}

export interface ConsumptionPoint {
  code: string
  water: number | null
  electric: number | null
}

/**
 * Kasaysayan ng konsumo ng homeowner (hanggang 12 cycle).
 * RLS: sariling metro lang ang babalik (owns_meter).
 */
export async function fetchMyConsumption(): Promise<ConsumptionPoint[]> {
  const { data, error } = await supabase
    .from('meter_readings')
    .select('consumption, status, meter:meters(utility_type), cycle:billing_cycles(code)')
    .in('status', ['verified', 'for_review'])
  if (error) throw error

  const map = new Map<string, ConsumptionPoint>()
  for (const row of (data ?? []) as unknown as {
    consumption: number
    meter: { utility_type: string } | null
    cycle: { code: string } | null
  }[]) {
    const code = row.cycle?.code ?? '—'
    if (!map.has(code)) map.set(code, { code, water: null, electric: null })
    const p = map.get(code)!
    if (row.meter?.utility_type === 'water') p.water = Number(row.consumption)
    else if (row.meter?.utility_type === 'electric') p.electric = Number(row.consumption)
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code)).slice(-12)
}

export interface MyReadingRow {
  id: string
  code: string
  utility: 'water' | 'electric'
  present: number
  consumption: number
  photoPath: string | null
  readAt: string | null
}

/**
 * Mga reading ng homeowner (per metro, per cycle) kasama ang litrato ng metro
 * na kinuha ng staff. RLS: sariling metro lang (owns_meter).
 */
export async function fetchMyReadings(): Promise<MyReadingRow[]> {
  const { data, error } = await supabase
    .from('meter_readings')
    .select(
      'id, present_reading, consumption, photo_path, read_at, status, meter:meters(utility_type), cycle:billing_cycles(code)',
    )
    .in('status', ['verified', 'for_review'])
  if (error) throw error

  const rows = (data ?? []) as unknown as {
    id: string
    present_reading: number
    consumption: number
    photo_path: string | null
    read_at: string | null
    meter: { utility_type: string } | null
    cycle: { code: string } | null
  }[]

  return rows
    .map((r) => ({
      id: r.id,
      code: r.cycle?.code ?? '—',
      utility: (r.meter?.utility_type === 'electric' ? 'electric' : 'water') as 'water' | 'electric',
      present: Number(r.present_reading),
      consumption: Number(r.consumption),
      photoPath: r.photo_path,
      readAt: r.read_at,
    }))
    .sort((a, b) => b.code.localeCompare(a.code))
}

/** Pinakabagong reading ng isang metro (para sa homeowner card). */
export async function fetchLatestReading(meterId: string): Promise<MeterReading | null> {
  const { data, error } = await supabase
    .from('meter_readings')
    .select('*')
    .eq('meter_id', meterId)
    .in('status', ['verified', 'for_review'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as MeterReading) ?? null
}
// ---- Unassigned readings (Unknown / C.O. Subdivision) ---------------

export interface CreateUnassignedInput {
  cycleId: string
  kind: UnassignedKind
  utility: UtilityType
  meterNumber?: string | null
  previous?: number | null
  present: number
  photoPath: string
  remarks?: string
  readById: string
}

export async function createUnassignedReading(input: CreateUnassignedInput): Promise<void> {
  const { error } = await supabase.from('unassigned_readings').insert({
    billing_cycle_id: input.cycleId,
    kind: input.kind,
    utility_type: input.utility,
    meter_number: input.meterNumber?.trim() || null,
    previous_reading: input.previous ?? null,
    present_reading: input.present,
    photo_path: input.photoPath,
    remarks: input.remarks?.trim() || null,
    read_by: input.readById,
  })
  if (error) throw error
}

/** Mga naghihintay pa ng aksyon ng admin sa isang cycle. */
export async function fetchUnassignedReadings(cycleId: string): Promise<UnassignedReading[]> {
  const { data, error } = await supabase
    .from('unassigned_readings')
    .select('*')
    .eq('billing_cycle_id', cycleId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as UnassignedReading[]
}

/**
 * Ang error ng supabase.rpc() ay PostgrestError — hindi Error instance,
 * kaya nawawala ang mensahe kapag `e instanceof Error` ang tsek sa UI.
 * Dito ito ginagawang tunay na Error para makita ang totoong dahilan.
 */
function asError(e: { message?: string; details?: string; hint?: string }): Error {
  return new Error([e.message, e.details, e.hint].filter(Boolean).join(' — ') || 'RPC failed')
}

/** Italaga sa tunay na metro — gagawa ng tunay na reading (admin lang). */
export async function assignUnassignedReading(id: string, meterId: string): Promise<void> {
  const { error } = await supabase.rpc('assign_unassigned_reading', {
    p_id: id,
    p_meter_id: meterId,
  })
  if (error) throw asError(error)
}

/** Itapon — mali ang basa o doble (admin lang). */
export async function discardUnassignedReading(id: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('discard_unassigned_reading', {
    p_id: id,
    p_reason: reason ?? null,
  })
  if (error) throw asError(error)
}
/** Bilang ng naghihintay kada cycle, HIWALAY ang Unknown at C.O. */
export interface UnassignedCounts {
  unknown: number
  co_subdivision: number
  total: number
}

export async function fetchPendingUnassignedCounts(): Promise<Record<string, UnassignedCounts>> {
  const { data, error } = await supabase
    .from('unassigned_readings')
    .select('billing_cycle_id, kind')
    .eq('status', 'pending')
  if (error) throw error

  const out: Record<string, UnassignedCounts> = {}
  for (const r of (data ?? []) as { billing_cycle_id: string; kind: UnassignedKind }[]) {
    const c = (out[r.billing_cycle_id] ??= { unknown: 0, co_subdivision: 0, total: 0 })
    c[r.kind] += 1
    c.total += 1
  }
  return out
}
/** Lahat ng naghihintay sa lahat ng cycle — para sa tabs sa Billing Cycles. */
export interface PendingUnassigned extends UnassignedReading {
  cycle: { code: string } | null
}

export async function fetchAllPendingUnassigned(): Promise<PendingUnassigned[]> {
  const { data, error } = await supabase
    .from('unassigned_readings')
    .select('*, cycle:billing_cycles(code)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as PendingUnassigned[]
}

/**
 * Worklist ng LAHAT ng bukas na cycle. Dahil isa ang cycle kada property,
 * marami ang bukas nang sabay — dito pinagsasama para isang listahan lang
 * ang haharapin ng staff, at dala ng bawat item kung saang cycle ito
 * mase-save.
 */
export async function fetchOpenWorklist(): Promise<WorklistItem[]> {
  const cycles = await fetchOpenCycles()
  if (cycles.length === 0) return []

  const { data: meters, error: mErr } = await supabase
    .from('meters')
    .select(
      '*, property:properties(id, block, lot, phase, owners:property_owners(end_date, profile:profiles(full_name)))',
    )
    .eq('status', 'active')
  if (mErr) throw mErr

  const { data: readings, error: rErr } = await supabase
    .from('meter_readings')
    .select('*')
    .in(
      'billing_cycle_id',
      cycles.map((c) => c.id),
    )
  if (rErr) throw rErr

  // (meter_id + cycle_id) ang susi — puwedeng may basa ang metro sa
  // maraming cycle, at magkaiba sila.
  const byKey = new Map<string, MeterReading>()
  for (const r of (readings ?? []) as MeterReading[]) {
    byKey.set(`${r.meter_id}:${r.billing_cycle_id}`, r)
  }

  const readerIds = [
    ...new Set((readings ?? []).map((r: MeterReading) => r.read_by).filter(Boolean)),
  ] as string[]
  const readerNames = new Map<string, string>()
  if (readerIds.length) {
    const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', readerIds)
    for (const p of (profs ?? []) as { id: string; full_name: string }[]) {
      readerNames.set(p.id, p.full_name)
    }
  }

  const rows = (meters ?? []) as unknown as (Meter & {
    property:
      | (Pick<Property, 'id' | 'block' | 'lot' | 'phase'> & {
          owners: { end_date: string | null; profile: { full_name: string } | null }[]
        })
      | null
  })[]

  const items: WorklistItem[] = []
  for (const c of cycles) {
    for (const m of rows) {
      // Kapag may property ang cycle, ang metro nito lang ang kasama.
      if (c.property_id && m.property?.id !== c.property_id) continue
      const activeOwner = m.property?.owners?.find((o) => !o.end_date)
      const { property: _p, ...meter } = m
      const reading = byKey.get(`${m.id}:${c.id}`) ?? null
      items.push({
        cycle: { id: c.id, code: c.code },
        meter: meter as Meter,
        property: m.property
          ? { id: m.property.id, block: m.property.block, lot: m.property.lot, phase: m.property.phase }
          : { id: '', block: '?', lot: '?', phase: null },
        ownerName: activeOwner?.profile?.full_name ?? null,
        reading,
        readerName: reading?.read_by ? readerNames.get(reading.read_by) ?? null : null,
      })
    }
  }
  return items
}

/** Isang buwan (cycle) ng isang property, kasama ang metro at basa nito. */
export interface PropertyCycleGroup {
  cycle: { id: string; code: string; status: BillingCycle['status'] }
  items: WorklistItem[]
}

/**
 * BUONG kasaysayan ng basa ng isang property — lahat ng cycle niya, kasama
 * ang kasalukuyang bukas. Ang bukas lang ang puwedeng i-encode; ang iba ay
 * tinitingnan.
 */
export async function fetchPropertyReadings(propertyId: string): Promise<PropertyCycleGroup[]> {
  const { data: cyclesRaw, error: cErr } = await supabase
    .from('billing_cycles')
    .select('id, code, status')
    .eq('property_id', propertyId)
    .order('code', { ascending: false })
  if (cErr) throw cErr
  const cycles = (cyclesRaw ?? []) as { id: string; code: string; status: BillingCycle['status'] }[]
  if (cycles.length === 0) return []

  const { data: meters, error: mErr } = await supabase
    .from('meters')
    .select(
      '*, property:properties(id, block, lot, phase, owners:property_owners(end_date, profile:profiles(full_name)))',
    )
    .eq('status', 'active')
    .eq('property_id', propertyId)
  if (mErr) throw mErr

  const { data: readings, error: rErr } = await supabase
    .from('meter_readings')
    .select('*')
    .in(
      'billing_cycle_id',
      cycles.map((c) => c.id),
    )
  if (rErr) throw rErr

  const byKey = new Map<string, MeterReading>()
  for (const r of (readings ?? []) as MeterReading[]) {
    byKey.set(`${r.meter_id}:${r.billing_cycle_id}`, r)
  }

  const readerIds = [
    ...new Set((readings ?? []).map((r: MeterReading) => r.read_by).filter(Boolean)),
  ] as string[]
  const readerNames = new Map<string, string>()
  if (readerIds.length) {
    const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', readerIds)
    for (const p of (profs ?? []) as { id: string; full_name: string }[]) {
      readerNames.set(p.id, p.full_name)
    }
  }

  const rows = (meters ?? []) as unknown as (Meter & {
    property:
      | (Pick<Property, 'id' | 'block' | 'lot' | 'phase'> & {
          owners: { end_date: string | null; profile: { full_name: string } | null }[]
        })
      | null
  })[]

  return cycles.map((c) => ({
    cycle: c,
    items: rows.map((m) => {
      const activeOwner = m.property?.owners?.find((o) => !o.end_date)
      const { property: _p, ...meter } = m
      const reading = byKey.get(`${m.id}:${c.id}`) ?? null
      return {
        cycle: { id: c.id, code: c.code },
        meter: meter as Meter,
        property: m.property
          ? { id: m.property.id, block: m.property.block, lot: m.property.lot, phase: m.property.phase }
          : { id: '', block: '?', lot: '?', phase: null },
        ownerName: activeOwner?.profile?.full_name ?? null,
        reading,
        readerName: reading?.read_by ? readerNames.get(reading.read_by) ?? null : null,
      }
    }),
  }))
}
