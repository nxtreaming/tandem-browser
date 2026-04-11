import { describe, expect, it, beforeEach } from 'vitest';
import { NetworkInspector, type NetworkRequest } from '../inspector';

function createRequest(overrides: Partial<NetworkRequest> = {}): NetworkRequest {
  return {
    id: 1,
    url: 'https://api.example.com/v1/users?id=42',
    method: 'GET',
    status: 200,
    contentType: 'application/json',
    size: 128,
    timestamp: Date.parse('2026-03-08T12:00:00.000Z'),
    initiator: 'https://example.com/app',
    domain: 'api.example.com',
    durationMs: 84,
    requestHeaders: { Accept: 'application/json' },
    responseHeaders: { 'content-type': ['application/json'], 'cache-control': ['no-cache'] },
    ...overrides,
  };
}

type MutableInspector = {
  requests: NetworkRequest[];
  domainStats: Map<string, { domain: string; requests: number; apis: string[]; lastSeen: number }>;
  addRequest: (req: NetworkRequest) => void;
  isApiEndpoint: (req: NetworkRequest) => boolean;
  extractApiPath: (url: string) => string;
  extractDomain: (url: string) => string;
};

describe('NetworkInspector', () => {
  let inspector: NetworkInspector;
  let mut: MutableInspector;

  beforeEach(() => {
    inspector = new NetworkInspector();
    mut = inspector as unknown as MutableInspector;
  });

  // ─── HAR export ───

  it('exports recent requests as HAR', () => {
    mut.requests = [createRequest()];

    const har = inspector.toHar();

    expect(har.log.version).toBe('1.2');
    expect(har.log.entries).toHaveLength(1);
    expect(har.log.entries[0]).toMatchObject({
      startedDateTime: '2026-03-08T12:00:00.000Z',
      time: 84,
      request: {
        method: 'GET',
        url: 'https://api.example.com/v1/users?id=42',
        queryString: [{ name: 'id', value: '42' }],
      },
      response: {
        status: 200,
        statusText: 'OK',
        content: { size: 128, mimeType: 'application/json' },
      },
    });
    expect(har.log.entries[0].request.headers).toContainEqual({
      name: 'Accept',
      value: 'application/json',
    });
    expect(har.log.entries[0].response.headers).toContainEqual({
      name: 'content-type',
      value: 'application/json',
    });
  });

  it('HAR page title includes domain when domain filter is provided', () => {
    mut.requests = [createRequest()];
    const har = inspector.toHar(100, 'api.example.com');
    expect(har.log.pages[0].title).toContain('api.example.com');
  });

  it('HAR export with empty requests returns empty entries', () => {
    const har = inspector.toHar();
    expect(har.log.entries).toHaveLength(0);
  });

  it('HAR response uses correct statusText for various codes', () => {
    mut.requests = [
      createRequest({ status: 404 }),
      createRequest({ id: 2, status: 500 }),
    ];
    const har = inspector.toHar();
    expect(har.log.entries[0].response.statusText).toBe('Not Found');
    expect(har.log.entries[1].response.statusText).toBe('Internal Server Error');
  });

  it('HAR uses application/octet-stream for missing contentType', () => {
    mut.requests = [createRequest({ contentType: '' })];
    const har = inspector.toHar();
    expect(har.log.entries[0].response.content.mimeType).toBe('application/octet-stream');
  });

  // ─── getLog ───

  it('getLog returns all requests up to limit', () => {
    mut.requests = Array.from({ length: 5 }, (_, i) =>
      createRequest({ id: i + 1, domain: 'example.com' }),
    );
    expect(inspector.getLog(3)).toHaveLength(3);
    expect(inspector.getLog()).toHaveLength(5);
  });

  it('getLog filters by domain', () => {
    mut.requests = [
      createRequest({ id: 1, domain: 'a.com' }),
      createRequest({ id: 2, domain: 'b.com' }),
      createRequest({ id: 3, domain: 'a.com' }),
    ];
    const filtered = inspector.getLog(100, 'a.com');
    expect(filtered).toHaveLength(2);
    expect(filtered.every(r => r.domain === 'a.com')).toBe(true);
  });

  it('getLog returns empty for non-existent domain', () => {
    mut.requests = [createRequest({ domain: 'a.com' })];
    expect(inspector.getLog(100, 'nonexistent.com')).toHaveLength(0);
  });

  // ─── getDomains ───

  it('getDomains returns domain stats sorted by request count', () => {
    mut.domainStats.set('a.com', { domain: 'a.com', requests: 10, apis: [], lastSeen: 1 });
    mut.domainStats.set('b.com', { domain: 'b.com', requests: 50, apis: ['/api/v1'], lastSeen: 2 });
    mut.domainStats.set('c.com', { domain: 'c.com', requests: 5, apis: [], lastSeen: 3 });

    const domains = inspector.getDomains();
    expect(domains).toHaveLength(3);
    expect(domains[0].domain).toBe('b.com');
    expect(domains[0].requests).toBe(50);
    expect(domains[0].apiCount).toBe(1);
    expect(domains[2].domain).toBe('c.com');
  });

  it('getDomains returns empty array when no domains tracked', () => {
    expect(inspector.getDomains()).toEqual([]);
  });

  // ─── getApis ───

  it('getApis returns only domains with discovered endpoints', () => {
    mut.domainStats.set('api.com', { domain: 'api.com', requests: 5, apis: ['/v1/users', '/v1/items'], lastSeen: 1 });
    mut.domainStats.set('cdn.com', { domain: 'cdn.com', requests: 100, apis: [], lastSeen: 2 });

    const apis = inspector.getApis();
    expect(Object.keys(apis)).toEqual(['api.com']);
    expect(apis['api.com']).toEqual(['/v1/users', '/v1/items']);
  });

  // ─── clear ───

  it('clear resets all internal state', () => {
    mut.requests = [createRequest()];
    mut.domainStats.set('a.com', { domain: 'a.com', requests: 1, apis: [], lastSeen: 1 });

    inspector.clear();

    expect(inspector.getLog()).toHaveLength(0);
    expect(inspector.getDomains()).toHaveLength(0);
    expect(inspector.getApis()).toEqual({});
  });

  // ─── addRequest & sliding window ───

  it('addRequest maintains max 1000 requests', () => {
    for (let i = 0; i < 1050; i++) {
      mut.addRequest(createRequest({ id: i, url: `https://example.com/${i}`, domain: 'example.com' }));
    }
    expect(mut.requests.length).toBeLessThanOrEqual(1000);
  });

  it('addRequest auto-discovers API endpoints', () => {
    mut.addRequest(createRequest({ url: 'https://api.com/v1/users', domain: 'api.com', contentType: 'application/json' }));
    const apis = inspector.getApis();
    expect(apis['api.com']).toBeDefined();
  });

  it('addRequest does not duplicate API paths', () => {
    mut.addRequest(createRequest({ id: 1, url: 'https://api.com/v1/users', domain: 'api.com', contentType: 'application/json' }));
    mut.addRequest(createRequest({ id: 2, url: 'https://api.com/v1/users', domain: 'api.com', contentType: 'application/json' }));
    expect(inspector.getApis()['api.com']).toHaveLength(1);
  });

  // ─── API endpoint detection ───

  it('isApiEndpoint detects JSON content type', () => {
    expect(mut.isApiEndpoint(createRequest({ contentType: 'application/json' }))).toBe(true);
  });

  it('isApiEndpoint detects /api/ path', () => {
    expect(mut.isApiEndpoint(createRequest({ url: 'https://example.com/api/data', contentType: 'text/html' }))).toBe(true);
  });

  it('isApiEndpoint detects /graphql path', () => {
    expect(mut.isApiEndpoint(createRequest({ url: 'https://example.com/graphql', contentType: 'text/html' }))).toBe(true);
  });

  it('isApiEndpoint detects /rest/ path', () => {
    expect(mut.isApiEndpoint(createRequest({ url: 'https://example.com/rest/items', contentType: 'text/html' }))).toBe(true);
  });

  it('isApiEndpoint returns false for static assets', () => {
    expect(mut.isApiEndpoint(createRequest({ url: 'https://cdn.com/style.css', contentType: 'text/css' }))).toBe(false);
  });

  it('isApiEndpoint detects XML content on non-.xml URLs', () => {
    expect(mut.isApiEndpoint(createRequest({ url: 'https://api.com/data', contentType: 'application/xml' }))).toBe(true);
  });

  it('isApiEndpoint returns false for .xml file URL with XML content', () => {
    expect(mut.isApiEndpoint(createRequest({ url: 'https://cdn.com/sitemap.xml', contentType: 'application/xml' }))).toBe(false);
  });

  // ─── API path normalization ───

  it('extractApiPath normalizes UUIDs to {uuid}', () => {
    const path = mut.extractApiPath('https://api.com/users/550e8400-e29b-41d4-a716-446655440000/profile');
    expect(path).toBe('/users/{uuid}/profile');
  });

  it('extractApiPath normalizes numeric IDs to {id}', () => {
    const path = mut.extractApiPath('https://api.com/users/42/posts/123');
    expect(path).toBe('/users/{id}/posts/{id}');
  });

  it('extractApiPath returns empty string for invalid URL', () => {
    expect(mut.extractApiPath('not-a-url')).toBe('');
  });

  // ─── Domain extraction ───

  it('extractDomain extracts hostname', () => {
    expect(mut.extractDomain('https://www.example.com/path')).toBe('www.example.com');
  });

  it('extractDomain returns empty for invalid URL', () => {
    expect(mut.extractDomain('not-a-url')).toBe('');
  });
});
