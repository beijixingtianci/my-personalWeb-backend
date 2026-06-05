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

// 预设问答（优先匹配，秒回不消耗API）
const presetQA = [
  {
    keys: ['你是谁', '你谁', '介绍自己', '自我介绍', '你是'],
    reply: '我是北极星·天赐的个人AI助手！天赐是韩国建国大学计算机专业大四学生，正在做潜行Roguelike游戏毕业设计 🎮'
  },
  {
    keys: ['你会什么', '能做什么', '功能', '有什么用', '你能干嘛'],
    reply: '我可以聊天、回答技术问题、介绍天赐的项目经历。试试问我关于 Vue3、Python、Godot 的问题吧！'
  },
  {
    keys: ['毕业设计', '毕设', 'Roguelike'],
    reply: '天赐的毕设是一潜行Roguelike游戏, 算法层用 Python 实现（含视野计算、巡逻AI、关卡生成），客户端用 Godot 引擎。🎮'
  },
  {
    keys: ['技术栈', '技术', '会用什么', '擅长', '技能'],
    reply: '天赐擅长 Vue3、Python、FastAPI、Godot、Supabase、Node.js 等技术。个人网站用 Vue3 + Vite 构建，后端用 Express 部署在 Render 上。'
  },
  {
    keys: ['联系方式', '联系', '怎么找你', '邮箱', '怎么联系？'],
    reply: '欢迎通过本网站的链接找到天赐的 GitHub 和其他社交账号，就在右上角噢！'
  },
   {
    keys: ['在做什么项目', '作品'],
    reply: '目前在开发个人网页前端+后端+数据库。'
  }
]

// AI 对话（调用智谱 GLM）
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ error: 'message 不能为空' });
  }

  console.log('收到消息:', JSON.stringify(userMessage));

  // 先检查预设问答（秒回，不消耗API）
  const preset = presetQA.find(item =>
    item.keys.some(key => userMessage.includes(key) || key.includes(userMessage))
  );
  if (preset) {
    return res.json({ reply: preset.reply });
  }

  try {
    const response = await axios.post(
      'https://open.bigmodel.cn/api/paas/v4/chat/completions',  
      {
        model: 'glm-4-flash',  
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
          'Authorization': `Bearer ${process.env.GLM_API_KEY}`,  
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const reply = response.data.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error('GLM API 错误:', err.response?.data || err.message);
    res.status(500).json({ error: 'AI 服务暂时不可用，请稍后再试。' });
  }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});