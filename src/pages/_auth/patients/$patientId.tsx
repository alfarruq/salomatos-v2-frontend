import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  Archive,
  Building2,
  Cake,
  Calendar,
  CalendarPlus,
  MapPin,
  Pencil,
  Phone,
  Pill,
  Stethoscope,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AttachmentGallery, attachmentQueries } from '@/entities/attachment'
import type { Patient } from '@/entities/patient'
import {
  MedicalHistoryCard,
  PatientAvatar,
  PatientStatusBadge,
  patientQueries,
} from '@/entities/patient'
import { type Recipe, recipeQueries } from '@/entities/recipe'
import { Can, useCan } from '@/entities/session'
import type { Treatment } from '@/entities/treatment'
import { treatmentQueries } from '@/entities/treatment'
import { CreateAppointmentDialog } from '@/features/appointment-create'
import { BotAccessPanel } from '@/features/bot-access-manage'
import { EditMedicalHistoryDialog } from '@/features/medical-history-edit'
import { ArchivePatientDialog } from '@/features/patient-archive'
import { EditPatientDialog } from '@/features/patient-edit'
import { GalleryDropzone } from '@/features/patient-gallery-upload'
import { DeleteRecipeDialog } from '@/features/recipe-delete'
import { RecipeEditor } from '@/features/recipe-editor'
import { usePrintRecipe } from '@/features/recipe-print'
import { TreatmentComposer } from '@/features/treatment-composer'
import { VoidTreatmentDialog } from '@/features/treatment-void'
import { ageOn, formatCalendarDate, todayCalendarDate } from '@/shared/lib/calendarDate'
import { cn } from '@/shared/lib/cn'
import {
  Alert,
  Button,
  Card,
  ErrorState,
  formatSubscriber,
  QueryBoundary,
  Skeleton,
  subscriberDigitsOf,
  Tabs,
} from '@/shared/ui'
import { PatientBilling } from '@/widgets/patient-billing'
import { PrescriptionCards } from '@/widgets/patient-prescriptions'
import { TreatmentHistoryTable, TreatmentToothChart } from '@/widgets/patient-treatments'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const Route = createFileRoute('/_auth/patients/$patientId')({
  component: PatientDetailPage,
})

function PatientDetailPage() {
  const { t } = useTranslation(['patients', 'common', 'bot'])
  const { patientId } = Route.useParams()
  const { clinicId } = Route.useRouteContext()
  const navigate = useNavigate()
  const [isEditOpen, setEditOpen] = useState(false)
  // A lead fills the patient form before the first procedure; the composer opens after.
  const [isRegisterOpen, setRegisterOpen] = useState(false)
  const [isArchiveOpen, setArchiveOpen] = useState(false)
  const [isAppointmentOpen, setAppointmentOpen] = useState(false)
  // Here rather than in the tabs: the header's button and the table both open it.
  const [isComposerOpen, setComposerOpen] = useState(false)
  // A fresh key per opening: the form seeds its state once, on mount, so
  // without this the next opening would inherit the last one's doctor and rows.
  const [composerSession, setComposerSession] = useState(0)

  // Same reasoning as the composer: a fresh form on every opening.
  const [isRecipeEditorOpen, setRecipeEditorOpen] = useState(false)
  const [recipeEditorSession, setRecipeEditorSession] = useState(0)

  const openRecipeEditor = () => {
    setRecipeEditorSession((session) => session + 1)
    setRecipeEditorOpen(true)
  }

  const openComposer = () => {
    setComposerSession((session) => session + 1)
    setComposerOpen(true)
  }

  /*
   * Ids are UUIDs. Anything else in the path is a typed or tampered URL, not a
   * patient — the server would answer 404 anyway, one round trip later.
   */
  const isValidId = UUID_PATTERN.test(patientId)
  const query = useQuery({ ...patientQueries.detail(clinicId, patientId), enabled: isValidId })

  const startTreatment = () => {
    if (query.data?.isLead === true) setRegisterOpen(true)
    else openComposer()
  }

  if (!isValidId) {
    return (
      <ErrorState
        description={t('patients:detail.notFoundBody')}
        headingLevel={1}
        title={t('patients:detail.notFound')}
      />
    )
  }

  return (
    <QueryBoundary
      error={({ retry }) => (
        <ErrorState
          description={t('common:error.pageBody')}
          headingLevel={1}
          retryLabel={t('common:action.retry')}
          title={t('common:error.pageTitle')}
          // Spread rather than passed: under `exactOptionalPropertyTypes` an
          // absent prop and one set to undefined are different types, and
          // `ErrorState` hides the retry button when the handler is absent.
          {...(retry === undefined ? {} : { onRetry: retry })}
        />
      )}
      loading={<PatientDetailSkeleton />}
      query={query}
    >
      {(patient) => (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="text-callout text-accent-text hover:underline" to="/patients">
              {t('patients:detail.backToList')}
            </Link>

            <div className="flex flex-wrap gap-2">
              {/* UX only — Django decides what may actually be written (§9.1). */}
              <Can permission="procedure:manage">
                <Button
                  className="max-md:hidden"
                  iconLeft={<Stethoscope aria-hidden="true" className="size-4" />}
                  onClick={startTreatment}
                  size="sm"
                  variant="primary"
                >
                  {t('patients:detail.newTreatment')}
                </Button>
              </Can>
              <Can permission="prescription:manage">
                <Button
                  className="max-md:hidden"
                  iconLeft={<Pill aria-hidden="true" className="size-4" />}
                  onClick={openRecipeEditor}
                  size="sm"
                  variant="secondary"
                >
                  {t('patients:detail.writePrescription')}
                </Button>
              </Can>
              <Can permission="appointment:manage">
                <Button
                  className="max-md:hidden"
                  iconLeft={<CalendarPlus aria-hidden="true" className="size-4" />}
                  onClick={() => setAppointmentOpen(true)}
                  size="sm"
                  variant="secondary"
                >
                  {t('patients:detail.newAppointment')}
                </Button>
              </Can>
              <Can permission="patient:manage">
                <Button
                  iconLeft={<Pencil aria-hidden="true" className="size-4" />}
                  onClick={() => setEditOpen(true)}
                  size="sm"
                  variant="secondary"
                >
                  {t('patients:edit.title')}
                </Button>
              </Can>
              {patient.status === 'active' ? (
                <Can permission="patient:archive">
                  <Button
                    iconLeft={<Archive aria-hidden="true" className="size-4" />}
                    onClick={() => setArchiveOpen(true)}
                    size="sm"
                    variant="secondary"
                  >
                    {t('patients:archive.confirm')}
                  </Button>
                </Can>
              ) : null}
            </div>
          </div>

          {patient.isLead ? (
            <Alert title={t('patients:lead.title')} tone="info">
              {t('patients:lead.body')}
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="flex flex-col gap-6">
              <PatientSidebar
                onNewAppointment={() => setAppointmentOpen(true)}
                onNewTreatment={startTreatment}
                onWritePrescription={openRecipeEditor}
                patient={patient}
              />
              <MedicalHistorySection clinicId={clinicId} patient={patient} />
              <Can permission="payment:view">
                <PatientBilling clinicId={clinicId} patientId={patient.id} />
              </Can>
              <Can permission="patient:bot_access">
                <Card className="flex flex-col gap-3 p-4 sm:p-6">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-headline text-text">{t('bot:title')}</h2>
                    <p className="text-caption text-text-secondary">{t('bot:hint')}</p>
                  </div>
                  <BotAccessPanel
                    clinicId={clinicId}
                    target={{ kind: 'patient', id: patient.id }}
                  />
                </Card>
              </Can>
            </div>
            <PatientTabs
              onOpenComposer={startTreatment}
              onOpenRecipeEditor={openRecipeEditor}
              patient={patient}
            />
          </div>

          <TreatmentComposer
            clinicId={clinicId}
            initialDoctorId={patient.primaryDoctorId}
            key={composerSession}
            onOpenChange={setComposerOpen}
            open={isComposerOpen}
            patientId={patient.id}
          />

          <RecipeEditor
            clinicId={clinicId}
            initialDoctorId={patient.primaryDoctorId}
            key={`recipe-${recipeEditorSession}`}
            onOpenChange={setRecipeEditorOpen}
            open={isRecipeEditorOpen}
            patientId={patient.id}
            patientName={patient.fullName}
          />

          <CreateAppointmentDialog
            clinicId={clinicId}
            defaultDate={todayCalendarDate()}
            initialDoctorId={patient.primaryDoctorId}
            initialPatient={{
              id: patient.id,
              fullName: patient.fullName,
              phoneNumber: patient.phoneNumber,
            }}
            onOpenChange={setAppointmentOpen}
            open={isAppointmentOpen}
          />

          <EditPatientDialog
            clinicId={clinicId}
            onOpenChange={setRegisterOpen}
            onSaved={openComposer}
            open={isRegisterOpen}
            patient={patient}
            register
          />

          <EditPatientDialog
            clinicId={clinicId}
            onOpenChange={setEditOpen}
            open={isEditOpen}
            patient={patient}
          />

          <ArchivePatientDialog
            clinicId={clinicId}
            onArchived={() => void navigate({ to: '/patients' })}
            onOpenChange={setArchiveOpen}
            open={isArchiveOpen}
            patient={patient}
          />
        </div>
      )}
    </QueryBoundary>
  )
}

const quickActionClassName = cn(
  'flex min-h-16 flex-col items-center justify-center gap-1 rounded-control bg-accent-soft px-1',
  'text-caption font-medium text-accent-text transition-colors duration-150 ease-out-apple',
  'disabled:pointer-events-none disabled:opacity-40',
)

function QuickAction({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button className={quickActionClassName} disabled={disabled} onClick={onClick} type="button">
      <span aria-hidden="true">{icon}</span>
      {label}
    </button>
  )
}

function SidebarFact({ icon, value }: { icon: ReactNode; value: string | null }) {
  if (value === null) return null
  return (
    <div className="flex items-center gap-2 text-callout text-text">
      <span aria-hidden="true" className="text-text-tertiary">
        {icon}
      </span>
      {value}
    </div>
  )
}

function PatientSidebar({
  patient,
  onNewAppointment,
  onNewTreatment,
  onWritePrescription,
}: {
  patient: Patient
  onNewAppointment: () => void
  onNewTreatment: () => void
  onWritePrescription: () => void
}) {
  const { t, i18n } = useTranslation(['patients', 'common'])
  const locale = i18n.language
  const canTreat = useCan('procedure:manage')
  const canPrescribe = useCan('prescription:manage')
  const canBook = useCan('appointment:manage')

  const birthDate =
    patient.birthDate === null ? null : formatCalendarDate(patient.birthDate, locale)
  const phoneDisplay =
    patient.phoneNumber === null
      ? null
      : `+998-${formatSubscriber(subscriberDigitsOf(patient.phoneNumber))}`

  const age = patient.birthDate === null ? null : ageOn(patient.birthDate, todayCalendarDate())

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <PatientAvatar name={patient.fullName} size="lg" />
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-title2 text-text">{patient.fullName}</h1>
          {patient.status === 'archived' ? <PatientStatusBadge status={patient.status} /> : null}
        </div>
      </div>

      {/* Phone replacement for the header's button row, which would wrap into
          three lines there. The header keeps edit/delete, used far less. */}
      <div className="grid grid-cols-4 gap-2 md:hidden">
        {patient.phoneNumber === null ? (
          <QuickAction
            disabled
            icon={<Phone className="size-5" />}
            label={t('patients:detail.quick.call')}
          />
        ) : (
          <a className={quickActionClassName} href={`tel:${patient.phoneNumber}`}>
            <Phone aria-hidden="true" className="size-5" />
            {t('patients:detail.quick.call')}
          </a>
        )}
        <QuickAction
          disabled={!canBook}
          icon={<CalendarPlus className="size-5" />}
          label={t('patients:detail.quick.appointment')}
          onClick={onNewAppointment}
        />
        <QuickAction
          disabled={!canTreat}
          icon={<Stethoscope className="size-5" />}
          label={t('patients:detail.quick.treatment')}
          onClick={onNewTreatment}
        />
        <QuickAction
          disabled={!canPrescribe}
          icon={<Pill className="size-5" />}
          label={t('patients:detail.quick.prescription')}
          onClick={onWritePrescription}
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        {phoneDisplay === null ? null : (
          <a
            className="flex items-center gap-2 text-callout text-accent-text hover:underline"
            href={`tel:${patient.phoneNumber}`}
          >
            <Phone aria-hidden="true" className="size-4" />
            {phoneDisplay}
          </a>
        )}
        <SidebarFact icon={<Stethoscope className="size-4" />} value={patient.primaryDoctorName} />
        <SidebarFact icon={<Building2 className="size-4" />} value={patient.clinicName} />
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <SidebarFact icon={<Calendar className="size-4" />} value={birthDate} />
        <SidebarFact
          icon={<Cake className="size-4" />}
          value={age === null ? null : t('patients:detail.ageYears', { age })}
        />
        <SidebarFact icon={<MapPin className="size-4" />} value={patient.address} />
      </div>

      {patient.notes === null ? null : (
        <p className="border-t border-border pt-4 text-callout whitespace-pre-line text-text-secondary">
          {patient.notes}
        </p>
      )}
    </Card>
  )
}

function MedicalHistorySection({ clinicId, patient }: { clinicId: string; patient: Patient }) {
  const { t } = useTranslation(['patients', 'common'])
  const [isEditOpen, setEditOpen] = useState(false)
  const query = useQuery(patientQueries.medicalHistory(clinicId, patient.id))
  const showPregnancy = patient.gender !== 'male'

  return (
    <QueryBoundary
      error={({ retry }) => (
        <Card className="p-4 sm:p-6">
          <ErrorState
            description={t('common:error.pageBody')}
            retryLabel={t('common:action.retry')}
            title={t('patients:medicalHistory.title')}
            {...(retry === undefined ? {} : { onRetry: retry })}
          />
        </Card>
      )}
      loading={<Skeleton className="h-40 w-full" />}
      query={query}
    >
      {(history) => (
        <>
          <MedicalHistoryCard
            action={
              <Can permission="patient:manage">
                <Button
                  iconLeft={<Pencil aria-hidden="true" className="size-4" />}
                  onClick={() => setEditOpen(true)}
                  size="sm"
                  variant="ghost"
                >
                  {t('patients:medicalHistory.edit')}
                </Button>
              </Can>
            }
            history={history}
            showPregnancy={showPregnancy}
          />
          <EditMedicalHistoryDialog
            clinicId={clinicId}
            history={history}
            onOpenChange={setEditOpen}
            open={isEditOpen}
            patientId={patient.id}
            showPregnancy={showPregnancy}
          />
        </>
      )}
    </QueryBoundary>
  )
}

/** A tab name with its item count raised to the top-right, like a notification dot. */
function TabLabel({ children, count }: { children: string; count: number | undefined }) {
  return (
    <span className="inline-flex items-start gap-1">
      {children}
      {/* Absent until the list has loaded: a "0" that flips to "5" reads as a change. */}
      {count === undefined ? null : (
        <span
          className={cn(
            'inline-flex h-5 min-w-5 -translate-y-1 items-center justify-center rounded-full px-1',
            'text-caption leading-none font-semibold tabular-nums',
            count === 0 ? 'bg-sunken text-text-tertiary' : 'bg-accent text-on-accent',
          )}
        >
          {count}
        </span>
      )}
    </span>
  )
}

function PatientTabs({
  patient,
  onOpenComposer,
  onOpenRecipeEditor,
}: {
  patient: Patient
  onOpenComposer: () => void
  onOpenRecipeEditor: () => void
}) {
  const { t } = useTranslation(['patients', 'common'])
  const { clinicId } = Route.useRouteContext()
  const [voidingTreatment, setVoidingTreatment] = useState<Treatment | null>(null)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [deletingRecipe, setDeletingRecipe] = useState<Recipe | null>(null)
  const printRecipe = usePrintRecipe()
  // The same queries (and cache entries) the tabs' own contents read, so the
  // counts cost no extra request once a tab has been opened.
  const treatmentCount = useQuery(treatmentQueries.list(clinicId, patient.id)).data?.length
  const recipeCount = useQuery(recipeQueries.list(clinicId, patient.id)).data?.length
  const attachmentsQuery = useQuery(attachmentQueries.list(clinicId, patient.id))
  const attachments = attachmentsQuery.data ?? []

  return (
    <>
      <Tabs
        items={[
          {
            value: 'general',
            label: t('patients:detail.tabGeneral'),
            content: (
              <Card className="p-6">
                <TreatmentToothChart
                  clinicId={clinicId}
                  onCreate={onOpenComposer}
                  onVoid={setVoidingTreatment}
                  patientId={patient.id}
                />
              </Card>
            ),
          },
          {
            value: 'treatments',
            label: <TabLabel count={treatmentCount}>{t('patients:detail.tabTreatments')}</TabLabel>,
            content: (
              <TreatmentHistoryTable
                clinicId={clinicId}
                onCreate={onOpenComposer}
                onVoid={setVoidingTreatment}
                patientId={patient.id}
              />
            ),
          },
          {
            value: 'prescriptions',
            label: <TabLabel count={recipeCount}>{t('patients:detail.tabPrescriptions')}</TabLabel>,
            content: (
              <Card className="p-6">
                <PrescriptionCards
                  clinicId={clinicId}
                  onCreate={onOpenRecipeEditor}
                  onDelete={setDeletingRecipe}
                  onEdit={setEditingRecipe}
                  onPrint={(recipe) => printRecipe.mutate(recipe.id)}
                  patientId={patient.id}
                />
              </Card>
            ),
          },
          {
            value: 'gallery',
            label: (
              <TabLabel count={attachmentsQuery.data?.length}>
                {t('patients:detail.tabGallery')}
              </TabLabel>
            ),
            content: (
              <Card className="p-6">
                <div className="flex flex-col gap-4">
                  <Can permission="attachment:manage">
                    <GalleryDropzone clinicId={clinicId} patientId={patient.id} />
                  </Can>
                  {attachments.length === 0 ? null : (
                    <AttachmentGallery attachments={attachments} clinicId={clinicId} />
                  )}
                </div>
              </Card>
            ),
          },
        ]}
      />

      {/* Mounted per prescription: the editor seeds its rows once, from the one being edited. */}
      {editingRecipe === null ? null : (
        <RecipeEditor
          clinicId={clinicId}
          key={editingRecipe.id}
          onOpenChange={(open: boolean) => {
            if (!open) setEditingRecipe(null)
          }}
          open
          patientId={patient.id}
          patientName={patient.fullName}
          recipe={editingRecipe}
        />
      )}

      {deletingRecipe === null ? null : (
        <DeleteRecipeDialog
          clinicId={clinicId}
          onOpenChange={(open: boolean) => {
            if (!open) setDeletingRecipe(null)
          }}
          open
          recipe={deletingRecipe}
        />
      )}

      {voidingTreatment === null ? null : (
        <VoidTreatmentDialog
          clinicId={clinicId}
          onOpenChange={(open: boolean) => {
            if (!open) setVoidingTreatment(null)
          }}
          onVoided={() => setVoidingTreatment(null)}
          open
          treatment={voidingTreatment}
        />
      )}
    </>
  )
}

function PatientDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-6 w-32" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  )
}
