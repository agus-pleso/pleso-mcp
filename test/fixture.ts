/** Synthetic catalog page in the same shape as pleso.me's __NEXT_DATA__ (no real people). */
export function therapistRaw(
  id: string,
  name: string,
  extra: Record<string, unknown> = {},
  spec: Record<string, string> = {},
) {
  return {
    worker_id: id,
    worker_name_long: name,
    gender: 'female',
    birthdate: '1985-01-01',
    experience_start_date: '2015-01-01',
    half_length_photo: `https://img.example/${id}.png`,
    video_introduction_url: null,
    specialization: { 'language.english': '1', 'language.ukrainian': '0', ...spec },
    descriptions: [{ type: 'main_description', title: '', description: `${name} is a warm therapist. She helps clients feel safe.` }],
    diplomas: [{ type: 'main_diploma', title: 'MSc Counselling', description: '2014' }],
    active_services: ['personal'],
    ...extra,
  };
}

const opt = (code: string) => ({ title: code, url_title: code.split('.').pop()!.replace(/_/g, '-'), value: code });

export function catalogHtml(therapists: unknown[], opts: { count?: number; pair?: boolean } = {}) {
  const personal = {
    requests: [
      'issue.personal.anxiety_fear',
      'issue.personal.mood_disorders',
      'issue.personal.sleep',
      'issue.personal.work_life_balance',
      'issue.personal.divorce',
      'issue.personal.loss_grief',
    ].map(opt),
    methods: ['modality.personal.cbt', 'modality.personal.emdr', 'modality.personal.gestalt_therapy'].map(opt),
    groups: ['group.personal.lgbt', 'group.personal.veterans'].map(opt),
  };
  const pageProps = {
    therapistsData: therapists,
    therapistsCount: opts.count ?? therapists.length,
    api_catalog_config: {
      personal,
      ...(opts.pair ? { pair: { requests: [opt('issue.pair.conflict')], methods: [], groups: [] } } : {}),
    },
    __i18n: {
      resources: {
        en: {
          workerSkills: {
            'issue.personal.anxiety_fear': 'Anxiety and Fear',
            'issue.personal.mood_disorders': 'Mood Disorders (incl. Depression, SAD, Bipolar)',
            'issue.personal.sleep': 'Sleep Problems and Insomnia',
            'issue.personal.work_life_balance': 'Work-Life Balance (Burnout, Motivation)',
            'issue.personal.divorce': 'Breakup and Divorce',
            'issue.personal.loss_grief': 'Grief and Loss',
            'modality.personal.cbt': 'Cognitive Behavioural Therapy (CBT)',
            'modality.personal.emdr': 'EMDR',
            'modality.personal.gestalt_therapy': 'Gestalt Therapy',
            'group.personal.lgbt': 'LGBTQ+ People',
            'group.personal.veterans': 'Veterans and Active Duty Service Members',
            'language.english': 'English',
          },
          catalogPage: { personal_price_min: 'from €59 / session', pair_price_min: 'from €79 / session' },
        },
      },
    },
  };
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps } })}</script></body></html>`;
}
