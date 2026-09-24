import { AuthenticatedUser } from '../middleware/auth';

/**
 * Permission System for Vedata
 * 
 * Defines granular permissions and checks for role-based access control.
 */

// Permission definitions
export enum Permission {
  // Zone Management
  ZONE_VIEW = 'zone.view',
  ZONE_CREATE = 'zone.create',
  ZONE_UPDATE = 'zone.update',
  ZONE_MOVE = 'zone.move',
  ZONE_ARCHIVE = 'zone.archive',

  // Animal Management
  ANIMAL_VIEW = 'animal.view',
  ANIMAL_CREATE = 'animal.create',
  ANIMAL_UPDATE = 'animal.update',
  ANIMAL_DELETE = 'animal.delete',
  ANIMAL_MARK_DECEASED = 'animal.mark_deceased',

  // Owner Management
  OWNER_VIEW = 'owner.view',
  OWNER_CREATE = 'owner.create',
  OWNER_UPDATE = 'owner.update',

  // Vaccination Management
  VACCINATION_VIEW = 'vaccination.view',
  VACCINATION_CREATE = 'vaccination.create',
  VACCINATION_UPDATE = 'vaccination.update',
  VACCINATION_DELETE = 'vaccination.delete',

  // Disease & Vaccine Configuration
  DISEASE_VIEW = 'disease.view',
  DISEASE_CREATE = 'disease.create',
  DISEASE_UPDATE = 'disease.update',
  DISEASE_DELETE = 'disease.delete',
  VACCINE_CREATE = 'vaccine.create',
  VACCINE_UPDATE = 'vaccine.update',
  SCHEDULE_MANAGE = 'schedule.manage',

  // Species & Breed Configuration
  SPECIES_VIEW = 'species.view',
  SPECIES_CREATE = 'species.create',
  SPECIES_UPDATE = 'species.update',
  BREED_CREATE = 'breed.create',
  BREED_UPDATE = 'breed.update',

  // Team Management
  TEAM_VIEW = 'team.view',
  TEAM_INVITE = 'team.invite',
  TEAM_UPDATE = 'team.update',
  TEAM_CONTRACT_EXTEND = 'team.contract.extend',

  // User Management
  USER_VIEW = 'user.view',
  USER_CREATE = 'user.create',
  USER_UPDATE = 'user.update',
  USER_ASSIGN_ZONE = 'user.assign_zone',
  USER_SUSPEND = 'user.suspend',

  // Role Management
  ROLE_VIEW = 'role.view',
  ROLE_CREATE = 'role.create',
  ROLE_UPDATE = 'role.update',
  ROLE_DELETE = 'role.delete',

  // Audit Log
  AUDIT_VIEW = 'audit.view',
  AUDIT_VIEW_ALL = 'audit.view_all',

  // Dashboard & Reports
  DASHBOARD_SYSTEM = 'dashboard.system',
  DASHBOARD_ZONE = 'dashboard.zone',
  DASHBOARD_PERSONAL = 'dashboard.personal',
  REPORTS_VIEW = 'reports.view',
  REPORTS_EXPORT = 'reports.export',
}

// Role-based permission mapping
const rolePermissions: Record<string, Permission[]> = {
  superadmin: [
    // All permissions
    Permission.ZONE_VIEW,
    Permission.ZONE_CREATE,
    Permission.ZONE_UPDATE,
    Permission.ZONE_MOVE,
    Permission.ZONE_ARCHIVE,
    Permission.ANIMAL_VIEW,
    Permission.ANIMAL_CREATE,
    Permission.ANIMAL_UPDATE,
    Permission.ANIMAL_DELETE,
    Permission.ANIMAL_MARK_DECEASED,
    Permission.OWNER_VIEW,
    Permission.OWNER_CREATE,
    Permission.OWNER_UPDATE,
    Permission.VACCINATION_VIEW,
    Permission.VACCINATION_CREATE,
    Permission.VACCINATION_UPDATE,
    Permission.VACCINATION_DELETE,
    Permission.DISEASE_VIEW,
    Permission.DISEASE_CREATE,
    Permission.DISEASE_UPDATE,
    Permission.DISEASE_DELETE,
    Permission.VACCINE_CREATE,
    Permission.VACCINE_UPDATE,
    Permission.SCHEDULE_MANAGE,
    Permission.SPECIES_VIEW,
    Permission.SPECIES_CREATE,
    Permission.SPECIES_UPDATE,
    Permission.BREED_CREATE,
    Permission.BREED_UPDATE,
    Permission.TEAM_VIEW,
    Permission.TEAM_INVITE,
    Permission.TEAM_UPDATE,
    Permission.TEAM_CONTRACT_EXTEND,
    Permission.USER_VIEW,
    Permission.USER_CREATE,
    Permission.USER_UPDATE,
    Permission.USER_ASSIGN_ZONE,
    Permission.USER_SUSPEND,
    Permission.ROLE_VIEW,
    Permission.ROLE_CREATE,
    Permission.ROLE_UPDATE,
    Permission.ROLE_DELETE,
    Permission.AUDIT_VIEW,
    Permission.AUDIT_VIEW_ALL,
    Permission.DASHBOARD_SYSTEM,
    Permission.DASHBOARD_ZONE,
    Permission.DASHBOARD_PERSONAL,
    Permission.REPORTS_VIEW,
    Permission.REPORTS_EXPORT,
  ],
  vet: [
    Permission.ZONE_VIEW,
    Permission.ZONE_UPDATE,
    Permission.ANIMAL_VIEW,
    Permission.ANIMAL_CREATE,
    Permission.ANIMAL_UPDATE,
    Permission.ANIMAL_DELETE,
    Permission.ANIMAL_MARK_DECEASED,
    Permission.OWNER_VIEW,
    Permission.OWNER_CREATE,
    Permission.OWNER_UPDATE,
    Permission.VACCINATION_VIEW,
    Permission.VACCINATION_CREATE,
    Permission.VACCINATION_UPDATE,
    Permission.VACCINATION_DELETE,
    Permission.DISEASE_VIEW,
    Permission.SPECIES_VIEW,
    Permission.TEAM_VIEW,
    Permission.TEAM_INVITE,
    Permission.TEAM_UPDATE,
    Permission.TEAM_CONTRACT_EXTEND,
    Permission.AUDIT_VIEW,
    Permission.DASHBOARD_ZONE,
    Permission.DASHBOARD_PERSONAL,
    Permission.REPORTS_VIEW,
    Permission.REPORTS_EXPORT,
  ],
  technician: [
    Permission.ANIMAL_VIEW,
    Permission.ANIMAL_CREATE,
    Permission.ANIMAL_UPDATE, // Within grace period
    Permission.OWNER_VIEW,
    Permission.OWNER_CREATE,
    Permission.OWNER_UPDATE,
    Permission.VACCINATION_VIEW,
    Permission.VACCINATION_CREATE,
    Permission.VACCINATION_UPDATE, // Within grace period
    Permission.DISEASE_VIEW,
    Permission.SPECIES_VIEW,
    Permission.DASHBOARD_PERSONAL,
    Permission.REPORTS_VIEW,
  ],
};

/**
 * Check if user has a specific permission
 */
export function hasPermission(user: AuthenticatedUser, permission: Permission): boolean {
  const userPermissions = rolePermissions[user.role] || [];
  return userPermissions.includes(permission);
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(user: AuthenticatedUser, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(user: AuthenticatedUser, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(user, permission));
}

/**
 * Get all permissions for a user
 */
export function getUserPermissions(user: AuthenticatedUser): Permission[] {
  return rolePermissions[user.role] || [];
}

/**
 * Check if user has access to a specific zone
 */
export function hasZoneAccess(user: AuthenticatedUser, zoneId: string): boolean {
  // Superadmins have access to all zones
  if (user.role === 'superadmin') {
    return true;
  }

  // Check if user has an active role in the zone
  return user.zoneRoles.some((zr) => zr.zoneId === zoneId && zr.status === 'active');
}

/**
 * Check if user is lead vet in a zone
 */
export function isZoneLead(user: AuthenticatedUser, zoneId: string): boolean {
  return user.zoneRoles.some((zr) => zr.zoneId === zoneId && zr.isLead && zr.status === 'active');
}

/**
 * Get all zone IDs user has access to
 */
export function getUserZoneIds(user: AuthenticatedUser): string[] {
  if (user.role === 'superadmin') {
    // Superadmins need to query all zones - return empty to indicate "all"
    return [];
  }
  return user.zoneRoles.filter((zr) => zr.status === 'active').map((zr) => zr.zoneId);
}

/**
 * Check if user can edit a record within grace period
 */
export function canEditWithinGracePeriod(
  user: AuthenticatedUser,
  createdByUserId: string,
  editableUntil: Date | null,
): boolean {
  // Vets and superadmins can edit anytime
  if (user.role === 'vet' || user.role === 'superadmin') {
    return true;
  }

  // Technicians can only edit their own records within grace period
  if (user.role === 'technician') {
    if (createdByUserId !== user.id) {
      return false;
    }
    if (!editableUntil) {
      return false;
    }
    return new Date() <= editableUntil;
  }

  return false;
}

/**
 * Permission check decorator for routes
 */
export function requirePermission(permission: Permission) {
  return (user: AuthenticatedUser): boolean => {
    return hasPermission(user, permission);
  };
}

/**
 * Get dashboard permissions for user
 */
export function getDashboardPermissions(user: AuthenticatedUser) {
  return {
    canViewSystemDashboard: hasPermission(user, Permission.DASHBOARD_SYSTEM),
    canViewZoneDashboard: hasPermission(user, Permission.DASHBOARD_ZONE),
    canViewPersonalDashboard: hasPermission(user, Permission.DASHBOARD_PERSONAL),
    canManageZones: hasPermission(user, Permission.ZONE_CREATE),
    canManageUsers: hasPermission(user, Permission.USER_CREATE),
    canViewAuditLog: hasPermission(user, Permission.AUDIT_VIEW_ALL),
    canManageTeam: hasPermission(user, Permission.TEAM_INVITE),
    canConfigureSystem: hasPermission(user, Permission.DISEASE_CREATE),
  };
}
