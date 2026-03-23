import { useState } from 'react';
import { createFamily, joinFamily } from '../utils/familyContext';
import type { FamilyMembership } from '../utils/familyContext';

interface FamilySetupProps {
  userId: string;
  onComplete: (membership: FamilyMembership) => void;
}

type SetupMode = 'choose' | 'create' | 'join';

export default function FamilySetup({ userId, onComplete }: FamilySetupProps) {
  const [mode, setMode] = useState<SetupMode>('choose');
  const [displayName, setDisplayName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const membership = await createFamily(familyName.trim(), userId, displayName.trim() || undefined);
      onComplete(membership);
    } catch (err: any) {
      setError(err.message ?? 'Failed to create family. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const membership = await joinFamily(joinCode.trim(), userId, displayName.trim() || undefined);
      if (!membership) {
        setError('Invalid join code. Please check the code and try again.');
      } else {
        onComplete(membership);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to join family. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">👨‍👩‍👧‍👦</div>
          <h1 className="text-2xl font-bold text-gray-800">Welcome to Family App</h1>
          <p className="text-gray-500 mt-2">
            Set up your family to get started. All your data is kept private to your family.
          </p>
        </div>

        {mode === 'choose' && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              className="w-full bg-royal-blue-600 hover:bg-royal-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition"
            >
              ✨ Create a New Family
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full border-2 border-royal-blue-600 text-royal-blue-700 hover:bg-royal-blue-50 font-semibold py-3 px-6 rounded-xl transition"
            >
              🔗 Join an Existing Family
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Family Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="e.g. The Smiths"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-royal-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Mom, Dad, Alex…"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-royal-blue-400"
              />
            </div>
            {error && (
              <p className="text-red-600 text-sm">{error}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setMode('choose'); setError(null); }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !familyName.trim()}
                className="flex-1 bg-royal-blue-600 hover:bg-royal-blue-700 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Create Family'}
              </button>
            </div>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Family Join Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                maxLength={6}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2 uppercase tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-royal-blue-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                Ask a family member with Admin access for the 6-character join code.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Mom, Dad, Alex…"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-royal-blue-400"
              />
            </div>
            {error && (
              <p className="text-red-600 text-sm">{error}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setMode('choose'); setError(null); }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !joinCode.trim()}
                className="flex-1 bg-royal-blue-600 hover:bg-royal-blue-700 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50"
              >
                {loading ? 'Joining…' : 'Join Family'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
