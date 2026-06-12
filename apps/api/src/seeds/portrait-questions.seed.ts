import { PortraitQuestionCategory } from '@skill/shared';

export const PORTRAIT_QUESTIONS_SEED: Array<{
  category: PortraitQuestionCategory;
  question: string;
  options: string[];
  allowMultiple: boolean;
}> = [
  {
    category: PortraitQuestionCategory.IDENTITY,
    question: '你当前的职业身份是什么？',
    options: ['学生', '前端开发', '后端开发', '全栈开发', '产品经理', '设计师', '其他'],
    allowMultiple: false,
  },
  {
    category: PortraitQuestionCategory.IDENTITY,
    question: '你的工作年限？',
    options: ['<1年', '1-3年', '3-5年', '5-10年', '10年+'],
    allowMultiple: false,
  },
  {
    category: PortraitQuestionCategory.INTEREST,
    question: '你对哪些技术领域感兴趣？',
    options: ['云原生', 'AI与机器学习', '微服务', 'DevOps', '前端工程化', '数据工程', '安全'],
    allowMultiple: true,
  },
  {
    category: PortraitQuestionCategory.INTEREST,
    question: '你偏好的学习方式？',
    options: ['视频教程', '文档阅读', '实战项目', '交互式练习'],
    allowMultiple: false,
  },
  {
    category: PortraitQuestionCategory.GOAL,
    question: '你当前的主要学习目标？',
    options: ['求职面试', '技术转型', '晋升加薪', '兴趣拓展', '解决当前工作问题'],
    allowMultiple: true,
  },
  {
    category: PortraitQuestionCategory.GOAL,
    question: '你希望学习的深度？',
    options: ['够用就行', '系统掌握', '深入原理', '成为专家'],
    allowMultiple: false,
  },
  {
    category: PortraitQuestionCategory.BACKGROUND,
    question: '你当前的编程基础？',
    options: ['零基础', '有基础', '熟练', '精通'],
    allowMultiple: false,
  },
  {
    category: PortraitQuestionCategory.BACKGROUND,
    question: '你每天能投入的学习时间？',
    options: ['<30分钟', '30-60分钟', '1-2小时', '2小时+'],
    allowMultiple: false,
  },
];
