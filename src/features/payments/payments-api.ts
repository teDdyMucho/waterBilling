import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/image'
import type {
  Payment,
  PaymentMethod,
  PaymentSettings,
  PaymentStatus,
  PaymentWithRelations,
} from '@/types/domain'

// ---- Settings (admin) ----------------------------------------------

export async function fetchPaymentSettings(): Promise<PaymentSettings | null> {
  const { data, error } = await supabase
    .from('payment_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return (data as PaymentSettings) ?? null
}

export async function updatePaymentSettings(
  input: Partial<Omit<PaymentSettings, 'id' | 'updated_at'>>,
): Promise<void> {
  const { error } = await supabase
    .from('payment_settings')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw error
}

/** I-upload ang QR sa public-assets, i-save ang public URL bilang qr_path. */
export async function uploadQr(file: File): Promise<string> {
  const blob = await compressImage(file, { maxDim: 800, quality: 0.85 })
  const path = `qr/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from('public-assets')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('public-assets').getPublicUrl(path)
  await updatePaymentSettings({ qr_path: data.publicUrl })
  return data.publicUrl
}

// ---- Submit (homeowner) --------------------------------------------

export interface SubmitPaymentInput {
  billId: string | null
  propertyId: string | null
  submittedBy: string
  amount: number
  method: PaymentMethod
  referenceNumber?: string
  paymentDate: string
  proof: File // REQUIRED
}

/** I-upload ang proof (compressed) tapos i-insert ang payment. */
export async function submitPayment(input: SubmitPaymentInput): Promise<void> {
  const blob = await compressImage(input.proof, { maxDim: 1600, quality: 0.75 })
  const path = `${input.submittedBy}/${crypto.randomUUID()}.jpg`
  const { error: upErr } = await supabase.storage
    .from('payment-proofs')
    .upload(path, blob, { contentType: 'image/jpeg' })
  if (upErr) throw upErr

  const { error } = await supabase.from('payments').insert({
    bill_id: input.billId,
    property_id: input.propertyId,
    submitted_by: input.submittedBy,
    amount: input.amount,
    method: input.method,
    reference_number: input.referenceNumber?.trim() || null,
    payment_date: input.paymentDate,
    proof_path: path,
    status: 'submitted',
  })
  if (error) throw error
}

// ---- Queries --------------------------------------------------------

export async function fetchMyPayments(): Promise<
  (Payment & { bill: { bill_no: string } | null })[]
> {
  const { data, error } = await supabase
    .from('payments')
    .select('*, bill:bills(bill_no)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as (Payment & { bill: { bill_no: string } | null })[]
}

/** Staff/admin queue by status ('submitted' = pang-endorse, 'endorsed' = pang-confirm). */
export async function fetchPaymentsByStatus(
  status: PaymentStatus,
): Promise<PaymentWithRelations[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(
      '*, bill:bills(bill_no, total_amount, balance), submitter:profiles!payments_submitted_by_fkey(full_name, avatar_url)',
    )
    .eq('status', status)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as PaymentWithRelations[]
}

/** Staff/admin queue by MULTIPLE statuses. */
export async function fetchPaymentsInStatuses(
  statuses: PaymentStatus[],
): Promise<PaymentWithRelations[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(
      '*, bill:bills(bill_no, total_amount, balance), submitter:profiles!payments_submitted_by_fkey(full_name, avatar_url)',
    )
    .in('status', statuses)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as PaymentWithRelations[]
}

export async function getProofUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('payment-proofs')
    .createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}

// ---- Actions (RPCs) -------------------------------------------------

export async function endorsePayment(id: string, remarks: string): Promise<void> {
  const { error } = await supabase.rpc('endorse_payment', {
    p_payment_id: id,
    p_remarks: remarks || '',
  })
  if (error) throw error
}

export async function confirmPayment(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('confirm_payment', { p_payment_id: id })
  if (error) throw error
  return String(data ?? '')
}

export async function rejectPayment(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('reject_payment', {
    p_payment_id: id,
    p_reason: reason,
  })
  if (error) throw error
}

export async function voidPayment(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('void_payment', { p_payment_id: id, p_reason: reason })
  if (error) throw error
}
