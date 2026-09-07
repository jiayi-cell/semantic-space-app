const AXIS_SCALE = 4.2;

const dimensionRules = {
  entity: {
    positive: {
      exact: [
        '镜子',
        '火车',
        '墓碑',
        '花园',
        '灯盏',
        '河流',
        '客人',
        '作者',
        '图书馆',
        '遗迹',
        'mirror',
        'train',
        'garden',
        'river',
        'guest',
        'author',
        'library',
        'ruin',
        'stone',
        'lamp',
      ],
      partial: ['镜', '车', '碑', '园', '灯', '墓', '馆', 'river', 'train', 'mirror', 'lamp'],
    },
    negative: {
      exact: [
        '目录',
        '谜语',
        '书目',
        '时间',
        '魔法',
        '偏差',
        '误差',
        '象征',
        '观念',
        '结构',
        'index',
        'riddle',
        'time',
        'chance',
        'symbol',
        'idea',
        'concept',
        'logic',
        'language',
      ],
      partial: ['目录', '书', '时间', '谜', 'symbol', 'index', 'logic', 'concept', 'idea'],
    },
  },
  medium: {
    negative: {
      exact: [
        '镜子',
        '火车',
        '墓碑',
        '花园',
        '灯盏',
        '客人',
        '河流',
        '房间',
        '镜面',
        'mirror',
        'train',
        'garden',
        'ruin',
        'guest',
        'river',
        'forest',
        'body',
      ],
      partial: ['花园', '火车', '镜子', '墓碑', 'garden', 'train', 'mirror', 'river', 'body'],
    },
    positive: {
      exact: [
        '目录',
        '谜语',
        '书目',
        '前言',
        '小说',
        '注释',
        '索引',
        '书写',
        '赫隆尼尔',
        'index',
        'riddle',
        'catalogue',
        'preface',
        'novel',
        'symbol',
        'author',
        'archive',
        'library',
      ],
      partial: ['目录', '书目', '前言', '小说', '谜语', '赫隆', 'index', 'author', 'library', 'archive'],
    },
  },
  stability: {
    positive: {
      exact: [
        '目录',
        '火车',
        '墓碑',
        '书目',
        '钟表',
        '六角形',
        '档案',
        '规则',
        'index',
        'train',
        'library',
        'archive',
        'clock',
        'grid',
        'catalogue',
      ],
      partial: ['目录', '书目', '墓碑', '钟', '档案', 'index', 'grid', 'archive', 'clock'],
    },
    negative: {
      exact: [
        '谜语',
        '赫隆尼尔',
        '迷路',
        '彩票',
        '机会',
        '偏差',
        '偶然',
        '岔路',
        '谜团',
        'riddle',
        'maze',
        'chance',
        'error',
        'drift',
        'ruin',
        'symbol',
      ],
      partial: ['谜', '赫隆', '迷', '偏差', '偶然', 'maze', 'chance', 'drift', 'ruin', 'error'],
    },
  },
};

const descriptions = {
  entity: {
    positive: '更接近可感知的对象、场景或人物',
    negative: '更接近抽象观念、判断或符号关系',
  },
  medium: {
    negative: '更像世界中的物、地点或情境',
    positive: '更像文本、档案或叙述系统中的结构',
  },
  stability: {
    positive: '更偏向秩序、结构与可归档性',
    negative: '更偏向漂移、歧义、偏差与不确定',
  },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seedString) {
  let state = hashString(seedString) || 1;
  return () => {
    state = (1664525 * state + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function normalizeWord(word) {
  return word.trim().toLowerCase();
}

function scoreDimension(word, dimension, random) {
  const normalized = normalizeWord(word);
  const ruleSet = dimensionRules[dimension];
  let score = 0;
  let matched = false;

  if (ruleSet.negative.exact.includes(normalized)) {
    score -= 0.8;
    matched = true;
  }

  if (ruleSet.positive.exact.includes(normalized)) {
    score += 0.8;
    matched = true;
  }

  ruleSet.negative.partial.forEach((token) => {
    if (normalized.includes(token)) {
      score -= 0.22;
      matched = true;
    }
  });

  ruleSet.positive.partial.forEach((token) => {
    if (normalized.includes(token)) {
      score += 0.22;
      matched = true;
    }
  });

  if (!matched) {
    score += (random() - 0.5) * 0.2;
  } else {
    score += (random() - 0.5) * 0.06;
  }

  return clamp(score, -1, 1);
}

function buildExplanation(word, scores) {
  const entityTone = scores.entity > 0.18 ? descriptions.entity.positive : descriptions.entity.negative;
  const mediumTone = scores.medium < -0.18 ? descriptions.medium.negative : descriptions.medium.positive;
  const stabilityTone =
    scores.stability > 0.18 ? descriptions.stability.positive : descriptions.stability.negative;

  return `“${word}”被估计为：${entityTone}，${mediumTone}，同时${stabilityTone}。`;
}

function createPosition(scores, random) {
  const jitter = () => (random() - 0.5) * 0.22;

  return [
    scores.entity * AXIS_SCALE + jitter(),
    scores.medium * AXIS_SCALE + jitter(),
    scores.stability * AXIS_SCALE + jitter(),
  ];
}

export function spreadSemanticItems(items) {
  const nextItems = items.map((item) => ({
    ...item,
    position: [...item.position],
  }));
  const minDistance = 1.05;
  const bounds = 4.55;

  for (let iteration = 0; iteration < 18; iteration += 1) {
    for (let i = 0; i < nextItems.length; i += 1) {
      for (let j = i + 1; j < nextItems.length; j += 1) {
        const a = nextItems[i];
        const b = nextItems[j];
        const dx = b.position[0] - a.position[0];
        const dy = b.position[1] - a.position[1];
        const dz = b.position[2] - a.position[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;

        if (distance >= minDistance) {
          continue;
        }

        const push = ((minDistance - distance) / minDistance) * 0.12;
        const nx = dx / distance;
        const ny = dy / distance;
        const nz = dz / distance;

        a.position[0] = clamp(a.position[0] - nx * push, -bounds, bounds);
        a.position[1] = clamp(a.position[1] - ny * push, -bounds, bounds);
        a.position[2] = clamp(a.position[2] - nz * push, -bounds, bounds);
        b.position[0] = clamp(b.position[0] + nx * push, -bounds, bounds);
        b.position[1] = clamp(b.position[1] + ny * push, -bounds, bounds);
        b.position[2] = clamp(b.position[2] + nz * push, -bounds, bounds);
      }
    }
  }

  return nextItems;
}

export function createSemanticItemFromScores(word, scores, explanation, seed = 1, meta = {}) {
  const random = createSeededRandom(`${seed}:${word}:external`);
  const normalizedScores = {
    entity: Number(clamp(Number(scores.entity ?? 0), -1, 1).toFixed(3)),
    medium: Number(clamp(Number(scores.medium ?? 0), -1, 1).toFixed(3)),
    stability: Number(clamp(Number(scores.stability ?? 0), -1, 1).toFixed(3)),
  };

  return {
    word,
    x: normalizedScores.entity,
    y: normalizedScores.medium,
    z: normalizedScores.stability,
    position: createPosition(normalizedScores, random).map((value) => Number(value.toFixed(3))),
    scores: normalizedScores,
    explanation: explanation || buildExplanation(word, normalizedScores),
    meta,
  };
}

export function createSemanticMapper(options = {}) {
  const externalScorer = options.scorer;

  return {
    async scoreWord(word, seed = 1) {
      if (typeof externalScorer === 'function') {
        return externalScorer(word, seed);
      }
      return getSemanticPosition(word, seed);
    },
  };
}

export function getSemanticPosition(word, seed = 1) {
  const random = createSeededRandom(`${seed}:${word}`);
  const scores = {
    entity: Number(scoreDimension(word, 'entity', random).toFixed(3)),
    medium: Number(scoreDimension(word, 'medium', random).toFixed(3)),
    stability: Number(scoreDimension(word, 'stability', random).toFixed(3)),
  };

  return {
    word,
    x: scores.entity,
    y: scores.medium,
    z: scores.stability,
    position: createPosition(scores, random).map((value) => Number(value.toFixed(3))),
    scores,
    explanation: buildExplanation(word, scores),
    meta: {
      source: 'heuristic-v1',
      replaceable: true,
    },
  };
}

export function mapWordsToSemanticSpace(words, seed = 1) {
  return spreadSemanticItems(words.map((word, index) => getSemanticPosition(word, `${seed}-${index}`)));
}
