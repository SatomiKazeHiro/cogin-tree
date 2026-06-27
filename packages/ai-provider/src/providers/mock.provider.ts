import { IAIProvider } from '../ai-provider.interface';

export class MockProvider implements IAIProvider {
  async chat(prompt: string): Promise<string> {
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
          },
          {
            title: `${goalTags[0]} 专项突破`,
            description: `针对${goalTags[0]}目标，梳理核心知识点与常见面试题。`,
            reason: `与你当前的主要学习目标「${goalTags[0]}」高度匹配。`,
            matchTags: ['目标'],
            suggestedMode: 'EXPERT',
          },
          {
            title: '系统架构设计基础',
            description: '从设计原则到常用模式，建立架构思维。',
            reason: '适合有基础的同学扩展技术广度。',
            matchTags: ['兴趣', '学习风格'],
            suggestedMode: 'ENTRY',
          },
          {
            title: 'AI 应用开发入门',
            description: '学习如何集成大模型 API，构建智能应用。',
            reason: '当前热门方向，适合动手实践型学习者。',
            matchTags: ['兴趣', '学习风格'],
            suggestedMode: 'ENTRY',
          },
          {
            title: 'DevOps 与持续交付',
            description: 'CI/CD、容器化与监控，提升交付效率。',
            reason: '补足工程化能力，提升全栈竞争力。',
            matchTags: ['目标'],
            suggestedMode: 'EXPERT',
          },
          {
            title: '技术写作与知识管理',
            description: '将学习成果沉淀为可复用的知识资产。',
            reason: '帮助形成长期学习习惯，适合系统掌握目标。',
            matchTags: ['学习风格'],
            suggestedMode: 'INTERVIEW',
          },
        ],
      });
    }

    // L3 prompts also mention L1/L2, so check the most specific marker first.
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
        coreText: `${skillTreeName}下的「${l1Title}」包含「${l2Title}」这一重要主题。它解释了关键概念、使用场景和注意事项，帮助你建立系统理解。学习时应结合实际案例，先掌握原理再动手实践。`,
        codeExamples: [
          {
            title: `${l2Title}基础示例`,
            language: 'javascript',
            code: `// ${l2Title} 核心用法示例\nconst example = {\n  name: '${l2Title}',\n  skill: '${skillTreeName}'\n};\nconsole.log(example);`,
          },
        ],
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
