export const DEFAULT_WORDS = [
  '镜子',
  '目录',
  '谜语',
  '火车',
  '赫隆尼尔',
  '墓碑',
  '花园',
  '书目',
  '时间',
  '灯盏',
  'mirror',
  'index',
  'riddle',
  'train',
  'library',
  'ruin',
  'author',
  'maze',
  'chance',
  'symbol',
];

export const AXIS_RANGE = 5;

export const AXIS_LABELS = {
  x: {
    name: '实体性 Entity',
    negative: '抽象观念',
    positive: '具体实体',
  },
  y: {
    name: '媒介性 Medium',
    negative: '世界对象',
    positive: '文本结构',
  },
  z: {
    name: '稳定性 Stability',
    negative: '漂移分岔',
    positive: '秩序固定',
  },
};

export const SAMPLE_DESCRIPTION =
  '一个研究型、可交互的文本可视化原型。当前使用启发式词表评分，后续可替换为 embedding 或 LLM 接口。';
