import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  Calendar,
  Check,
  Eye,
  Gauge,
  Hash,
  Info,
  ListChecks,
  Receipt,
  UserPlus,
} from 'lucide-react'
import { AppShell, PageHeader } from '@/components/AppShell'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { useT } from '@/hooks/useT'

/**
 * Gabay para sa STAFF: paano magdagdag ng meter/billing sa isang homeowner,
 * anong mga detalye ang ilalagay (may guidelines), at paano ito lalabas sa
 * homeowner. Instruksyon lang — walang datos na binabago dito.
 */
export default function MeterGuide() {
  const { t } = useT()

  const steps = [t('meterGuide.s1'), t('meterGuide.s2'), t('meterGuide.s3'), t('meterGuide.s4'), t('meterGuide.s5')]

  const fields: { icon: React.ReactNode; label: string; desc: string }[] = [
    { icon: <Hash className="size-4" />, label: t('meterGuide.fMeterNo'), desc: t('meterGuide.fMeterNoDesc') },
    { icon: <Gauge className="size-4" />, label: t('meterGuide.fInitial'), desc: t('meterGuide.fInitialDesc') },
    { icon: <Hash className="size-4" />, label: t('meterGuide.fDigits'), desc: t('meterGuide.fDigitsDesc') },
    { icon: <Calendar className="size-4" />, label: t('meterGuide.fInstalled'), desc: t('meterGuide.fInstalledDesc') },
  ]

  const homeownerSees = [t('meterGuide.ho1'), t('meterGuide.ho2'), t('meterGuide.ho3'), t('meterGuide.ho4')]
  const checklist = [t('meterGuide.c1'), t('meterGuide.c2'), t('meterGuide.c3'), t('meterGuide.c4')]

  return (
    <AppShell>
      <PageHeader
        title={t('meterGuide.title')}
        description={t('meterGuide.sub')}
        action={
          <Link
            to="/staff/properties"
            className="inline-flex h-11 items-center gap-2 rounded-input bg-brand-700 px-4.5 text-[0.9375rem] font-semibold text-white shadow-brand ring-1 ring-inset ring-white/10 hover:bg-brand-600 active:bg-brand-800"
          >
            {t('meterGuide.openProperties')}
            <ArrowRight className="size-4" />
          </Link>
        }
      />

      <div className="mx-auto max-w-3xl space-y-5">
        {/* Steps */}
        <Card>
          <CardHeader title={t('meterGuide.stepsTitle')} />
          <CardBody>
            <ol className="space-y-3.5">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 text-sm text-slate-700">{s}</p>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

        {/* Meter field guidelines */}
        <Card>
          <CardHeader title={t('meterGuide.fieldsTitle')} description={t('meterGuide.fieldsSub')} />
          <CardBody className="space-y-3">
            {fields.map((f) => (
              <div key={f.label} className="flex gap-3 rounded-input border border-slate-200 p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-card bg-brand-50 text-brand-700">
                  {f.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{f.label}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{f.desc}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Link to homeowner */}
        <Card>
          <CardHeader title={t('meterGuide.linkTitle')} />
          <CardBody>
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-card bg-brand-50 text-brand-700">
                <UserPlus className="size-5" />
              </span>
              <ul className="space-y-2 text-sm text-slate-700">
                <li>{t('meterGuide.link1')}</li>
                <li>{t('meterGuide.link2')}</li>
              </ul>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-input bg-slate-50 p-3 text-sm text-slate-600">
              <Info className="mt-0.5 size-4 shrink-0 text-brand-700" />
              <span>{t('meterGuide.link3')}</span>
            </div>
          </CardBody>
        </Card>

        {/* How it becomes a bill */}
        <Card>
          <CardHeader title={t('meterGuide.billTitle')} />
          <CardBody>
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-card bg-brand-50 text-brand-700">
                <Receipt className="size-5" />
              </span>
              <ul className="space-y-2 text-sm text-slate-700">
                <li>{t('meterGuide.bill1')}</li>
                <li>{t('meterGuide.bill2')}</li>
                <li>{t('meterGuide.bill3')}</li>
              </ul>
            </div>
          </CardBody>
        </Card>

        {/* What the homeowner sees */}
        <Card>
          <CardHeader title={t('meterGuide.homeownerTitle')} />
          <CardBody>
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-card bg-brand-50 text-brand-700">
                <Eye className="size-5" />
              </span>
              <ul className="space-y-2.5">
                {homeownerSees.map((h, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand-700" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardBody>
        </Card>

        {/* Checklist */}
        <Card>
          <CardHeader title={t('meterGuide.checklistTitle')} />
          <CardBody>
            <ul className="space-y-2.5">
              {checklist.map((c, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                  <ListChecks className="mt-0.5 size-4 shrink-0 text-brand-700" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        {/* Quick open */}
        <div className="flex justify-center pb-2">
          <Link
            to="/staff/properties"
            className="inline-flex items-center gap-2 rounded-input bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-brand ring-1 ring-inset ring-white/10 hover:bg-brand-600 active:bg-brand-800"
          >
            <Building2 className="size-4" />
            {t('meterGuide.openProperties')}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </AppShell>
  )
}
