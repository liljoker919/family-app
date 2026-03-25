export type FamilyRole = 'dad' | 'mom' | 'child1' | 'child2';

export type FamilyUser = {
  role: FamilyRole;
  email: string;
  password: string;
};

const ROLE_ENV_KEY: Record<FamilyRole, string> = {
  dad: 'E2E_DAD_EMAIL',
  mom: 'E2E_MOM_EMAIL',
  child1: 'E2E_CHILD1_EMAIL',
  child2: 'E2E_CHILD2_EMAIL',
};

export const INVALID_PASSWORD = process.env.E2E_INVALID_PASSWORD?.trim() || 'InvalidPassword123!';

function readPassword(): string | null {
  const password = process.env.E2E_VALID_PASSWORD?.trim();
  return password || null;
}

export function getFamilyUser(role: FamilyRole): FamilyUser | null {
  const email = process.env[ROLE_ENV_KEY[role]]?.trim();
  const password = readPassword();
  if (!email || !password) {
    return null;
  }

  return { role, email, password };
}

export function getConfiguredFamilyUsers(): FamilyUser[] {
  return (Object.keys(ROLE_ENV_KEY) as FamilyRole[])
    .map((role) => getFamilyUser(role))
    .filter((user): user is FamilyUser => !!user);
}

export function getAnyConfiguredFamilyUser(): FamilyUser | null {
  const users = getConfiguredFamilyUsers();
  return users[0] ?? null;
}