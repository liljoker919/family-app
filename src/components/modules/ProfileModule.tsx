import { useState, useEffect, useRef } from 'react';
import { updatePassword, updateUserAttribute, confirmUserAttribute } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import type { FamilyMembership } from '../../utils/familyContext';
import {
  type NotificationPrefs,
  DEFAULT_PREFS,
  mergeWithDefaults,
} from '../../utils/notificationPrefs';
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

  // ── Change email state ───────────────────────────────────────────────────
  const [emailStep, setEmailStep] = useState<'idle' | 'form' | 'verify'>('idle');
  const [newEmail, setNewEmail] = useState('');
  const [emailVerifyCode, setEmailVerifyCode] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // ── Notification preferences state ───────────────────────────────────────
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

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

  // Load notification preferences from the Profile record on mount
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const result = await client.models.Profile.list({
          filter: { userId: { eq: userId } },
        });
        const profile = result.data?.[0];
        if (profile) {
          setProfileId(profile.id);
          setPrefs(mergeWithDefaults(profile));
        }
      } finally {
        setPrefsLoaded(true);
      }
    })();
  }, [userId]);

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

  // ── Change email ─────────────────────────────────────────────────────────
  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    if (!newEmail || !newEmail.includes('@')) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailSaving(true);
    try {
      await updateUserAttribute({
        userAttribute: { attributeKey: 'email', value: newEmail },
      });
      setEmailStep('verify');
    } catch (err: any) {
      setEmailError(err?.message ?? 'Failed to request email change. Please try again.');
    } finally {
      setEmailSaving(false);
    }
  };

  const handleConfirmEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    if (!emailVerifyCode.trim()) {
      setEmailError('Please enter the verification code.');
      return;
    }
    setEmailSaving(true);
    try {
      await confirmUserAttribute({
        userAttributeKey: 'email',
        confirmationCode: emailVerifyCode.trim(),
      });
      // Also update the email stored on the Profile record if we have one
      if (profileId) {
        await client.models.Profile.update({ id: profileId, email: newEmail });
      }
      setEmailStep('idle');
      setNewEmail('');
      setEmailVerifyCode('');
      setToast({ message: 'Email updated successfully.', type: 'success' });
    } catch (err: any) {
      setEmailError(err?.message ?? 'Verification failed. Please check the code and try again.');
    } finally {
      setEmailSaving(false);
    }
  };

  // ── Notification preferences ─────────────────────────────────────────────
  const handleTogglePref = (key: keyof NotificationPrefs) => {
    setPrefs((prev) => {
      if (key === 'globalUnsubscribe') {
        return { ...prev, globalUnsubscribe: !prev.globalUnsubscribe };
      }
      // Individual toggle – also clear globalUnsubscribe if re-enabling something
      return { ...prev, [key]: !prev[key] };
    });
  };

  const handleGlobalUnsubscribe = () => {
    setPrefs((prev) => ({
      ...prev,
      globalUnsubscribe: !prev.globalUnsubscribe,
    }));
  };

  const handleSavePrefs = async () => {
    setPrefsSaving(true);
    try {
      if (profileId) {
        await client.models.Profile.update({ id: profileId, ...prefs });
      } else {
        // No profile record yet – create one (edge case)
        const created = await client.models.Profile.create({
          userId,
          email: userEmail,
          ...prefs,
        });
        if (created.data?.id) setProfileId(created.data.id);
      }
      setToast({ message: 'Notification preferences saved.', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save preferences. Please try again.', type: 'error' });
    } finally {
      setPrefsSaving(false);
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

      {/* ── Security Credentials ─────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-1">Security &amp; Credentials</h3>
        <p className="text-sm text-gray-500 mb-6">Manage your login credentials and account security.</p>

        {/* Change Password */}
        <h4 className="text-base font-semibold text-gray-700 mb-3">Change Password</h4>
        <form onSubmit={handleChangePassword} className="space-y-4 mb-8">
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

        <hr className="border-gray-200 mb-6" />

        {/* Change Email */}
        <h4 className="text-base font-semibold text-gray-700 mb-1">Change Email</h4>
        <p className="text-sm text-gray-500 mb-3">
          A verification code will be sent to your new address. The change takes effect after you
          enter the code.
        </p>

        {emailStep === 'idle' && (
          <button
            type="button"
            onClick={() => { setEmailStep('form'); setEmailError(null); }}
            className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-5 py-2 rounded-lg transition text-sm"
          >
            Change Email Address
          </button>
        )}

        {emailStep === 'form' && (
          <form onSubmit={handleRequestEmailChange} className="space-y-4">
            <div>
              <label htmlFor="new-email" className="block text-sm font-medium text-gray-700 mb-1">
                New Email Address
              </label>
              <input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-royal-blue-400"
              />
            </div>
            {emailError && <p className="text-sm text-red-600">{emailError}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={emailSaving}
                className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-5 py-2 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {emailSaving ? 'Sending code…' : 'Send Verification Code'}
              </button>
              <button
                type="button"
                onClick={() => { setEmailStep('idle'); setNewEmail(''); setEmailError(null); }}
                className="px-5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {emailStep === 'verify' && (
          <form onSubmit={handleConfirmEmailChange} className="space-y-4">
            <p className="text-sm text-gray-600">
              A verification code has been sent to <strong>{newEmail}</strong>. Enter it below to
              confirm your new email address.
            </p>
            <div>
              <label htmlFor="email-verify-code" className="block text-sm font-medium text-gray-700 mb-1">
                Verification Code
              </label>
              <input
                id="email-verify-code"
                type="text"
                inputMode="numeric"
                value={emailVerifyCode}
                onChange={(e) => setEmailVerifyCode(e.target.value)}
                required
                autoComplete="one-time-code"
                placeholder="Enter 6-digit code"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-royal-blue-400"
              />
            </div>
            {emailError && <p className="text-sm text-red-600">{emailError}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={emailSaving}
                className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-5 py-2 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {emailSaving ? 'Verifying…' : 'Confirm Email Change'}
              </button>
              <button
                type="button"
                onClick={() => { setEmailStep('idle'); setNewEmail(''); setEmailVerifyCode(''); setEmailError(null); }}
                className="px-5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <hr className="border-gray-200 mt-6 mb-6" />

        {/* MFA Placeholder */}
        <h4 className="text-base font-semibold text-gray-700 mb-1">Multi-Factor Authentication (MFA)</h4>
        <p className="text-sm text-gray-500 mb-3">
          Add an extra layer of security to your account with SMS or authenticator-app verification.
        </p>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
            Coming Soon
          </span>
          <span className="text-sm text-gray-600">
            MFA support (SMS/TOTP) will be available in a future update.
          </span>
        </div>
      </div>

      {/* ── Notification Preferences ─────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-1">Notification Preferences</h3>
        <p className="text-sm text-gray-500 mb-6">
          Control which notifications you receive and how they are delivered. Changes take effect
          immediately after saving.
        </p>

        {!prefsLoaded ? (
          <p className="text-sm text-gray-400 animate-pulse">Loading preferences…</p>
        ) : (
          <>
            {/* Global Unsubscribe */}
            <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
              <div>
                <p className="text-sm font-semibold text-amber-900">Global Unsubscribe</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Disable all non-essential notifications at once.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.globalUnsubscribe}
                onClick={handleGlobalUnsubscribe}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-royal-blue-500 focus:ring-offset-2 ${
                  prefs.globalUnsubscribe ? 'bg-amber-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                    prefs.globalUnsubscribe ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Immediate Alerts */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Immediate Alerts
              </h4>
              <div className="space-y-3">
                <NotifToggleRow
                  id="notifyNewChore"
                  label="New Chore Assigned"
                  description="Alert when a chore is assigned to you."
                  checked={prefs.notifyNewChore}
                  disabled={prefs.globalUnsubscribe}
                  onToggle={() => handleTogglePref('notifyNewChore')}
                />
                <NotifToggleRow
                  id="notifyCarAlert"
                  label="High Priority Car Alert"
                  description="Alert for urgent vehicle service or safety notices."
                  checked={prefs.notifyCarAlert}
                  disabled={prefs.globalUnsubscribe}
                  onToggle={() => handleTogglePref('notifyCarAlert')}
                />
              </div>
            </div>

            {/* Reminders */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Reminders
              </h4>
              <div className="space-y-3">
                <NotifToggleRow
                  id="notifyVacationReminder"
                  label="Upcoming Vacation Activity"
                  description="Reminder before a scheduled vacation activity."
                  checked={prefs.notifyVacationReminder}
                  disabled={prefs.globalUnsubscribe}
                  onToggle={() => handleTogglePref('notifyVacationReminder')}
                />
              </div>
            </div>

            {/* Marketing / Product Updates */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Marketing &amp; Product Updates
              </h4>
              <div className="space-y-3">
                <NotifToggleRow
                  id="notifyMarketingUpdates"
                  label="New Kinsly Features"
                  description="Occasional emails about new features and improvements."
                  checked={prefs.notifyMarketingUpdates}
                  disabled={prefs.globalUnsubscribe}
                  onToggle={() => handleTogglePref('notifyMarketingUpdates')}
                />
              </div>
            </div>

            {/* Delivery Channels */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Delivery Channels
              </h4>
              <div className="space-y-3">
                <NotifToggleRow
                  id="notifyByEmail"
                  label="Email"
                  description="Receive notifications via email."
                  checked={prefs.notifyByEmail}
                  disabled={prefs.globalUnsubscribe}
                  onToggle={() => handleTogglePref('notifyByEmail')}
                />
                <NotifToggleRow
                  id="notifyByPush"
                  label="In-App / Push"
                  description="Receive notifications inside the app (push support coming soon)."
                  checked={prefs.notifyByPush}
                  disabled={prefs.globalUnsubscribe}
                  onToggle={() => handleTogglePref('notifyByPush')}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSavePrefs}
              disabled={prefsSaving}
              className="bg-royal-blue-600 hover:bg-royal-blue-700 text-white px-5 py-2 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {prefsSaving ? 'Saving…' : 'Save Preferences'}
            </button>
          </>
        )}
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

// ── Reusable toggle row component ────────────────────────────────────────────

interface NotifToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}

function NotifToggleRow({ id, label, description, checked, disabled, onToggle }: NotifToggleRowProps) {
  const isOn = checked && !disabled;
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 mr-4">
        <label htmlFor={id} className={`text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
          {label}
        </label>
        <p className={`text-xs mt-0.5 ${disabled ? 'text-gray-300' : 'text-gray-500'}`}>{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={isOn}
        disabled={disabled}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-royal-blue-500 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed ${
          isOn ? 'bg-royal-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
            isOn ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
