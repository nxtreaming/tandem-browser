import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall, logActivity } from '../api-client.js';

export function registerExtensionTools(server: McpServer): void {
  server.tool(
    'tandem_extensions_list',
    'List all loaded and available browser extensions with conflict info.',
    async () => {
      const data = await apiCall('GET', '/extensions/list');
      await logActivity('extensions_list');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_extension_load',
    'Load a browser extension from a local directory path.',
    {
      path: z.string().describe('Absolute path to the extension directory'),
    },
    async ({ path: extPath }) => {
      const data = await apiCall('POST', '/extensions/load', { path: extPath });
      await logActivity('extension_load', extPath);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_extension_install',
    'Install a browser extension from the Chrome Web Store. Accepts a CWS URL or extension ID.',
    {
      input: z.string().describe('Chrome Web Store URL or extension ID'),
    },
    async ({ input }) => {
      const data = await apiCall('POST', '/extensions/install', { input });
      await logActivity('extension_install', input);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_extension_uninstall',
    'Uninstall a browser extension by its ID. Removes from session and disk.',
    {
      id: z.string().describe('Extension ID (32 lowercase a-p characters)'),
    },
    {
      destructiveHint: true,
      readOnlyHint: false,
      openWorldHint: false,
    },
    async ({ id }) => {
      const data = await apiCall('DELETE', `/extensions/uninstall/${encodeURIComponent(id)}`);
      await logActivity('extension_uninstall', id);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );
}
