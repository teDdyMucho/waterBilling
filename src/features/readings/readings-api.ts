import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/image'
import type {
  BillingCycle,
  MeterReading,
  Meter,
  Property,
  WorklistItem,
} from '@/types/domain'

// ---- Billing cycles -------------------------------------------------

export async function fetchCycles(): Promise<BillingCycle[]> {
  const { data, error } = await supabase
    .from('billing_cycles')
    .select('*')
    .order('code', { ascending: false })
  if (error) throw error
  return (data ?? []) as BillingCycle[]
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
  photoPath: string
  remarks?: string
  readById: string
}

export async function createReading(input: CreateReadingInput): Promise<void> {
  const { error } = await supabase.from('meter_readings').insert({
    meter_id: input.meterId,
    billing_cycle_id: input.cycleId,
    present_reading: input.present,
    previous_reading: 0, // io-override ng trigger (server-authoritative)
    photo_path: input.photoPath,
    remarks: input.remarks?.trim() || null,
    read_by: input.readById,
  })
  if (error) throw error
}

/** Worklist: lahat ng active meter + reading (kung meron na) para sa cycle. */
export async function fetchWorklist(cycleId: string): Promise<WorklistItem[]> {
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
