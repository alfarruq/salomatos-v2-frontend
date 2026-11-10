import { createFileRoute, redirect } from '@tanstack/react-router'
import { BranchTable } from '@/widgets/branch-table'

export const Route = createFileRoute('/_auth/manage/branches')({
  beforeLoad: ({ context }) => {
    // Organization owners only; the server checks the same (`branch:manage`).
    if (!context.session.permissions.has('branch:manage')) {
      throw redirect({ to: '/manage/doctors' })
    }
  },
  component: BranchesSection,
})

function BranchesSection() {
  // Set by the `_auth` guard, which resolved the session before this rendered.
  const { clinicId, session } = Route.useRouteContext()

  return (
    <BranchTable
      clinicId={clinicId}
      currentBranch={{ id: session.scope.id, name: session.scopeName }}
    />
  )
}
