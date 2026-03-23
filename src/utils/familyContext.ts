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

export type FamilyRole = 'ADMIN' | 'PLANNER' | 'MEMBER';

export interface FamilyMembership {
  familyId: string;
  role: FamilyRole;
  displayName: string | null | undefined;
  familyName: string | null;
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
    try {
      const { data: family } = await client.models.Family.get({ id: member.familyId });
      familyName = family?.name ?? null;
    } catch {
      // Family lookup is best-effort
    }

    return {
      familyId: member.familyId,
      role: (member.role ?? 'MEMBER') as FamilyRole,
      displayName: member.displayName,
      familyName,
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

  return {
    familyId: family.id,
    role: 'ADMIN',
    displayName: member.displayName,
    familyName: family.name,
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
    return {
      familyId: family.id,
      role: (existing[0].role ?? 'MEMBER') as FamilyRole,
      displayName: existing[0].displayName,
      familyName: family.name,
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

  return {
    familyId: family.id,
    role: 'MEMBER',
    displayName: member.displayName,
    familyName: family.name,
  };
}
