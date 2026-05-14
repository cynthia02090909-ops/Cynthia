const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// PostgreSQL connection
// Render 免费 PostgreSQL 会自动设置 DATABASE_URL 环境变量
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/taskapp',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Allow large payloads (for base64 images)
app.use(express.json({ limit: '50mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ===== Database setup =====
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_data (
      id INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // Ensure at least one row exists
  const result = await pool.query('SELECT id FROM task_data WHERE id = 1');
  if (result.rows.length === 0) {
    await pool.query(
      'INSERT INTO task_data (id, data) VALUES (1, $1)',
      [JSON.stringify({ students: [], groups: [], nextGroupId: 1 })]
    );
  }
  console.log('✅ Database ready');
}

// ===== Helpers =====
async function loadData() {
  try {
    const result = await pool.query('SELECT data FROM task_data WHERE id = 1');
    if (result.rows.length > 0) {
      return result.rows[0].data;
    }
  } catch (e) {
    console.error('Load error:', e.message);
  }
  return { students: [], groups: [], nextGroupId: 1 };
}

async function saveData(data) {
  try {
    await pool.query(
      'UPDATE task_data SET data = $1, updated_at = NOW() WHERE id = 1',
      [JSON.stringify(data)]
    );
    return true;
  } catch (e) {
    console.error('Save error:', e.message);
    return false;
  }
}

// ===== API Routes =====

// GET /api/data — 获取全部数据
app.get('/api/data', async (req, res) => {
  const data = await loadData();
  res.json({ ok: true, data });
});

// POST /api/data — 保存全部数据
app.post('/api/data', async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ ok: false, error: 'Invalid data' });
  }
  const success = await saveData(req.body);
  if (success) {
    res.json({ ok: true });
  } else {
    res.status(500).json({ ok: false, error: 'Failed to save data' });
  }
});

// GET /api/status — 健康检查
app.get('/api/status', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ===== Start =====
async function start() {
  try {
    await initDB();
    app.listen(PORT, '0.0.0.0', () => {
      console.log('================================================');
      console.log('  📚 每日任务管理系统 - 服务已启动');
      console.log('================================================');
      console.log(`  地址: http://0.0.0.0:${PORT}`);
      console.log(`  API:  /api/data`);
      console.log(`  数据库: PostgreSQL`);
      console.log('================================================');
    });
  } catch (e) {
    console.error('Failed to start:', e.message);
    process.exit(1);
  }
}
start();
