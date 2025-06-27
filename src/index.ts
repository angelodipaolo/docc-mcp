#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { DocCArchiveManager } from './docc-manager.js';

// Parse command line arguments for archive paths
function parseArchivePaths(): string[] {
  const args = process.argv.slice(2);
  const archivePaths: string[] = [];
  
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
DocC MCP Server - Expose Apple DocC documentation to AI agents

Usage: node dist/index.js --archive-path <path> [options]

Options:
  --archive-path <path>    Directory containing .doccarchive files (can be repeated) [REQUIRED]
  --help, -h               Show this help message

Examples:
  node dist/index.js --archive-path ./docs --archive-path ~/my-docs
  node dist/index.js --archive-path "~/Library/Developer/Xcode/DerivedData"

At least one --archive-path must be specified.
`);
    process.exit(0);
  }
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--archive-path' && i + 1 < args.length) {
      archivePaths.push(args[i + 1]);
      i++; // Skip the next argument since we consumed it
    } else if (args[i].startsWith('--archive-path=')) {
      archivePaths.push(args[i].substring('--archive-path='.length));
    }
  }
  
  return archivePaths;
}

// Initialize the DocC archive manager with configured paths
const archivePaths = parseArchivePaths();
if (archivePaths.length === 0) {
  console.error('❌ Error: No archive paths specified. Use --archive-path to specify directories containing .doccarchive files.');
  process.exit(1);
}
const doccManager = new DocCArchiveManager(archivePaths);

// Initialize MCP server
const server = new Server(
  {
    name: 'docc-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const SEARCH_TOOL: Tool = {
  name: 'search_docc',
  description: 'Search DocC documentation for symbols, types, or content',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for documentation content',
      },
      archive: {
        type: 'string',
        description: 'Specific DocC archive name to search in (optional)',
      },
      type: {
        type: 'string',
        enum: ['symbol', 'type', 'function', 'class', 'struct', 'enum', 'protocol'],
        description: 'Filter by symbol type (optional)',
      },
    },
    required: ['query'],
  },
};

const GET_SYMBOL_TOOL: Tool = {
  name: 'get_symbol',
  description: 'Get detailed information about a specific symbol',
  inputSchema: {
    type: 'object',
    properties: {
      symbolId: {
        type: 'string',
        description: 'Symbol identifier or path',
      },
      archive: {
        type: 'string',
        description: 'DocC archive name',
      },
      includeReferences: {
        type: 'boolean',
        description: 'Include symbol references (default: false for large responses)',
      },
      maxSections: {
        type: 'number',
        description: 'Maximum number of content sections to include (default: 10)',
      },
      summaryOnly: {
        type: 'boolean',
        description: 'Return only essential symbol information (title, abstract, basic usage)',
      },
    },
    required: ['symbolId', 'archive'],
  },
};

const LIST_ARCHIVES_TOOL: Tool = {
  name: 'list_archives',
  description: 'List all available DocC archives',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const BROWSE_ARCHIVE_TOOL: Tool = {
  name: 'browse_archive',
  description: 'Browse the structure of a DocC archive',
  inputSchema: {
    type: 'object',
    properties: {
      archive: {
        type: 'string',
        description: 'DocC archive name to browse',
      },
      path: {
        type: 'string',
        description: 'Path within the archive to browse (optional)',
      },
    },
    required: ['archive'],
  },
};

const GET_ARTICLE_TOOL: Tool = {
  name: 'get_article',
  description: 'Get detailed information about a specific article or tutorial',
  inputSchema: {
    type: 'object',
    properties: {
      articleId: {
        type: 'string',
        description: 'Article or tutorial identifier or path',
      },
      archive: {
        type: 'string',
        description: 'DocC archive name',
      },
    },
    required: ['articleId', 'archive'],
  },
};

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [SEARCH_TOOL, GET_SYMBOL_TOOL, GET_ARTICLE_TOOL, LIST_ARCHIVES_TOOL, BROWSE_ARCHIVE_TOOL],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_docc': {
        const { query, archive, type } = args as {
          query: string;
          archive?: string;
          type?: string;
        };
        const results = await doccManager.search(query, { archive, type });
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      }

      case 'get_symbol': {
        const { symbolId, archive, includeReferences, maxSections, summaryOnly } = args as { 
          symbolId: string; 
          archive: string;
          includeReferences?: boolean;
          maxSections?: number;
          summaryOnly?: boolean;
        };
        const symbol = await doccManager.getSymbol(symbolId, archive, {
          includeReferences,
          maxSections,
          summaryOnly
        });
        return { content: [{ type: 'text', text: JSON.stringify(symbol, null, 2) }] };
      }

      case 'list_archives': {
        const archives = await doccManager.listArchives();
        return { content: [{ type: 'text', text: JSON.stringify(archives, null, 2) }] };
      }

      case 'get_article': {
        const { articleId, archive } = args as { articleId: string; archive: string };
        const article = await doccManager.getArticle(articleId, archive);
        return { content: [{ type: 'text', text: JSON.stringify(article, null, 2) }] };
      }

      case 'browse_archive': {
        const { archive, path } = args as { archive: string; path?: string };
        const structure = await doccManager.browseArchive(archive, path);
        return { content: [{ type: 'text', text: JSON.stringify(structure, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('DocC MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});