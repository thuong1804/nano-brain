import 'dotenv/config';
import {
    initDb,
    saveMemory,
    searchSimilarMemory,
    listRecentMemories,
    deleteMemory,
    pool,
} from './db.js';

async function test() {
    console.log('=== START TESTING NANO-BRAIN DB & PGVECTOR ===\n');

    // 1. Automatically initialize database schema
    console.log('1. Initializing schema (initDb)...');
    await initDb();
    console.log('   ✓ Vector extension and memories table are ready.');

    // 2. Generate mock vector (768 dimensions compatible with gemini-embedding-001)
    const dummyVector = new Array(768).fill(0.01);

    // 3. Test saving a memory record
    console.log('\n2. Testing memory insertion (saveMemory)...');
    const saved = await saveMemory(
        'This is a test knowledge entry for nano-brain local system',
        dummyVector,
        'test-suite'
    );
    console.log('   ✓ Successfully saved entry with ID:', saved.id);

    // 4. Test similarity search
    console.log('\n3. Testing similarity search (searchSimilarMemory)...');
    const searchResults = await searchSimilarMemory(dummyVector, 2, 'test-suite');
    console.log(`   ✓ Found ${searchResults.length} matching results:`, searchResults.map((r: any) => ({
        id: r.id,
        content: r.content,
        similarity: Number(r.similarity).toFixed(4),
    })));

    // 5. Test listing recent memories
    console.log('\n4. Testing listing recent memories (listRecentMemories)...');
    const recent = await listRecentMemories(3);
    console.log(`   ✓ Retrieved ${recent.length} recent entries.`);

    // 6. Test deleting the created test record
    console.log('\n5. Cleaning up test entry (deleteMemory)...');
    const deleted = await deleteMemory(saved.id);
    console.log(`   ✓ Delete status for ID ${saved.id}:`, deleted ? 'Success' : 'Failed');

    await pool.end();
    console.log('\n=== COMPLETED ALL TESTS SUCCESSFULLY ===');
}

test().catch(async (err) => {
    console.error('Database test error:', err.message);
    await pool.end();
    process.exit(1);
});