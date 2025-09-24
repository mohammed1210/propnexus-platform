"""Async wrapper for OpenAI chat completions using httpx."""

from __future__ import annotations

import os
from typing import Any, Dict, List

import httpx


class OpenAIClient:
    def __init__(self) -> None:
        self.api_key = os.getenv("OPENAI_API_KEY")
        # Allow overriding base URL for testing
        self.base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "gpt-3.5-turbo",
        temperature: float = 0.3,
        max_tokens: int = 800,
    ) -> str:
        """Call OpenAI's chat completions endpoint and return the response text."""
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY environment variable is not set")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions", headers=headers, json=payload
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()


openai_client = OpenAIClient()
