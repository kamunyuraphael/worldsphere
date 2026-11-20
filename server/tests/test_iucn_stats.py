"""Aggregation logic against a fake IUCN API (no network, no token)."""
import httpx

from app import iucn_stats as I


def fake_api(request: httpx.Request) -> httpx.Response:
    path, q = request.url.path.removeprefix("/api/v4"), request.url.params
    assert request.headers["authorization"] == "Bearer t0ken"
    page = int(q.get("page", 1))
    if path == "/information/red_list_version":
        return httpx.Response(200, json={"red_list_version": "2026-1"})
    if path == "/systems/":
        return httpx.Response(200, json={"systems": [{"code": "1", "description": {"en": "Freshwater"}}]})
    if path.startswith("/taxa/kingdom/") or path == "/systems/1":
        data = {"Animalia": ["CR", "EN", "LC"], "Plantae": ["LC", "LC"]}.get(path.rsplit("/", 1)[-1], ["VU"] if path == "/systems/1" else [])
        items = [{"red_list_category_code": c} for c in data] if page == 1 else []
        return httpx.Response(200, json={"assessments": items})
    return httpx.Response(404)


def test_build_stats_counts_by_kingdom_and_system():
    with httpx.Client(transport=httpx.MockTransport(fake_api), headers={"Authorization": "Bearer t0ken"}) as c:
        stats = I.build_stats(c, log=lambda _: None)
    assert stats["by_kingdom"]["Animalia"] == {"CR": 1, "EN": 1, "LC": 1}
    assert stats["by_kingdom"]["Plantae"] == {"LC": 2}
    assert stats["by_kingdom"]["Fungi"] == {}
    assert stats["by_system"] == {"Freshwater": {"VU": 1}}
    assert stats["red_list_version"] == "2026-1" and stats["partial"] is False


def test_nested_category_and_bad_token():
    assert I.category_of({"red_list_category": {"code": "EN"}}) == "EN"
    bad = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(401)))
    try:
        I._get(bad, "/x")
        assert False
    except I.IucnError:
        pass
