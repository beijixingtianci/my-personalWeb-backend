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
// 只保留简单数据型答案（网址/地址/电话/时间），专业问题交给AI参考system prompt自由回答
const studentPresetQA = [
  // ── 关于AI/学生会 ──
  { keys: ['如何让AI鹅秘书更加智能', '调教AI', '让AI更聪明', 'AI记忆'], reply: '添加作者微信，把你知道的信息（问题和答案）告诉我，我通过调教让AI记住！' },
  { keys: ['联系方式', '怎么联系', '联系学生会', '学生会联系方式'], reply: '点击右上角的联系我们，添加作者微信！' },
  { keys: ['加入', '入会', '如何加入学生会', '加入学生会'], reply: '点击"联系我们"或本页的"加入我们"按钮，扫描微信二维码，备注"姓名+学科"' },
  { keys: ['学生会面试', '加入学生会需要面试', '需要面试吗'], reply: '通常需要简单面试，主要了解你的意向和特长' },
  { keys: ['招新', '学生会招新', '什么时候招新', '招新时间'], reply: '每学期初（3月和9月）发布招新公告，关注公众号或群通知' },

  // ── 生活类：固定信息 ──
  { keys: ['机场', '从学校到机场', '去机场', '接机', '如何去学校'], reply: '出租车约300-400韩元，机场大巴6013号直达건대입구站，车费2万韩元' },
  { keys: ['打印店', '打印', '哪里打印', '学校打印店'], reply: '学生会馆一楼自助打印机、3号馆一楼便利店打印室、产学馆二楼打印室' },
  { keys: ['在学证明', '成绩单', '证明在哪打', '打印证明'], reply: '学生会馆一楼可以打印。网上申请：학교홈페이지 → 학사인내 → 등록서발급 → 인터넷발급신청' },
  { keys: ['教材', '买教材', '教材在哪买'], reply: '学校内21号建筑是书店，目前工学馆书店已搬迁' },
  { keys: ['校服', '买校服', '校服在哪买'], reply: '学生会馆1楼订购' },
  { keys: ['吃饭', '食堂', '哪里吃饭', '餐厅'], reply: '宿舍楼下食堂(平日无午饭)、旁边饭店咖啡店、学生会馆一楼食堂、图书馆负一层' },
  { keys: ['国际处', '国际处地址'], reply: '8号建筑法学院一楼' },
  { keys: ['入学许可书', '标准入学许可书', 'COE'], reply: '发放最多需要7天，至缴纳学费和选课时间截止申请' },
  { keys: ['学士服', '毕业服', '领学士服'], reply: '联系学科办公室咨询，邮箱在안내처시판最上面的"생활 안내 채팅"末尾' },
  { keys: ['拿不到毕业证', '邮寄毕业证', '国外毕业证'], reply: '正式毕业证只在毕业典礼发放，不能邮寄，可通过朋友在学科办公室代收后邮寄' },
  { keys: ['交学费', '学费', '缴纳学费', '会费'], reply: '网址 http://kupis.konkuk.ac.kr/ipsi/anundw/dmpp/index_pass_gen2.jsp 会费可交可不交' },
  { keys: ['国际处老师', '远程提问', '问国际处', 'Q&A网址'], reply: '国际处不接受邮件，提问请到：http://www.konkuk.ac.kr/Administration/abroadCenter/jsp/School_life/Q&A.jsp 登录后在Q&A提问' },
  { keys: ['住宿', '租房', '校外租房'], reply: '校内宿舍通过CISS申请，校外租房建议提前了解当地租房市场，可咨询学生会或国际处' },

  // ── 宿舍：固定数据 ──
  { keys: ['宿舍网站', '宿舍网址'], reply: '上方链接区有，点击即可进入' },
  { keys: ['宿舍邮箱', 'kulhouse'], reply: 'kulhouse5003@gmail.com / kulhouse5000@gmail.com' },
  { keys: ['宿舍电话'], reply: '02-2024-5000 ~ 5003' },
  { keys: ['宿舍申请时间', '什么时候申请宿舍'], reply: '一般是7月和1月左右，随时关注邮箱' },
  { keys: ['宿舍工作时间', '行政室开门'], reply: '周一至周五 9:00-17:30（公休日放假）' },
  { keys: ['宿舍门禁', '几点关门'], reply: '晚上1点' },
  { keys: ['宿舍快递', '快递地址'], reply: '서울시 광진구 건대대학교 + 宿舍楼名字 + 房间号' },
  { keys: ['宿舍入住', '住宿舍', '办入住'], reply: '去行政室办理，出示护照和肺结核检查报告领取房卡（周末不上班）' },
  { keys: ['宿舍健身房', '健身房'], reply: '每月第三个星期一申请，每月1万원，在쿨몰별을 지하 1층申请' },

  // ── 学习类：固定数据 ──
  { keys: ['포털账户', 'portal账号', '注册portal'], reply: '新生等国际处发学号后才能注册，注册一天后才能登录' },
  { keys: ['忘记ID', '找回密码', '忘记密码'], reply: '发邮件向信息处询问 kuinfo@konkuk.ac.kr' },
  { keys: ['学科分类', '课程分类', '课程类型'], reply: '전필=专业必修 | 전선=专业选择 | 선교=选择教养 | 지교=指定教养 | 일선=一般选择 | 기교=基础教养 | 수강바구니=选课篮子 | 수강신청=选课申请' },
  { keys: ['评分标准', 'GPA', '成绩等级'], reply: '绝对评价：95-100=A+ | 90-95=A | 85-90=B+ | 80-85=B | 75-80=C+ | 70-75=C | 65-70=D+ | 60-65=D | 60以下=F。相对评价：排名前50%为A' },
  { keys: ['删课', '退课'], reply: '每学期期末左右有删课通知，大三才能删课（只能删C-、D和F的课程）' },
  { keys: ['如何提交Topik成绩', '提交Topik成绩', 'TOPIK成绩提交'], reply: '点击上方链接区提交，记得登录' },
  { keys: ['法定教育', '법정교육', '必修教育', 'e-캠퍼스', '怎么完成法定教育'], reply: '留学生法定教育是韩国法律要求的必修课程！每年第一个学期在e-캠퍼스上修"韩国法令理解"。不完成会停用学士Portal。公告查看：CISS(ciss.konkuk.ac.kr) → Students Support → Notices' },
  { keys: ['学生证作用', '学生证有什么用', '学生证优惠'], reply: '带着学生证去合作商家有打折优惠（需先去银行开通银行卡功能）' },
]

// ==================== System Prompts ====================
const systemPrompts = {
  personal: '你是北极星.天赐的个人网站的AI助手。用简洁友好的中文回答访客的问题。北极星.天赐是韩国建国大学（건국대학교）大四学生，计算机专业，擅长 Vue3、Python、FastAPI、Godot 等技术，目前正在开发一款潜行Roguelike游戏的毕业设计。',

  student: `你是建国大学学生会AI助手"鹅秘书"，用亲切实用的中文回答同学们的校园生活问题。

【核心知识库——请参考以下内容回答，回答要完整详细，不要只给简短一句】

📌 重要提醒：
- 外国人本科生宿舍申请在宿舍主页无效！必须通过CISS(http://ciss.konkuk.ac.kr)申请
- 学位证(毕业证)只在毕业典礼发放一次，不可补办，务必保管！
- 国民健康保险必须加入，不缴纳会限制签证延长甚至强制扣押财产
- 绝对禁止使用换钱商/非法银行缴纳学费
- 讲课评价必须全部完成，否则无法查看成绩
- C3签证入境不可转D-2，必须直接持D-2入境

📌 注册与学费：
- 注册期：1学期约2月中旬，2学期约8月中旬
- 高知书打印：主页→学事指南→证明书发行→网上发行(https://unc.webminwon.com)，支持中/英/日/韩语
- 虚拟账户转账缴纳，金额必须一致，他人代缴也可
- 超学期注册金按毕业审查学分计算，需确认未毕代码
- 海外汇款：SHINHAN BANK, Swift:SHBKKRSE, 地址120 Neungdong-ro Gwangjin-gu Seoul, 收款人本人姓名
- 高知减免奖学金获得者必须先注册再休学，否则复学无法再享受
- 学费缴纳确认：主页(Portal)直接确认并输出缴纳确认书
- 分期缴纳：主页→分期缴纳注册公告→输出分期高知书

📌 选课注册：
- 选课：网页版上方链接区，手机APP搜"건국대학교 수강신청"
- 电脑版：수강신청→输入课号→초기；手机版：登录→수강신청→输入课号→신청
- 最低修12分(不能参与奖学金)，15分以上可参与，最多17-19分(因专业而异)

📌 奖学金：
- 休学生/超学期者/退学处分者排除，休学前务必确认奖学金资格
- 国籍变更为韩国后不再享受外国人奖学金
- 实用韩语奖学金不是直接发给学生，是付给语言教育院的课费
- 优秀外国人奖学金按理工/非理工/国际大学比例分配选拔
- 受校规处分者、虚假申请者排除

📌 签证/登陆证：
- 入境90天内申请外国人登录证，否则罚款
- 签证延期到期前4个月可申请，过期罚款
- 搬家14天内申报地址变更，超期罚款
- 出境1年内免再入境许可，1~2年需申请
- 出入境预约：hikorea.go.kr，必须预约才办理，电话1345
- D-2签证材料：护照+机票+2万美元存款证明(冻结6个月)+联系方式
- 登录证遗失14天内补办，信息变更14天内申报
- 团体延期75,000韩元，个人60,000韩元；有违规记录不能团体申请

📌 打工证：
- 许可下发前不能上班(否则非法就业)
- 建大认证大学：主中30h/周，周末假期不限
- 无TOPIK3(1~2年级)/4(3~4年级)则合计最多10h/周
- 换雇主15天内重新申报
- 出勤率70%以下或绩点C(2.0)以下不予许可

📌 健康保险：
- 必须加入，报销50%诊疗费，实损需另买民间保险
- 月费5~15万韩元，每月25日前缴纳
- 2021年3月起自动加入：D-2→登录日，D-4→入境满6月，F-4→入学日
- 实损保险在线加入：http://n.foreignerdb.com/konkuk1
- 不缴纳后果：就医给付限制→签证延长受限(拖欠50万+)→强制扣押财产

📌 休学/复学：
- 休学：포털→학사행정→학적→학적변동관리→휴학신청/취소
- 休学后15天内必须出境，休学期间1年，6个月后可复学
- 新生最多休6学期，插班生最多4学期
- 已缴学费可休学(学费延到复学)，未缴学费缴费截止日前可休学(复学需缴)
- 复学：포털→학사행정→학적→학적변동관리→복학신청。申请时间1月/7月

📌 教养课：
- 留学生必须选带(국제)标记的课程，不带的不算毕业学分
- 2024后入学：基础15学分+深化12学分(6门)
- 深化3领域各2门：思考力增进/人性涵养/全球化人才培养
- 2025年1月起领域名变更：思考力增进→창의적전문인，人性涵养→실천적사회인，全球化→선도적세계인
- 教养韩语第一节课分班考试(분반고사)，必须出席

📌 毕业关键：
- TOPIK 4级以上(部分专业5级)，成绩过有效期仍有效
- 入学后6年内必须毕业(也是签证最长延长期)
- 毕业15天内必须出国，继续留韩需换签证类型
- 毕业延期仅以延长滞留为目的不被批准
- 各学院毕业学分不同，查：www.konkuk.ac.kr/konkuk/2396/subview.do
- 超学期无需另外申请注册，学科会联系设置未毕代码

📌 转专业(전과)：
- 每年1月选拔一次，2~4年级可申请
- 编入生和休学生不可，在校期间只能转一次
- 포털→학사행정→학적→전과관리→전과신청
- 转专业后学费按新学科标准，有差额需补缴或退还

📌 다전공(双专业)/부전공(辅修)：
- 다전공：同时修读2个专业，毕业获2个学位。3~8学期可申请，每年1月/7月
- 부전공：额外修读另一专业学分(不获学位)。3~8学期可申请，每年1月/7月
- 同一学科不可同时申请다전공和부전공
- 有转出/转入限制学科：兽医科/产业经营融合/国际大学等不可或有限制
- 다전공无需额外注册费；부전공也无需额外注册费
- 학사정보시스템→학적→제2전공신청/포기 申请

📌 재입학(再入学)：
- 被除籍者可申请继续学业，仅限1次
- 退学处分者和入学放弃者不可再入学
- 每学期1月/7月通过官网公告通知

📌 讲课评价(강의평가)：
- 必须全部完成否则无法查看成绩！
- 终课3周前至期末考试前
- 포털→학사행정→수업→강의평가→강의평가등록
- 一旦提交不可修改，内容严格保密

📌 证明书/学生证：
- 证明书3种发行方式：网上(https://unc.webminwon.com)/邮寄/自助机(14号馆1层/20号馆1层/1号馆1层)
- 学生证含新韩借记卡功能，免费发行，HeyYoung Campus+SOL APP申请
- 第1学生会馆2层新韩银行领取，带护照/驾照/居民证
- 移动学生证：建国大学APP→SID登录→身份证管理→移动身份证

📌 宿舍：
- 外国人本科生必须通过CISS(http://ciss.konkuk.ac.kr)申请，宿舍主页无效
- CISS只管申请，入住后看쿨하우스网站自行处理
- 中途退住扣30%违约金，到期退住3周内不退，擅自退住不退
- 1学期约11月~1月申请，2学期约6月~7月申请

📌 留学生项目：
- 导师项目：2月/8月申请，40小时+，文/经/社科单独申请
- 就业支援：简历/面试/就业信息，每学期12次，韩语进行
- 写作诊所：wein.konkuk.ac.kr，1:1指导，学期中随时申请

📌 关键联系方式：
- CISS(外国人学生中心)：http://ciss.konkuk.ac.kr
- 出入境：1345(多语言)，hikorea.go.kr
- 建大健康保险公团：1577-1000(韩语)/033-811-2000(多语言)
- 宿舍行政室：02-450-3092 / kulhouse5000@gmail.com
- 学生证咨询：02-450-3204，第1学生会馆205号
- 证明书咨询：02-450-3308 / certificate@konkuk.ac.kr
- 新韩银行建大支店：02-453-0583
- 实损保险：02-720-1399，中文02-3481-2133(Kakao:CLAIMS)
- 信息处(忘记密码)：kuinfo@konkuk.ac.kr

回答原则：
1. 参考知识库内容自由回答，耐心完整地回答
2. 知识库没有覆盖的，诚实告知"这个问题我暂时无法确认，数据库中没有查询到相关信息，建议添加作者微信进行确认"
`  // ← ⚠️ 这个反引号必须存在！关闭模板字符串
};  // ← 关闭 systemPrompts 对象

// ==================== AI 对话 ====================
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message;
  const source = req.body.source || 'personal';

  if (!userMessage) {
    return res.status(400).json({ error: 'message 不能为空' });
  }

  console.log(`收到消息: [${source}] ${JSON.stringify(userMessage)}`);

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
            content: systemPrompts[source] || systemPrompts.personal
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
