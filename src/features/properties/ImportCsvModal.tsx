import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, FileUp, Upload } from 'lucide-react'
import { createMeter, createProperty } from '@/features/properties/properties-api'
import { parseCsvObjects } from '@/lib/csv'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useT } from '@/hooks/useT'
import type { PropertyStatus } from '@/types/domain'

const TEMPLATE =
  'block,lot,phase,status,zone,address,water_meter,water_initial,electric_meter,electric_initial\n' +
  '5,12,Phase 1,occupied,Zone A,123 Sampaguita St,WM-0012,0,EM-0012,0\n' +
  '5,13,Phase 1,vacant,Zone A,,,,,\n'

const STATUSES: PropertyStatus[] = ['occupied', 'vacant', 'inactive']

interface RowResult {
  line: number
  label: string
  ok: boolean
  error?: string
}

export function ImportCsvModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT()
  const qc = useQueryClient()
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [fileName, setFileName] = useState('')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<RowResult[] | null>(null)

  function reset() {
    setRows([])
    setFileName('')
    setResults(null)
    setRunning(false)
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResults(null)
    const text = await file.text()
    setRows(parseCsvObjects(text))
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'scs-properties-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function runImport() {
    setRunning(true)
    const out: RowResult[] = []

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const label = `Blk ${r.block ?? '?'} Lot ${r.lot ?? '?'}`
      try {
        if (!r.block?.trim() || !r.lot?.trim()) {
          throw new Error('Kulang ang block/lot')
        }
        const status = (STATUSES as string[]).includes(r.status)
          ? (r.status as PropertyStatus)
          : 'occupied'

        const property = await createProperty({
          block: r.block.trim(),
          lot: r.lot.trim(),
          phase: r.phase?.trim() || null,
          address_line: r.address?.trim() || null,
          assigned_zone: r.zone?.trim() || null,
          status,
          notes: null,
        })

        if (r.water_meter?.trim() || r.water_initial?.trim()) {
          await createMeter({
            property_id: property.id,
            utility_type: 'water',
            meter_number: r.water_meter?.trim() || null,
            initial_reading: Number(r.water_initial) || 0,
            digits: 5,
          })
        }
        if (r.electric_meter?.trim() || r.electric_initial?.trim()) {
          await createMeter({
            property_id: property.id,
            utility_type: 'electric',
            meter_number: r.electric_meter?.trim() || null,
            initial_reading: Number(r.electric_initial) || 0,
            digits: 5,
          })
        }
        out.push({ line: i + 2, label, ok: true })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error'
        out.push({
          line: i + 2,
          label,
          ok: false,
          error: /duplicate|unique/i.test(msg) ? 'May ganitong lote na' : msg,
        })
      }
    }

    setResults(out)
    setRunning(false)
    qc.invalidateQueries({ queryKey: ['properties'] })
  }

  const okCount = results?.filter((r) => r.ok).length ?? 0
  const failCount = results?.filter((r) => !r.ok).length ?? 0

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title={t('properties.importTitle')}
      description={t('properties.importDesc')}
      size="lg"
      footer={
        results ? (
          <Button
            onClick={() => {
              reset()
              onClose()
            }}
          >
            {t('properties.importDoneClose')}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => {
                reset()
                onClose()
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={runImport}
              disabled={rows.length === 0}
              loading={running}
              iconLeft={<Upload className="size-4" />}
            >
              {t('properties.importRun')}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          <Download className="size-4" />
          {t('properties.importTemplate')}
        </button>

        {!results && (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/40">
            <FileUp className="size-8 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">
              {fileName || t('properties.importChoose')}
            </span>
            {rows.length > 0 && (
              <span className="text-xs text-brand-700">
                {t('properties.importRows').replace('{n}', String(rows.length))}
              </span>
            )}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>
        )}

        {results && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 rounded-input bg-success-50 p-3 text-center ring-1 ring-inset ring-success-100">
                <p className="text-2xl font-bold text-success-700">{okCount}</p>
                <p className="text-xs font-medium text-success-700">
                  {t('properties.importImported')}
                </p>
              </div>
              <div className="flex-1 rounded-input bg-danger-50 p-3 text-center ring-1 ring-inset ring-danger-100">
                <p className="text-2xl font-bold text-danger-700">{failCount}</p>
                <p className="text-xs font-medium text-danger-700">
                  {t('properties.importFailed')}
                </p>
              </div>
            </div>

            {failCount > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-semibold text-slate-700">
                  {t('properties.importErrors')}
                </p>
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-input border border-slate-200 p-2 text-sm">
                  {results
                    .filter((r) => !r.ok)
                    .map((r) => (
                      <li key={r.line} className="flex justify-between gap-3 text-slate-600">
                        <span>
                          <span className="text-slate-400">L{r.line}</span> {r.label}
                        </span>
                        <span className="text-danger-600">{r.error}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {rows.length === 0 && !results && (
          <Alert tone="info">{t('properties.importDesc')}</Alert>
        )}
      </div>
    </Modal>
  )
}
