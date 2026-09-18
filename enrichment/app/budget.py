"""Token/cost guards so LLM usage stays within configured budgets (uc1_specs.md 2.8)."""

from __future__ import annotations

import threading
from datetime import date


class TokenBudget:
    def __init__(self, *, daily_budget: int, request_budget: int) -> None:
        self.daily_budget = daily_budget
        self.request_budget = request_budget
        self._spent_today = 0
        self._day = date.today()
        self._lock = threading.Lock()

    def _rollover(self) -> None:
        today = date.today()
        if today != self._day:
            self._day = today
            self._spent_today = 0

    def has_budget(self, *, estimated_tokens: int = 0) -> bool:
        with self._lock:
            self._rollover()
            if self.daily_budget <= 0:
                return True
            return self._spent_today + estimated_tokens <= self.daily_budget

    def record(self, tokens: int) -> None:
        if tokens <= 0:
            return
        with self._lock:
            self._rollover()
            self._spent_today += tokens

    @property
    def spent_today(self) -> int:
        with self._lock:
            self._rollover()
            return self._spent_today

    @property
    def remaining(self) -> int:
        with self._lock:
            self._rollover()
            return max(0, self.daily_budget - self._spent_today)
