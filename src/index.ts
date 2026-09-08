#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
    initDb,
    saveMemory,
    searchSimilarMemory,
    listRecentMemories,
    deleteMemory,
} from './db.js';
import { getEmbedding } from './embeddings.js';

const server = new Server(
    {
        name: 'nano-brain',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// 1. Register tools with the MCP Client
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'memory_query',
                description: 'Retrieve context, solutions, rules, or saved knowledge from long-term memory via semantic similarity search',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'The search query, question, or keywords to look up relevant context',
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum number of results to return (default: 5)',
                        },
                        source: {
                            type: 'string',
                            description: 'Optional filter by source tag (e.g., cursor, antigravity, project-name)',
                        },
                    },
                    required: ['query'],
                },
            },
            {
                name: 'memory_save',
                description: 'Save learnings, architectural decisions, code conventions, solutions, or key findings into persistent long-term memory',
                inputSchema: {
                    type: 'object',
                    properties: {
                        content: {
                            type: 'string',
                            description: 'The detailed knowledge or information to memorize',
                        },
                        source: {
                            type: 'string',
                            description: 'Source or namespace tag (e.g., cursor, antigravity, project-name, manual) - defaults to manual',
                        },
                    },
                    required: ['content'],
                },
            },
            {
                name: 'memory_list',
                description: 'List the most recently saved memories ordered by creation time',
                inputSchema: {
                    type: 'object',
                    properties: {
                        limit: {
                            type: 'number',
                            description: 'Number of recent entries to retrieve (default: 10)',
                        },
                        source: {
                            type: 'string',
                            description: 'Optional filter by source tag',
                        },
                    },
                },
            },
            {
                name: 'memory_delete',
                description: 'Delete a specific memory entry by its unique ID',
                inputSchema: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'number',
                            description: 'The numeric ID of the memory entry to delete',
                        },
                    },
                    required: ['id'],
                },
            },
        ],
    };
});

// 2. Handle tool invocation from the MCP Client
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        if (name === 'memory_query') {
            const query = String(args?.query);
            const limit = Number(args?.limit) || 5;
            const source = args?.source ? String(args.source) : undefined;

            const vector = await getEmbedding(query);
            const results = await searchSimilarMemory(vector, limit, source);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(results, null, 2),
                    },
                ],
            };
        }

        if (name === 'memory_save') {
            const content = String(args?.content);
            const source = String(args?.source || 'manual');

            const vector = await getEmbedding(content);
            const saved = await saveMemory(content, vector, source);

            return {
                content: [
                    {
                        type: 'text',
                        text: `Successfully saved to memory with ID: ${saved.id} (Source: ${saved.source})`,
                    },
                ],
            };
        }

        if (name === 'memory_list') {
            const limit = Number(args?.limit) || 10;
            const source = args?.source ? String(args.source) : undefined;

            const results = await listRecentMemories(limit, source);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(results, null, 2),
                    },
                ],
            };
        }

        if (name === 'memory_delete') {
            const id = Number(args?.id);
            if (!id || isNaN(id)) {
                throw new Error('The id argument must be a valid number.');
            }

            const deleted = await deleteMemory(id);

            return {
                content: [
                    {
                        type: 'text',
                        text: deleted
                            ? `Successfully deleted memory ID: ${id}`
                            : `Memory with ID: ${id} not found`,
                    },
                ],
            };
        }

        throw new Error(`Unknown tool: ${name}`);
    } catch (error: any) {
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: `Execution error: ${error.message}`,
                },
            ],
        };
    }
});

// 3. Start the MCP Server via stdio transport
async function main() {
    try {
        await initDb();
        console.error('[nano-brain] Connected to database and ensured memories table / pgvector extension are ready.');
    } catch (dbErr: any) {
        console.error('[nano-brain] DB connection/initialization warning:', dbErr.message);
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[nano-brain] nano-brain MCP Server running on stdio...');
}

main().catch((err) => {
    console.error('[nano-brain] Fatal server startup error:', err);
    process.exit(1);
});