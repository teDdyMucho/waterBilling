import { AppShell, PageHeader } from '@/components/AppShell'
import { AccountManagement } from '@/features/admin/AccountManagement'
import { useT } from '@/hooks/useT'

export default function AdminAccounts() {
  const { t } = useT()
  return (
    <AppShell>
      <PageHeader title={t('accounts.title')} description={t('accounts.subtitle')} />
      <AccountManagement />
    </AppShell>
  )
}
