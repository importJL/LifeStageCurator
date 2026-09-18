"""Centralised prompt templates (uc1_specs.md 2.4).

Keeping every prompt in one module makes the LLM contract easy to review and
version, and lets the mock provider key off the ``TASK:`` markers.
"""

from __future__ import annotations

from .taxonomy import CONTENT_TYPES, LIFE_STAGES

SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {"summary": {"type": "string", "description": "Concise summary of at most 200 words."}},
    "required": ["summary"],
}

TAXONOMY_SCHEMA = {
    "type": "object",
    "properties": {
        "primary_life_stage": {"type": "string", "enum": list(LIFE_STAGES)},
        "sub_topics": {"type": "array", "items": {"type": "string"}},
        "content_type": {"type": "string", "enum": CONTENT_TYPES},
        "estimated_minutes": {"type": "integer", "minimum": 1},
    },
    "required": ["primary_life_stage", "sub_topics", "content_type"],
}

SUMMARY_SYSTEM = (
    "You write concise, practical summaries for a curated library that helps adults "
    "navigate major life transitions. Summarise only what the source supports: no "
    "invented facts, no promotional language, no professional advice."
)

TAXONOMY_SYSTEM = (
    "You classify content for a life-stage library. Choose exactly one primary life "
    "stage and one or more sub-topics from the provided taxonomy. Infer the content "
    "type and estimate reading or watching time in whole minutes. Only use taxonomy "
    "values that are provided."
)

ENRICHMENT_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string", "description": "Concise summary of at most 200 words."},
        "primary_life_stage": {"type": "string", "enum": list(LIFE_STAGES)},
        "sub_topics": {"type": "array", "items": {"type": "string"}},
        "content_type": {"type": "string", "enum": CONTENT_TYPES},
        "estimated_minutes": {"type": "integer", "minimum": 1},
    },
    "required": ["summary", "primary_life_stage", "sub_topics", "content_type"],
}

# One combined request covers both summary and taxonomy, halving latency and
# rate-limit exposure versus two sequential calls.
ENRICHMENT_SYSTEM = (
    f"{SUMMARY_SYSTEM} {TAXONOMY_SYSTEM} Return the summary and the classification "
    "together in a single JSON object."
)


def _taxonomy_reference() -> str:
    lines = []
    for stage, topics in LIFE_STAGES.items():
        lines.append(f"- {stage}: {', '.join(topics)}")
    return "\n".join(lines)


def build_summary_prompt(*, title: str | None, url: str | None, text: str) -> str:
    body = text[:12000] if text else "(no extracted text available)"
    return (
        "TASK: SUMMARY\n"
        f"Title: {title or '(unknown)'}\n"
        f"Source URL: {url or '(none)'}\n"
        "Write a summary of at most 200 words in 2-4 sentences.\n\n"
        f"Content:\n{body}"
    )


def build_taxonomy_prompt(
    *,
    title: str | None,
    description: str | None,
    url: str | None,
    text: str,
    content_hint: str | None = None,
) -> str:
    snippet = (text or description or "")[:6000]
    hint = f"Detected media hint: {content_hint}\n" if content_hint else ""
    return (
        "TASK: TAXONOMY\n"
        f"Title: {title or '(unknown)'}\n"
        f"Description: {description or '(none)'}\n"
        f"Source URL: {url or '(none)'}\n"
        f"{hint}"
        f"Allowed content types: {', '.join(CONTENT_TYPES)}\n"
        "Taxonomy:\n"
        f"{_taxonomy_reference()}\n\n"
        f"Content snippet:\n{snippet}"
    )


def build_enrichment_prompt(
    *,
    title: str | None,
    description: str | None,
    url: str | None,
    text: str,
    content_hint: str | None = None,
) -> str:
    body = (text or description or "")[:12000] or "(no extracted text available)"
    hint = f"Detected media hint: {content_hint}\n" if content_hint else ""
    return (
        "TASK: ENRICH\n"
        f"Title: {title or '(unknown)'}\n"
        f"Description: {description or '(none)'}\n"
        f"Source URL: {url or '(none)'}\n"
        f"{hint}"
        f"Allowed content types: {', '.join(CONTENT_TYPES)}\n"
        "Taxonomy:\n"
        f"{_taxonomy_reference()}\n\n"
        "Write a summary of at most 200 words in 2-4 sentences, then classify the "
        "content using the taxonomy above.\n\n"
        f"Content:\n{body}"
    )
