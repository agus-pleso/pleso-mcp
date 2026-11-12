#!/usr/bin/env node
/** Local (stdio) entry point — for Claude Desktop, Gemini CLI, Cursor, VS Code, etc. */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PlesoWebCatalog } from './catalog.js';
import { createServer } from './server.js';

const server = createServer(new PlesoWebCatalog());
await server.connect(new StdioServerTransport());
