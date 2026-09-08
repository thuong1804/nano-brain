import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const { Pool } = pg;

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Initialize pgvector extension, memories table, and HNSW index
export async function initDb() {
    await pool.query(`
        CREATE EXTENSION IF NOT EXISTS vector;
        CREATE TABLE IF NOT EXISTS memories (
            id SERIAL PRIMARY KEY,
            content TEXT NOT NULL,
            embedding vector(768),
            source VARCHAR(100) DEFAULT 'general',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS memories_embedding_idx ON memories USING hnsw (embedding vector_cosine_ops);
    `);
}

// Store a memory record with its embedding vector into the database
export async function saveMemory(content: string, embedding: number[], source: string = 'general') {
    const vectorStr = `[${embedding.join(',')}]`;
    const query = `
        INSERT INTO memories (content, embedding, source)
        VALUES ($1, $2, $3)
        RETURNING id, content, source, created_at;
    `;
    const res = await pool.query(query, [content, vectorStr, source]);
    return res.rows[0];
}

// Search for similar memories using Cosine Similarity (with optional source filtering)
export async function searchSimilarMemory(embedding: number[], limit: number = 5, source?: string) {
    const vectorStr = `[${embedding.join(',')}]`;

    if (source) {
        const query = `
            SELECT id, content, source, 1 - (embedding <=> $1) AS similarity, created_at
            FROM memories 
            WHERE source = $2
            ORDER BY embedding <=> $1 
            LIMIT $3;
        `;
        const res = await pool.query(query, [vectorStr, source, limit]);
        return res.rows;
    }

    const query = `
            SELECT id, content, source, 1 - (embedding <=> $1) AS similarity, created_at
            FROM memories 
            ORDER BY embedding <=> $1 
            LIMIT $2;
        `;
    const res = await pool.query(query, [vectorStr, limit]);
    return res.rows;
}

// Retrieve the most recent memory records
export async function listRecentMemories(limit: number = 10, source?: string) {
    if (source) {
        const query = `
            SELECT id, content, source, created_at
            FROM memories
            WHERE source = $1
            ORDER BY created_at DESC
            LIMIT $2;
        `;
        const res = await pool.query(query, [source, limit]);
        return res.rows;
    }

    const query = `
        SELECT id, content, source, created_at
        FROM memories
        ORDER BY created_at DESC
        LIMIT $1;
    `;
    const res = await pool.query(query, [limit]);
    return res.rows;
}

// Delete a memory record by ID
export async function deleteMemory(id: number) {
    const query = `
        DELETE FROM memories
        WHERE id = $1
        RETURNING id;
    `;
    const res = await pool.query(query, [id]);
    return res.rowCount !== null && res.rowCount > 0;
}