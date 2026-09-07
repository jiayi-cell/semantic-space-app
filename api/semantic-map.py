from __future__ import annotations

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler

from server import call_openai_compatible_api, get_ai_config, heuristic_item, normalize_item


class handler(BaseHTTPRequestHandler):
    def _send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            words = [str(word).strip() for word in payload.get("words", []) if str(word).strip()]
            if not words:
                raise ValueError("No words provided")
        except Exception as exc:
            self._send_json({"error": f"Invalid request: {exc}"}, HTTPStatus.BAD_REQUEST)
            return

        config = get_ai_config()
        if not config:
            items = [heuristic_item(word, f"fallback-{index}") for index, word in enumerate(words)]
            self._send_json({"items": items, "meta": {"mode": "heuristic-only"}})
            return

        try:
            result = call_openai_compatible_api(config, words)
            result_items = result.get("items", [])
            items = []
            for index, word in enumerate(words):
                match = next((item for item in result_items if item.get("word") == word), None)
                items.append(
                    normalize_item(word, match, f"fallback-{index}")
                    if match
                    else heuristic_item(word, f"fallback-{index}")
                )
            self._send_json({"items": items, "meta": {"mode": "ai"}})
        except Exception as exc:
            items = [heuristic_item(word, f"fallback-{index}") for index, word in enumerate(words)]
            self._send_json({"items": items, "meta": {"mode": "heuristic-fallback", "reason": str(exc)}})
