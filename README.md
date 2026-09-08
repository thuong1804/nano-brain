# nano-brain

A lightweight, long-term semantic memory [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server powered by **PostgreSQL (`pgvector`)** and **Google Gemini embeddings (`gemini-embedding-001`)**.

`nano-brain` enables AI assistants (Antigravity, Claude Desktop, Cursor, Zed, Windsurf, etc.) to store, retrieve, and manage persistent semantic knowledge, project conventions, architectural decisions, and session learnings across chats.

---

## Features

- **Semantic Memory Storage (`memory_save`)**: Automatically converts plain text into 768-dimensional embeddings using Gemini `gemini-embedding-001` (configured with MRL 768) and stores them in PostgreSQL.
- **Fast Similarity Search (`memory_query`)**: Uses cosine distance with an **HNSW index** in `pgvector` to perform real-time semantic retrieval, with optional source-based filtering.
- **Memory Inspection & Deletion (`memory_list`, `memory_delete`)**: Query recent memories or prune outdated entries by ID.
- **Auto Schema Provisioning**: On startup, automatically enables the `vector` extension, creates the `memories` table, and sets up the HNSW index if they do not exist.
- **Containerized Database**: Preconfigured `docker-compose.yml` using `pgvector/pgvector:pg16` for instant local setup.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│              MCP Client                          │
│   (Antigravity / Claude / Cursor / Zed / etc.)   │
└────────────────────────┬─────────────────────────┘
                         │ stdio (JSON-RPC)
┌────────────────────────▼─────────────────────────┐
│                 nano-brain                       │
│              (MCP Stdio Server)                  │
└───────────┬──────────────────────────┬───────────┘
            │ Gemini API               │ PostgreSQL Protocol
┌───────────▼───────────┐  ┌───────────▼───────────┐
│     Google Gemini     │  │  PostgreSQL (pg16)    │
│ (gemini-embedding-001)│  │  + pgvector (HNSW)    │
└───────────────────────┘  └───────────────────────┘
```

---

## Prerequisites

- **Node.js**: `v18.0.0` or higher
- **Docker & Docker Compose**: For running PostgreSQL with the `pgvector` extension
- **Google Gemini API Key**: Obtain one from [Google AI Studio](https://aistudio.google.com/)

---

## Quick Start

### 1. Clone & Install Dependencies

```bash
git clone <your-repo-url>
cd nano-brain
npm install
```

### 2. Start PostgreSQL with pgvector

Launch the database container defined in `docker-compose.yml`:

```bash
docker compose up -d
```

Verify that the container is healthy:

```bash
docker ps --filter "name=nano_brain_db"
```

### 3. Configure Environment Variables

Create a `.env` file in the project root (or copy from `.env.example`):

```bash
cp .env.example .env
```

Update the configuration:

```env
# PostgreSQL connection string with pgvector extension
DATABASE_URL=postgresql://postgres:081842000tT@localhost:5432/nano_brain

# Google Gemini API key for gemini-embedding-001
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Build the Project

Compile TypeScript into JavaScript:

```bash
npm run build
```

### 5. Verify the Setup

Run the automated test script to test schema initialization, memory insertion, vector search, and deletion:

```bash
npm run test-db
```

---

## MCP Client Configuration

Add `nano-brain` to your MCP client configuration.

### For Google Antigravity / Gemini IDE

Add the server to your `~/.gemini/config/mcp_config.json` or `.agents/mcp_config.json`:

```json
{
  "mcpServers": {
    "nano-brain": {
      "command": "node",
      "args": ["d:/personal/nano-brain/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:081842000tT@localhost:5432/nano_brain",
        "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY",
        "DOTENV_CONFIG_QUIET": "true"
      }
    }
  }
}
```

> **Note for Windows users**: Ensure you use forward slashes (`/`) or escaped backslashes (`\\\\`) in file paths.

### For Claude Desktop

Edit your `claude_desktop_config.json` (`%APPDATA%\\Claude\\claude_desktop_config.json` on Windows or `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "nano-brain": {
      "command": "node",
      "args": ["/path/to/nano-brain/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:password@localhost:5432/nano_brain",
        "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY"
      }
    }
  }
}
```

---

## Available MCP Tools

### 1. `memory_save`
Store important knowledge, architectural rules, bug fixes, or session findings into the persistent memory.

- **Parameters**:
  - `content` (*string*, required): The text content to store.
  - `source` (*string*, optional): Source or category tag (e.g., `'antigravity'`, `'cursor'`, `'architecture'`, `'manual'`). Default is `'manual'`.

- **Example Usage by AI**:
  ```json
  {
    "content": "All API endpoints must use bearer token authorization in the Authorization header.",
    "source": "api-conventions"
  }
  ```

---

### 2. `memory_query`
Perform semantic similarity search across stored memories using cosine distance.

- **Parameters**:
  - `query` (*string*, required): The question, topic, or keywords to look up.
  - `limit` (*number*, optional): Maximum number of results to return (default: `5`).
  - `source` (*string*, optional): Filter memories by specific source.

- **Example Usage by AI**:
  ```json
  {
    "query": "How are API endpoints authenticated?",
    "limit": 3
  }
  ```

---

### 3. `memory_list`
List the most recently saved memories ordered by creation time.

- **Parameters**:
  - `limit` (*number*, optional): Number of recent entries to fetch (default: `10`).
  - `source` (*string*, optional): Filter by source tag.

- **Example Usage by AI**:
  ```json
  {
    "limit": 5,
    "source": "api-conventions"
  }
  ```

---

### 4. `memory_delete`
Delete a specific memory by its unique numeric ID.

- **Parameters**:
  - `id` (*number*, required): The ID of the memory record to remove.

- **Example Usage by AI**:
  ```json
  {
    "id": 42
  }
  ```

---

## Database Schema

`nano-brain` manages the table and index structure automatically on connection:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS memories (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(768),
    source VARCHAR(100) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS memories_embedding_idx 
ON memories USING hnsw (embedding vector_cosine_ops);
```

---

## Development Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs the server in development mode using `tsx` |
| `npm run build` | Compiles TypeScript source to `./dist` |
| `npm start` | Runs the compiled server from `./dist/index.js` |
| `npm run test-db` | Executes database & vector similarity unit tests |

---

## License

This project is licensed under the [ISC License](LICENSE).
