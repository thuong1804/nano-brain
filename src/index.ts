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

// 1. Khai báo danh sách Tool với Client
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'memory_query',
                description: 'Truy vấn ngữ cảnh, giải pháp, quy ước hoặc thông tin đã lưu trong bộ nhớ theo ngữ nghĩa tương đồng',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Câu hỏi hoặc từ khóa cần tra cứu ngữ cảnh',
                        },
                        limit: {
                            type: 'number',
                            description: 'Số lượng kết quả trả về tối đa (mặc định 5)',
                        },
                        source: {
                            type: 'string',
                            description: 'Lọc kết quả theo nguồn cụ thể (tùy chọn: cursor, antigravity, manual...)',
                        },
                    },
                    required: ['query'],
                },
            },
            {
                name: 'memory_save',
                description: 'Lưu lại bài học, quy ước kiến trúc, giải pháp hoặc ghi nhớ quan trọng vào bộ não',
                inputSchema: {
                    type: 'object',
                    properties: {
                        content: {
                            type: 'string',
                            description: 'Nội dung chi tiết cần ghi nhớ',
                        },
                        source: {
                            type: 'string',
                            description: 'Nguồn thông tin (cursor, antigravity, zed, manual...) - mặc định manual',
                        },
                    },
                    required: ['content'],
                },
            },
            {
                name: 'memory_list',
                description: 'Liệt kê danh sách các ký ức mới nhất đã lưu trong bộ não',
                inputSchema: {
                    type: 'object',
                    properties: {
                        limit: {
                            type: 'number',
                            description: 'Số lượng bản ghi cần lấy (mặc định 10)',
                        },
                        source: {
                            type: 'string',
                            description: 'Lọc theo nguồn (tùy chọn)',
                        },
                    },
                },
            },
            {
                name: 'memory_delete',
                description: 'Xóa một ghi nhớ khỏi bộ não dựa vào ID',
                inputSchema: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'number',
                            description: 'ID của bản ghi nhớ cần xóa',
                        },
                    },
                    required: ['id'],
                },
            },
        ],
    };
});

// 2. Xử lý logic khi Client gọi Tool
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
                        text: `Đã lưu thành công vào bộ nhớ với ID: ${saved.id} (Source: ${saved.source})`,
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
                throw new Error('Tham số id phải là số hợp lệ.');
            }

            const deleted = await deleteMemory(id);

            return {
                content: [
                    {
                        type: 'text',
                        text: deleted
                            ? `Đã xóa thành công ký ức ID: ${id}`
                            : `Không tìm thấy ký ức mang ID: ${id} để xóa`,
                    },
                ],
            };
        }

        throw new Error(`Tool không tồn tại: ${name}`);
    } catch (error: any) {
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: `Lỗi xử lý: ${error.message}`,
                },
            ],
        };
    }
});

// 3. Khởi chạy Server qua kênh giao tiếp stdio
async function main() {
    try {
        await initDb();
        console.error('[nano-brain] Đã kết nối DB và đảm bảo bảng memories / pgvector tồn tại.');
    } catch (dbErr: any) {
        console.error('[nano-brain] Cảnh báo kết nối/khởi tạo DB:', dbErr.message);
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[nano-brain] nano-brain MCP Server đang chạy qua stdio...');
}

main().catch((err) => {
    console.error('[nano-brain] Lỗi khởi động server:', err);
    process.exit(1);
});