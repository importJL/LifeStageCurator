"""Canonical life-stage taxonomy shared by prompts and the offline labeller.

Values mirror the six launch stages in tech_specs.md 3 and the seeded data in
app/page.tsx so suggestions map directly onto application choices.
"""

from __future__ import annotations

LIFE_STAGES: dict[str, list[str]] = {
    "Preparing for Parenthood": ["Before baby", "Finances", "Relationships"],
    "New Parents": ["Sleep & settling", "Feeding", "Parental mental health", "Admin & legal", "Returning to work"],
    "Newlyweds / Early Partnership": ["Money together", "Home rhythms", "Communication"],
    "Moving into a New Home": ["First 30 days", "Admin & legal", "Making it home"],
    "Becoming Grandparents": ["Being supportive", "Staying connected", "Family boundaries"],
    "Retirement & Later Life": ["Financial planning", "Health & mobility", "Purpose & connection", "Downsizing"],
}

CONTENT_TYPES = ["article", "video", "podcast", "guide", "checklist", "tool"]

# Keyword signals per stage used by the offline (non-LLM) labelling path.
STAGE_KEYWORDS: dict[str, list[str]] = {
    "Preparing for Parenthood": [
        "pregnan", "expecting", "prenatal", "before baby", "trying to conceive",
        "birth plan", "maternity", "paternity leave",
    ],
    "New Parents": [
        "newborn", "baby", "infant", "toddler", "breastfeed", "formula", "nursing",
        "sleep training", "postpartum", "teething", "diaper", "new parent",
    ],
    "Newlyweds / Early Partnership": [
        "newlywed", "marriage", "married", "couple", "partnership", "wedding",
        "engaged", "shared finances", "in-laws",
    ],
    "Moving into a New Home": [
        "moving", "move in", "relocat", "first home", "buying a home", "renting",
        "mortgage", "lease", "new house", "new apartment",
    ],
    "Becoming Grandparents": [
        "grandparent", "grandma", "grandpa", "grandchild", "grandkids",
    ],
    "Retirement & Later Life": [
        "retire", "retirement", "pension", "401k", "social security", "later life",
        "aging", "downsiz", "senior",
    ],
}

TOPIC_KEYWORDS: dict[str, list[str]] = {
    "Sleep & settling": ["sleep", "settling", "bedtime", "nap", "night waking"],
    "Feeding": ["feed", "breastfeed", "formula", "nursing", "solids", "weaning"],
    "Parental mental health": ["mental health", "postpartum depression", "anxiety", "burnout", "self-care"],
    "Admin & legal": ["legal", "paperwork", "documents", "will", "insurance", "registration"],
    "Returning to work": ["returning to work", "back to work", "parental leave", "childcare"],
    "Before baby": ["before baby", "third trimester", "nesting", "hospital bag"],
    "Finances": ["budget", "savings", "cost", "finance", "expenses"],
    "Relationships": ["relationship", "partner", "communication", "intimacy"],
    "Money together": ["joint account", "shared finances", "money", "budget"],
    "Home rhythms": ["routine", "chores", "household", "home rhythms"],
    "Communication": ["communication", "conflict", "listening", "conversation"],
    "First 30 days": ["first 30 days", "utilities", "address change", "safety check", "setup"],
    "Making it home": ["decor", "unpack", "neighborhood", "settling in", "making it home"],
    "Being supportive": ["support", "helping", "boundaries"],
    "Staying connected": ["stay connected", "visits", "video call", "long distance"],
    "Family boundaries": ["boundaries", "family dynamics", "respect"],
    "Financial planning": ["pension", "investment", "retirement savings", "withdrawal", "401k"],
    "Health & mobility": ["health", "mobility", "exercise", "medical", "aging"],
    "Purpose & connection": ["purpose", "volunteer", "social connection", "loneliness", "hobby"],
    "Downsizing": ["downsizing", "declutter", "smaller home", "senior living"],
}


def all_topics() -> list[str]:
    seen: list[str] = []
    for topics in LIFE_STAGES.values():
        for topic in topics:
            if topic not in seen:
                seen.append(topic)
    return seen
