import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall, tabHeaders, logActivity } from '../api-client.js';

export function registerSnapshotTools(server: McpServer): void {
  server.tool(
    'tandem_snapshot',
    'Get the accessibility tree of the page with @ref IDs for element interaction. Supports targeting a background tab by ID.',
    {
      tabId: z.string().optional().describe('Optional tab ID to target a background tab instead of the active tab'),
      compact: z.boolean().optional().describe('Return a compact snapshot (fewer details)'),
      interactive: z.boolean().optional().describe('Only include interactive elements'),
      selector: z.string().optional().describe('CSS selector to scope the snapshot to a subtree'),
    },
    async ({ tabId, compact, interactive, selector }) => {
      const params = new URLSearchParams();
      if (compact) params.set('compact', 'true');
      if (interactive) params.set('interactive', 'true');
      if (selector) params.set('selector', selector);
      const qs = params.toString();
      const endpoint = qs ? `/snapshot?${qs}` : '/snapshot';
      const data = await apiCall('GET', endpoint, undefined, tabHeaders(tabId));
      await logActivity('snapshot', `${data.count ?? 0} nodes`);
      return { content: [{ type: 'text', text: data.snapshot || '' }] };
    }
  );

  server.tool(
    'tandem_snapshot_click',
    'Click an element by its @ref ID from a previous snapshot. Supports targeting a background tab by ID.',
    {
      ref: z.string().describe('The @ref ID of the element to click (e.g. "@e1")'),
      tabId: z.string().optional().describe('Optional tab ID to target a background tab instead of the active tab'),
    },
    async ({ ref, tabId }) => {
      await apiCall('POST', '/snapshot/click', { ref }, tabHeaders(tabId));
      await logActivity('snapshot_click', ref);
      return { content: [{ type: 'text', text: `Clicked element ${ref}` }] };
    }
  );

  server.tool(
    'tandem_snapshot_fill',
    'Fill an input element by its @ref ID from a previous snapshot. Supports targeting a background tab by ID.',
    {
      ref: z.string().describe('The @ref ID of the input element (e.g. "@e3")'),
      value: z.string().describe('The value to fill into the input'),
      tabId: z.string().optional().describe('Optional tab ID to target a background tab instead of the active tab'),
    },
    async ({ ref, value, tabId }) => {
      await apiCall('POST', '/snapshot/fill', { ref, value }, tabHeaders(tabId));
      await logActivity('snapshot_fill', `${ref}: "${value.substring(0, 50)}"`);
      return { content: [{ type: 'text', text: `Filled element ${ref} with "${value}"` }] };
    }
  );

  server.tool(
    'tandem_snapshot_text',
    'Get the text content of an element by its @ref ID from a previous snapshot. Supports targeting a background tab by ID.',
    {
      ref: z.string().describe('The @ref ID of the element (e.g. "@e1")'),
      tabId: z.string().optional().describe('Optional tab ID to target a background tab instead of the active tab'),
    },
    async ({ ref, tabId }) => {
      const params = new URLSearchParams({ ref });
      const data = await apiCall('GET', `/snapshot/text?${params.toString()}`, undefined, tabHeaders(tabId));
      await logActivity('snapshot_text', ref);
      return { content: [{ type: 'text', text: data.text ?? '' }] };
    }
  );

  server.tool(
    'tandem_find',
    'Find elements on the page by semantic locator (role, text, label, or placeholder). Supports targeting a background tab by ID.',
    {
      by: z.enum(['role', 'text', 'label', 'placeholder']).describe('Locator strategy'),
      value: z.string().describe('Value to search for'),
      tabId: z.string().optional().describe('Optional tab ID to target a background tab instead of the active tab'),
    },
    async ({ by, value, tabId }) => {
      const result = await apiCall('POST', '/find', { by, value }, tabHeaders(tabId));
      await logActivity('find', `${by}="${value}"`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'tandem_find_click',
    'Find an element by semantic locator and click it. Supports targeting a background tab by ID.',
    {
      by: z.enum(['role', 'text', 'label', 'placeholder']).describe('Locator strategy'),
      value: z.string().describe('Value to search for'),
      tabId: z.string().optional().describe('Optional tab ID to target a background tab instead of the active tab'),
    },
    async ({ by, value, tabId }) => {
      const result = await apiCall('POST', '/find/click', { by, value }, tabHeaders(tabId));
      await logActivity('find_click', `${by}="${value}"`);
      return { content: [{ type: 'text', text: `Clicked element found by ${by}="${value}" (ref: ${result.ref})` }] };
    }
  );

  server.tool(
    'tandem_find_fill',
    'Find an input element by semantic locator and fill it with text. Supports targeting a background tab by ID.',
    {
      by: z.enum(['role', 'text', 'label', 'placeholder']).describe('Locator strategy'),
      value: z.string().describe('Value to search for the element'),
      text: z.string().describe('Text to fill into the input'),
      tabId: z.string().optional().describe('Optional tab ID to target a background tab instead of the active tab'),
    },
    async ({ by, value, text, tabId }) => {
      const result = await apiCall('POST', '/find/fill', { by, value, fillValue: text }, tabHeaders(tabId));
      await logActivity('find_fill', `${by}="${value}": "${text.substring(0, 50)}"`);
      return { content: [{ type: 'text', text: `Filled element found by ${by}="${value}" with "${text}" (ref: ${result.ref})` }] };
    }
  );
}
