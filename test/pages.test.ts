import { describe, expect, it } from 'vitest';
import { getPage } from '../src/pages.js';

describe('public pages', () => {
  it('serves indexable docs with the MCP URL and support contact', () => {
    const p = getPage('/docs')!;
    expect(p.status).toBe(200);
    expect(p.type).toMatch(/text\/html/);
    const html = String(p.body);
    expect(html).toContain('/mcp</code>');
    expect(html).toContain('hello@pleso.me');
    expect(html).toContain('rel="canonical"');
    expect(html).not.toContain('noindex');
  });

  it('serves a noindex privacy notice naming the controller and DPO', () => {
    const html = String(getPage('/privacy/')!.body);
    expect(html).toContain('Pleso Therapy sp. z o.o.');
    expect(html).toContain('iod@pleso.me');
    expect(html).toContain('name="robots" content="noindex"');
  });

  it('serves the logo and robots.txt', () => {
    const logo = getPage('/logo.png')!;
    expect(logo.type).toBe('image/png');
    expect((logo.body as Buffer).subarray(1, 4).toString()).toBe('PNG');
    expect(String(getPage('/robots.txt')!.body)).toContain('Disallow: /mcp');
  });

  it('redirects browsers from / to /docs but leaves API clients alone', () => {
    expect(getPage('/', 'text/html,application/xhtml+xml')!.headers!.Location).toBe('/docs');
    expect(getPage('/', 'application/json')).toBeNull();
    expect(getPage('/nope')).toBeNull();
  });
});
