from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib import error

from openai import OpenAI


ROOT = Path(__file__).resolve().parent
ENV_FILE = ROOT / ".env.local"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_env_file(ENV_FILE)


@dataclass
class AiConfig:
    api_key: str
    base_url: str
    model: str


def get_ai_config() -> AiConfig | None:
    api_key = (
        os.environ.get("DEEPSEEK_API_KEY", "").strip()
        or os.environ.get("AI_API_KEY", "").strip()
    )
    if not api_key:
        return None

    base_url = (
        os.environ.get("DEEPSEEK_BASE_URL", "").strip()
        or os.environ.get("AI_API_BASE_URL", "https://api.deepseek.com").strip()
    ).rstrip("/")
    model = (
        os.environ.get("DEEPSEEK_MODEL", "").strip()
        or os.environ.get("AI_MODEL", "deepseek-chat").strip()
    )
    return AiConfig(api_key=api_key, base_url=base_url, model=model)


def extract_json_payload(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
      text = re.sub(r"^```(?:json)?", "", text).strip()
      text = re.sub(r"```$", "", text).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


BORGES_CONTEXT = {
    "title": "《小径分岔的花园》小说集文化参考",
    "summary": (
        "这部小说集不是普通短篇合集，而是一组围绕迷宫、时间、文本、虚构、索引、复制、解释反复变形的小说实验。"
        "世界不是稳定背景，而是可被文本、目录、注释、命名和书写重新组织的结构。"
        "阅读不是接收答案，而是进入一个可跳转、可误读、可回返的系统。"
    ),
    "coreViews": [
        "文本不只是记录世界，也会生成世界。",
        "作者与原文不是稳定来源，归属和语境会改变意义。",
        "迷宫不只是建筑，也是时间、目录、注释和阅读路径的结构。",
        "真相不是唯一答案，而是多条路径中的暂时逼近。",
        "无限来自有限元素的重组，而不是来自空白。",
        "阅读应允许误读、偏移、比较、回返和重新索引。",
        "目录、书目、前言、注释、条目等边缘文本本身就是叙事发动机。",
    ],
    "motifs": [
        "镜子", "百科全书", "条目", "书目", "前言", "注释", "目录", "书架", "六角形", "图书馆",
        "辩白书", "花园", "书房", "谜语", "时间", "梦", "火", "彩票", "迷宫", "旅人",
        "作者", "读者", "祖先", "分岔", "复制", "误差", "胡言乱语",
    ],
    "styleRules": [
        "回答风格必须冷静、克制、结构化。",
        "像馆员、注释者、编目者、研究者，不像营销文案写手。",
        "不要情绪化，不要鸡汤化，不要过度解释。",
        "优先强调结构、索引、分岔、回返、误读、并存。",
        "不要把文本解释成单一寓意，也不要把博尔赫斯简化成奇幻或悬疑。",
        "允许留白，允许开放式解释，但要保持逻辑清晰。",
    ],
    "explanationTemplates": [
        "这不是一个对象，而是一种结构。",
        "它不指向现实本身，而指向现实被组织的方式。",
        "这里的迷宫不是空间，而是解释路径。",
        "这个词更像入口，而不是结论。",
        "它不是答案，而是另一条可进入的支路。",
        "它与其说是证据，不如说是索引。",
        "它不是复述，而是对原文的重新编目。",
        "它使文本从叙述转向了组织。",
    ],
    "jumpPromptRules": [
        "当生成词语解释时，优先判断它是对象、文本结构、制度、路径还是时间装置。",
        "当生成跳转提示时，优先寻找：索引关系、结构相似、功能类比、偏移关系，而不是浅层同义词。",
        "跳转提示语要短，像页边注，而不是长段解释。",
        "如果一个词更接近迷宫、目录、镜子、时间、注释等母题，可以优先把它视为结构性节点。",
        "在说明词与词关系时，优先使用：复制、索引、分岔、回返、误读、重写、并存、替代、追索。",
    ],
}


def build_borges_system_prompt(task: str, context: dict) -> str:
    def format_list(items: list[str]) -> str:
        return "\n".join(f"{index + 1}. {item}" for index, item in enumerate(items))

    return "\n".join(
        [
            f"你正在执行的任务：{task}",
            "",
            f"文化参考标题：{context['title']}",
            f"概述：{context['summary']}",
            "",
            "核心观点：",
            format_list(context["coreViews"]),
            "",
            "关键母题：",
            format_list(context["motifs"]),
            "",
            "风格约束：",
            format_list(context["styleRules"]),
            "",
            "解释模板倾向：",
            format_list(context["explanationTemplates"]),
            "",
            "跳转与关系提示规则：",
            format_list(context["jumpPromptRules"]),
            "",
            "输出补充要求：",
            "1. 优先输出结构化内容，能用 JSON 就用 JSON。",
            "2. 保持冷静、克制、编目式措辞，不写鸡汤，不写宣传文案。",
            "3. 把词视为结构节点、阅读路径或索引装置，不把它们简化成单一寓意。",
            "4. 在解释时优先说明对象性、文本性、制度性、路径性、时间性。",
            "5. 在关系与跳转中优先使用：索引、复制、分岔、回返、误读、重写、并存、替代、追索。",
        ]
    )


def build_messages(words: list[str]) -> list[dict]:
    return [
        {
            "role": "system",
            "content": build_borges_system_prompt(
                "为实验性语义空间工具批量分析词语，并返回结构化 JSON 结果。",
                BORGES_CONTEXT,
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "words": words,
                    "instruction": (
                        "请独立分析每个词，输出 JSON。每个词必须返回 "
                        "scores.entity / scores.medium / scores.stability，范围都是 -1 到 1。"
                        "entity: -1 抽象观念, +1 具体实体。"
                        "medium: -1 世界对象, +1 文本结构。"
                        "stability: -1 漂移分岔, +1 秩序固定。"
                        "explanation 必须冷静、克制、结构化，像页边注或编目说明。"
                        '输出格式严格为 {"items":[{"word":"...", "scores":{"entity":0.0,"medium":0.0,"stability":0.0}, "explanation":"..."}]}'
                    ),
                },
                ensure_ascii=False,
            ),
        },
    ]


def build_single_word_messages(word: str) -> list[dict]:
    return [
        {
            "role": "system",
            "content": build_borges_system_prompt(
                "为实验性语义空间工具分析单个词语，并返回结构化 JSON 结果。",
                BORGES_CONTEXT,
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "word": word,
                    "instruction": (
                        "请分析这个词，并返回 JSON。scores.entity / scores.medium / scores.stability "
                        "范围都是 -1 到 1。"
                        "entity: -1 抽象观念, +1 具体实体。"
                        "medium: -1 世界对象, +1 文本结构。"
                        "stability: -1 漂移分岔, +1 秩序固定。"
                        "explanation 必须简短、冷静、像注释者写的结构说明。"
                        '输出格式严格为 {"word":"...", "scores":{"entity":0.0,"medium":0.0,"stability":0.0}, "explanation":"..."}'
                    ),
                },
                ensure_ascii=False,
            ),
        },
    ]


def call_openai_compatible_api(config: AiConfig, words: list[str]) -> dict:
    client = OpenAI(
        api_key=config.api_key,
        base_url=config.base_url,
    )
    response = client.chat.completions.create(
        model=config.model,
        temperature=0.2,
        response_format={"type": "json_object"},
        messages=build_messages(words),
    )
    content = response.choices[0].message.content
    return extract_json_payload(content)


def call_openai_compatible_single_word(config: AiConfig, word: str) -> dict:
    client = OpenAI(
        api_key=config.api_key,
        base_url=config.base_url,
    )
    response = client.chat.completions.create(
        model=config.model,
        temperature=0.2,
        response_format={"type": "json_object"},
        messages=build_single_word_messages(word),
    )
    content = response.choices[0].message.content
    return extract_json_payload(content)


def clamp(value: float, minimum: float = -1.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def hash_string(value: str) -> int:
    hash_value = 2166136261
    for char in value:
        hash_value ^= ord(char)
        hash_value = (hash_value * 16777619) & 0xFFFFFFFF
    return hash_value


def seeded_random(seed_text: str):
    state = hash_string(seed_text) or 1
    while True:
        state = (1664525 * state + 1013904223) % 4294967296
        yield state / 4294967296


DIMENSION_RULES = {
    "entity": {
        "positive": ["镜子", "火车", "墓碑", "花园", "灯盏", "mirror", "train", "garden", "ruin", "lamp"],
        "negative": ["目录", "谜语", "书目", "时间", "symbol", "index", "riddle", "time", "concept"],
    },
    "medium": {
        "negative": ["镜子", "火车", "墓碑", "花园", "mirror", "train", "garden", "river", "guest"],
        "positive": ["目录", "谜语", "书目", "赫隆尼尔", "index", "riddle", "author", "library", "archive"],
    },
    "stability": {
        "positive": ["目录", "火车", "墓碑", "书目", "index", "train", "library", "archive", "clock"],
        "negative": ["谜语", "赫隆尼尔", "迷路", "彩票", "riddle", "maze", "chance", "drift", "error"],
    },
}


def heuristic_item(word: str, seed: str) -> dict:
    normalized = word.strip().lower()
    random = seeded_random(f"{seed}:{word}")
    scores = {}

    for dimension, rules in DIMENSION_RULES.items():
        score = 0.0
        if any(token.lower() in normalized for token in rules["negative"]):
            score -= 0.72
        if any(token.lower() in normalized for token in rules["positive"]):
            score += 0.72
        score += (next(random) - 0.5) * (0.06 if score else 0.18)
        scores[dimension] = round(clamp(score), 3)

    return {
        "word": word,
        "scores": scores,
        "explanation": f"“{word}”当前使用启发式评分作为回退结果。",
        "meta": {"source": "heuristic-fallback"},
    }


def build_public_note(word: str, scores: dict[str, float]) -> str:
    entity_label = "具体实体" if scores["entity"] > 0.18 else "抽象观念" if scores["entity"] < -0.18 else "中间地带"
    medium_label = "文本结构" if scores["medium"] > 0.18 else "世界对象" if scores["medium"] < -0.18 else "两侧之间"
    stability_label = "秩序固定" if scores["stability"] > 0.18 else "漂移分岔" if scores["stability"] < -0.18 else "轻微摇摆"
    return f"{word}: 偏向{entity_label} / {medium_label} / {stability_label}。"


def normalize_item(word: str, payload: dict, fallback_seed: str) -> dict:
    scores = payload.get("scores", {})
    return {
        "word": word,
        "scores": {
            "entity": round(clamp(float(scores.get("entity", 0))), 3),
            "medium": round(clamp(float(scores.get("medium", 0))), 3),
            "stability": round(clamp(float(scores.get("stability", 0))), 3),
        },
        "explanation": str(payload.get("explanation", "")).strip() or heuristic_item(word, fallback_seed)["explanation"],
        "meta": {"source": "ai"},
    }


class SemanticHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self) -> None:
        if self.path not in {"/api/semantic-map", "/api/semantic-map-stream"}:
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length)

        try:
            payload = json.loads(body.decode("utf-8"))
            words = [str(word).strip() for word in payload.get("words", []) if str(word).strip()]
            if not words:
                raise ValueError("No words provided")
        except Exception as exc:
            self._send_json({"error": f"Invalid request: {exc}"}, status=HTTPStatus.BAD_REQUEST)
            return

        config = get_ai_config()
        if self.path == "/api/semantic-map-stream":
            self._handle_stream(words, config)
            return

        if not config:
            items = [heuristic_item(word, f"fallback-{index}") for index, word in enumerate(words)]
            self._send_json({"items": items, "meta": {"mode": "heuristic-only", "reason": "missing_api_key"}})
            return

        try:
            ai_result = call_openai_compatible_api(config, words)
            items = ai_result.get("items", [])
            normalized_items = []

            for index, word in enumerate(words):
                match = next((item for item in items if item.get("word") == word), None)
                if not match:
                    normalized_items.append(heuristic_item(word, f"fallback-{index}"))
                    continue

                normalized_items.append(normalize_item(word, match, f"fallback-{index}"))

            self._send_json({"items": normalized_items, "meta": {"mode": "ai"}})
        except error.HTTPError as exc:
            fallback = [heuristic_item(word, f"fallback-{index}") for index, word in enumerate(words)]
            self._send_json(
                {
                    "items": fallback,
                    "meta": {
                        "mode": "heuristic-fallback",
                        "reason": f"http_{exc.code}",
                    },
                }
            )
        except Exception as exc:
            fallback = [heuristic_item(word, f"fallback-{index}") for index, word in enumerate(words)]
            self._send_json(
                {
                    "items": fallback,
                    "meta": {
                        "mode": "heuristic-fallback",
                        "reason": str(exc),
                    },
                }
            )

    def _send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_stream_event(self, payload: dict) -> None:
        body = (json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8")
        self.wfile.write(body)
        self.wfile.flush()

    def _handle_stream(self, words: list[str], config: AiConfig | None) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

        self._send_stream_event(
            {
                "type": "status",
                "message": f"Preparing semantic analysis for {len(words)} terms.",
            }
        )

        for index, word in enumerate(words):
            self._send_stream_event(
                {
                    "type": "thinking",
                    "word": word,
                    "message": f"Reading semantic cues for {word}.",
                }
            )

            if config:
                try:
                    ai_result = call_openai_compatible_single_word(config, word)
                    normalized_item = normalize_item(word, ai_result, f"fallback-{index}")
                except Exception:
                    normalized_item = heuristic_item(word, f"fallback-{index}")
            else:
                normalized_item = heuristic_item(word, f"fallback-{index}")

            self._send_stream_event(
                {
                    "type": "note",
                    "word": word,
                    "message": build_public_note(word, normalized_item["scores"]),
                }
            )
            self._send_stream_event(
                {
                    "type": "item",
                    "item": normalized_item,
                }
            )

        self._send_stream_event(
            {
                "type": "done",
                "message": f"Completed semantic mapping for {len(words)} terms.",
            }
        )


def main() -> int:
    port = int(os.environ.get("PORT", "4173"))
    server = ThreadingHTTPServer(("127.0.0.1", port), SemanticHandler)
    print(f"Serving semantic-space app at http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
