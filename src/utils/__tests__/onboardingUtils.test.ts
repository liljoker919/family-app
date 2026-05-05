import { describe, it, expect } from 'vitest';
import { getDefaultFamilyName } from '../onboardingUtils';

describe('getDefaultFamilyName', () => {
  it('appends "s" for a regular last name', () => {
    expect(getDefaultFamilyName('Smith')).toBe('The Smiths');
  });

  it('appends "es" for names ending in "s"', () => {
    expect(getDefaultFamilyName('Jones')).toBe('The Joneses');
  });

  it('appends "es" for names ending in "x"', () => {
    expect(getDefaultFamilyName('Fox')).toBe('The Foxes');
  });

  it('appends "es" for names ending in "z"', () => {
    expect(getDefaultFamilyName('Ruiz')).toBe('The Ruizes');
  });

  it('appends "es" for names ending in "ch"', () => {
    expect(getDefaultFamilyName('Church')).toBe('The Churches');
  });

  it('appends "es" for names ending in "sh"', () => {
    expect(getDefaultFamilyName('Walsh')).toBe('The Walshes');
  });

  it('handles names that do not need a suffix pattern exception', () => {
    expect(getDefaultFamilyName('Brady')).toBe('The Bradys');
    expect(getDefaultFamilyName('Miller')).toBe('The Millers');
  });

  it('returns empty string for null', () => {
    expect(getDefaultFamilyName(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(getDefaultFamilyName(undefined)).toBe('');
  });

  it('returns empty string for an empty string', () => {
    expect(getDefaultFamilyName('')).toBe('');
  });

  it('returns empty string for a whitespace-only string', () => {
    expect(getDefaultFamilyName('   ')).toBe('');
  });

  it('trims leading/trailing whitespace before processing', () => {
    expect(getDefaultFamilyName('  Taylor  ')).toBe('The Taylors');
  });
});
