/**
 * Permission Hierarchy for Multi-User Organizations
 *
 * See backend app/utils/permissions.py for full documentation.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * QUICK REFERENCE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Organization Roles:
 * - owner: God mode (full access to everything)
 * - admin: Edit all accounts, manage members
 * - member: Uses default_permission or account_permission
 * - viewer: Read-only everything
 *
 * Account Permissions:
 * - full: CRUD transactions + account settings + manage permissions
 * - edit: RU transactions only (no delete, no settings)
 * - view: R transactions only (read-only)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * PERMISSION RESOLUTION ORDER
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. Check organization role first:
 *    - Owner → Always full access (bypass all other checks)
 *    - Admin → Always edit access (bypass account permissions)
 *    - Viewer → Always read-only (cannot be overridden)
 *
 * 2. If member, check account-level permission:
 *    - If explicit account_permission exists → use it
 *    - Else → fall back to account.default_permission
 *
 * Examples:
 * - Owner viewing Account A → Full access (no permission check needed)
 * - Admin editing Account B → Edit access automatically
 * - Member with account_permission='full' on Account C → Full access to C only
 * - Member with no account_permission on Account D (default='view') → Read-only
 * - Viewer trying to edit anything → Denied (always read-only)
 */

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer'
export type AccountPermission = 'full' | 'edit' | 'view'

/**
 * Permission level hierarchy (higher = more permissions)
 */
const PERMISSION_LEVELS: Record<AccountPermission, number> = {
  full: 3,
  edit: 2,
  view: 1
}

/**
 * Role level hierarchy (higher = more permissions)
 */
const ROLE_LEVELS: Record<OrgRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1
}

/**
 * Check if user can view an account
 *
 * @param orgRole - User's organization role
 * @param accountPermission - Optional explicit account permission
 * @returns true if user can view (everyone can view if in organization)
 */
export function canViewAccount(
  orgRole: OrgRole,
  accountPermission?: AccountPermission
): boolean {
  // Everyone in the organization can view accounts
  return true
}

/**
 * Check if user can edit account transactions
 *
 * @param orgRole - User's organization role
 * @param accountPermission - Optional explicit account permission
 * @param accountDefaultPermission - Account's default permission for members
 * @returns true if user can edit transactions
 */
export function canEditAccount(
  orgRole: OrgRole,
  accountPermission?: AccountPermission,
  accountDefaultPermission?: AccountPermission
): boolean {
  // Owner always can
  if (orgRole === 'owner') return true

  // Admin always can
  if (orgRole === 'admin') return true

  // Viewer never can
  if (orgRole === 'viewer') return false

  // Member: check account permission hierarchy
  const permission = accountPermission || accountDefaultPermission || 'view'
  return PERMISSION_LEVELS[permission] >= PERMISSION_LEVELS['edit']
}

/**
 * Check if user has full access to account (can delete, manage settings)
 *
 * @param orgRole - User's organization role
 * @param accountPermission - Optional explicit account permission
 * @param accountDefaultPermission - Account's default permission for members
 * @returns true if user has full access
 */
export function hasFullAccountAccess(
  orgRole: OrgRole,
  accountPermission?: AccountPermission,
  accountDefaultPermission?: AccountPermission
): boolean {
  // Owner always has full access
  if (orgRole === 'owner') return true

  // Admin does NOT have full access (cannot delete accounts)
  if (orgRole === 'admin') return false

  // Viewer never has full access
  if (orgRole === 'viewer') return false

  // Member: needs explicit 'full' permission
  const permission = accountPermission || accountDefaultPermission || 'view'
  return permission === 'full'
}

/**
 * Check if user can delete transactions
 *
 * @param orgRole - User's organization role
 * @param accountPermission - Optional explicit account permission
 * @param accountDefaultPermission - Account's default permission for members
 * @returns true if user can delete transactions
 */
export function canDeleteTransactions(
  orgRole: OrgRole,
  accountPermission?: AccountPermission,
  accountDefaultPermission?: AccountPermission
): boolean {
  // Only owners and users with 'full' permission can delete
  if (orgRole === 'owner') return true
  if (orgRole === 'admin') return true

  const permission = accountPermission || accountDefaultPermission || 'view'
  return permission === 'full'
}

/**
 * Check if user can create new accounts in organization
 *
 * @param orgRole - User's organization role
 * @returns true if user can create accounts
 */
export function canCreateAccounts(orgRole: OrgRole): boolean {
  // Owner and admin can create accounts
  return orgRole === 'owner' || orgRole === 'admin'
}

/**
 * Check if user can delete accounts
 *
 * @param orgRole - User's organization role
 * @returns true if user can delete accounts
 */
export function canDeleteAccounts(orgRole: OrgRole): boolean {
  // Only owner can delete accounts
  return orgRole === 'owner'
}

/**
 * Check if user can manage organization members (invite, remove, change roles)
 *
 * @param orgRole - User's organization role
 * @returns true if user can manage members
 */
export function canManageMembers(orgRole: OrgRole): boolean {
  // Owner and admin can manage members
  return orgRole === 'owner' || orgRole === 'admin'
}

/**
 * Check if user can modify specific member
 *
 * @param actorRole - Role of user performing action
 * @param targetRole - Role of user being modified
 * @returns true if actor can modify target
 */
export function canModifyMember(
  actorRole: OrgRole,
  targetRole: OrgRole
): boolean {
  // Owner can modify anyone except other owners
  if (actorRole === 'owner') {
    return targetRole !== 'owner'
  }

  // Admin can modify members and viewers only
  if (actorRole === 'admin') {
    return targetRole === 'member' || targetRole === 'viewer'
  }

  // Members and viewers cannot modify anyone
  return false
}

/**
 * Check if user can manage account-level permissions
 *
 * @param orgRole - User's organization role
 * @param accountPermission - Optional explicit account permission
 * @returns true if user can manage permissions
 */
export function canManageAccountPermissions(
  orgRole: OrgRole,
  accountPermission?: AccountPermission
): boolean {
  // Owner and admin always can
  if (orgRole === 'owner' || orgRole === 'admin') return true

  // Members with 'full' permission can
  if (accountPermission === 'full') return true

  return false
}

/**
 * Check if user can transfer organization ownership
 *
 * @param orgRole - User's organization role
 * @returns true if user can transfer ownership
 */
export function canTransferOwnership(orgRole: OrgRole): boolean {
  // Only owner can transfer ownership
  return orgRole === 'owner'
}

/**
 * Check if user can delete organization
 *
 * @param orgRole - User's organization role
 * @returns true if user can delete organization
 */
export function canDeleteOrganization(orgRole: OrgRole): boolean {
  // Only owner can delete organization
  return orgRole === 'owner'
}

/**
 * Check if user can rotate organization keys
 *
 * @param orgRole - User's organization role
 * @returns true if user can rotate keys
 */
export function canRotateKeys(orgRole: OrgRole): boolean {
  // Only owner can rotate keys
  return orgRole === 'owner'
}

/**
 * Check if user can view audit logs
 *
 * @param orgRole - User's organization role
 * @returns true if user can view audit logs
 */
export function canViewAuditLogs(orgRole: OrgRole): boolean {
  // Owner and admin can view audit logs
  return orgRole === 'owner' || orgRole === 'admin'
}

/**
 * Get permission level name (for UI display)
 *
 * @param permission - Account permission level
 * @returns Human-readable permission name
 */
export function getPermissionDisplayName(permission: AccountPermission): string {
  const names: Record<AccountPermission, string> = {
    full: 'Full Access',
    edit: 'Can Edit',
    view: 'View Only'
  }
  return names[permission]
}

/**
 * Get role display name (for UI display)
 *
 * @param role - Organization role
 * @returns Human-readable role name
 */
export function getRoleDisplayName(role: OrgRole): string {
  const names: Record<OrgRole, string> = {
    owner: 'Owner',
    admin: 'Administrator',
    member: 'Member',
    viewer: 'Viewer'
  }
  return names[role]
}

/**
 * Get role color for badges (CoreUI color names)
 *
 * @param role - Organization role
 * @returns CoreUI color name
 */
export function getRoleBadgeColor(role: OrgRole): string {
  const colors: Record<OrgRole, string> = {
    owner: 'danger',
    admin: 'warning',
    member: 'info',
    viewer: 'secondary'
  }
  return colors[role]
}

/**
 * Get permission color for badges (CoreUI color names)
 *
 * @param permission - Account permission
 * @returns CoreUI color name
 */
export function getPermissionBadgeColor(permission: AccountPermission): string {
  const colors: Record<AccountPermission, string> = {
    full: 'success',
    edit: 'primary',
    view: 'secondary'
  }
  return colors[permission]
}

/**
 * Compare two permission levels
 *
 * @param permission1 - First permission
 * @param permission2 - Second permission
 * @returns -1 if permission1 < permission2, 0 if equal, 1 if permission1 > permission2
 */
export function comparePermissions(
  permission1: AccountPermission,
  permission2: AccountPermission
): number {
  const level1 = PERMISSION_LEVELS[permission1]
  const level2 = PERMISSION_LEVELS[permission2]

  if (level1 < level2) return -1
  if (level1 > level2) return 1
  return 0
}

/**
 * Compare two role levels
 *
 * @param role1 - First role
 * @param role2 - Second role
 * @returns -1 if role1 < role2, 0 if equal, 1 if role1 > role2
 */
export function compareRoles(role1: OrgRole, role2: OrgRole): number {
  const level1 = ROLE_LEVELS[role1]
  const level2 = ROLE_LEVELS[role2]

  if (level1 < level2) return -1
  if (level1 > level2) return 1
  return 0
}
