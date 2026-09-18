from __future__ import annotations

import asyncio

from app.labelling import (
    clamp_summary,
    enrich_with_llm,
    estimate_minutes,
    extract_first_paragraph,
    offline_taxonomy,
    summarize_with_llm,
    taxonomy_with_llm,
)
from app.providers.base import InferenceProvider, InferenceResult
from app.providers.mock import MockProvider


class _SlowProvider(InferenceProvider):
    name = "slow"
    model = "slow-model"

    async def complete(self, prompt, response_schema=None, *, system=None):  # type: ignore[override]
        await asyncio.sleep(0.5)
        return InferenceResult(data={"summary": "late", "primary_life_stage": "New Parents"})


def test_offline_taxonomy_detects_new_parents():
    suggestion = offline_taxonomy(
        title="Newborn sleep: the first month",
        description="Practical tips for postpartum rest and baby feeding.",
        text="Breastfeeding and sleep training guidance for new parents and their newborn infant.",
    )
    assert suggestion.primary_life_stage == "New Parents"
    assert suggestion.content_type == "article"
    assert any(topic in {"Sleep & settling", "Feeding"} for topic in suggestion.sub_topics)


def test_offline_taxonomy_falls_back_to_first_stage():
    suggestion = offline_taxonomy(title="A random musing", description="", text="")
    assert suggestion.primary_life_stage == "Preparing for Parenthood"
    assert suggestion.sub_topics


def test_offline_content_type_video_and_podcast():
    assert offline_taxonomy(title="x", description="", text="", url="https://youtu.be/abc").content_type == "video"
    assert (
        offline_taxonomy(title="x", description="", text="", url="https://podcasts.apple.com/ep/1").content_type
        == "podcast"
    )


def test_estimate_minutes_from_oembed_duration():
    assert estimate_minutes(text="", content_type="video", oembed={"duration_seconds": 125}) == 3


def test_estimate_minutes_from_word_count():
    text = " ".join(["word"] * 460)
    assert estimate_minutes(text=text, content_type="article") == 2


def test_clamp_summary_enforces_word_limit():
    summary = " ".join(["word"] * 250)
    clamped = clamp_summary(summary, limit=200)
    assert len(clamped.split()) == 200
    assert clamped.endswith("…")


def test_extract_first_paragraph():
    text = "First sentence here. Second sentence here. Third sentence ignored."
    result = extract_first_paragraph(text)
    assert result is not None
    assert "First sentence" in result
    assert "Third sentence" not in result


async def test_enrich_with_llm_returns_summary_and_taxonomy():
    summary, taxonomy, tokens, model = await enrich_with_llm(
        MockProvider(), title="Newborn sleep", description=None, url=None, text="baby sleep", timeout=1
    )
    assert summary.summary
    assert summary.used_llm is True
    assert taxonomy is not None
    assert taxonomy.primary_life_stage == "New Parents"
    assert tokens > 0
    assert model == "mock-model"


async def test_summary_llm_timeout_falls_back():
    result = await summarize_with_llm(
        _SlowProvider(), title="Title", url=None, text="Some content", timeout=0.01
    )
    assert result.summary is None
    assert result.used_llm is False


async def test_taxonomy_llm_timeout_falls_back():
    suggestion, tokens, model = await taxonomy_with_llm(
        _SlowProvider(), title="Title", description=None, url=None, text="Some content", timeout=0.01
    )
    assert suggestion is None
    assert tokens == 0
    assert model is None
