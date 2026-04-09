import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall, tabHeaders } from '../api-client.js';

export function registerNetworkTools(server: McpServer): void {
  server.tool(
    'tandem_network_log',
    'Get the network request log captured via Electron webRequest API. Lighter-weight than DevTools network — shows URL, method, status, and timing for recent requests. Supports targeting a background tab by ID.',
    {
      domain: z.string().optional().describe('Filter by domain'),
      type: z.string().optional().describe('Filter by resource type'),
      limit: z.number().optional().describe('Maximum entries to return (default: 100)'),
      tabId: z.string().optional().describe('Optional tab ID to target a background tab instead of the active tab'),
    },
    async ({ domain, type, limit, tabId }) => {
      const params = new URLSearchParams();
      if (domain) params.set('domain', domain);
      if (type) params.set('type', type);
      if (limit !== undefined) params.set('limit', String(limit));
      const qs = params.toString();
      const endpoint = qs ? `/network/log?${qs}` : '/network/log';
      const data = await apiCall('GET', endpoint, undefined, tabHeaders(tabId));
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_network_apis',
    'Get a summary of detected API endpoints from network traffic. Shows unique API paths grouped by domain, useful for understanding what services the page communicates with.',
    async () => {
      const data = await apiCall('GET', '/network/apis');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_network_domains',
    'Get a list of all domains that the page has made requests to, with request counts. Useful for understanding third-party dependencies and data flows.',
    async () => {
      const data = await apiCall('GET', '/network/domains');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_network_har',
    'Export the network log as a HAR (HTTP Archive) file. Returns a full HAR 1.2 JSON object that can be imported into browser DevTools or other analysis tools.',
    async () => {
      const data = await apiCall('GET', '/network/har');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_network_mock',
    'Add a network mock rule to intercept and override HTTP responses. Matched requests will return the specified status, body, and headers instead of hitting the real server. WARNING: This modifies network behavior.',
    {
      url: z.string().describe('URL pattern to match (supports wildcards)'),
      method: z.string().optional().describe('HTTP method to match (e.g. "GET", "POST")'),
      status: z.number().optional().describe('HTTP status code to return (default: 200)'),
      body: z.string().optional().describe('Response body to return'),
      headers: z.record(z.string(), z.string()).optional().describe('Response headers to return'),
    },
    {
      destructiveHint: true,
      readOnlyHint: false,
      openWorldHint: false,
    },
    async ({ url, method, status, body, headers }) => {
      const payload: Record<string, unknown> = { pattern: url };
      if (method) payload.method = method;
      if (status !== undefined) payload.status = status;
      if (body) payload.body = body;
      if (headers) payload.headers = headers;
      const data = await apiCall('POST', '/network/mock', payload);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_network_unmock',
    'Remove a network mock rule by URL pattern. The matching pattern must be the same as the one used when creating the mock.',
    {
      url: z.string().describe('URL pattern of the mock to remove'),
    },
    async ({ url }) => {
      const data = await apiCall('POST', '/network/unmock', { pattern: url });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_network_mocks',
    'List all active network mock rules. Shows the URL patterns being intercepted and their configured responses.',
    async () => {
      const data = await apiCall('GET', '/network/mocks');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_network_clear',
    'Clear the network request log. Removes all captured webRequest-level network entries.',
    async () => {
      const data = await apiCall('DELETE', '/network/clear');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_network_mock_clear',
    'Remove all active network mock rules at once. WARNING: This clears all mock rules — real network requests will resume for all previously mocked patterns.',
    {},
    {
      destructiveHint: true,
      readOnlyHint: false,
      openWorldHint: false,
    },
    async () => {
      const data = await apiCall('POST', '/network/mock-clear');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );
}
