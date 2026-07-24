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

  return ((meters ?? []) as unknown as (Meter & {
    property: (Pick<Property, 'id' | 'block' | 'lot' | 'phase'> & {
      owners: { end_date: string | null; profile: { full_name: string } | null }[]
    }) | null
  })[]).map((m) => {
    const activeOwner = m.property?.owners?.find((o) => !o.end_date)
    const { property: _p, ...meter } = m
    return {
      meter: meter as Meter,
      property: m.property
        ? { id: m.property.id, block: m.property.block, lot: m.property.lot, phase: m.property.phase }
        : { id: '', block: '?', lot: '?', phase: null },
      ownerName: activeOwner?.profile?.full_name ?? null,
      reading: byMeter.get(m.id) ?? null,
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
