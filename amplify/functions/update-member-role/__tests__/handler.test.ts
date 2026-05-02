/**
 * Unit tests for the update-member-role Lambda handler.
 *
 * These tests verify that the last-admin guard is implemented atomically using
 * DynamoDB TransactWriteItems, preventing the race condition where two admins
 * could demote themselves simultaneously and leave the family with no admin.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DynamoDB mock setup ──────────────────────────────────────────────────────

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(function () { return {}; }),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => {
  return {
    DynamoDBDocumentClient: {
      from: vi.fn(() => ({ send: mockSend })),
    },
    GetCommand: vi.fn(function (this: any, input: any) { this.input = input; this._tag = 'GetCommand'; }),
    ScanCommand: vi.fn(function (this: any, input: any) { this.input = input; this._tag = 'ScanCommand'; }),
    UpdateCommand: vi.fn(function (this: any, input: any) { this.input = input; this._tag = 'UpdateCommand'; }),
    TransactWriteCommand: vi.fn(function (this: any, input: any) { this.input = input; this._tag = 'TransactWriteCommand'; }),
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(memberId: string, newRole: string, callerUsername = 'caller@example.com') {
  return {
    arguments: { memberId, newRole },
    identity: { username: callerUsername },
  } as any;
}

const FAMILY_ID = 'family-1';

const adminCaller = {
  id: 'caller-id',
  familyId: FAMILY_ID,
  userId: 'caller@example.com',
  role: 'ADMIN',
};

const adminTarget = {
  id: 'target-id',
  familyId: FAMILY_ID,
  userId: 'target@example.com',
  role: 'ADMIN',
};

const otherAdmin = {
  id: 'other-admin-id',
  familyId: FAMILY_ID,
  userId: 'other@example.com',
  role: 'ADMIN',
};

// ── Import handler (after mocks are registered) ───────────────────────────────

const { handler } = await import('../handler.js');

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FAMILY_MEMBER_TABLE_NAME = 'FamilyMemberTable';
});

describe('update-member-role handler – last-admin guard (atomic)', () => {
  it('uses TransactWriteCommand when demoting an ADMIN with another admin present', async () => {
    // GetCommand → target member
    // ScanCommand (caller lookup) → callerMember
    // ScanCommand (admin count)   → [adminTarget, otherAdmin]
    // TransactWriteCommand        → succeeds
    mockSend
      .mockResolvedValueOnce({ Item: adminTarget })           // step 3: get target
      .mockResolvedValueOnce({ Items: [adminCaller] })        // step 4: scan caller
      .mockResolvedValueOnce({ Items: [adminTarget, otherAdmin] }) // step 7: admin scan
      .mockResolvedValueOnce({});                             // step 7: transact write

    const result = await handler(makeEvent('target-id', 'MEMBER'), {} as any, vi.fn());

    // Confirm a TransactWriteCommand was issued (4th send call)
    const calls = mockSend.mock.calls;
    expect(calls).toHaveLength(4);
    const transactCall = calls[3][0];
    expect(transactCall._tag).toBe('TransactWriteCommand');

    // Confirm the transaction contains a ConditionCheck and an Update
    const items = transactCall.input.TransactItems;
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveProperty('ConditionCheck');
    expect(items[1]).toHaveProperty('Update');

    // The ConditionCheck must reference the OTHER admin (not the target)
    expect(items[0].ConditionCheck.Key.id).toBe('other-admin-id');

    // The Update must apply the new role to the target
    expect(items[1].Update.Key.id).toBe('target-id');
    expect(items[1].Update.ExpressionAttributeValues[':newRole']).toBe('MEMBER');

    // The Update must include an optimistic-lock ConditionExpression
    expect(items[1].Update.ConditionExpression).toContain(':currentRole');
    expect(items[1].Update.ExpressionAttributeValues[':currentRole']).toBe('ADMIN');

    expect((result as any).role).toBe('MEMBER');
  });

  it('blocks demotion when the target is the only admin (before transaction)', async () => {
    mockSend
      .mockResolvedValueOnce({ Item: adminTarget })      // get target
      .mockResolvedValueOnce({ Items: [adminCaller] })   // scan caller (caller IS the target here, but same pattern)
      .mockResolvedValueOnce({ Items: [adminTarget] });  // admin scan → only 1 admin

    // caller is also an admin, but target is the only ADMIN in the family scan
    await expect(handler(makeEvent('target-id', 'MEMBER'), {} as any, vi.fn()))
      .rejects.toThrow('A family must have at least one administrator.');

    // No TransactWriteCommand should have been sent
    const calls = mockSend.mock.calls;
    expect(calls).toHaveLength(3);
  });

  it('surfaces last-admin error when TransactionCanceledException is thrown', async () => {
    const txError = new Error('Transaction cancelled');
    txError.name = 'TransactionCanceledException';

    mockSend
      .mockResolvedValueOnce({ Item: adminTarget })
      .mockResolvedValueOnce({ Items: [adminCaller] })
      .mockResolvedValueOnce({ Items: [adminTarget, otherAdmin] })
      .mockRejectedValueOnce(txError);

    await expect(handler(makeEvent('target-id', 'MEMBER'), {} as any, vi.fn()))
      .rejects.toThrow('A family must have at least one administrator.');
  });

  it('re-throws non-transaction errors from the transact write', async () => {
    const networkError = new Error('Network error');
    networkError.name = 'NetworkError';

    mockSend
      .mockResolvedValueOnce({ Item: adminTarget })
      .mockResolvedValueOnce({ Items: [adminCaller] })
      .mockResolvedValueOnce({ Items: [adminTarget, otherAdmin] })
      .mockRejectedValueOnce(networkError);

    await expect(handler(makeEvent('target-id', 'MEMBER'), {} as any, vi.fn()))
      .rejects.toThrow('Network error');
  });

  it('uses plain UpdateCommand (not TransactWriteCommand) for non-admin-demotion changes', async () => {
    const memberTarget = { ...adminTarget, role: 'MEMBER' as const };

    mockSend
      .mockResolvedValueOnce({ Item: memberTarget })    // get target
      .mockResolvedValueOnce({ Items: [adminCaller] }) // scan caller
      .mockResolvedValueOnce({});                      // UpdateCommand

    await handler(makeEvent('target-id', 'PLANNER'), {} as any, vi.fn());

    const calls = mockSend.mock.calls;
    expect(calls).toHaveLength(3);
    const updateCall = calls[2][0];
    expect(updateCall._tag).toBe('UpdateCommand');
  });

  it('uses plain UpdateCommand when promoting a member to ADMIN', async () => {
    const memberTarget = { ...adminTarget, role: 'MEMBER' as const };

    mockSend
      .mockResolvedValueOnce({ Item: memberTarget })    // get target
      .mockResolvedValueOnce({ Items: [adminCaller] }) // scan caller
      .mockResolvedValueOnce({});                      // UpdateCommand

    await handler(makeEvent('target-id', 'ADMIN'), {} as any, vi.fn());

    const calls = mockSend.mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[2][0]._tag).toBe('UpdateCommand');
  });
});
