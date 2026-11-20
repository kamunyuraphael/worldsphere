"""Aggregate IUCN Red List (API v4) statistics.

The v4 API has no aggregate/count endpoints: collections are paged lists of up to
100 assessments. So we page through them once (see scripts/refresh_iucn.py),
tally by Red List category, kingdom and system, and cache the totals in
PostgreSQL. The dashboard reads the cached totals via GET /stats/iucn.

Docs: https://api.iucnredlist.org/api-docs/v4/openapi.yaml  (Bearer token auth)
"""
from __future__ import annotations

import time
from collections import Counter
from collections.abc import Callable, Iterator

import httpx

BASE_URL = "https://api.iucnredlist.org/api/v4"
KINGDOMS = ("Animalia", "Plantae", "Fungi")
# IUCN system codes; used only if GET /systems/ can't be parsed.
DEFAULT_SYSTEMS = {"0": "Terrestrial", "1": "Freshwater", "2": "Marine"}
THREATENED = ("CR", "EN", "VU")


class IucnError(RuntimeError):
    pass


def _get(client: httpx.Client, path: str, params: dict | None = None, retries: int = 5) -> dict:
    for attempt in range(retries):
        try:
            response = client.get(f"{BASE_URL}{path}", params=params)
        except httpx.TransportError:
            time.sleep(2 ** attempt)
            continue
        if response.status_code == 401:
            raise IucnError("IUCN rejected the token (401). Check IUCN_API_TOKEN.")
        if response.status_code == 404:
            return {}
        if response.status_code == 429 or response.status_code >= 500:
            time.sleep(float(response.headers.get("Retry-After", 2 ** attempt)))
            continue
        response.raise_for_status()
        return response.json()
    raise IucnError(f"IUCN request kept failing: {path}")


def _items(payload: dict) -> list[dict]:
    """The list of assessments in a page (key name isn't documented, so find it)."""
    if isinstance(payload.get("assessments"), list):
        return payload["assessments"]
    for value in payload.values():
        if isinstance(value, list) and value and isinstance(value[0], dict):
            return value
    return []


def category_of(item: dict) -> str | None:
    raw = item.get("red_list_category_code") or item.get("category_code") or item.get("red_list_category")
    if isinstance(raw, dict):
        raw = raw.get("code")
    return str(raw) if raw else None


def pages(client: httpx.Client, path: str, params: dict, max_pages: int | None = None) -> Iterator[list[dict]]:
    page = 1
    while max_pages is None or page <= max_pages:
        items = _items(_get(client, path, {**params, "page": page}))
        if not items:
            return
        yield items
        page += 1


def tally(client: httpx.Client, path: str, params: dict, max_pages: int | None,
          log: Callable[[str], None]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    total = 0
    for n, items in enumerate(pages(client, path, params, max_pages), start=1):
        if n == 1 and items:
            log(f"  sample item keys for {path}: {sorted(items[0].keys())}")
        for item in items:
            counts[category_of(item) or "UNKNOWN"] += 1
            total += 1
        if n % 25 == 0:
            log(f"  {path}: {n} pages, {total} assessments")
    return dict(counts)


def list_systems(client: httpx.Client) -> dict[str, str]:
    """{code: label}. Falls back to the standard 0/1/2 if the response shape is unexpected."""
    payload = _get(client, "/systems/")
    found: dict[str, str] = {}
    for item in _items(payload) or next((v for v in payload.values() if isinstance(v, list)), []):
        if not isinstance(item, dict) or "code" not in item:
            continue
        desc = item.get("description")
        label = desc.get("en") if isinstance(desc, dict) else desc
        found[str(item["code"])] = str(label or item["code"])
    return found or dict(DEFAULT_SYSTEMS)


def build_stats(client: httpx.Client, scope_code: int = 1, max_pages: int | None = None,
                log: Callable[[str], None] = print) -> dict:
    params = {"latest": "true", "scope_code": scope_code}

    version = _get(client, "/information/red_list_version").get("red_list_version")

    by_kingdom: dict[str, dict[str, int]] = {}
    for kingdom in KINGDOMS:
        log(f"Tallying kingdom {kingdom}…")
        by_kingdom[kingdom] = tally(client, f"/taxa/kingdom/{kingdom}", params, max_pages, log)

    by_system: dict[str, dict[str, int]] = {}
    for code, label in list_systems(client).items():
        log(f"Tallying system {label} ({code})…")
        by_system[label] = tally(client, f"/systems/{code}", params, max_pages, log)

    return {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "red_list_version": version,
        "scope_code": scope_code,
        "partial": max_pages is not None,
        "by_kingdom": by_kingdom,
        "by_system": by_system,
        "note": "A species can appear in more than one system, so system totals overlap.",
    }


def make_client(token: str) -> httpx.Client:
    return httpx.Client(headers={"Authorization": token if token.lower().startswith("bearer ") else f"Bearer {token}"},
                        timeout=30)
