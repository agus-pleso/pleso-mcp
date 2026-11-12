/**
 * Crisis resources. Pleso is not an emergency service; when a person may be at
 * risk, the assistant should surface these before (or instead of) therapist search.
 *
 * Numbers last checked 2026-11-11. Hours vary and are intentionally omitted —
 * Find A Helpline (findahelpline.com) is always included as the live fallback.
 * RE-VERIFY THIS LIST BEFORE EACH RELEASE (see README → "Crisis resources").
 */

export interface CrisisLine {
  name: string;
  contact: string;
  note?: string;
  url?: string;
}

export interface CrisisResources {
  country: string;
  emergency_number: string;
  lines: CrisisLine[];
}

const FIND_A_HELPLINE: CrisisLine = {
  name: 'Find A Helpline (free, confidential helplines in 130+ countries)',
  contact: 'https://findahelpline.com',
  url: 'https://findahelpline.com',
};

const RESOURCES: Record<string, CrisisResources> = {
  UA: {
    country: 'Ukraine',
    emergency_number: '112 (or 103 for ambulance)',
    lines: [{ name: 'Lifeline Ukraine — suicide prevention & mental health support', contact: '7333', url: 'https://lifelineukraine.com' }],
  },
  PL: {
    country: 'Poland',
    emergency_number: '112',
    lines: [
      { name: 'Centrum Wsparcia — adults in mental crisis (free)', contact: '800 70 2222', url: 'https://centrumwsparcia.pl' },
      { name: 'Kryzysowy Telefon Zaufania — adults in emotional crisis', contact: '116 123' },
      { name: 'Telefon Zaufania dla Dzieci i Młodzieży — children & young people', contact: '116 111' },
    ],
  },
  RO: {
    country: 'Romania',
    emergency_number: '112',
    lines: [
      {
        name: 'Alianța Română de Prevenție a Suicidului — suicide prevention line (free)',
        contact: '0800 801 200',
        note: 'Email: sos@antisuicid.ro',
        url: 'https://antisuicid.ro',
      },
    ],
  },
  GB: {
    country: 'United Kingdom',
    emergency_number: '999 or 112',
    lines: [
      { name: 'Samaritans (free, any time)', contact: '116 123', url: 'https://www.samaritans.org' },
      { name: 'Shout — text support', contact: 'Text SHOUT to 85258' },
    ],
  },
  IE: {
    country: 'Ireland',
    emergency_number: '112 or 999',
    lines: [{ name: 'Samaritans Ireland', contact: '116 123', url: 'https://www.samaritans.org' }],
  },
  US: {
    country: 'United States',
    emergency_number: '911',
    lines: [{ name: '988 Suicide & Crisis Lifeline — call or text', contact: '988', url: 'https://988lifeline.org' }],
  },
  CA: {
    country: 'Canada',
    emergency_number: '911',
    lines: [{ name: '9-8-8 Suicide Crisis Helpline — call or text', contact: '988', url: 'https://988.ca' }],
  },
  DE: {
    country: 'Germany',
    emergency_number: '112',
    lines: [{ name: 'TelefonSeelsorge (free, 24/7)', contact: '0800 111 0 111 or 0800 111 0 222', url: 'https://www.telefonseelsorge.de' }],
  },
};

const ALIASES: Record<string, string> = {
  UK: 'GB', ENGLAND: 'GB', SCOTLAND: 'GB', WALES: 'GB', 'UNITED KINGDOM': 'GB', BRITAIN: 'GB',
  UKRAINE: 'UA', POLAND: 'PL', POLSKA: 'PL', ROMANIA: 'RO', 'ROMÂNIA': 'RO', IRELAND: 'IE',
  USA: 'US', 'UNITED STATES': 'US', AMERICA: 'US', CANADA: 'CA', GERMANY: 'DE', DEUTSCHLAND: 'DE',
};

export function crisisResources(country?: string): { resources: CrisisResources | null; fallback: CrisisLine; supported: string[] } {
  const key = (country ?? '').trim().toUpperCase();
  const code = RESOURCES[key] ? key : ALIASES[key];
  return {
    resources: code ? (RESOURCES[code] ?? null) : null,
    fallback: FIND_A_HELPLINE,
    supported: Object.keys(RESOURCES),
  };
}

export const SAFETY_NOTE =
  'Pleso is an online therapy service, not an emergency service. If someone is in immediate danger or thinking about suicide or self-harm, contact local emergency services (112 in the EU/UK, 911 in North America) or a crisis line — use the get_crisis_resources tool or https://findahelpline.com.';

export const DISCLAIMER =
  'Results are based on the specializations therapists publish on Pleso. This is not a diagnosis or medical advice; the person should choose the therapist they feel comfortable with.';
