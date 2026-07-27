import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronRight, Droplets, Receipt, Search, Zap } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { fetchAllBills, fetchBillsForProperty } from '@/features/billing/billing-api'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageLoader, Spinner } from '@/components/ui/Spinner'
import { useT } from '@/hooks/useT'
import { consumption as fmtCons, lotLabel, money, shortDate } from '@/lib/format'
import type { BillItem, BillStatus, BillWithRelations } from '@/types/domain'

const TONE: Record<BillStatus, BadgeTone> = {
  draft: 'neutral',
  unpaid: 'warning',
  payment_pending: 'info',
  partially_paid: 'info',
  paid: 'success',
  overdue: 'danger',
  voided: 'neutral',
}

/** Mga status na may natitira pang babayaran. */
const OPEN_STATUSES: BillStatus[] = ['unpaid', 'partially_paid', 'overdue', 'payment_pending']

/** "2026-08" -> "August 2026" (fallback sa raw code). */
function cycleLabel(code: string | null | undefined): string {
  if (!code) return '—'
  const m = /^(\d{4})-(\d{2})$/.exec(code)
  if (!m) return code
  return new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(
    new Date(Number(m[1]), Number(m[2]) - 1, 1),
  )
}

export default function StaffBills() {
  const { id } = useParams()
  if (id) return <HomeownerBillHistory propertyId={id} />
  return <BillsDirectory />
}

// ---------------------------------------------------------------------
// Directory: isang row bawat homeowner (naka-grupo ayon sa property).
// ---------------------------------------------------------------------

interface DirectoryRow {
  propertyId: string
  block: string | null
  lot: string | null
  ownerName: string | null
  ownerAvatar: string | null
  outstanding: number
  latestStatus: BillStatus
}

function BillsDirectory() {
  const { t } = useT()
  const [search, setSearch] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['all-bills'], queryFn: fetchAllBills })
  const bills = data ?? []

  const groups = useMemo(() => {
    const map = new Map<string, DirectoryRow>()
    // Naka-order na ang bills ayon sa created_at desc — una = pinakabago.
    for (const b of bills) {
      const open = OPEN_STATUSES.includes(b.status) ? Number(b.balance) : 0
      const existing = map.get(b.property_id)
      if (existing) {
        existing.outstanding += open
      } else {
        map.set(b.property_id, {
          propertyId: b.property_id,
          block: b.property?.block ?? null,
          lot: b.property?.lot ?? null,
          ownerName: b.ownerName,
          ownerAvatar: b.ownerAvatar,
          outstanding: open,
          latestStatus: b.status,
        })
      }
    }
    return [...map.values()]
  }, [bills])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((g) =>
      `${g.ownerName ?? ''} ${g.block ?? ''} ${g.lot ?? ''}`.toLowerCase().includes(q),
    )
  }, [groups, search])

  return (
    <AppShell>
      <PageHeader title={t('billing.staffBillsTitle')} description={t('billing.staffBillsSub')} />

      <div className="mb-4 sm:max-w-xs">
        <Input
          placeholder={t('billing.searchBills')}
          iconLeft={<Search className="size-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Spinner className="size-4" /> {t('common.loading')}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<Receipt className="size-6" />} title={t('billing.noMyBills')} />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((g) => {
              const lot = lotLabel(g.block, g.lot)
              return (
                <li key={g.propertyId}>
                  <Link
                    to={`/staff/bills/${g.propertyId}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:gap-4 sm:px-5"
                  >
                    <Avatar url={g.ownerAvatar} name={g.ownerName ?? lot} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">{g.ownerName ?? lot}</p>
                      <p className="truncate text-xs text-slate-500">{lot}</p>
                    </div>
                    <div className="text-right">
                      {g.outstanding > 0 ? (
                        <>
                          <p className="tabular font-semibold text-slate-900">{money(g.outstanding)}</p>
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">
                            {t('billing.outstanding')}
                          </p>
                        </>
                      ) : (
                        <Badge tone="success">{t('billing.st_paid')}</Badge>
                      )}
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-slate-300" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </AppShell>
  )
}

// ---------------------------------------------------------------------
// History: lahat ng bill ng isang homeowner, per buwan. Ang charges ay
// lumalabas lang kapag pinindot ang "View details" (accordion).
// ---------------------------------------------------------------------

function HomeownerBillHistory({ propertyId }: { propertyId: string }) {
  const { t } = useT()
  const [openId, setOpenId] = useState<string | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['property-bills', propertyId],
    queryFn: () => fetchBillsForProperty(propertyId),
  })

  if (isLoading) return <PageLoader />

  const owner = data?.owner
  const bills = data?.bills ?? []
  const lot = lotLabel(owner?.block, owner?.lot)
  const outstanding = bills
    .filter((b) => OPEN_STATUSES.includes(b.status))
    .reduce((sum, b) => sum + Number(b.balance), 0)

  return (
    <AppShell>
      <Link
        to="/staff/bills"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        {t('billing.backToBills')}
      </Link>

      <div className="mx-auto max-w-2xl space-y-4">
        {/* Homeowner header + kabuuang natitirang balanse */}
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <Avatar url={owner?.avatar} name={owner?.name ?? lot} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-slate-900">{owner?.name ?? lot}</p>
                <p className="truncate text-sm text-slate-500">{lot}</p>
              </div>
            </div>
            <div className="mt-4 rounded-input bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t('billing.outstanding')}
              </p>
              <p className="tabular mt-1 text-2xl font-bold text-slate-900">{money(outstanding)}</p>
              {outstanding === 0 && (
                <p className="mt-1 text-sm text-slate-500">{t('billing.fullyPaid')}</p>
              )}
            </div>
          </CardBody>
        </Card>

        {/* History list */}
        <div>
          <h2 className="mb-2 px-1 text-sm font-semibold text-slate-700">{t('billing.billHistory')}</h2>
          {bills.length === 0 ? (
            <Card>
              <div className="p-5">
                <EmptyState icon={<Receipt className="size-6" />} title={t('billing.noMyBills')} />
              </div>
            </Card>
          ) : (
            <ul className="space-y-2">
              {bills.map((bill) => (
                <BillHistoryRow
                  key={bill.id}
                  bill={bill}
                  open={openId === bill.id}
                  onToggle={() => setOpenId((cur) => (cur === bill.id ? null : bill.id))}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function BillHistoryRow({
  bill,
  open,
  onToggle,
}: {
  bill: BillWithRelations
  open: boolean
  onToggle: () => void
}) {
  const { t } = useT()

  return (
    <li>
      <Card className="overflow-hidden">
        {/* Row header — pindutin para i-toggle ang detalye */}
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 sm:px-5"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200">
            <Receipt className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{cycleLabel(bill.cycle?.code)}</p>
            <p className="truncate text-xs text-slate-500">
              {bill.bill_no} · {t('billing.dueDate')}: {shortDate(bill.due_date)}
            </p>
          </div>
          <div className="text-right">
            <p className="tabular font-semibold text-slate-900">{money(bill.total_amount)}</p>
            <Badge tone={TONE[bill.status]}>{t(`billing.st_${bill.status}`)}</Badge>
          </div>
          <ChevronDown
            className={`size-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Detalye ng singil — lalabas lang kapag naka-open */}
        {open && (
          <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('billing.chargeDetails')}
            </p>
            <div className="space-y-1.5">
              {bill.items
                ?.slice()
                .sort((a, b) => itemOrder(a.item_type) - itemOrder(b.item_type))
                .map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {it.item_type === 'water' && <Droplets className="size-4 text-slate-500" />}
                      {it.item_type === 'electric' && <Zap className="size-4 text-slate-500" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {it.description ?? it.item_type}
                        </p>
                        {it.quantity != null && it.unit_price != null && (
                          <p className="text-xs text-slate-500">
                            {fmtCons(it.quantity, it.item_type === 'water' ? 'water' : 'electric')} ×{' '}
                            {money(it.unit_price)}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="tabular text-sm font-semibold text-slate-900">{money(it.amount)}</p>
                  </div>
                ))}
            </div>

            <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{t('billing.totalDue')}</p>
                <p className="tabular text-lg font-bold text-slate-900">{money(bill.total_amount)}</p>
              </div>
              <div className="flex items-center justify-between text-sm">
                <p className="text-slate-500">{t('billing.balance')}</p>
                <p className="tabular font-semibold text-slate-900">{money(bill.balance)}</p>
              </div>
            </div>
          </div>
        )}
      </Card>
    </li>
  )
}

function itemOrder(type: BillItem['item_type']): number {
  const o: Record<string, number> = {
    previous_balance: 0,
    water: 1,
    electric: 2,
    assoc_dues: 3,
    penalty: 4,
    adjustment: 5,
  }
  return o[type] ?? 9
}
