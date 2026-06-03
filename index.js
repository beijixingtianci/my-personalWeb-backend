require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// 使用连接池连接 Supabase（端口 6543）
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 获取 Q&A 数据
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

// AI 对话（调用 DeepSeek）
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ error: 'message 不能为空' });
  }

  try {
    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是北极星.天赐的个人网站的AI助手。用简洁友好的中文回答访客的问题。北极星.天赐是韩国建国大学（건국대학교）大四学生，计算机专业，擅长 Vue3、Python、FastAPI、Godot 等技术，目前正在开发一款潜行Roguelike游戏的毕业设计。'
          },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 300,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const reply = response.data.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error('DeepSeek API 错误:', err.response?.data || err.message);
    res.status(500).json({ error: 'AI 服务暂时不可用，请稍后再试。' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});