from __future__ import annotations

import json
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler

from server import (
    call_openai_compatible_api,
    get_ai_config,
    heuristic_item,
    normalize_item,
    build_public_note,
)


class handler(BaseHTTPRequestHandler):
    def _send_event(self, payload: dict) -> None:
        self.wfile.write((json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8"))
        self.wfile.flush()

    def _send_error(self, message: str, status: HTTPStatus) -> None:
        body = json.dumps({"error": message}, ensure_ascii=False).encode("utf-8")
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
            self._send_error(f"Invalid request: {exc}", HTTPStatus.BAD_REQUEST)
            return

        config = get_ai_config()
        normalized_items = []

        if config:
            try:
                result = call_openai_compatible_api(config, words)
                result_items = result.get("items", [])
                for index, word in enumerate(words):
                    match = next((item for item in result_items if item.get("word") == word), None)
                    normalized_items.append(
                        normalize_item(word, match, f"fallback-{index}")
                        if match
                        else heuristic_item(word, f"fallback-{index}")
                    )
            except Exception:
                normalized_items = [heuristic_item(word, f"fallback-{index}") for index, word in enumerate(words)]
        else:
            normalized_items = [heuristic_item(word, f"fallback-{index}") for index, word in enumerate(words)]

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()

        try:
            self._send_event({"type": "status", "message": f"Preparing semantic analysis for {len(words)} terms."})
            for word, item in zip(words, normalized_items):
                self._send_event({"type": "thinking", "word": word, "message": f"Reading semantic cues for {word}."})
                self._send_event({"type": "note", "word": word, "message": build_public_note(word, item["scores"])})
                self._send_event({"type": "item", "item": item})
                time.sleep(0.16)
            self._send_event({"type": "done", "message": f"Completed semantic mapping for {len(words)} terms."})
        except (BrokenPipeError, ConnectionResetError):
            return
