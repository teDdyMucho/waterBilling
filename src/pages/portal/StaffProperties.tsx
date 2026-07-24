import { AppShell, PageHeader } from '@/components/AppShell'
import { PropertiesList } from '@/features/properties/PropertiesList'
import { PropertyDetail } from '@/features/properties/PropertyDetail'
import { useT } from '@/hooks/useT'

export function StaffProperties() {
  const { t } = useT()
  return (
    <AppShell>
      <PageHeader title={t('properties.titleStaff')} description={t('properties.subtitleStaff')} />
      <PropertiesList basePath="/staff/properties" />
    </AppShell>
  )
}

export function StaffPropertyDetail() {
  return (
    <AppShell>
      <PropertyDetail basePath="/staff/properties" />
    </AppShell>
  )
}
