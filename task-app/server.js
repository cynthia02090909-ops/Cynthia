const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');
app.use(cors());

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection
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
  // Ensure task_data row exists
  const result = await pool.query('SELECT id FROM task_data WHERE id = 1');
  if (result.rows.length === 0) {
    await pool.query(
      'INSERT INTO task_data (id, data) VALUES (1, $1)',
      [JSON.stringify({ users: [], groups: [], nextGroupId: 1 })]
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
  return { users: [], groups: [], nextGroupId: 1 };
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
  // Strip passwords when sending to frontend
  if (data.users) {
    data.users = data.users.map(u => ({ name: u.name, role: u.role }));
  }
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

// POST /api/register — 注册
app.post('/api/register', async (req, res) => {
  const { name, password, role } = req.body;

  if (!name || !name.trim()) {
    return res.json({ ok: false, error: '请输入姓名' });
  }
  if (!password || password.length < 3) {
    return res.json({ ok: false, error: '密码至少3位' });
  }
  if (!role || !['teacher', 'student'].includes(role)) {
    return res.json({ ok: false, error: '请选择身份' });
  }

  const data = await loadData();
  const nameTrimmed = name.trim();

  if (data.users && data.users.some(u => u.name === nameTrimmed)) {
    return res.json({ ok: false, error: '该姓名已被注册' });
  }

  if (!data.users) data.users = [];
  data.users.push({ name: nameTrimmed, password, role });
  const saved = await saveData(data);

  if (saved) {
    res.json({ ok: true, user: { name: nameTrimmed, role }, message: '注册成功' });
  } else {
    res.status(500).json({ ok: false, error: '注册失败，请重试' });
  }
});

// POST /api/login — 登录
app.post('/api/login', async (req, res) => {
  const { name, password } = req.body;
  if (!name || !name.trim()) {
    return res.json({ ok: false, error: '请输入姓名' });
  }
  if (!password) {
    return res.json({ ok: false, error: '请输入密码' });
  }
  const data = await loadData();
  const users = data.users || [];
  const user = users.find(u => u.name === name.trim());
  if (!user) {
    return res.json({ ok: false, error: '用户不存在，请先注册' });
  }
  if (user.password !== password) {
    return res.json({ ok: false, error: '密码错误' });
  }
  res.json({ ok: true, user: { name: user.name, role: user.role } });
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
      console.log(`  API:  /api/login, /api/register, /api/data`);
      console.log(`  数据库: PostgreSQL`);
      console.log('================================================');
    });
  } catch (e) {
    console.error('Failed to start:', e.message);
    process.exit(1);
  }
}
start();
