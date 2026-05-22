import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDdbSend = vi.fn();
const mockCognitoSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(function () { return {}; }),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockDdbSend })),
  },
  ScanCommand: vi.fn(function (this: any, input: any) { this.input = input; this._tag = 'ScanCommand'; }),
}));

vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: vi.fn(function () {
    return { send: mockCognitoSend };
  }),
  CreateGroupCommand: vi.fn(function (this: any, input: any) { this.input = input; this._tag = 'CreateGroupCommand'; }),
  GetGroupCommand: vi.fn(function (this: any, input: any) { this.input = input; this._tag = 'GetGroupCommand'; }),
  AdminAddUserToGroupCommand: vi.fn(function (this: any, input: any) { this.input = input; this._tag = 'AdminAddUserToGroupCommand'; }),
}));

process.env.FAMILY_MEMBER_TABLE_NAME = 'FamilyMemberTable';
process.env.USER_POOL_ID = 'pool-123';

const { handler } = await import('../handler.js');

describe('add-to-family-group handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds caller to both family and role cognito groups', async () => {
    mockDdbSend.mockResolvedValueOnce({
      Items: [{ userId: 'admin@example.com', familyId: 'family-1', role: 'ADMIN' }],
    });

    mockCognitoSend
      .mockResolvedValueOnce({}) // GetGroup family
      .mockResolvedValueOnce({}) // AdminAddUserToGroup family
      .mockResolvedValueOnce({}); // AdminAddUserToGroup role

    const result = await handler(
      {
        arguments: { familyId: 'family-1' },
        identity: { username: 'admin@example.com' },
      } as any,
      {} as any,
      vi.fn()
    );

    expect(result).toEqual({ success: true, familyId: 'family-1' });
    expect(mockCognitoSend).toHaveBeenCalledTimes(3);
    expect(mockCognitoSend.mock.calls[1][0]._tag).toBe('AdminAddUserToGroupCommand');
    expect(mockCognitoSend.mock.calls[1][0].input.GroupName).toBe('family-1');
    expect(mockCognitoSend.mock.calls[2][0]._tag).toBe('AdminAddUserToGroupCommand');
    expect(mockCognitoSend.mock.calls[2][0].input.GroupName).toBe('ADMIN');
  });

  it('defaults unknown member roles to MEMBER group sync', async () => {
    mockDdbSend.mockResolvedValueOnce({
      Items: [{ userId: 'user@example.com', familyId: 'family-1', role: 'UNKNOWN_ROLE' }],
    });

    mockCognitoSend
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await handler(
      {
        arguments: { familyId: 'family-1' },
        identity: { username: 'user@example.com' },
      } as any,
      {} as any,
      vi.fn()
    );

    expect(mockCognitoSend.mock.calls[2][0].input.GroupName).toBe('MEMBER');
  });
});
