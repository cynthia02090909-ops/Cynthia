const express = require('express');
const { Pool } = require('pg');
const app = express();
const path = require('path');

// 必须用这个端口，Vercel 才能运行
const PORT = process.env.PORT || 3000;

// 解析 JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 数据库连接（自动适配 Vercel + Neon）
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// 初始化数据库表
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_data (
        id SERIAL PRIMARY KEY,
        data JSONB NOT NULL
      )
    `);
    console.log('✅ 数据库表初始化成功');
  } catch (err) {
    console.error('❌ 数据库初始化失败', err);
  }
}
initDB();

// 读取数据
async function loadData() {
  const result = await pool.query('SELECT data FROM task_data ORDER BY id DESC LIMIT 1');
  if (result.rows.length > 0) {
    return result.rows[0].data;
  }
  return {
    students: [],
    groups: [],
    tasks: [],
    submissions: []
  };
}

// 保存数据
async function saveData(data) {
  await pool.query('INSERT INTO task_data (data) VALUES ($1)', [data]);
}

// 首页（动态内容）
app.get('/', async (req, res) => {
  const data = await loadData();
  res.send(`
    <h1>🎓 学生任务管理系统</h1>
    <p>服务运行正常 🚀</p>
    <p>学生数量：${data.students.length}</p>
    <p>分组数量：${data.groups.length}</p>
    <p>当前时间：${new Date().toLocaleString()}</p>
  `);
});

// API：获取所有数据
app.get('/api/data', async (req, res) => {
  try {
    const data = await loadData();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API：保存数据
app.post('/api/data', async (req, res) => {
  try {
    await saveData(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 404 处理
app.all('*', (req, res) => {
  res.status(404).send(`<h1>404 - 页面不存在</h1><a href="/">返回首页</a>`);
});

// 启动服务
app.listen(PORT, () => {
  console.log(`✅ 服务已启动：http://localhost:${PORT}`);
});

module.exports = app;
