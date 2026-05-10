import { describe, expect, it } from 'vitest';
import { TODAY_ALERT_SEVERITY_STYLES } from '../todayAlertStyles';

describe('TODAY_ALERT_SEVERITY_STYLES', () => {
  it('uses high-contrast dark text classes for alert banners', () => {
    Object.values(TODAY_ALERT_SEVERITY_STYLES).forEach((style) => {
      expect(style).toMatch(/text-\w+-900/);
      expect(style).not.toContain('text-white');
    });
  });

  it('uses light background shades for warning and critical banners', () => {
    expect(TODAY_ALERT_SEVERITY_STYLES.warning).toContain('bg-amber-100');
    expect(TODAY_ALERT_SEVERITY_STYLES.critical).toContain('bg-rose-100');
  });
});
