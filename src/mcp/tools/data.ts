import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall, logActivity } from '../api-client.js';

export function registerDataTools(server: McpServer): void {
  server.tool(
    'tandem_data_export',
    'Export all user data (config, chat history, behavior stats) as JSON.',
    async () => {
      const data = await apiCall('GET', '/data/export');
      await logActivity('data_export');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_data_import',
    'Import user data from a previously exported JSON blob. This overwrites existing data.',
    {
      data: z.object({}).passthrough().describe('The data object from a previous export'),
    },
    {
      destructiveHint: true,
      readOnlyHint: false,
    },
    async ({ data }) => {
      const result = await apiCall('POST', '/data/import', data);
      await logActivity('data_import');
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'tandem_data_wipe',
    'Wipe all user data. This is irreversible — all bookmarks, history, config, and other data will be deleted.',
    {},
    {
      destructiveHint: true,
      readOnlyHint: false,
    },
    async () => {
      const data = await apiCall('POST', '/data/wipe');
      await logActivity('data_wipe', 'all data');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_downloads_list',
    'List all downloads (completed, failed, and cancelled).',
    async () => {
      const data = await apiCall('GET', '/downloads');
      await logActivity('downloads_list');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_downloads_active',
    'List currently active (in-progress) downloads.',
    async () => {
      const data = await apiCall('GET', '/downloads/active');
      await logActivity('downloads_active');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_config_get',
    'Get the current Tandem browser configuration.',
    async () => {
      const data = await apiCall('GET', '/config');
      await logActivity('config_get');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_config_update',
    'Update Tandem browser configuration settings. Pass an object with the settings to change.',
    {
      settings: z.object({}).passthrough().describe('Configuration settings to update'),
    },
    async ({ settings }) => {
      const data = await apiCall('PATCH', '/config', settings);
      await logActivity('config_update');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_get_cookies',
    'Get browser cookies, optionally filtered by URL.',
    {
      url: z.string().optional().describe('URL to filter cookies for'),
    },
    async ({ url }) => {
      const params = new URLSearchParams();
      if (url) params.set('url', url);
      const qs = params.toString();
      const endpoint = qs ? `/cookies?${qs}` : '/cookies';
      const data = await apiCall('GET', endpoint);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_clear_cookies',
    'Clear browser cookies, optionally filtered by domain.',
    {
      domain: z.string().optional().describe('Domain to clear cookies for (clears all if omitted)'),
    },
    async ({ domain }) => {
      const body: Record<string, unknown> = {};
      if (domain) body.domain = domain;
      const data = await apiCall('POST', '/cookies/clear', body);
      await logActivity('clear_cookies', domain ? `domain: ${domain}` : 'all cookies');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );
}
