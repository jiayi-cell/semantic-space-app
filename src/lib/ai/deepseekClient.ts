import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { borgesContext, type BorgesContext } from '../../data/borgesContext';
import { buildBorgesSystemPrompt } from './buildBorgesSystemPrompt';

type DeepSeekClientOptions = {
  apiKey?: string;
  baseURL?: string;
  model?: string;
};

type DeepSeekJsonRequest = {
  task: string;
  userInput: string;
  context?: BorgesContext;
  model?: string;
  temperature?: number;
};

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-chat';

function readEnv(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env?.[name]) {
    return process.env[name];
  }

  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const envValue = import.meta.env[name as keyof ImportMetaEnv];
    if (typeof envValue === 'string' && envValue.trim()) {
      return envValue;
    }

    const viteValue = import.meta.env[`VITE_${name}` as keyof ImportMetaEnv];
    if (typeof viteValue === 'string' && viteValue.trim()) {
      return viteValue;
    }
  }

  return undefined;
}

export function createDeepSeekClient(options: DeepSeekClientOptions = {}) {
  const apiKey = options.apiKey ?? readEnv('DEEPSEEK_API_KEY');

  if (!apiKey) {
    throw new Error('Missing DEEPSEEK_API_KEY.');
  }

  return new OpenAI({
    apiKey,
    baseURL: options.baseURL ?? readEnv('DEEPSEEK_BASE_URL') ?? DEFAULT_BASE_URL,
    dangerouslyAllowBrowser: true,
  });
}

export function extractStructuredJson<T>(content: string): T {
  const trimmed = content.trim();
  const fenced = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
    : trimmed;

  try {
    return JSON.parse(fenced) as T;
  } catch {
    const match = fenced.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) {
      throw new Error('DeepSeek response did not contain JSON.');
    }
    return JSON.parse(match[0]) as T;
  }
}

export async function requestDeepSeekJson<T>({
  task,
  userInput,
  context = borgesContext,
  model,
  temperature = 0.2,
}: DeepSeekJsonRequest): Promise<T> {
  const client = createDeepSeekClient({ model });
  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: buildBorgesSystemPrompt(task, context),
    },
    {
      role: 'user',
      content: userInput,
    },
  ];

  const response = await client.chat.completions.create({
    model: model ?? readEnv('DEEPSEEK_MODEL') ?? DEFAULT_MODEL,
    temperature,
    response_format: { type: 'json_object' },
    messages,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('DeepSeek returned an empty response.');
  }

  return extractStructuredJson<T>(content);
}
