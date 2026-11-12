import { describe, expect, it } from 'vitest';
import { buildCatalog, parseCatalogPage } from '../src/catalog.js';
import { rankTherapists, resolveLanguage, resolveTerms } from '../src/match.js';
import { catalogHtml, therapistRaw } from './fixture.js';

const now = new Date('2026-11-11');
const page = parseCatalogPage(
  catalogHtml([
    therapistRaw('a1111111-0000-0000-0000-000000000001', 'Anna A', {}, {
      'issue.personal.anxiety_fear': '5',
      'issue.personal.sleep': '5',
      'issue.personal.mood_disorders': '2',
      'modality.personal.cbt': '3',
    }),
    therapistRaw('b2222222-0000-0000-0000-000000000002', 'Bob B', { gender: 'male', experience_start_date: '2005-01-01' }, {
      'issue.personal.anxiety_fear': '4',
      'issue.personal.sleep': '4',
      'issue.personal.mood_disorders': '4',
      'group.personal.veterans': '3',
    }),
    therapistRaw('c3333333-0000-0000-0000-000000000003', 'Cara C', { active_services: ['personal', 'couple'], birthdate: '2000-05-05' }, {
      'issue.personal.anxiety_fear': '1',
      'language.ukrainian': '1',
    }),
  ]),
  'en',
  now,
);
const cat = buildCatalog('en', [page], page.localLabels, now);
const concerns = cat.facets.individual!.concerns;

describe('parsing', () => {
  it('normalizes therapists, languages, prices and facets', () => {
    expect(cat.therapists).toHaveLength(3);
    const a = cat.therapists[0]!;
    expect(a.experienceYears).toBe(11);
    expect(a.languages).toEqual(['language.english']);
    expect(a.scores['issue.personal.anxiety_fear']).toBe(5);
    expect(cat.therapists[2]!.therapyTypes).toEqual(['individual', 'couple']);
    expect(cat.prices.individual).toBe('from €59 / session');
    expect(concerns.find((c) => c.code === 'issue.personal.sleep')?.label).toBe('Sleep Problems and Insomnia');
  });
  it('throws on an unexpected page', () => {
    expect(() => parseCatalogPage('<html></html>', 'en')).toThrow();
  });
});

describe('resolveTerms', () => {
  it('accepts codes, slugs, labels and synonyms', () => {
    const { resolved, unmatched } = resolveTerms(
      ['issue.personal.sleep', 'anxiety-fear', 'depression', 'burnout', 'my breakup', 'grieving'],
      concerns,
    );
    expect(resolved.map((r) => r.code)).toEqual([
      'issue.personal.sleep',
      'issue.personal.anxiety_fear',
      'issue.personal.mood_disorders',
      'issue.personal.work_life_balance',
      'issue.personal.divorce',
      'issue.personal.loss_grief',
    ]);
    expect(unmatched).toEqual([]);
  });
  it('splits a compound phrase into several concerns', () => {
    const { resolved } = resolveTerms(['anxiety and insomnia'], concerns);
    expect(resolved.map((r) => r.code).sort()).toEqual(['issue.personal.anxiety_fear', 'issue.personal.sleep']);
  });
  it('reports unknown terms', () => {
    expect(resolveTerms(['xylophone'], concerns).unmatched).toEqual(['xylophone']);
  });
  it('resolves methods and groups', () => {
    expect(resolveTerms(['CBT'], cat.facets.individual!.methods).resolved[0]?.code).toBe('modality.personal.cbt');
    expect(resolveTerms(['military'], cat.facets.individual!.client_groups).resolved[0]?.code).toBe('group.personal.veterans');
  });
  it('resolves languages', () => {
    expect(resolveLanguage('English', cat)).toBe('language.english');
    expect(resolveLanguage('uk', cat)).toBe('language.ukrainian');
    expect(resolveLanguage('klingon', cat)).toBeNull();
  });
});

describe('rankTherapists', () => {
  const base = { therapyType: 'individual' as const, methods: [] as string[], clientGroups: [] as string[] };
  it('ranks by concern strength and penalises weak coverage', () => {
    const r = rankTherapists(cat.therapists, { ...base, concerns: ['issue.personal.anxiety_fear', 'issue.personal.mood_disorders'] }, now);
    expect(r.map((x) => x.therapist.name)).toEqual(['Bob B', 'Anna A', 'Cara C']);
    expect(r[0]!.score).toBe(80);
  });
  it('applies hard filters', () => {
    const names = (c: Partial<typeof base> & Record<string, unknown>) =>
      rankTherapists(cat.therapists, { ...base, concerns: [], ...c } as never, now).map((x) => x.therapist.name);
    expect(names({ gender: 'male' })).toEqual(['Bob B']);
    expect(names({ ageRange: '30-' })).toEqual(['Cara C']);
    expect(names({ therapyType: 'couple' } as never)).toEqual(['Cara C']);
    expect(names({ language: 'language.ukrainian' })).toEqual(['Cara C']);
  });
  it('gives a bonus for preferred methods without excluding others', () => {
    const r = rankTherapists(cat.therapists, { ...base, concerns: ['issue.personal.sleep'], methods: ['modality.personal.cbt'] }, now);
    expect(r[0]!.therapist.name).toBe('Anna A');
    expect(r[0]!.matchedMethods).toEqual(['modality.personal.cbt']);
    expect(r).toHaveLength(3);
  });
});
