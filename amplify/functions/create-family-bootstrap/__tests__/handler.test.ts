import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(function () {
    return {};
  }),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockSend })),
  },
  TransactWriteCommand: vi.fn(function (this: any, input: any) {
    this.input = input;
    this._tag = 'TransactWriteCommand';
  }),
}));

const { handler } = await import('../handler.js');

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FAMILY_TABLE_NAME = 'FamilyTable';
  process.env.FAMILY_MEMBER_TABLE_NAME = 'FamilyMemberTable';
});

describe('create-family-bootstrap handler', () => {
  it('creates a family and an ADMIN membership in a single transaction', async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await handler(
      {
        arguments: { name: 'The Smiths', displayName: 'Mom' },
        identity: { username: 'mom@example.com' },
      } as any,
      {} as any,
      vi.fn()
    );

    expect(result.role).toBe('ADMIN');
    expect(result.familyName).toBe('The Smiths');
    expect(result.joinCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    const sentCommand = mockSend.mock.calls[0][0];
    expect(sentCommand._tag).toBe('TransactWriteCommand');
    expect(sentCommand.input.TransactItems).toHaveLength(2);

    const [familyPut, memberPut] = sentCommand.input.TransactItems;
    expect(familyPut.Put.Item.name).toBe('The Smiths');
    expect(familyPut.Put.Item.createdBy).toBe('mom@example.com');
    expect(memberPut.Put.Item.role).toBe('ADMIN');
    expect(memberPut.Put.Item.userId).toBe('mom@example.com');
    expect(memberPut.Put.Item.familyId).toBe(familyPut.Put.Item.id);
  });
});
