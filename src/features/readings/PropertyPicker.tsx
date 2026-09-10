import { useMemo, useState } from 'react'
import { Droplets, HelpCircle, Plus, Search, Zap } from 'lucide-react'
import { NewPropertyAccountModal } from '@/features/properties/NewPropertyAccountModal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useT } from '@/hooks/useT'
import { lotLabel, propertyLabel } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { PropertyWithRelations, UnassignedKind, WorklistItem } from '@/types/domain'

/**
 * Dalawang pagpipiliang WALANG property. Sa halip na tunay na metro,
 * napupunta ang basa sa inbox ng admin (tingnan ang migration 0019).
 */
export const UNASSIGNED_OPTION_IDS: Record<UnassignedKind, string> = {
  unknown: '__unknown__',
  co_subdivision: '__co_subdivision__',
}

/** Special ba ang napiling id? Ibinabalik ang kind, o null kung tunay na property. */
export function unassignedKindOf(id: string | null): UnassignedKind | null {
  if (id === UNASSIGNED_OPTION_IDS.unknown) return 'unknown'
  if (id === UNASSIGNED_OPTION_IDS.co_subdivision) return 'co_subdivision'
  return null
}

type Row = {
  id: string
  label: string
  ownerName: string | null
  /** Unknown / C.O. Subdivision — nasa itaas at walang tunay na metro. */
  special: boolean
  /** Walang bukas na cycle — hindi pa puwedeng basahan. */
  noCycle: boolean
  items: WorklistItem[]
}

/**
 * Searchable na pampili ng property para sa quick encode.
 * Nagmumula ang listahan sa worklist ng aktibong cycle — kaya kung ano ang
 * may aktibong metro, iyon ang mapipili.
 */
export function PropertyPicker({
  items,
  properties = [],
  value,
  onChange,
}: {
  /** Mga metrong PUWEDENG basahan ngayon (may bukas na cycle). */
  items: WorklistItem[]
  /** LAHAT ng property — kasama ang walang bukas na cycle, para makita. */
  properties?: PropertyWithRelations[]
  value: string | null
  onChange: (propertyId: string | null) => void
}) {
  const { t } = useT()
  const [search, setSearch] = useState('')
  // Wala sa listahan ang hinahanap — dito gumagawa ng bagong lote,
  // kasama na ang account ng homeowner nito.
  const [addOpen, setAddOpen] = useState(false)

  const rows = useMemo(() => {
    const map = new Map<string, Row>()

    // Una: LAHAT ng property — para makita rin ang wala pang cycle.
    for (const p of properties) {
      map.set(p.id, {
        id: p.id,
        label: lotLabel(p.block, p.lot),
        ownerName: p.owners?.find((o) => !o.end_date)?.profile?.full_name ?? null,
        special: false,
        noCycle: true,
        items: [],
      })
    }

    // Pangalawa: ang may bukas na cycle — sila ang puwedeng basahan.
    for (const i of items) {
      const r = map.get(i.property.id)
      if (r) {
        r.noCycle = false
        r.items.push(i)
      } else {
        map.set(i.property.id, {
          id: i.property.id,
          label: propertyLabel(i.property),
          ownerName: i.ownerName,
          special: false,
          noCycle: false,
          items: [i],
        })
      }
    }

    const propRows = [...map.values()].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true }),
    )

    // Ang dalawang walang-property na opsyon — laging nasa itaas.
    const special: Row[] = [
      {
        id: UNASSIGNED_OPTION_IDS.unknown,
        label: t('readings.unknownProperty'),
        ownerName: t('readings.unknownPropertyHint'),
        special: true,
        noCycle: false,
        items: [],
      },
      {
        id: UNASSIGNED_OPTION_IDS.co_subdivision,
        label: t('readings.coSubdivision'),
        ownerName: t('readings.coSubdivisionHint'),
        special: true,
        noCycle: false,
        items: [],
      },
    ]

    return [...special, ...propRows]
  }, [items, properties, t])

  const selected = rows.find((r) => r.id === value) ?? null

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    // Walang hinahanap — Unknown at C.O. lang ang ipinapakita. Ang mga
    // property ay maraming-marami; hanapin, huwag i-scroll.
    if (!q) return rows.filter((r) => r.special)
    return rows.filter(
      (r) => r.label.toLowerCase().includes(q) || (r.ownerName ?? '').toLowerCase().includes(q),
    )
  }, [rows, search])

  // May napili na — compact na bar lang, may pindutang pampalit.
  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-input border border-slate-200 bg-slate-50 px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{selected.label}</p>
          <p className="truncate text-xs text-slate-500">{selected.ownerName ?? '—'}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onChange(null)
            setSearch('')
          }}
        >
          {t('readings.changeProperty')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Input
        placeholder={t('readings.searchWorklist')}
        iconLeft={<Search className="size-4" />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />

      <Button
        type="button"
        variant="outline"
        block
        onClick={() => setAddOpen(true)}
        iconLeft={<Plus className="size-4" />}
      >
        {t('properties.add')}
      </Button>

      <NewPropertyAccountModal open={addOpen} onClose={() => setAddOpen(false)} />

      <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-input border border-slate-200">
        {matches.length === 0 && (
          <li className="px-3.5 py-6 text-center text-sm text-slate-400">
            {t('readings.noMatches')}
          </li>
        )}
        {!search.trim() && (
          <li className="px-3.5 py-3 text-center text-xs text-slate-400">
            {t('readings.searchToFind')}
          </li>
        )}
        {matches.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onChange(r.id)}
              disabled={r.noCycle}
              title={r.noCycle ? t('readings.noCycleForProperty') : undefined}
              className={cn(
                'flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors',
                r.noCycle ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-50',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{r.label}</p>
                <p className="truncate text-xs text-slate-500">
                  {r.noCycle ? t('readings.noCycleForProperty') : (r.ownerName ?? '—')}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {r.special && (
                  <span className="grid size-6 place-items-center rounded-md bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200">
                    <HelpCircle className="size-3.5" />
                  </span>
                )}
                {r.items.map((i) => {
                  const water = i.meter.utility_type === 'water'
                  const Icon = water ? Droplets : Zap
                  return (
                    <span
                      key={i.meter.id}
                      title={water ? t('properties.water') : t('properties.electric')}
                      className={cn(
                        'grid size-6 place-items-center rounded-md ring-1 ring-inset',
                        // Nabasa na = kupas; hindi pa = matingkad
                        i.reading
                          ? 'bg-slate-50 text-slate-300 ring-slate-100'
                          : water
                            ? 'bg-water-50 text-water-700 ring-water-100'
                            : 'bg-power-50 text-power-700 ring-power-100',
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                  )
                })}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
