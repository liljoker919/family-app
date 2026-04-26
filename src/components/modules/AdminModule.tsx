import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import type { FamilyRole, FamilyMembership } from '../../utils/familyContext';

const client = generateClient<Schema>();

interface AdminModuleProps {
  user: any;
  familyId: string;
  membership: FamilyMembership;
}

interface FamilyMemberRecord {
  id: string;
  userId: string;
  role: FamilyRole;
  displayName: string | null | undefined;
  familyId: string;
}

interface InviteRecord {
  id: string;
  email: string;
  role: 'MEMBER' | 'PLANNER';
  expiresAt: string;
  status: 'PENDING' | 'ACCEPTED';
  inviteUrl?: string;
}

const ROLE_LABELS: Record<FamilyRole, string> = {
  ADMIN: 'Admin',
  PLANNER: 'Planner',
  MEMBER: 'Member',
};

const ROLE_BADGE_CLASSES: Record<FamilyRole, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  PLANNER: 'bg-blue-100 text-blue-700',
  MEMBER: 'bg-gray-100 text-gray-700',
};

export default function AdminModule({ user, familyId, membership }: AdminModuleProps) {
  const [members, setMembers] = useState<FamilyMemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'PLANNER'>('MEMBER');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [generatedInvite, setGeneratedInvite] = useState<InviteRecord | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  const isAdmin = membership.role === 'ADMIN';

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.models.FamilyMember.list({
        filter: { familyId: { eq: familyId } },
      });
      setMembers(
        data.map((m: any) => ({
          id: m.id,
          userId: m.userId,
          role: (m.role ?? 'MEMBER') as FamilyRole,
          displayName: m.displayName,
          familyId: m.familyId,
        }))
      );
    } catch (err) {
      console.error('Error fetching family members:', err);
      setError('Failed to load family members.');
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    if (isAdmin) {
      fetchMembers();
    } else {
      setLoading(false);
    }
  }, [familyId, isAdmin, fetchMembers]);

  const adminCount = members.filter((m) => m.role === 'ADMIN').length;

  const updateRole = async (memberId: string, newRole: FamilyRole) => {
    setError(null);

    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    // Client-side fast-fail: mirrors the server-side last-admin guard so the
    // UI stays responsive without a round-trip for the most common block.
    if (member.role === 'ADMIN' && newRole !== 'ADMIN' && adminCount <= 1) {
      setError('A family must have at least one administrator.');
      return;
    }

    setSaving(memberId);
    try {
      const { errors } = await client.mutations.updateMemberRole({ memberId, newRole });
      if (errors && errors.length > 0) {
        setError(errors.map((e: any) => e.message).join(' '));
      } else {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
        );
      }
    } catch (err: any) {
      // Surface the server-side error message when available so the user sees
      // an actionable explanation (e.g. cross-family or last-admin errors).
      const serverMsg: string | undefined =
        err?.errors?.[0]?.message ?? err?.message;
      setError(serverMsg ?? 'Failed to update role. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setGeneratedInvite(null);
    setInviteCopied(false);

    const trimmedEmail = inviteEmail.trim();
    if (!trimmedEmail) {
      setInviteError('Please enter an email address.');
      return;
    }

    setInviteSubmitting(true);
    try {
      const result = await client.mutations.createInvite({
        familyId,
        email: trimmedEmail,
        role: inviteRole,
      });
      if (result.errors && result.errors.length > 0) {
        setInviteError(result.errors.map((e: any) => e.message).join(' '));
      } else if (result.data) {
        setGeneratedInvite({
          id: result.data.id,
          email: result.data.email,
          role: result.data.role as 'MEMBER' | 'PLANNER',
          expiresAt: result.data.expiresAt,
          status: result.data.status as 'PENDING' | 'ACCEPTED',
          inviteUrl: result.data.inviteUrl,
        });
        setInviteEmail('');
      }
    } catch (err: any) {
      const serverMsg: string | undefined =
        err?.errors?.[0]?.message ?? err?.message;
      setInviteError(serverMsg ?? 'Failed to create invite. Please try again.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const copyInviteUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      setInviteCopied(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6V7m0 0a4 4 0 100-8 4 4 0 000 8z"
            />
          </svg>
          <p className="text-lg font-medium text-gray-600">Access Restricted</p>
          <p className="text-sm text-gray-400">Only admins can access the admin panel.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-gray-500 text-lg">Loading…</div>
      </div>
    );
  }

  const currentUserId = user?.signInDetails?.loginId ?? user?.userId ?? '';

  return (
    <div className="space-y-8">
      {/* ── Invite Member section ─────────────────────────────────────────── */}
      <div>
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Invite Member</h2>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 mb-4">
            Send a one-time invite link to a new family member. The link expires in 7 days.
          </p>

          <form onSubmit={sendInvite} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'MEMBER' | 'PLANNER')}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MEMBER">Member</option>
                  <option value="PLANNER">Planner</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={inviteSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviteSubmitting ? 'Creating…' : 'Create Invite'}
                </button>
              </div>
            </div>
          </form>

          {inviteError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {inviteError}
            </div>
          )}

          {generatedInvite && generatedInvite.inviteUrl && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-800 mb-2">
                Invite created for <span className="font-semibold">{generatedInvite.email}</span> as{' '}
                <span className="font-semibold">{ROLE_LABELS[generatedInvite.role]}</span>
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedInvite.inviteUrl}
                  className="flex-1 border border-green-300 rounded-lg px-3 py-1.5 text-xs bg-white text-gray-700 truncate"
                />
                <button
                  onClick={() => copyInviteUrl(generatedInvite.inviteUrl)}
                  className="shrink-0 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs transition"
                >
                  {inviteCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-green-600 mt-2">
                This link expires on {new Date(generatedInvite.expiresAt).toLocaleDateString()}.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Family Members section ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Family Members</h2>
          <button
            onClick={fetchMembers}
            className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-5 py-2 rounded-lg transition text-sm"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {members.length === 0 ? (
          <p className="text-gray-500">No family members found.</p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => {
              const isCurrentUser = member.userId === currentUserId;
              const isLastAdmin = member.role === 'ADMIN' && adminCount <= 1;
              const isBusy = saving === member.id;

              return (
                <div
                  key={member.id}
                  className="bg-white rounded-lg shadow p-5 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800">
                        {member.displayName ?? member.userId}
                      </p>
                      {isCurrentUser && (
                        <span className="text-xs text-gray-400">(you)</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{member.userId}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-medium px-3 py-1 rounded-full ${ROLE_BADGE_CLASSES[member.role]}`}
                    >
                      {ROLE_LABELS[member.role]}
                    </span>

                    {member.role !== 'ADMIN' && (
                      <button
                        onClick={() => updateRole(member.id, 'ADMIN')}
                        disabled={isBusy}
                        className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                      >
                        {isBusy ? 'Saving…' : 'Promote to Admin'}
                      </button>
                    )}

                    {member.role === 'ADMIN' && (
                      <button
                        onClick={() => updateRole(member.id, 'MEMBER')}
                        disabled={isBusy || isLastAdmin}
                        title={isLastAdmin ? 'A family must have at least one administrator.' : undefined}
                        className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isBusy ? 'Saving…' : 'Demote to Member'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
