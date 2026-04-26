import { useState, useEffect, useRef } from 'react';
import { updatePassword } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import type { FamilyMembership } from '../../utils/familyContext';
import ConfirmModal from '../ConfirmModal';
import Toast from '../Toast';

const client = generateClient<Schema>();

interface ProfileModuleProps {
  user: any;
  membership: FamilyMembership;
  onSignOut: (() => void) | undefined;
}

export default function ProfileModule({ user, membership, onSignOut }: ProfileModuleProps) {
  const userId = user?.signInDetails?.loginId ?? user?.userId ?? '';
  const userEmail = user?.signInDetails?.loginId ?? '';

  // ── Change password state ────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // ── Export state ─────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  // ── Delete account state ─────────────────────────────────────────────────
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm1' | 'confirm2'>('idle');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const deleteInputRef = useRef<HTMLInputElement>(null);

  // ── Toast state ──────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Focus the confirmation text input when step 2 opens
  useEffect(() => {
    if (deleteStep === 'confirm2') {
      setTimeout(() => deleteInputRef.current?.focus(), 50);
    }
  }, [deleteStep]);

  // ── Change password ──────────────────────────────────────────────────────
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }

    setPasswordSaving(true);
    try {
      await updatePassword({ oldPassword: currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setToast({ message: 'Password updated successfully.', type: 'success' });
    } catch (err: any) {
      const msg: string = err?.message ?? 'Failed to update password. Please try again.';
      setPasswordError(msg);
    } finally {
      setPasswordSaving(false);
    }
  };

  // ── Export my data ───────────────────────────────────────────────────────
  const handleExportData = async () => {
    setExporting(true);
    try {
      // Fetch Profile record
      const profileResult = await client.models.Profile.list({
        filter: { userId: { eq: userId } },
      });

      // Fetch FamilyMember record(s) for this user
      const memberResult = await client.models.FamilyMember.list({
        filter: { userId: { eq: userId } },
      });

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        user: {
          email: userEmail,
          userId,
        },
        profile: profileResult.data ?? [],
        familyMemberships: memberResult.data ?? [],
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `family-app-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setToast({ message: 'Your data has been downloaded.', type: 'success' });
    } catch {
      setToast({ message: 'Failed to export data. Please try again.', type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  // ── Delete account ───────────────────────────────────────────────────────
  const handleDeleteConfirm1 = () => {
    setDeleteStep('confirm2');
    setDeleteConfirmText('');
  };

  const handleDeleteConfirm2 = async () => {
    if (deleteConfirmText !== 'DELETE') return;

    setDeleting(true);
    try {
      // Delete the user's own Profile record (owner rule permits self-delete)
      const profileResult = await client.models.Profile.list({
        filter: { userId: { eq: userId } },
      });
      for (const profile of profileResult.data) {
        await client.models.Profile.delete({ id: profile.id });
      }

      setToast({ message: 'Your account has been deleted. Signing out…', type: 'success' });
      // Give the toast a moment to show, then sign out
      setTimeout(() => {
        if (onSignOut) onSignOut();
      }, 1500);
    } catch {
      setDeleting(false);
      setDeleteStep('idle');
      setToast({ message: 'Failed to delete account. Please try again.', type: 'error' });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteStep('idle');
    setDeleteConfirmText('');
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <h2 className="text-3xl font-bold text-gray-800">Profile Settings</h2>

      {/* ── Account info ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Account Information</h3>
        <dl className="space-y-3">
          <div className="flex gap-4">
            <dt className="w-32 text-sm font-medium text-gray-500 shrink-0">Email</dt>
            <dd className="text-sm text-gray-800">{userEmail || '—'}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-32 text-sm font-medium text-gray-500 shrink-0">Display Name</dt>
            <dd className="text-sm text-gray-800">{membership.displayName || '—'}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-32 text-sm font-medium text-gray-500 shrink-0">Role</dt>
            <dd className="text-sm text-gray-800">{membership.role}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-32 text-sm font-medium text-gray-500 shrink-0">Family</dt>
            <dd className="text-sm text-gray-800">{membership.familyName || '—'}</dd>
          </div>
        </dl>
      </div>

      {/* ── Change password ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Change Password</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-royal-blue-400"
            />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-royal-blue-400"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-royal-blue-400"
            />
          </div>

          {passwordError && (
            <p className="text-sm text-red-600">{passwordError}</p>
          )}

          <button
            type="submit"
            disabled={passwordSaving}
            className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-5 py-2 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {passwordSaving ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* ── Export my data ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Export My Data</h3>
        <p className="text-sm text-gray-500 mb-4">
          Download a JSON file containing all of your personal records — profile info and
          family memberships.
        </p>
        <button
          type="button"
          onClick={handleExportData}
          disabled={exporting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? 'Preparing download…' : 'Export My Data'}
        </button>
      </div>

      {/* ── Danger zone: delete account ──────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow p-6 border border-red-200">
        <h3 className="text-lg font-semibold text-red-700 mb-2">Delete Account</h3>
        <p className="text-sm text-gray-500 mb-4">
          Permanently removes your profile record. This action cannot be undone. You will
          be signed out immediately after deletion.
        </p>
        <button
          type="button"
          onClick={() => setDeleteStep('confirm1')}
          className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg transition text-sm"
        >
          Delete My Account
        </button>
      </div>

      {/* ── Step 1: first confirmation modal ─────────────────────────────── */}
      <ConfirmModal
        isOpen={deleteStep === 'confirm1'}
        title="Delete Your Account?"
        message="Are you sure you want to delete your account? This will permanently remove your profile. You will be signed out immediately."
        confirmLabel="Yes, continue"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm1}
        onCancel={handleDeleteCancel}
      />

      {/* ── Step 2: type-to-confirm modal ────────────────────────────────── */}
      {deleteStep === 'confirm2' && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm2-title"
        >
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full mx-4">
            <h3 id="delete-confirm2-title" className="text-xl font-bold text-gray-800 mb-3">
              Final Confirmation
            </h3>
            <p className="text-gray-600 mb-4">
              Type <strong>DELETE</strong> below to permanently delete your account. This cannot
              be undone.
            </p>
            <input
              ref={deleteInputRef}
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-6"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={handleDeleteCancel}
                disabled={deleting}
                className="px-5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm2}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast notifications ───────────────────────────────────────────── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
