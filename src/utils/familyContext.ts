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

async function addSelfToFamilyGroupWithRetry(
  familyId: string,
  context: 'createFamily' | 'joinFamily'
): Promise<void> {
  const wait = async (ms: number) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  };

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await (client.mutations as any).addSelfToFamilyGroup({ familyId });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        console.warn(`[${context}] addSelfToFamilyGroup attempt ${attempt} failed; retrying...`, error);
        await wait(300 * attempt);
      }
    }
  }

  console.warn(`[${context}] addSelfToFamilyGroup failed after retries (non-fatal):`, lastError);
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
  const trimmedDisplayName = displayName?.trim() || null;
  const { data: result, errors } = await (client.mutations as any).createFamilyBootstrap({
    name,
    ...(trimmedDisplayName ? { displayName: trimmedDisplayName } : {}),
  });

  if (errors || !result) {
    throw new Error(
      errors?.map((e: { message: string }) => e.message).join(', ') ??
        'Failed to create family'
    );
  }

  // Assign the user to the family's Cognito group so that the server-side
  // allow.groupDefinedIn('familyId') rule on all family-scoped models is
  // satisfied.  This call is best-effort: a failure here does not roll back
  // the family/member records; the user can retry via addSelfToFamilyGroup.
  await addSelfToFamilyGroupWithRetry(result.familyId, 'createFamily');

  return {
    familyId: result.familyId,
    role: 'ADMIN',
    canPlan: true,
    displayName: trimmedDisplayName,
    familyName: result.familyName,
    familyJoinCode: result.joinCode ?? null,
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
  await addSelfToFamilyGroupWithRetry(family.id, 'joinFamily');

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
 * Create a solo family and start the 10-day free trial for a new user.
 *
 * This is the "Start Solo" onboarding path: no join code is required.  The
 * user gets their own private family (named "My Family") and an ADMIN role so
 * they can explore every feature during the trial window.
 *
 * Also creates (or updates) the user's Profile record with trial tracking
 * fields (`trialStartDate` and `trialStatus = TRIAL`).  Profile setup is
 * best-effort – a failure there does not block the user from reaching the
 * dashboard.
 *
 * @param userId      – Cognito login ID (email) / user identifier.
 * @param email       – The user's email address for the Profile record.
 * @param displayName – Optional friendly display name.
 */
export async function startSoloTrial(
  userId: string,
  email: string,
  displayName?: string
): Promise<FamilyMembership> {
  const membership = await createFamily('My Family', userId, displayName);

  const now = new Date().toISOString();
  try {
    const { data: profiles } = await client.models.Profile.list({
      filter: { userId: { eq: userId } },
    });
    if (profiles && profiles.length > 0) {
      await client.models.Profile.update({
        id: profiles[0].id,
        trialStartDate: now,
        trialStatus: 'TRIAL',
      });
    } else {
      await client.models.Profile.create({
        userId,
        email,
        trialStartDate: now,
        trialStatus: 'TRIAL',
      });
    }
  } catch (err) {
    // Non-fatal: trial tracking failure must not block onboarding.
    console.warn('[startSoloTrial] Profile trial setup failed (non-fatal):', err);
  }

  return membership;
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
