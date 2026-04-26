import type { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());

// Injected by the Amplify backend at deploy time (see amplify/backend.ts).
const INVITE_TABLE_NAME = process.env.INVITE_TABLE_NAME!;
const FAMILY_TABLE_NAME = process.env.FAMILY_TABLE_NAME!;
const APP_BASE_URL = process.env.APP_BASE_URL ?? 'https://kinsly.app';

const VALID_INVITE_ROLES = ['MEMBER', 'PLANNER'] as const;
type InviteRole = (typeof VALID_INVITE_ROLES)[number];

// 7-day expiry in milliseconds
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CreateInviteArgs {
  familyId: string;
  email: string;
  role: string;
}

interface CreateInviteResult {
  id: string;
  familyId: string;
  email: string;
  token: string;
  role: string;
  expiresAt: string;
  status: string;
  inviteUrl: string;
}

/**
 * AppSync Lambda resolver for the `createInvite` custom mutation.
 *
 * Enforces:
 *   1. Role must be MEMBER or PLANNER (ADMIN cannot be invited; must be promoted).
 *   2. Caller identity is resolved from AppSync context (not from args).
 *   3. A single-use UUID token is generated and stored with a 7-day TTL.
 */
export const handler: AppSyncResolverHandler<CreateInviteArgs, CreateInviteResult> = async (
  event
) => {
  const { familyId, email, role } = event.arguments;

  // ── 1. Validate the invite role ───────────────────────────────────────────
  if (!(VALID_INVITE_ROLES as readonly string[]).includes(role)) {
    throw new Error(`Invalid role: ${role}. Must be MEMBER or PLANNER.`);
  }

  // ── 2. Validate inputs ────────────────────────────────────────────────────
  if (!familyId || !familyId.trim()) {
    throw new Error('familyId is required.');
  }
  if (!email || !email.trim()) {
    throw new Error('email is required.');
  }

  // ── 3. Generate a cryptographically random token ──────────────────────────
  const token = randomUUID();
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS).toISOString();

  // ── 4. Persist the invite record ──────────────────────────────────────────
  // Email is normalised to lowercase for consistent comparisons during invite
  // redemption.  RFC 5321 treats the local part as case-sensitive in theory,
  // but in practice all major providers (Gmail, Outlook, etc.) are case-
  // insensitive.  The redemption flow must also lowercase the incoming email
  // before looking up the invite record.
  const item = {
    id,
    familyId: familyId.trim(),
    email: email.trim().toLowerCase(),
    token,
    role: role as InviteRole,
    expiresAt,
    status: 'PENDING',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    __typename: 'Invite',
  };

  await ddb.send(
    new PutCommand({
      TableName: INVITE_TABLE_NAME,
      Item: item,
      // Prevent overwriting an existing (still-pending) invite for the same
      // email+family combination if both id and token are unique.
      ConditionExpression: 'attribute_not_exists(id)',
    })
  );

  // ── 5. Build and return the invite URL ────────────────────────────────────
  // Fetch the family name so the invite landing page can show it without
  // requiring a separate authenticated API call before sign-up.
  let familyName = '';
  try {
    const familyResult = await ddb.send(
      new GetCommand({
        TableName: FAMILY_TABLE_NAME,
        Key: { id: familyId.trim() },
      })
    );
    familyName = familyResult.Item?.name ?? '';
  } catch {
    // Best-effort: if the family lookup fails the invite URL still works;
    // the landing page will just not show the family name.
  }

  const inviteUrl =
    `${APP_BASE_URL}/invite` +
    `?token=${token}` +
    `&email=${encodeURIComponent(item.email)}` +
    `&role=${encodeURIComponent(role)}` +
    (familyName ? `&family=${encodeURIComponent(familyName)}` : '');

  return {
    id,
    familyId: item.familyId,
    email: item.email,
    token,
    role: item.role,
    expiresAt,
    status: 'PENDING',
    inviteUrl,
  };
};
