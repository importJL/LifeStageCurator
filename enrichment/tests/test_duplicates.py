from __future__ import annotations

from app.duplicates import DuplicateStore, cosine_similarity


def test_cosine_similarity_identical_vectors():
    assert cosine_similarity([1.0, 0.0], [1.0, 0.0]) == 1.0


def test_cosine_similarity_orthogonal_vectors():
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == 0.0


def test_exact_url_match(store: DuplicateStore):
    store.record(
        content_id="c1",
        url="https://example.com/a?utm_source=x",
        canonical_url="https://example.com/a",
        title="Example",
    )
    match = store.find_exact("https://example.com/a")
    assert match is not None
    assert match.content_id == "c1"
    assert match.similarity == 1.0
    assert match.reason == "exact_url"


def test_exact_match_respects_exclusion(store: DuplicateStore):
    store.record(content_id="c1", url=None, canonical_url="https://example.com/a", title="Example")
    assert store.find_exact("https://example.com/a", exclude_content_id="c1") is None


def test_near_duplicate_by_embedding(store: DuplicateStore):
    store.record(
        content_id="c1",
        url=None,
        canonical_url="https://example.com/a",
        title="Example",
        embedding=[1.0, 0.0, 0.0],
    )
    matches = store.find_near([0.99, 0.01, 0.0], threshold=0.9)
    assert matches
    assert matches[0].content_id == "c1"
    assert matches[0].reason == "near_duplicate"


def test_reindexing_same_url_updates_in_place(store: DuplicateStore):
    store.record(content_id="c1", url="https://example.com/a", canonical_url="https://example.com/a", title="First")
    store.record(content_id="c2", url="https://example.com/a", canonical_url="https://example.com/a", title="Second")
    assert store.count() == 1
    match = store.find_exact("https://example.com/a")
    assert match is not None
    assert match.content_id == "c1"


def test_near_duplicate_below_threshold(store: DuplicateStore):
    store.record(content_id="c1", url=None, canonical_url="u", title="t", embedding=[1.0, 0.0])
    assert store.find_near([0.0, 1.0], threshold=0.9) == []
