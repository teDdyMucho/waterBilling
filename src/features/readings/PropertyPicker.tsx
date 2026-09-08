import { useMemo, useState } from 'react'
import { Droplets, HelpCircle, Search, Zap } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useT } from '@/hooks/useT'
import { propertyLabel } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { UnassignedKind, WorklistItem } from '@/types/domain'

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
  items: WorklistItem[]
}

/**
 * Searchable na pampili ng property para sa quick encode.
 * Nagmumula ang listahan sa worklist ng aktibong cycle — kaya kung ano ang
 * may aktibong metro, iyon ang mapipili.
 */
export function PropertyPicker({
  items,
  value,
  onChange,
}: {
  /** Buong worklist ng cycle (lahat ng metro ng lahat ng property). */
  items: WorklistItem[]
  value: string | null
  onChange: (propertyId: string | null) => void
}) {
  const { t } = useT()
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const map = new Map<string, Row>()
    for (const i of items) {
      const r = map.get(i.property.id)
      if (r) r.items.push(i)
      else
        map.set(i.property.id, {
          id: i.property.id,
          label: propertyLabel(i.property),
          ownerName: i.ownerName,
          special: false,
          items: [i],
        })
    }
    const properties = [...map.values()].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true }),
    )

    // Ang dalawang walang-property na opsyon — laging nasa itaas.
    const special: Row[] = [
      {
        id: UNASSIGNED_OPTION_IDS.unknown,
        label: t('readings.unknownProperty'),
        ownerName: t('readings.unknownPropertyHint'),
        special: true,
        items: [],
      },
      {
        id: UNASSIGNED_OPTION_IDS.co_subdivision,
        label: t('readings.coSubdivision'),
        ownerName: t('readings.coSubdivisionHint'),
        special: true,
        items: [],
      },
    ]

    return [...special, ...properties]
  }, [items, t])

  const selected = rows.find((r) => r.id === value) ?? null

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
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

      <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-input border border-slate-200">
        {matches.length === 0 && (
          <li className="px-3.5 py-6 text-center text-sm text-slate-400">
            {t('readings.noMatches')}
          </li>
        )}
        {matches.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onChange(r.id)}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{r.label}</p>
                <p className="truncate text-xs text-slate-500">{r.ownerName ?? '—'}</p>
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
