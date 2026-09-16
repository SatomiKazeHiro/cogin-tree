import { AIProviderResult, IAIProvider } from '../ai-provider.interface';

export class MockProvider implements IAIProvider {
  async chat(prompt: string): Promise<AIProviderResult> {
    // mock 不产生真实 token 消耗，故用量字段留空
    return { content: this.reply(prompt) };
  }

  /** 各 stage 的模拟返回（按提示词正文里的特征词分派） */
  private reply(prompt: string): string {
    if (prompt.includes('生成用户肖像摘要')) {
      return JSON.stringify({
        summary: '热爱技术、追求实战的学习者',
        identityTags: ['前端开发', '1-3年经验'],
        interestTags: ['工程化', 'AI应用'],
        goalTags: ['技术广度提升'],
        learningStyle: 'hands-on',
      });
    }

    if (
      prompt.includes('个性化学习路径规划师') ||
      prompt.includes('推荐方向') ||
      prompt.includes('recommendations')
    ) {
      const interestTags = this.extractTags(prompt, '兴趣标签：') || ['技术提升'];
      const goalTags = this.extractTags(prompt, '目标标签：') || ['职业发展'];
      return JSON.stringify({
        recommendations: [
          {
            title: `${interestTags[0]} 实战进阶`,
            description: `围绕你的${interestTags[0]}兴趣，构建系统化的实战学习路径。`,
            reason: `基于你的兴趣标签「${interestTags[0]}」和目标「${goalTags[0]}」推荐。`,
            matchTags: ['兴趣', '目标'],
            suggestedMode: 'ENTRY',
            keywords: ['核心概念', '实战案例', '性能优化'],
          },
          {
            title: `${goalTags[0]} 专项突破`,
            description: `针对${goalTags[0]}目标，梳理核心知识点与常见面试题。`,
            reason: `与你当前的主要学习目标「${goalTags[0]}」高度匹配。`,
            matchTags: ['目标'],
            suggestedMode: 'EXPERT',
            keywords: ['核心知识点', '常见面试题', '实战演练'],
          },
          {
            title: '系统架构设计基础',
            description: '从设计原则到常用模式，建立架构思维。',
            reason: '适合有基础的同学扩展技术广度。',
            matchTags: ['兴趣', '学习风格'],
            suggestedMode: 'ENTRY',
            keywords: ['设计原则', '常用架构模式', '分层与解耦'],
          },
          {
            title: 'AI 应用开发入门',
            description: '学习如何集成大模型 API，构建智能应用。',
            reason: '当前热门方向，适合动手实践型学习者。',
            matchTags: ['兴趣', '学习风格'],
            suggestedMode: 'ENTRY',
            keywords: ['大模型 API', '提示词工程', '应用集成'],
          },
          {
            title: 'DevOps 与持续交付',
            description: 'CI/CD、容器化与监控，提升交付效率。',
            reason: '补足工程化能力，提升全栈竞争力。',
            matchTags: ['目标'],
            suggestedMode: 'EXPERT',
            keywords: ['CI/CD', '容器化', '监控与告警'],
          },
          {
            title: '技术写作与知识管理',
            description: '将学习成果沉淀为可复用的知识资产。',
            reason: '帮助形成长期学习习惯，适合系统掌握目标。',
            matchTags: ['学习风格'],
            suggestedMode: 'INTERVIEW',
            keywords: ['笔记体系', '知识沉淀', '写作方法'],
          },
        ],
      });
    }

    // Stage 0 知识点清单：必须放在 L1/L2 分支之前 ——
    // 该 prompt 正文里提到"再被你归纳成 L1 学习大纲"，否则会被下面的 L1 分支截胡（返回 nodes 而非 points）。
    if (prompt.includes('知识点清单')) {
      const title = this.extractLine(prompt, '技能方向名称：') || '该技能方向';
      return JSON.stringify({
        points: [
          `${title}基础概念`,
          `${title}核心工具链`,
          '模块化与工程化规范',
          '构建工具与打包原理',
          '依赖管理与版本策略',
          '代码规范与静态检查',
          '单元测试与集成测试',
          '性能分析与优化',
          '持续集成与自动化发布',
          '多包仓库协作',
          '错误监控与日志',
          '安全与依赖审计',
        ],
      });
    }

    // Stage 4 新增分析：必须放在 L3 分支之前（分析 prompt 会提到 L1/L2）。
    if (prompt.includes('技术趋势分析师')) {
      return JSON.stringify({
        suggestions: [
          {
            parentTitle: null,
            title: 'AI 辅助开发实践',
            description: '使用大模型工具提升日常开发效率。',
            reason: 'AI 编程工具已成为主流开发方式，值得系统学习。',
          },
          {
            parentTitle: null,
            title: '云原生部署入门',
            description: '容器化与编排的基础实践。',
            reason: '云原生技能在招聘市场需求持续增长。',
          },
        ],
      });
    }

    // Stage 5 过期分析
    if (prompt.includes('技术观察者')) {
      return JSON.stringify({
        suggestions: [
          {
            nodeTitle: 'jQuery 基础',
            expireLevel: 3,
            reason: '主流框架已全面取代 jQuery，官方生态停止演进。',
          },
        ],
      });
    }

    // Stage 6 面试 Q&A（按 L2 节点出题）
    if (prompt.includes('资深技术面试官')) {
      const topic = this.extractLine(prompt, '主题（L2）：')?.split('：')[0] || '该主题';
      return JSON.stringify({
        questions: [
          {
            question: `请介绍${topic}的核心概念和适用场景。`,
            answer: '核心概念是围绕该主题的基础原理与关键实践；适用场景包括实际项目落地、团队协作与面试应答。',
            difficulty: 'EASY',
          },
          {
            question: `${topic}中常见的性能瓶颈有哪些，如何排查？`,
            answer: '常见瓶颈包括资源加载、渲染阻塞与不必要的重复计算；排查手段：性能面板分析、指标监控、二分定位。',
            difficulty: 'MEDIUM',
          },
          {
            question: `在${topic}的实战中，你做过最有挑战的技术决策是什么？`,
            answer: '参考答案应包含：背景与约束、候选方案对比、权衡过程、最终结果与复盘，体现决策思路而非背诵概念。',
            difficulty: 'HARD',
          },
        ],
      });
    }

    // L3 系列（阶段 4 起拆成三个独立 stage）的提示词都会提到 L1/L2，
    // 因此必须先按「格式段里的 schema 字段名」判定，再回落到通用 L3 分支。
    // 顺序敏感：codeExamples → exercises → coreText。
    if (prompt.includes('codeExamples')) {
      const l2Title = this.extractLine(prompt, 'L2 节点：') || '该主题';
      const skillTreeName = this.extractLine(prompt, '技能方向：') || '该技能方向';

      return JSON.stringify({
        codeExamples: [
          {
            title: `${l2Title}基础示例`,
            language: 'javascript',
            code: `// ${l2Title} 核心用法示例\nconst example = {\n  name: '${l2Title}',\n  skill: '${skillTreeName}'\n};\nconsole.log(example);`,
          },
        ],
      });
    }

    if (prompt.includes('"exercises"') || prompt.includes('单选题')) {
      const skillTreeName = this.extractLine(prompt, '技能方向：') || '该技能方向';
      const l2Title = this.extractLine(prompt, 'L2 节点：') || '该主题';

      return JSON.stringify({
        exercises: [
          {
            question: `在${skillTreeName}中，${l2Title}的核心作用是什么？`,
            options: ['A. 仅用于展示', `B. 提升${skillTreeName}的开发效率与可维护性`, 'C. 替代所有现有工具', 'D. 仅适用于小型项目'],
            correctIndex: 1,
            explanation: `该知识点主要用于提升${skillTreeName}的开发效率与可维护性，而不是替代所有工具或仅用于展示。`,
          },
          {
            question: `学习${l2Title}时，以下哪项最重要？`,
            options: ['A. 死记 API', 'B. 理解原理并结合实践', 'C. 只看文档不动手', 'D. 跳过基础直接写项目'],
            correctIndex: 1,
            explanation: '理解原理并结合实践是掌握技术主题的最佳方式。',
          },
        ],
      });
    }

    // 兜底 L3 分支：只输出 coreText（若落到这里说明是 l3-core-text）
    if (
      prompt.includes('L3') ||
      prompt.includes('三级') ||
      prompt.includes('coreText') ||
      prompt.includes('学习内容')
    ) {
      const skillTreeName = this.extractLine(prompt, '技能方向：') || '该技能方向';
      const l1Title = this.extractLine(prompt, 'L1 节点：') || 'L1 节点';
      const l2Title = this.extractLine(prompt, 'L2 节点：') || 'L2 节点';

      return JSON.stringify({
        coreText: `## ${l2Title} 概述\n\n${skillTreeName}下的「${l1Title}」包含「${l2Title}」这一重要主题。它解释了关键概念、使用场景和注意事项，帮助你建立系统理解。\n\n## 使用要点\n\n- 先掌握原理，再动手实践。\n- 结合实际案例理解适用边界。\n- 注意常见误区与性能影响。\n\n掌握这些内容后，可以继续学习代码示例与练习题，检验并巩固理解。`,
      });
    }

    if (prompt.includes('L2') || prompt.includes('二级')) {
      const skillTreeName = this.extractLine(prompt, '技能方向：') || '该技能方向';
      const l1Title = this.extractLine(prompt, 'L1 节点标题：') || 'L1 节点';

      return JSON.stringify({
        nodes: [
          { title: `${l1Title}概述`, description: `了解${l1Title}在${skillTreeName}中的定位与价值` },
          { title: `${l1Title}关键技术`, description: `掌握${l1Title}涉及的核心技术与工具` },
          { title: `${l1Title}最佳实践`, description: `学习${l1Title}在${skillTreeName}中的行业推荐做法` },
          { title: `${l1Title}常见问题`, description: `排查${l1Title}相关问题的思路与方案` },
        ],
      });
    }

    if (prompt.includes('L1') || prompt.includes('一级')) {
      const title = this.extractLine(prompt, '技能方向名称：') || '技能方向';

      return JSON.stringify({
        nodes: [
          { title: `${title}基础概念`, description: `掌握${title}的核心概念与术语` },
          { title: `${title}核心工具链`, description: `熟悉${title}开发中常用的工具与生态` },
          { title: `${title}进阶主题`, description: `深入理解${title}的关键原理与设计思想` },
          { title: `${title}实战项目`, description: `通过真实项目巩固${title}知识` },
        ],
      });
    }

    return JSON.stringify({ result: 'mock response' });
  }

  private extractTags(prompt: string, marker: string): string[] | undefined {
    const value = this.extractLine(prompt, marker);
    if (!value || value === '无') return undefined;
    return value.split('，').filter(Boolean);
  }

  private extractLine(prompt: string, marker: string): string | undefined {
    const start = prompt.indexOf(marker);
    if (start === -1) return undefined;
    const lineStart = start + marker.length;
    const lineEnd = prompt.indexOf('\n', lineStart);
    const value = lineEnd === -1
      ? prompt.slice(lineStart).trim()
      : prompt.slice(lineStart, lineEnd).trim();
    return value || undefined;
  }
}
