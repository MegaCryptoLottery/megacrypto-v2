import { describe, expect, it } from 'vitest';
import { catalogAudit, en, languages, resources, resolveLocale } from './i18n';

describe('locale selection', () => {
  it('exposes the ten supported locales', () => expect(languages.map(([code]) => code)).toEqual(['en','pt','es','fr','de','it','ja','ko','zh-CN','zh-TW']));
  it('maps browser locales and falls back to English', () => {
    expect(resolveLocale('pt-BR')).toBe('pt');
    expect(resolveLocale('zh-TW')).toBe('zh-TW');
    expect(resolveLocale('en-US')).toBe('en');
    expect(resolveLocale('xx-YY')).toBe('en');
  });
  it('ships every English key in every supported resource', () => {
    for (const [locale] of languages) expect(Object.keys(en).filter((key) => !(key in resources[locale]))).toEqual([]);
  });
  it('has no missing, empty, or mismatched interpolation values', () => {
    for (const report of catalogAudit().byLocale) {
      expect(report.missing).toEqual([]);
      expect(report.empty).toEqual([]);
      expect(report.placeholderMismatches).toEqual([]);
    }
  });
  it('has complete, non-English Portuguese, Spanish, and French catalogs', () => {
    const completed = new Set(['pt', 'es', 'fr', 'de', 'it', 'ja', 'ko', 'zh-CN', 'zh-TW']);
    const reports = catalogAudit().byLocale.filter((report) => completed.has(report.locale));
    for (const report of reports) {
      expect(report.translationMissing).toEqual([]);
      expect(report.translationEmpty).toEqual([]);
      expect(report.translationPlaceholderMismatches).toEqual([]);
      expect(report.identical).toEqual([]);
    }
  });
});
