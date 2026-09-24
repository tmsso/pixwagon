import { describe, expect, it } from 'vitest';
import { corsHeaders, isAllowedOrigin } from './cors.ts';

describe('isAllowedOrigin', () => {
  it('allows the production Pages origin, its previews, and local dev', () => {
    expect(isAllowedOrigin('https://pixwagon.pages.dev')).toBe(true);
    expect(isAllowedOrigin('https://3f2a9c1b.pixwagon.pages.dev')).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
  });

  it('rejects anything else, including lookalikes', () => {
    expect(isAllowedOrigin(null)).toBe(false);
    expect(isAllowedOrigin('https://evil.test')).toBe(false);
    expect(isAllowedOrigin('https://pixwagon.pages.dev.evil.test')).toBe(false);
    expect(isAllowedOrigin('http://pixwagon.pages.dev')).toBe(false);
  });
});

describe('corsHeaders', () => {
  it('echoes an allowed origin and varies on it', () => {
    const headers = corsHeaders('https://pixwagon.pages.dev');
    expect(headers['Access-Control-Allow-Origin']).toBe('https://pixwagon.pages.dev');
    expect(headers.Vary).toBe('Origin');
  });

  it('adds nothing for a disallowed origin', () => {
    expect(corsHeaders('https://evil.test')).toEqual({});
  });
});
