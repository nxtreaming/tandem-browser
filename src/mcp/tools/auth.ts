import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../api-client.js';

export function registerAuthTools(server: McpServer): void {
  server.tool(
    'tandem_auth_states',
    'Get all detected authentication states across visited domains. Shows login status for each domain the browser has tracked.',
    async () => {
      const data = await apiCall('GET', '/auth/states');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_auth_state',
    'Get the detected authentication state for a specific domain.',
    {
      domain: z.string().describe('Domain to check auth state for (e.g. "github.com")'),
    },
    async ({ domain }) => {
      const data = await apiCall('GET', `/auth/state/${encodeURIComponent(domain)}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_auth_check',
    'Check the authentication state of the current page. Analyzes the active tab to detect login forms, logged-in indicators, and auth cookies.',
    async () => {
      const data = await apiCall('POST', '/auth/check');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'tandem_auth_is_login_page',
    'Check if the current page is a login page. Uses heuristics to detect login forms and authentication UI.',
    async () => {
      const data = await apiCall('GET', '/auth/is-login-page');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );
}
