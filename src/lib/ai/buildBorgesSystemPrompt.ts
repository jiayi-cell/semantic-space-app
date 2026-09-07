import type { BorgesContext } from '../../data/borgesContext';

const formatList = (items: string[]) => items.map((item, index) => `${index + 1}. ${item}`).join('\n');

export function buildBorgesSystemPrompt(task: string, context: BorgesContext): string {
  return [
    `你正在执行的任务：${task}`,
    '',
    `文化参考标题：${context.title}`,
    `概述：${context.summary}`,
    '',
    '核心观点：',
    formatList(context.coreViews),
    '',
    '关键母题：',
    formatList(context.motifs),
    '',
    '风格约束：',
    formatList(context.styleRules),
    '',
    '解释模板倾向：',
    formatList(context.explanationTemplates),
    '',
    '跳转与关系提示规则：',
    formatList(context.jumpPromptRules),
    '',
    '输出补充要求：',
    '1. 优先输出结构化内容，能用 JSON 就用 JSON。',
    '2. 保持冷静、克制、编目式措辞，不写鸡汤，不写宣传文案。',
    '3. 把词视为结构节点、阅读路径或索引装置，不把它们简化成单一寓意。',
    '4. 在解释时优先说明对象性、文本性、制度性、路径性、时间性。',
    '5. 在关系与跳转中优先使用：索引、复制、分岔、回返、误读、重写、并存、替代、追索。',
  ].join('\n');
}
