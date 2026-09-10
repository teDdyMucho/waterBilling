import { supabase } from '@/lib/supabase'
import type {
  HomeownerDirectoryRow,
  Meter,
  Property,
  PropertyStatus,
  PropertyWithRelations,
  UtilityType,
} from '@/types/domain'

// ---- Properties -----------------------------------------------------

export interface PropertyInput {
  block: string
  lot: string
  phase?: string | null
  address_line?: string | null
  assigned_zone?: string | null
  status: PropertyStatus
  notes?: string | null
}

/** Listahan ng property na may bilang ng metro (para sa table). */
export async function fetchProperties(): Promise<PropertyWithRelations[]> {
  const { data, error } = await supabase
    .from('properties')
    .select(
      '*, meters(*), owners:property_owners(*, profile:profiles(full_name, email))',
    )
    .order('block', { ascending: true })
    .order('lot', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as PropertyWithRelations[]
}

export async function fetchProperty(id: string): Promise<PropertyWithRelations | null> {
  const { data, error } = await supabase
    .from('properties')
    .select(
      '*, meters(*), owners:property_owners(*, profile:profiles(full_name, email))',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as PropertyWithRelations) ?? null
}

export async function createProperty(input: PropertyInput): Promise<Property> {
  const { data, error } = await supabase
    .from('properties')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data as Property
}

export async function updateProperty(
  id: string,
  input: Partial<PropertyInput>,
): Promise<void> {
  const { error } = await supabase.from('properties').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteProperty(id: string): Promise<void> {
  const { error } = await supabase.from('properties').delete().eq('id', id)
  if (error) throw error
}

/**
 * Para sa HOMEOWNER — ang sariling lote nila kasama ang mga metro.
 * Pinoprotektahan ng RLS (owns_property), kaya sariling property lang
 * ang babalik. Null kung wala pang naka-link.
 */
export async function fetchMyProperty(
  profileId: string,
): Promise<PropertyWithRelations | null> {
  const { data, error } = await supabase
    .from('property_owners')
    .select('property:properties(*, meters(*))')
    .eq('profile_id', profileId)
    .is('end_date', null)
    .maybeSingle()
  if (error) throw error
  const property = (data as { property: PropertyWithRelations | null } | null)?.property
  if (!property) return null
  return { ...property, owners: [] }
}

// ---- Meters ---------------------------------------------------------

export interface MeterInput {
  property_id: string
  utility_type: UtilityType
  meter_number?: string | null
  initial_reading: number
  digits: number
  installed_at?: string | null
}

export async function createMeter(input: MeterInput): Promise<Meter> {
  const { data, error } = await supabase.from('meters').insert(input).select().single()
  if (error) throw error
  return data as Meter
}

export async function updateMeter(
  id: string,
  input: Partial<MeterInput & { status: string }>,
): Promise<void> {
  const { error } = await supabase.from('meters').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteMeter(id: string): Promise<void> {
  const { error } = await supabase.from('meters').delete().eq('id', id)
  if (error) throw error
}

/** Palitan ang metro (atomic via RPC): luma → replaced, bago → active. */
export async function replaceMeter(input: {
  oldMeterId: string
  meterNumber?: string | null
  initialReading: number
  digits: number
  installedAt?: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('replace_meter', {
    p_old_meter_id: input.oldMeterId,
    p_new_number: input.meterNumber ?? '',
    p_new_initial: input.initialReading,
    p_new_digits: input.digits,
    p_installed: input.installedAt || null,
  })
  if (error) throw error
}

// ---- Property owners (link homeowner) -------------------------------

/** Homeowner accounts na puwedeng i-link. */
export async function fetchHomeownerDirectory(): Promise<HomeownerDirectoryRow[]> {
  const { data, error } = await supabase
    .from('homeowner_directory')
    .select('*')
    .order('full_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as HomeownerDirectoryRow[]
}

export async function linkOwner(propertyId: string, profileId: string): Promise<void> {
  const { error } = await supabase
    .from('property_owners')
    .insert({ property_id: propertyId, profile_id: profileId, is_primary: true })
  if (error) throw error
}

/** Alisin ang link (soft: itakda ang end_date sa ngayon). */
export async function unlinkOwner(linkId: string): Promise<void> {
  const { error } = await supabase
    .from('property_owners')
    .update({ end_date: new Date().toISOString().slice(0, 10) })
    .eq('id', linkId)
  if (error) throw error
}

// ---- Property + account nang sabay (migration 0029) -----------------

export interface NewPropertyAccount {
  property_id: string
  profile_id: string
  email: string
  password: string
}

/**
 * Gumawa ng property, metro, AT homeowner account nang sabay.
 * Ang email ay galing sa lote; ang password ay pareho sa lahat.
 * WALANG pangalan dito — ang homeowner mismo ang maglalagay niyon sa
 * unang login niya.
 */
export async function createPropertyWithAccount(input: {
  block: string
  lot: string
  waterMeter?: string
  electricMeter?: string
  installedAt?: string | null
}): Promise<NewPropertyAccount> {
  const { data, error } = await supabase.rpc('create_property_with_account', {
    p_block: input.block,
    p_lot: input.lot,
    p_water_meter: input.waterMeter?.trim() || null,
    p_electric_meter: input.electricMeter?.trim() || null,
    p_installed_at: input.installedAt || null,
  })
  if (error) throw new Error(error.message)
  return data as NewPropertyAccount
}

/** Unang login ng homeowner — pangalan at address. */
export async function completeHomeownerSetup(fullName: string, address: string): Promise<void> {
  const { error } = await supabase.rpc('complete_homeowner_setup', {
    p_full_name: fullName,
    p_address: address,
  })
  if (error) throw new Error(error.message)
}
