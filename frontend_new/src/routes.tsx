import React, { LazyExoticComponent, FC, ReactNode } from 'react'
import { Translation } from 'react-i18next'

export type Route = {
  element?: LazyExoticComponent<FC>
  exact?: boolean
  name?: ReactNode
  path?: string
  routes?: Route[]
}

const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'))
const Colors = React.lazy(() => import('./views/theme/colors/Colors'))
const Typography = React.lazy(() => import('./views/theme/typography/Typography'))

// Base
const Accordion = React.lazy(() => import('./views/base/accordion/Accordion'))
const Breadcrumbs = React.lazy(() => import('./views/base/breadcrumbs/Breadcrumbs'))
const Calendar = React.lazy(() => import('./views/base/calendar/Calendar'))
const Cards = React.lazy(() => import('./views/base/cards/Cards'))
const Carousels = React.lazy(() => import('./views/base/carousels/Carousels'))
const Collapses = React.lazy(() => import('./views/base/collapses/Collapses'))
const ListGroups = React.lazy(() => import('./views/base/list-groups/ListGroups'))
const Navs = React.lazy(() => import('./views/base/navs/Navs'))
const Paginations = React.lazy(() => import('./views/base/paginations/Paginations'))
const Placeholders = React.lazy(() => import('./views/base/placeholders/Placeholders'))
const Popovers = React.lazy(() => import('./views/base/popovers/Popovers'))
const Progress = React.lazy(() => import('./views/base/progress/Progress'))
const Spinners = React.lazy(() => import('./views/base/spinners/Spinners'))
const Tabs = React.lazy(() => import('./views/base/tabs/Tabs'))
const Tables = React.lazy(() => import('./views/base/tables/Tables'))
const Tooltips = React.lazy(() => import('./views/base/tooltips/Tooltips'))
const VirtualScroller = React.lazy(() => import('./views/base/virtual-scroller/VirtualScroller'))

// Buttons
const Buttons = React.lazy(() => import('./views/buttons/buttons/Buttons'))
const ButtonGroups = React.lazy(() => import('./views/buttons/button-groups/ButtonGroups'))
const LoadingButtons = React.lazy(() => import('./views/buttons/loading-buttons/LoadingButtons'))
const Dropdowns = React.lazy(() => import('./views/buttons/dropdowns/Dropdowns'))

//Forms
const Autocomplete = React.lazy(() => import('./views/forms/autocomplete/Autocomplete'))
const ChecksRadios = React.lazy(() => import('./views/forms/checks-radios/ChecksRadios'))
const DatePicker = React.lazy(() => import('./views/forms/date-picker/DatePicker'))
const DateRangePicker = React.lazy(() => import('./views/forms/date-range-picker/DateRangePicker'))
const FloatingLabels = React.lazy(() => import('./views/forms/floating-labels/FloatingLabels'))
const FormControl = React.lazy(() => import('./views/forms/form-control/FormControl'))
const InputGroup = React.lazy(() => import('./views/forms/input-group/InputGroup'))
const Layout = React.lazy(() => import('./views/forms/layout/Layout'))
const MultiSelect = React.lazy(() => import('./views/forms/multi-select/MultiSelect'))
const PasswordInput = React.lazy(() => import('./views/forms/password-input/PasswordInput'))
const Range = React.lazy(() => import('./views/forms/range/Range'))
const RangeSlider = React.lazy(() => import('./views/forms/range-slider/RangeSlider'))
const Rating = React.lazy(() => import('./views/forms/rating/Rating'))
const Select = React.lazy(() => import('./views/forms/select/Select'))
const Stepper = React.lazy(() => import('./views/forms/stepper/Stepper'))
const TimePicker = React.lazy(() => import('./views/forms/time-picker/TimePicker'))
const Validation = React.lazy(() => import('./views/forms/validation/Validation'))

// Icons
const CoreUIIcons = React.lazy(() => import('./views/icons/coreui-icons/CoreUIIcons'))
const Flags = React.lazy(() => import('./views/icons/flags/Flags'))
const Brands = React.lazy(() => import('./views/icons/brands/Brands'))

// Notifications
const Alerts = React.lazy(() => import('./views/notifications/alerts/Alerts'))
const Badges = React.lazy(() => import('./views/notifications/badges/Badges'))
const Modals = React.lazy(() => import('./views/notifications/modals/Modals'))
const Toasts = React.lazy(() => import('./views/notifications/toasts/Toasts'))

const SmartTable = React.lazy(() => import('./views/smart-table/SmartTable'))

// Plugins
const FullCalendar = React.lazy(() => import('./views/plugins/full-calendar/FullCalendar'))
const Charts = React.lazy(() => import('./views/plugins/charts/Charts'))
const GoogleMaps = React.lazy(() => import('./views/plugins/google-maps/GoogleMaps'))

const Widgets = React.lazy(() => import('./views/widgets/Widgets'))

const Invoice = React.lazy(() => import('./views/apps/invoicing/Invoice'))

// Expense Tracker
const ExpenseTracker = React.lazy(() => import('./views/expense-tracker/ExpenseTracker'))
const ExpenseTrackerDemo = React.lazy(() => import('./views/expense-tracker/ExpenseTrackerDemo'))
const ExcelDemo = React.lazy(() => import('./views/expense-tracker/ExcelDemo'))

// Organizations
const OrganizationList = React.lazy(() => import('./views/organizations/OrganizationList'))
const OrganizationSettings = React.lazy(() => import('./views/organizations/OrganizationSettings'))

// Invitations
const MyInvitations = React.lazy(() => import('./views/invitations/MyInvitations'))
const AcceptInvitation = React.lazy(() => import('./views/invitations/AcceptInvitation'))

// System Administration
const AdminDashboard = React.lazy(() => import('./views/admin/AdminDashboard'))
const UserManagement = React.lazy(() => import('./views/admin/UserManagement'))
const OrganizationManagement = React.lazy(() => import('./views/admin/OrganizationManagement'))
const SystemLogs = React.lazy(() => import('./views/admin/SystemLogs'))
const BackupManagement = React.lazy(() => import('./views/admin/BackupManagement'))
const SystemSettings = React.lazy(() => import('./views/admin/SystemSettings'))

const routes: Route[] = [
  { path: '/', exact: true, name: <Translation>{(t) => t('home')}</Translation> },
  {
    path: '/dashboard',
    name: <Translation>{(t) => t('dashboard')}</Translation>,
    element: Dashboard,
  },
  {
    path: '/expense-tracker',
    name: 'Expense Tracker',
    element: ExpenseTracker,
  },
  {
    path: '/expense-tracker-demo',
    name: 'Excel Grid Demo',
    element: ExpenseTrackerDemo,
  },
  {
    path: '/excel-demo',
    name: 'Excel Demo (Standalone)',
    element: ExcelDemo,
  },
  {
    path: '/organizations',
    name: 'Organizations',
    element: OrganizationList,
    exact: true,
  },
  {
    path: '/organizations/:id',
    name: 'Organization Settings',
    element: OrganizationSettings,
  },
  {
    path: '/invitations',
    name: 'My Invitations',
    element: MyInvitations,
    exact: true,
  },
  {
    path: '/invitations/:token/accept',
    name: 'Accept Invitation',
    element: AcceptInvitation,
  },
  {
    path: '/admin',
    name: 'System Admin',
    element: AdminDashboard,
    exact: true,
  },
  {
    path: '/admin/dashboard',
    name: 'Admin Dashboard',
    element: AdminDashboard,
  },
  {
    path: '/admin/users',
    name: 'User Management',
    element: UserManagement,
  },
  {
    path: '/admin/organizations',
    name: 'Organization Management',
    element: OrganizationManagement,
  },
  {
    path: '/admin/logs',
    name: 'System Logs',
    element: SystemLogs,
  },
  {
    path: '/admin/backups',
    name: 'Backup Management',
    element: BackupManagement,
  },
  {
    path: '/admin/settings',
    name: 'System Settings',
    element: SystemSettings,
  },
  {
    path: '/theme',
    name: <Translation>{(t) => t('theme')}</Translation>,
    element: Colors,
    exact: true,
  },
  { path: '/theme/colors', name: <Translation>{(t) => t('colors')}</Translation>, element: Colors },
  {
    path: '/theme/typography',
    name: <Translation>{(t) => t('typography')}</Translation>,
    element: Typography,
  },
  {
    path: '/base',
    name: <Translation>{(t) => t('base')}</Translation>,
    element: Cards,
    exact: true,
  },
  { path: '/base/accordion', name: 'Accordion', element: Accordion },
  { path: '/base/breadcrumbs', name: 'Breadcrumbs', element: Breadcrumbs },
  { path: '/base/calendar', name: 'Calendar', element: Calendar },
  { path: '/base/cards', name: 'Cards', element: Cards },
  { path: '/base/carousels', name: 'Carousel', element: Carousels },
  { path: '/base/collapses', name: 'Collapse', element: Collapses },
  { path: '/base/list-groups', name: 'List Groups', element: ListGroups },
  { path: '/base/navs', name: 'Navs', element: Navs },
  { path: '/base/paginations', name: 'Paginations', element: Paginations },
  { path: '/base/placeholders', name: 'Placeholders', element: Placeholders },
  { path: '/base/popovers', name: 'Popovers', element: Popovers },
  { path: '/base/progress', name: 'Progress', element: Progress },
  { path: '/base/spinners', name: 'Spinners', element: Spinners },
  { path: '/base/tabs', name: 'Tabs', element: Tabs },
  { path: '/base/tables', name: 'Tables', element: Tables },
  { path: '/base/tooltips', name: 'Tooltips', element: Tooltips },
  { path: '/base/virtual-scroller', name: 'VirtualScroller', element: VirtualScroller },
  {
    path: '/buttons',
    name: <Translation>{(t) => t('buttons')}</Translation>,
    element: Buttons,
    exact: true,
  },
  { path: '/buttons/buttons', name: 'Buttons', element: Buttons },
  { path: '/buttons/button-groups', name: 'Button Groups', element: ButtonGroups },
  { path: '/buttons/loading-buttons', name: 'Loading Buttons', element: LoadingButtons },
  { path: '/buttons/dropdowns', name: 'Dropdowns', element: Dropdowns },
  {
    path: '/forms',
    name: <Translation>{(t) => t('forms')}</Translation>,
    element: FormControl,
    exact: true,
  },
  { path: '/forms/autocomplete', name: 'Autocomplete', element: Autocomplete },
  { path: '/forms/checks-radios', name: 'Checks & Radios', element: ChecksRadios },
  { path: '/forms/date-picker', name: 'Date Picker', element: DatePicker },
  { path: '/forms/date-range-picker', name: 'Date Range Picker', element: DateRangePicker },
  { path: '/forms/floating-labels', name: 'Floating Labels', element: FloatingLabels },
  { path: '/forms/form-control', name: 'Form Control', element: FormControl },
  { path: '/forms/input-group', name: 'Input Group', element: InputGroup },
  { path: '/forms/layout', name: 'Layout', element: Layout },
  { path: '/forms/multi-select', name: 'Multi Select', element: MultiSelect },
  { path: '/forms/password-input', name: 'Password Input', element: PasswordInput },
  { path: '/forms/range', name: 'Range', element: Range },
  { path: '/forms/range-slider', name: 'RangeSlider', element: RangeSlider },
  { path: '/forms/rating', name: 'Rating', element: Rating },
  { path: '/forms/select', name: 'Select', element: Select },
  { path: '/forms/stepper', name: 'Stepper', element: Stepper },
  { path: '/forms/time-picker', name: 'Time Picker', element: TimePicker },
  { path: '/forms/validation', name: 'Validation', element: Validation },
  {
    path: '/icons',
    exact: true,
    name: <Translation>{(t) => t('icons')}</Translation>,
    element: CoreUIIcons,
  },
  { path: '/icons/coreui-icons', name: 'CoreUI Icons', element: CoreUIIcons },
  { path: '/icons/flags', name: 'Flags', element: Flags },
  { path: '/icons/brands', name: 'Brands', element: Brands },
  {
    path: '/notifications',
    name: <Translation>{(t) => t('notifications')}</Translation>,
    element: Alerts,
    exact: true,
  },
  { path: '/notifications/alerts', name: 'Alerts', element: Alerts },
  { path: '/notifications/badges', name: 'Badges', element: Badges },
  { path: '/notifications/modals', name: 'Modals', element: Modals },
  { path: '/notifications/toasts', name: 'Toasts', element: Toasts },
  {
    path: '/plugins',
    name: <Translation>{(t) => t('plugins')}</Translation>,
    element: Calendar,
    exact: true,
  },
  {
    path: '/plugins/calendar',
    name: <Translation>{(t) => t('calendar')}</Translation>,
    element: Calendar,
  },
  {
    path: '/plugins/charts',
    name: <Translation>{(t) => t('charts')}</Translation>,
    element: Charts,
  },
  {
    path: '/plugins/full-calendar',
    name: 'FullCalendar',
    element: FullCalendar,
  },
  { path: '/plugins/google-maps', name: 'GoogleMaps', element: GoogleMaps },
  { path: '/smart-table', name: 'Smart Table', element: SmartTable },
  { path: '/widgets', name: <Translation>{(t) => t('widgets')}</Translation>, element: Widgets },
  {
    path: '/apps',
    name: <Translation>{(t) => t('apps')}</Translation>,
    element: Invoice,
    exact: true,
  },
  { path: '/apps/invoicing', name: 'Invoice', element: Invoice, exact: true },
  { path: '/apps/invoicing/invoice', name: 'Invoice', element: Invoice },
  { path: '/apps/email', name: 'Email', exact: true },
  { path: '/apps/email/inbox', name: 'Inbox', exact: true },
  { path: '/apps/email/compose', name: 'Compose', exact: true },
  { path: '/apps/email/message', name: 'Message', exact: true },
]

export default routes
