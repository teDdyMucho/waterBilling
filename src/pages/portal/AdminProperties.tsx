import { AppShell, PageHeader } from '@/components/AppShell'
import { PropertiesList } from '@/features/properties/PropertiesList'
import { PropertyDetail } from '@/features/properties/PropertyDetail'
import { useT } from '@/hooks/useT'

export function AdminProperties() {
  const { t } = useT()
  return (
    <AppShell>
      <PageHeader title={t('properties.title')} description={t('properties.subtitle')} />
      <PropertiesList basePath="/admin/properties" />
    </AppShell>
  )
}

export function AdminPropertyDetail() {
  return (
    <AppShell>
      <PropertyDetail basePath="/admin/properties" />
    </AppShell>
  )
}
