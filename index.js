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
// ==================== 预设问答（个人网站） ====================
const personalPresetQA = [
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

// ==================== 预设问答（学生会网站） ====================
const studentPresetQA = [
  {
    keys: ['如何让AI鹅秘书更加智能？', '调教AI', '让AI更聪明', 'AI记忆'],
    reply: '添加作者微信，把你知道信息（问题和答案告诉我）。我通过调教ai，让他记住！'
  },
  {
    keys: ['联系方式？', '怎么联系', '联系学生会', '学生会联系方式'],
    reply: '点击右上角的联系我们，添加作者微信！'
  }
  // ── 关于学生会 ──
  {
    keys: ['加入', '入会', '如何加入学生会', '加入学生会'],
    reply: '点击"联系我们"或本页的"加入我们"按钮，扫描微信二维码，备注"姓名+学科"，即可咨询入会事宜'
  },
  {
    keys: ['面试', '加入学生会需要面试', '需要面试吗'],
    reply: '通常需要简单面试，主要了解你的意向和特长，欢迎积极参与'
  },
  {
    keys: ['招新', '学生会招新', '什么时候招新', '招新时间'],
    reply: '每学期初开学（3月和9月）会发布招新公告，请关注公众号或群通知'
  },

  // ── 生活类：交通/购物 ──
  {
    keys: ['机场', '从学校到机场', '去机场', '接机'],
    reply: '可以选择接机，机场到学校大概300-400左右不等。也可以选择机场大巴，6013号直达学校건대입구站下车，车费2W'
  },
  {
    keys: ['打印店', '打印', '哪里打印', '学校打印店'],
    reply: '学生会馆一楼有自助打印机，3号馆一楼便利店打印室，产学馆二楼有打印室'
  },
  {
    keys: ['在学证明', '成绩单', '证明在哪打', '打印证明'],
    reply: '学生会馆一楼可以打印在学证明和成绩单。网上申请方法：학교홈페이지 → 학사인내 → 등록서발급 → 발급인내 → 인터넷발급신청'
  },
  {
    keys: ['教材', '买教材', '教材在哪买', '书店'],
    reply: '学校内21号建筑是书店可以购买，但目前工学馆书店搬迁了'
  },
  {
    keys: ['校服', '买校服', '校服在哪买', '订购校服'],
    reply: '学生会馆1楼有订购校服的地方'
  },

  // ── 生活类：证件/行政 ──
  {
    keys: ['国际处', '国际处地址', '学生证在哪办', '领取学生证'],
    reply: '国际处在学校内8号建筑法学院一楼，学生证现在要去学校的新韩银行办理'
  },
  {
    keys: ['学生证作用', '学生证有什么用', '学生证优惠'],
    reply: '带着学生证去合作商家会有打折优惠（要先去银行开通银行卡功能）'
  },
  {
    keys: ['吃饭', '食堂', '哪里吃饭', '餐厅'],
    reply: '栋宿舍楼下有食堂（平日没有午饭），旁边有饭店和咖啡店，学生会馆一楼有食堂，图书馆负一层也有'
  },
  {
    keys: ['登陆证', '延期登陆证', '办登陆证', '签证延期'],
    reply: '每学期开学学校会有团体办理，可以关注一下学联公众号，也可以自己去出入境管理处办理（梧木桥站）'
  },
  {
    keys: ['入学许可书', '标准入学许可书', 'COE', '申请许可书'],
    reply: '发放标准入学许可书最多需要7天，至缴纳学费和选课时间截止申请'
  },
  {
    keys: ['复学', '怎么复学', '复学流程'],
    reply: '复学步骤：포털 → 학생행정 → 학적 → 학적변경관리 → 복학신청/재수 → 복학신청（至学费缴纳期间及选课期间为止）'
  },
  {
    keys: ['休学', '怎么休学', '休学流程'],
    reply: '休学不能只发休学申请给国际处，要自己在网址申请。步骤：포털 → 학생행정 → 학교행정 → 휴학'
  },
  {
    keys: ['保险', '买保险', '国民健康保险', '学校保险'],
    reply: '国民健康保险是办完登陆证后自动加入的，只需要每个月定期缴纳保险费。学校保险（非强制）：http://n.foreignerdb.com/konkuk1'
  },
  {
    keys: ['奖学金', '申请奖学金', 'topik奖学金'],
    reply: '目前奖学金自动减免学费，不单独发放，除了TOPIK奖学金。具体要求和流程可以咨询学生会或国际处'
  },
  {
    keys: ['学士服', '毕业服', '领学士服', '学位服'],
    reply: '联系系办公室进行咨询，学科办公室邮箱地址在안내처시판最上面的"생활 안내 채팅"末尾显示各学科的邮箱地址'
  },
  {
    keys: ['拿不到毕业证', '邮寄毕业证', '国外毕业证'],
    reply: '正式毕业证（学位证）只在毕业典礼上发放。外国人学生中心不能代替邮寄毕业证，可通过朋友在学科办公室代收后进行邮寄'
  },
  {
    keys: ['打工证', '办理打工证', '兼职许可'],
    reply: '官网左边"학교행政"菜单 → "서각 취업업"查看大致内容。在"자주사용하는 양식"中填写"서각 취업추천서"后访问外国人学生中心，带着契约书一起去签字即可'
  },
  {
    keys: ['住宿', '租房', '校外租房', '宿舍申请'],
    reply: '学校提供两种住宿选择：校内宿舍和校外租房。校内宿舍申请时间通常在每学期初，具体要求可咨询学生会或国际处。校外租房建议提前了解当地租房市场'
  },
  {
    keys: ['交学费', '学费', '缴纳学费', '会费'],
    reply: '网址 http://kupis.konkuk.ac.kr/ipsi/anundw/dmpp/index_pass_gen2.jsp 会费可交可不交，是自愿缴纳的项目'
  },
  {
    keys: ['国际处老师', '远程提问', '问国际处', 'Q&A'],
    reply: '国际处不接受邮件，如需提问请到官网：http://www.konkuk.ac.kr/Administration/abroadCenter/jsp/School_life/Q&A.jsp 登录后在Q&A里面提问'
  },

  // ── 宿舍类 ──
  {
    keys: ['宿舍网站', '宿舍网址', '宿舍官网'],
    reply: '上方链接区有，点击即可进入'
  },
  {
    keys: ['宿舍邮箱', '宿舍行政室邮箱', 'kulhouse'],
    reply: 'kulhouse5003@gmail.com / kulhouse5000@gmail.com 两个邮箱都可以'
  },
  {
    keys: ['宿舍电话', '宿舍行政室电话'],
    reply: '02-2024-5000 ~ 5003'
  },
  {
    keys: ['宿舍申请时间', '什么时候申请宿舍'],
    reply: '一般是7月和1月左右，随时关注邮箱'
  },
  {
    keys: ['宿舍工作时间', '行政室开门'],
    reply: '周一至周五 9:00-17:30（公休日放假）'
  },
  {
    keys: ['宿舍门禁', '几点关门', '回宿舍'],
    reply: '晚上1点'
  },
  {
    keys: ['宿舍快递', '快递地址', '寄快递'],
    reply: '서울시 광진구 건대대학교 + 宿舍楼名字 + 房间号'
  },
  {
    keys: ['宿舍入住', '住宿舍', '办入住'],
    reply: '去行政室办理入住，出示护照和肺结核检查报告直接领取房卡（周末不上班）'
  },
  {
    keys: ['宿舍健身房', '健身房', '申请健身房'],
    reply: '每月第三个星期一申请，每月1万원，在쿨몰별을 지하 1층申请'
  },

  // ── 学习类 ──
  {
    keys: ['포털账户', 'portal账号', '注册portal', '注册账户'],
    reply: '新生要等国际处发了学号之后才能注册，注册一天后才能登录'
  },
  {
    keys: ['抢课', '选课系统', '在哪里抢课', '수강신청', '选课如何操作？'],
    reply: '网页版去上方链接区；手机版去APP里搜索"건국대학교 수강신청"'
  },
  {
    keys: ['忘记ID', '找回密码', 'portal密码', '忘记密码'],
    reply: '메일번호 문전 행정실 或发邮件 kuinfo@konkuk.ac.kr'
  },
  {
    keys: ['如何选课', '选课流程', '选课步骤'],
    reply: '电脑版：点击수강신청 → 输入抢课编号 → 초기；手机版：登录 → 수강신청 → 输入课号 → 신청。B站搜"建国大学联官号"也有视频教程'
  },
  {
    keys: ['学科分类', '课程分类', '中文翻译', '课程类型'],
    reply: '전필=专业必修 | 전선=专业选择 | 선교=选择教养 | 지교=指定教养 | 일선=一般选择 | 기교=基础教养 | 수강바구니=选课篮子 | 수강신청=选课申请 | 수강신청 초기=选课结果查询'
  },
  {
    keys: ['教养课', '教养课怎么选', '外国人教养'],
    reply: '기교(基教)修满12分，삶교(三教)修满12分（三教的三个领域必须每个修2门），지교(指教)15分，진선(专选)每个专业所需分数不一样'
  },
  {
    keys: ['最低学分', '最少修几分', '学分标准'],
    reply: '最低修12分（12分不能参与奖学金），15分以上可参与奖学金，最多17-19分（因专业而异）。没修够的分数移到下学期（最多3分）'
  },
  {
    keys: ['评分标准', 'GPA', '成绩等级', '分数对应'],
    reply: '绝对评价：95-100=A+ | 90-95=A | 85-90=B+ | 80-85=B | 75-80=C+ | 70-75=C | 65-70=D+ | 60-65=D | 60以下=F。相对评价：排名前50%为A'
  },
  {
    keys: ['删课', '退课', '取消课程'],
    reply: '每学期期末左右会有具体的删课通知。大三才能删课（只能删C-、D和F的课程）'
  },
  {
    keys: ['如何提交Topik成绩', '提交Topik成绩', 'Topik成绩提交', '语言成绩提交','如何提交TOPIK成绩？'],
    reply: '点击上方链接区提交，记得登录'
  }
]

// ==================== System Prompts ====================
const systemPrompts = {
  personal: '你是北极星.天赐的个人网站的AI助手。用简洁友好的中文回答访客的问题。北极星.天赐是韩国建国大学（건국대학교）大四学生，计算机专业，擅长 Vue3、Python、FastAPI、Godot 等技术，目前正在开发一款潜行Roguelike游戏的毕业设计。',

  student: '你是建国大学学生会的AI助手。用亲切热情的中文回答同学们的校园生活问题。你可以介绍学生会服务、校园设施、社团活动、食堂推荐等。如果不确定具体信息，建议同学联系作者本人并添加微信，获取最新信息。回答要简洁实用。'
}

// ==================== AI 对话 ====================
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message;
  const source = req.body.source || 'personal';  // ✅ 默认个人站

  if (!userMessage) {
    return res.status(400).json({ error: 'message 不能为空' });
  }

  console.log(`收到消息: [${source}] ${JSON.stringify(userMessage)}`);

  // ✅ 根据 source 选择对应的预设问答
  const currentPresetQA = source === 'student' ? studentPresetQA : personalPresetQA;

  // 先检查预设问答（秒回，不消耗API）
  const preset = currentPresetQA.find(item =>
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
            content: systemPrompts[source] || systemPrompts.personal  // ✅ 动态选人设
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