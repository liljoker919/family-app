import { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type { FamilyMembership } from '../utils/familyContext';
import type { ActiveModule } from '../utils/dashboardModules';

const client = generateClient<Schema>();

type WizardStep = 1 | 2 | 3;

interface OnboardingWizardProps {
  /** The user's family membership, established right before the wizard. */
  membership: FamilyMembership;
  /**
   * Default family name suggestion (e.g. "The Smiths"), derived from the
   * authenticated user's last name.  Falls back to `membership.familyName`.
   */
  defaultFamilyName?: string;
  /**
   * Called when the wizard finishes (completed or skipped entirely).
   * If the user chose an action in Step 3, `module` is the deep-link target.
   */
  onComplete: (module?: ActiveModule) => void;
}

export default function OnboardingWizard({
  membership,
  defaultFamilyName,
  onComplete,
}: OnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);

  // Step 1 state
  const initialFamilyName =
    defaultFamilyName ||
    (membership.familyName && membership.familyName !== 'My Family'
      ? membership.familyName
      : '');
  const [familyName, setFamilyName] = useState(initialFamilyName);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Step 2 state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCanPlan, setInviteCanPlan] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  // ── Step 1 handler ──────────────────────────────────────────────────────────

  const handleNameNext = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = familyName.trim();
    if (trimmed) {
      setSavingName(true);
      setNameError(null);
      try {
        // Update the family name when the user changed it from the default.
        if (trimmed !== membership.familyName) {
          // We need the family record id; the membership only carries familyId
          // which IS the record id for a Family.
          await client.models.Family.update({
            id: membership.familyId,
            name: trimmed,
          });
        }
      } catch {
        // Non-fatal: name update failure should not block onboarding progress.
        setNameError('Could not save the family name. You can update it later in settings.');
      } finally {
        setSavingName(false);
      }
    }
    setStep(2);
  };

  // ── Step 2 handler ──────────────────────────────────────────────────────────

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = inviteEmail.trim();
    if (!trimmedEmail) {
      setInviteError('Please enter an email address.');
      return;
    }
    setInviteSubmitting(true);
    setInviteError(null);
    try {
      const inviteRole = inviteCanPlan ? 'PLANNER' : 'MEMBER';
      const result = await client.mutations.createFamilyInvite({
        familyId: membership.familyId,
        email: trimmedEmail,
        role: inviteRole,
      });
      if (result.errors && result.errors.length > 0) {
        setInviteError(result.errors.map((e: any) => e.message).join(' '));
      } else if (result.data) {
        setInviteSent(true);
        setInviteUrl(result.data.inviteUrl ?? null);
        setInviteEmail('');
        setInviteCanPlan(false);
      }
    } catch (err: any) {
      const serverMsg: string | undefined = err?.errors?.[0]?.message ?? err?.message;
      setInviteError(serverMsg ?? 'Failed to send invite. Please try again.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleCopyInviteUrl = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // ── Step 3 handler ──────────────────────────────────────────────────────────

  const handlePickAction = (module: ActiveModule) => {
    onComplete(module);
  };

  // ── Progress bar ────────────────────────────────────────────────────────────

  const stepLabels = ['Name Family', 'Invite', 'First Action'];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold text-gray-800">Welcome to Family App!</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Let's get you set up in just a few steps.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center mb-8">
          {stepLabels.map((label, idx) => {
            const stepNum = (idx + 1) as WizardStep;
            const isActive = step === stepNum;
            const isDone = step > stepNum;
            return (
              <div key={label} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1 ${
                    isDone
                      ? 'bg-emerald-500 text-white'
                      : isActive
                      ? 'bg-royal-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isDone ? '✓' : stepNum}
                </div>
                <span
                  className={`text-xs ${
                    isActive ? 'text-royal-blue-600 font-semibold' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
                {idx < stepLabels.length - 1 && null}
              </div>
            );
          })}
        </div>

        {/* ── Step 1: Name your family ─────────────────────────────────────── */}
        {step === 1 && (
          <form onSubmit={handleNameNext} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                What should we call your family?
              </label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="e.g. The Smiths"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-royal-blue-400"
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">
                This is the display name for your family. You can change it at any time.
              </p>
            </div>
            {nameError && (
              <p className="text-amber-600 text-sm">{nameError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onComplete()}
                className="flex-1 border border-gray-300 text-gray-500 py-2 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                Skip setup
              </button>
              <button
                type="submit"
                disabled={savingName}
                className="flex-1 bg-royal-blue-600 hover:bg-royal-blue-700 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50"
              >
                {savingName ? 'Saving…' : 'Next →'}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 2: Invite members ───────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Invite family members</h2>
              <p className="text-sm text-gray-500">
                Send an invite link to your family members so they can join.
              </p>
            </div>

            {inviteSent && inviteUrl && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-emerald-700 text-sm font-medium mb-2">
                  ✅ Invite sent! Share this link:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteUrl}
                    className="flex-1 text-xs border border-emerald-300 rounded px-2 py-1 bg-white truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyInviteUrl}
                    className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded transition"
                  >
                    {inviteCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSendInvite} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="family.member@example.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-royal-blue-400"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={inviteCanPlan}
                  onChange={(e) => setInviteCanPlan(e.target.checked)}
                  className="rounded"
                />
                Allow planning (vacations, events)
              </label>
              {inviteError && (
                <p className="text-red-600 text-sm">{inviteError}</p>
              )}
              <button
                type="submit"
                disabled={inviteSubmitting || !inviteEmail.trim()}
                className="w-full bg-royal-blue-600 hover:bg-royal-blue-700 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50"
              >
                {inviteSubmitting ? 'Sending…' : 'Send Invite'}
              </button>
            </form>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 border border-royal-blue-300 text-royal-blue-600 hover:bg-royal-blue-50 py-2 rounded-lg transition text-sm font-medium"
              >
                {inviteSent ? 'Next →' : 'Skip for now →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Pick your first action ──────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">
                Pick your first action
              </h2>
              <p className="text-sm text-gray-500">
                Where would you like to start? You can always change this later.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handlePickAction('chores')}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-royal-blue-400 hover:bg-royal-blue-50 transition text-left"
              >
                <span className="text-3xl">✅</span>
                <div>
                  <div className="font-semibold text-gray-800">Add a Chore</div>
                  <div className="text-sm text-gray-500">Assign household tasks to family members</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handlePickAction('vacations')}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-royal-blue-400 hover:bg-royal-blue-50 transition text-left"
              >
                <span className="text-3xl">✈️</span>
                <div>
                  <div className="font-semibold text-gray-800">Plan a Trip</div>
                  <div className="text-sm text-gray-500">Organize your next family vacation</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handlePickAction('cars')}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-royal-blue-400 hover:bg-royal-blue-50 transition text-left"
              >
                <span className="text-3xl">🚗</span>
                <div>
                  <div className="font-semibold text-gray-800">Add a Car</div>
                  <div className="text-sm text-gray-500">Track your vehicles and service history</div>
                </div>
              </button>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => onComplete()}
                className="flex-1 border border-royal-blue-300 text-royal-blue-600 hover:bg-royal-blue-50 py-2 rounded-lg transition text-sm font-medium"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
