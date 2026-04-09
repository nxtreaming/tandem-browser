import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall, tabHeaders, logActivity } from '../api-client.js';
import { coerceShape } from '../coerce.js';

export function registerDevtoolsTools(server: McpServer): void {
  server.tool(
    'tandem_devtools_console',
    'Get console log entries from the browser DevTools. Use to inspect logs, warnings, errors, and debug output from the page. Supports filtering by level (log, warn, error, info, debug) and searching message text. Supports targeting a background tab by ID.',
    coerceShape({
      level: z.string().optional().describe('Filter by log level: log, warn, error, info, debug'),
      search: z.string().optional().describe('Search string to filter messages'),
      limit: z.number().optional().describe('Maximum entries to return (default: 100)'),
      tabId: z.string().optional().describe('Optional tab ID to target a background tab instead of the active tab'),
    }),
    async ({ level, search, limit, tabId }: any) => {
      const params = new URLSearchParams();
      if (level) params.set('level', level);
      if (search) params.set('search', search);
      if (limit !== undefined) params.set('limit', String(limit));
      const qs = params.toString();
      const endpoint = qs ? `/devtools/console?${qs}` : '/devtools/console';
      const data = await apiCall('GET', endpoint, undefined, tabHeaders(tabId));
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_devtools_console_errors',
    'Get only console errors from the browser DevTools. A quick way to check if the page has any JavaScript errors. Supports targeting a background tab by ID.',
    coerceShape({
      limit: z.number().optional().describe('Maximum errors to return (default: 50)'),
      tabId: z.string().optional().describe('Optional tab ID to target a background tab instead of the active tab'),
    }),
    async ({ limit, tabId }: any) => {
      const params = new URLSearchParams();
      if (limit !== undefined) params.set('limit', String(limit));
      const qs = params.toString();
      const endpoint = qs ? `/devtools/console/errors?${qs}` : '/devtools/console/errors';
      const data = await apiCall('GET', endpoint, undefined, tabHeaders(tabId));
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_devtools_console_clear',
    'Clear the console log buffer in DevTools. Removes all captured console entries.',
    async () => {
      const data = await apiCall('POST', '/devtools/console/clear');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_devtools_network',
    'Get network request entries captured via CDP (Chrome DevTools Protocol). Includes full headers and POST bodies. Use to inspect API calls, failed requests, and resource loading. Supports targeting a background tab by ID.',
    coerceShape({
      domain: z.string().optional().describe('Filter by domain (e.g. "api.example.com")'),
      type: z.string().optional().describe('Filter by resource type (e.g. "XHR", "Fetch", "Script")'),
      failed: z.boolean().optional().describe('Filter to only failed requests (true) or successful (false)'),
      limit: z.number().optional().describe('Maximum entries to return (default: 100)'),
      tabId: z.string().optional().describe('Optional tab ID to target a background tab instead of the active tab'),
    }),
    async ({ domain, type, failed, limit, tabId }: any) => {
      const params = new URLSearchParams();
      if (domain) params.set('domain', domain);
      if (type) params.set('type', type);
      if (failed !== undefined) params.set('failed', String(failed));
      if (limit !== undefined) params.set('limit', String(limit));
      const qs = params.toString();
      const endpoint = qs ? `/devtools/network?${qs}` : '/devtools/network';
      const data = await apiCall('GET', endpoint, undefined, tabHeaders(tabId));
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_devtools_network_body',
    'Get the response body for a specific network request captured via CDP. Use requestId from tandem_devtools_network results.',
    {
      requestId: z.string().describe('The request ID from DevTools network entries'),
    },
    async ({ requestId }) => {
      const data = await apiCall('GET', `/devtools/network/${encodeURIComponent(requestId)}/body`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_devtools_network_clear',
    'Clear the DevTools network log buffer. Removes all captured network entries.',
    async () => {
      const data = await apiCall('POST', '/devtools/network/clear');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_devtools_evaluate',
    'Evaluate a JavaScript expression via CDP Runtime in the active tab. Returns the result. Use for inspecting page state, reading variables, or running diagnostic code. Supports targeting a background tab by ID. WARNING: This can modify page state.',
    {
      expression: z.string().describe('JavaScript expression to evaluate'),
      tabId: z.string().optional().describe('Optional tab ID to target a background tab instead of the active tab'),
    },
    {
      destructiveHint: true,
      readOnlyHint: false,
      openWorldHint: true,
    },
    async ({ expression, tabId }) => {
      const data = await apiCall('POST', '/devtools/evaluate', { expression }, tabHeaders(tabId));
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_devtools_dom_query',
    'Query the DOM by CSS selector via CDP. Returns matching nodes with their attributes and text content. Use to inspect page structure without executing JavaScript. Supports targeting a background tab by ID.',
    {
      selector: z.string().describe('CSS selector to query'),
      tabId: z.string().optional().describe('Optional tab ID to target a background tab instead of the active tab'),
    },
    async ({ selector, tabId }) => {
      const data = await apiCall('POST', '/devtools/dom/query', { selector }, tabHeaders(tabId));
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_devtools_dom_xpath',
    'Query the DOM by XPath expression via CDP. Returns matching nodes with their attributes and text content. Supports targeting a background tab by ID.',
    {
      expression: z.string().describe('XPath expression to evaluate'),
      tabId: z.string().optional().describe('Optional tab ID to target a background tab instead of the active tab'),
    },
    async ({ expression, tabId }) => {
      const data = await apiCall('POST', '/devtools/dom/xpath', { expression }, tabHeaders(tabId));
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_devtools_performance',
    'Get performance metrics from the browser via CDP. Includes timing data like DOM content loaded, first paint, layout counts, and memory usage. Supports targeting a background tab by ID.',
    {
      tabId: z.string().optional().describe('Optional tab ID to target a background tab instead of the active tab'),
    },
    async ({ tabId }) => {
      const data = await apiCall('GET', '/devtools/performance', undefined, tabHeaders(tabId));
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_devtools_storage',
    'Get browser storage data (cookies, localStorage, sessionStorage) for the current page via CDP. Supports targeting a background tab by ID.',
    {
      tabId: z.string().optional().describe('Optional tab ID to target a background tab instead of the active tab'),
    },
    async ({ tabId }) => {
      const data = await apiCall('GET', '/devtools/storage', undefined, tabHeaders(tabId));
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_devtools_screenshot_element',
    'Take a screenshot of a specific DOM element by CSS selector. Returns the screenshot as a PNG image. Supports targeting a background tab by ID.',
    {
      selector: z.string().describe('CSS selector of the element to screenshot'),
      tabId: z.string().optional().describe('Optional tab ID to target a background tab instead of the active tab'),
    },
    async ({ selector, tabId }) => {
      const base64 = await apiCall('POST', '/devtools/screenshot/element', { selector }, tabHeaders(tabId));
      await logActivity('screenshot_element', selector);
      return {
        content: [{
          type: 'image',
          data: base64,
          mimeType: 'image/png',
        }],
      };
    }
  );

  server.tool(
    'tandem_devtools_status',
    'Get the current status of the DevTools manager. Shows whether DevTools is connected and available.',
    async () => {
      const data = await apiCall('GET', '/devtools/status');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_devtools_cdp',
    'Send a raw Chrome DevTools Protocol (CDP) command. WARNING: This is a powerful low-level tool that can modify browser state.',
    {
      method: z.string().describe('CDP method name (e.g. "Page.reload", "DOM.getDocument")'),
      params: z.object({}).passthrough().optional().describe('Optional CDP method parameters'),
    },
    {
      destructiveHint: true,
      readOnlyHint: false,
      openWorldHint: true,
    },
    async ({ method, params }) => {
      const data = await apiCall('POST', '/devtools/cdp', { method, params });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_devtools_toggle',
    'Toggle DevTools open/closed for the active tab.',
    async () => {
      const data = await apiCall('POST', '/devtools/toggle');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );
}
