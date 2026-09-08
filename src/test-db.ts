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
    console.log('=== BẮT ĐẦU KIỂM TRA NANO-BRAIN DB & PGVECTOR ===\n');

    // 1. Tự động khởi tạo DB schema
    console.log('1. Khởi tạo schema (initDb)...');
    await initDb();
    console.log('   ✓ Đã kích hoạt extension vector và bảng memories.');

    // 2. Tạo vector giả lập (768 chiều tương thích text-embedding-004)
    const dummyVector = new Array(768).fill(0.01);

    // 3. Lưu thử dữ liệu
    console.log('\n2. Lưu thử ký ức (saveMemory)...');
    const saved = await saveMemory(
        'Đây là kiến thức kiểm tra hệ thống nano-brain local',
        dummyVector,
        'test-suite'
    );
    console.log('   ✓ Đã lưu thành công bản ghi ID:', saved.id);

    // 4. Tìm kiếm thử dữ liệu theo vector
    console.log('\n3. Tìm kiếm tương đồng (searchSimilarMemory)...');
    const searchResults = await searchSimilarMemory(dummyVector, 2, 'test-suite');
    console.log(`   ✓ Tìm thấy ${searchResults.length} kết quả phù hợp:`, searchResults.map((r: any) => ({
        id: r.id,
        content: r.content,
        similarity: Number(r.similarity).toFixed(4),
    })));

    // 5. Liệt kê ký ức gần đây
    console.log('\n4. Liệt kê ký ức gần đây (listRecentMemories)...');
    const recent = await listRecentMemories(3);
    console.log(`   ✓ Lấy được ${recent.length} bản ghi gần nhất.`);

    // 6. Xóa ký ức vừa tạo
    console.log('\n5. Dọn dẹp bản ghi kiểm tra (deleteMemory)...');
    const deleted = await deleteMemory(saved.id);
    console.log(`   ✓ Trạng thái xóa ID ${saved.id}:`, deleted ? 'Thành công' : 'Thất bại');

    await pool.end();
    console.log('\n=== HOÀN TẤT KIỂM TRA TOÀN BỘ CHỨC NĂNG ===');
}

test().catch(async (err) => {
    console.error('Lỗi khi kiểm tra DB:', err.message);
    await pool.end();
    process.exit(1);
});