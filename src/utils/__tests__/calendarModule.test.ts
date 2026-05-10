/**
 * Unit tests for CalendarModule utility constants.
 *
 * These tests verify the color map and label map are consistent for the
 * explicitly enumerated event types below, and that both maps stay in sync.
 */

import { describe, it, expect } from 'vitest';
import { EVENT_COLORS, EVENT_TYPE_LABELS } from '../../utils/calendarConstants';

const EXPECTED_TYPES = ['vacation', 'chore', 'car', 'manual'] as const;

describe('CalendarModule constants', () => {
  describe('EVENT_COLORS', () => {
    it('has a color entry for every expected event type', () => {
      for (const type of EXPECTED_TYPES) {
        expect(EVENT_COLORS[type], `Missing color for type "${type}"`).toBeDefined();
      }
    });

    it('all color values are valid CSS hex strings', () => {
      for (const [type, color] of Object.entries(EVENT_COLORS)) {
        expect(color, `Invalid color for type "${type}"`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    it('event type colors are distinct from each other', () => {
      const values = EXPECTED_TYPES.map((t) => EVENT_COLORS[t]);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });
  });

  describe('EVENT_TYPE_LABELS', () => {
    it('has a label entry for every expected event type', () => {
      for (const type of EXPECTED_TYPES) {
        expect(EVENT_TYPE_LABELS[type], `Missing label for type "${type}"`).toBeDefined();
      }
    });

    it('all labels are non-empty strings', () => {
      for (const [type, label] of Object.entries(EVENT_TYPE_LABELS)) {
        expect(typeof label).toBe('string');
        expect(label.trim().length, `Empty label for type "${type}"`).toBeGreaterThan(0);
      }
    });

    it('EVENT_COLORS and EVENT_TYPE_LABELS cover the same set of types', () => {
      const colorKeys = new Set(Object.keys(EVENT_COLORS));
      const labelKeys = new Set(Object.keys(EVENT_TYPE_LABELS));
      expect(colorKeys).toEqual(labelKeys);
    });
  });
});
