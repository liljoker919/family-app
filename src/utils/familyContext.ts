/**
 * Family context utilities for multi-tenant isolation.
 *
 * Every authenticated user must belong to exactly one Family.
 * All domain-model reads and writes are scoped to the user's familyId,
 * enforcing tenant isolation at the application layer.
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

type StoredMemberRole = 'ADMIN' | 'PLANNER' | 'MEMBER';

export type FamilyRole = 'ADMIN' | 'MEMBER';

export interface FamilyMembership {
  familyId: string;
  role: FamilyRole;
  canPlan: boolean;
  displayName: string | null | undefined;
  familyName: string | null;
  familyJoinCode: string | null;
}

/**
 * Generate a short random join code for a family (e.g. "ABC123").
 */
export function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Look up the FamilyMember record for the given userId.
 * Returns null if the user has no family membership.
 */
function normalizeMembershipRole(role: string | null | undefined): {
  role: FamilyRole;
  canPlan: boolean;
} {
  const storedRole = (role ?? 'MEMBER') as StoredMemberRole;
  if (storedRole === 'ADMIN') {
    return { role: 'ADMIN', canPlan: true };
  }

  return {
    role: 'MEMBER',
    canPlan: storedRole === 'PLANNER',
  };
}

export async function getFamilyMembership(
  userId: string
): Promise<FamilyMembership | null> {
  try {
    const { data: members } = await client.models.FamilyMember.list({
      filter: { userId: { eq: userId } },
    });

    if (members.length === 0) {
      return null;
    }

    const member = members[0];

    // Fetch the family name for display purposes
    let familyName: string | null = null;
    let familyJoinCode: string | null = null;
    try {
      const { data: family } = await client.models.Family.get({ id: member.familyId });
      familyName = family?.name ?? null;
      familyJoinCode = family?.joinCode ?? null;
    } catch {
      // Family lookup is best-effort
    }

    const normalizedRole = normalizeMembershipRole(member.role ?? 'MEMBER');

    return {
      familyId: member.familyId,
      role: normalizedRole.role,
      canPlan: normalizedRole.canPlan,
      displayName: member.displayName,
      familyName,
      familyJoinCode,
    };
  } catch (error) {
    console.error('Error fetching family membership:', error);
    return null;
  }
}

/**
 * Create a new Family and add the user as ADMIN.
 * Returns the new FamilyMembership.
 */
export async function createFamily(
  name: string,
  userId: string,
  displayName?: string
): Promise<FamilyMembership> {
  const joinCode = generateJoinCode();

  const { data: family, errors: familyErrors } = await client.models.Family.create({
    name,
    joinCode,
    createdBy: userId,
  });

  if (familyErrors || !family) {
    throw new Error(
      familyErrors?.map((e) => e.message).join(', ') ?? 'Failed to create family'
    );
  }

  const { data: member, errors: memberErrors } = await client.models.FamilyMember.create({
    familyId: family.id,
    userId,
    role: 'ADMIN',
    displayName: displayName ?? null,
  });

  if (memberErrors || !member) {
    throw new Error(
      memberErrors?.map((e) => e.message).join(', ') ?? 'Failed to create family membership'
    );
  }

  // Assign the user to the family's Cognito group so that the server-side
  // allow.groupDefinedIn('familyId') rule on all family-scoped models is
  // satisfied.  This call is best-effort: a failure here does not roll back
  // the family/member records; the user can retry via addSelfToFamilyGroup.
  try {
    await (client.mutations as any).addSelfToFamilyGroup({ familyId: family.id });
  } catch (err) {
    // Non-fatal: the user can still use the app; group assignment can be
    // retried, or an admin can use the Cognito console to add them.
    console.warn('[createFamily] addSelfToFamilyGroup failed (non-fatal):', err);
  }

  return {
    familyId: family.id,
    role: 'ADMIN',
    canPlan: true,
    displayName: member.displayName,
    familyName: family.name,
    familyJoinCode: family.joinCode ?? null,
  };
}

/**
 * Join an existing family using its join code.
 * Returns the new FamilyMembership on success, or null if the code is invalid.
 */
export async function joinFamily(
  joinCode: string,
  userId: string,
  displayName?: string
): Promise<FamilyMembership | null> {
  const normalizedCode = joinCode.trim().toUpperCase();

  const { data: families } = await client.models.Family.list({
    filter: { joinCode: { eq: normalizedCode } },
  });

  if (!families || families.length === 0) {
    return null;
  }

  const family = families[0];

  // Check if the user is already a member
  const { data: existing } = await client.models.FamilyMember.list({
    filter: { familyId: { eq: family.id }, userId: { eq: userId } },
  });

  if (existing && existing.length > 0) {
    const normalizedRole = normalizeMembershipRole(existing[0].role ?? 'MEMBER');

    return {
      familyId: family.id,
      role: normalizedRole.role,
      canPlan: normalizedRole.canPlan,
      displayName: existing[0].displayName,
      familyName: family.name,
      familyJoinCode: family.joinCode ?? null,
    };
  }

  const { data: member, errors: memberErrors } = await client.models.FamilyMember.create({
    familyId: family.id,
    userId,
    role: 'MEMBER',
    displayName: displayName ?? null,
  });

  if (memberErrors || !member) {
    throw new Error(
      memberErrors?.map((e) => e.message).join(', ') ?? 'Failed to join family'
    );
  }

  // Assign the user to the family's Cognito group (tenant isolation).
  try {
    await (client.mutations as any).addSelfToFamilyGroup({ familyId: family.id });
  } catch (err) {
    // Non-fatal: best-effort group assignment.
    console.warn('[joinFamily] addSelfToFamilyGroup failed (non-fatal):', err);
  }

  return {
    familyId: family.id,
    role: 'MEMBER',
    canPlan: false,
    displayName: member.displayName,
    familyName: family.name,
    familyJoinCode: family.joinCode ?? null,
  };
}

/**
 * Redeem a one-time invite token after the user has authenticated.
 *
 * Calls the `redeemInvite` Lambda mutation which:
 *   - Validates the token (PENDING, not expired, email match).
 *   - Creates a FamilyMember record with the role from the invite.
 *   - Marks the invite ACCEPTED.
 *
 * Returns a FamilyMembership on success, or throws on any validation failure.
 */
export async function redeemInviteToken(token: string): Promise<FamilyMembership> {
  const { data: result, errors } = await (client.mutations as any).redeemInvite({ token });

  if (errors || !result) {
    throw new Error(
      errors?.map((e: { message: string }) => e.message).join(', ') ??
        'Failed to redeem invite. Please try again.'
    );
  }

  const normalizedRole = normalizeMembershipRole(result.role as string);

  return {
    familyId: result.familyId,
    role: normalizedRole.role,
    canPlan: normalizedRole.canPlan,
    displayName: null,
    familyName: result.familyName,
    familyJoinCode: null,
  };
}

/**
 * Parse invite URL parameters from a URL search string.
 *
 * Returns the token, email, role, and family name embedded in the invite URL,
 * or null for any field that is absent or empty.
 */
export function parseInviteParams(search: string): {
  token: string | null;
  email: string | null;
  role: string | null;
  family: string | null;
} {
  const params = new URLSearchParams(search);
  return {
    token: params.get('token') || null,
    email: params.get('email') || null,
    role: params.get('role') || null,
    family: params.get('family') || null,
  };
}
