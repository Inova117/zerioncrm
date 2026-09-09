// Tests de mapeo de shapes Monid — fixtures copia fiel de respuestas reales
// (sep 2026, confirmadas en vivo contra api.monid.ai). Estos tests son el
// regress-guard contra el bug más caro del V2: asumir un wire-format equivocado
// (p.ej. `profiles` dict vs array).
import { describe, it, expect } from 'vitest';
import {
  mapContactOutProfiles,
  mapHunterEmails,
  mapApolloPeople,
  mapClayPeople,
  mapPdlFirm,
  scoreFacturacion,
  nivelOf,
  parseIntentFallback,
} from './monidMapping';

describe('mapContactOutProfiles — el shape más traicionero', () => {
  it('aplana el DICCIONARIO indexado por URL de LinkedIn (shape real)', () => {
    // Respuesta REAL de contactout /decision-makers/work-email (reveal=false):
    const profiles = {
      'https://www.linkedin.com/in/vishal-chowdri': {
        full_name: 'Vishal Chowdri',
        title: 'Partner',
        seniority: 'Partner',
        job_function: 'Finance',
        contact_availability: { work_email: true, phone: false },
      },
      'https://www.linkedin.com/in/swati-tomar-b8523613b': {
        full_name: 'Swati Tomar',
        title: 'CEO',
        seniority: 'C-Level',
        job_function: 'Operations',
        contact_availability: { work_email: true, phone: true },
      },
    };

    const people = mapContactOutProfiles(profiles);
    expect(people).toHaveLength(2);
    expect(people[0].full_name).toBe('Vishal Chowdri');
    expect(people[1].full_name).toBe('Swati Tomar');
    expect(people[0].contact_availability?.work_email).toBe(true);
  });

  it('también acepta array (por si Monid cambia el shape)', () => {
    const arr = [{ full_name: 'A' }, { full_name: 'B' }];
    expect(mapContactOutProfiles(arr)).toHaveLength(2);
  });

  it('devuelve [] ante null/undefined', () => {
    expect(mapContactOutProfiles(null)).toEqual([]);
    expect(mapContactOutProfiles(undefined)).toEqual([]);
  });
});

describe('mapHunterEmails — `value` → `email`', () => {
  it('normaliza data.emails[].value a email (shape real domain-search)', () => {
    const output = {
      data: {
        domain: 'stripe.com',
        pattern: '{first}{last}',
        emails: [
          { value: 'manu@stripe.com', type: 'personal', confidence: 85, first_name: 'Manu', last_name: 'Kapoor' },
          { value: 'contact@stripe.com', type: 'generic', confidence: 50 },
        ],
      },
    };
    const emails = mapHunterEmails(output);
    expect(emails).toHaveLength(2);
    expect(emails[0].email).toBe('manu@stripe.com');
    expect(emails[0].confidence).toBe(85);
    expect(emails[1].type).toBe('generic');
  });

  it('devuelve [] ante output vacío', () => {
    expect(mapHunterEmails({})).toEqual([]);
    expect(mapHunterEmails(null)).toEqual([]);
  });
});

describe('mapApolloPeople / mapClayPeople', () => {
  it('Apollo: extrae people[] (shape real)', () => {
    const output = {
      total_entries: 12,
      people: [
        { first_name: 'Patrick', last_name_obfuscated: 'Co***n', title: 'Co-Founder & CEO', has_email: true },
        { first_name: 'Ravi', last_name_obfuscated: 'Kh***a', title: 'Founder', has_email: false },
      ],
    };
    const people = mapApolloPeople(output);
    expect(people).toHaveLength(2);
    expect(people[0].first_name).toBe('Patrick');
  });

  it('Clay: extrae data[] (shape real query-mode/run)', () => {
    const output = {
      data: [
        {
          clay_profile_id: 30954253,
          name: 'Archy Gupta',
          matched_experiences: [{ company: 'Google', title: 'Software Engineer III' }],
        },
      ],
    };
    const people = mapClayPeople(output);
    expect(people).toHaveLength(1);
    expect(people[0].matched_experiences?.[0].company).toBe('Google');
  });
});

describe('mapPdlFirm — founded → antiguedad', () => {
  it('deriva antiguedad desde founded (shape real PDL)', () => {
    const output = {
      name: 'stripe',
      employee_count: 12041,
      founded: 2010,
      size: '1001-5000',
      industry: 'internet',
      total_funding_raised: 9000000000,
      latest_funding_stage: 'IPO',
      linkedin_url: 'linkedin.com/company/stripe',
    };
    const firm = mapPdlFirm(output);
    expect(firm.founded).toBe(2010);
    expect(firm.empleados).toBe(12041);
    expect(firm.antiguedad).toBe(new Date().getFullYear() - 2010);
    expect(firm.totalFunding).toBe(9000000000);
    expect(firm.fundingStage).toBe('IPO');
  });
});

describe('scoreFacturacion + nivelOf', () => {
  it('empleados grandes → sostiene', () => {
    expect(nivelOf(scoreFacturacion({ empleados: 50 }))).toBe('sostiene');
  });

  it('reseñas solas son señal válida (negocio local sin PDL)', () => {
    const score = scoreFacturacion({ resenas: 200 });
    expect(score).toBe(80); // ptsResenas(200) = 80
    expect(nivelOf(score)).toBe('sostiene');
  });

  it('sin señales → null → sin-datos', () => {
    expect(scoreFacturacion({})).toBeNull();
    expect(nivelOf(null)).toBe('sin-datos');
  });

  it('empleados + fundación se promedian', () => {
    // empleados 9 → 60; founded 2000 → antig 26 → 80; avg = 70 → sostiene
    const score = scoreFacturacion({ empleados: 9, founded: 2000 });
    expect(score).toBe(70);
  });
});

describe('parseIntentFallback (sin LLM)', () => {
  it('extrae nicho + ciudad en minúsculas', () => {
    const i = parseIntentFallback('dame dentistas en quito que sostengan el ticket');
    expect(i.niche).toBe('dentistas');
    expect(i.city).toBe('quito');
    expect(i.objetivo).toBe('sostiene');
  });

  it('ciudad compuesta "Vía a la Costa"', () => {
    const i = parseIntentFallback('dame gimnasios en Vía a la Costa');
    expect(i.city.toLowerCase()).toContain('vía a la costa');
  });

  it('sin objetivo explícito → todos', () => {
    const i = parseIntentFallback('dame talleres en Guayaquil');
    expect(i.objetivo).toBe('todos');
    expect(i.city).toBe('Guayaquil');
  });

  it('detecta tipo b2b para empresas de software', () => {
    const i = parseIntentFallback('empresas de desarrollo de software en Quito');
    expect(i.tipo).toBe('b2b');
  });

  it('detecta tipo local para negocios de barrio', () => {
    const i = parseIntentFallback('dame dentistas en Quito');
    expect(i.tipo).toBe('local');
  });
});