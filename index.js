require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 使用连接池连接 Supabase（端口 6543）
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get('/api/qa', async (req, res) => {
  try {
    const query = `
      SELECT 
        q.id, q.question, q.answer,
        c.id as category_id, c.title as category_title
      FROM qa_questions q
      JOIN qa_categories c ON q.category_id = c.id
      ORDER BY c.id, q.id
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});