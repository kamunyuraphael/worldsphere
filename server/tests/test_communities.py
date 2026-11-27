"""Communities router: wiring and auth rules that need no database."""
import os

os.environ.setdefault("AUTH_SECRET", "x" * 40)

from fastapi.testclient import TestClient  # noqa: E402

from app import auth, communities  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


def test_optional_user_is_none_without_or_with_bad_token():
    assert communities.optional_user_id(None) is None
    assert communities.optional_user_id("Basic abc") is None
    assert communities.optional_user_id("Bearer not-a-token") is None


def test_optional_user_reads_a_valid_token():
    token = auth.create_token(7, "a@b.co")
    assert communities.optional_user_id(f"Bearer {token}") == 7


def test_joining_requires_sign_in():
    assert client.post("/communities/circles/wildlife-guild/join").status_code == 401
    assert client.delete("/communities/circles/wildlife-guild/join").status_code == 401


def test_circle_dict_shape():
    row = {"slug": "s", "name": "N", "description": "d", "category": "animal", "member_count": 3, "joined": 1}
    assert communities.circle_dict(row) == {"slug": "s", "name": "N", "description": "d", "category": "animal", "memberCount": 3, "joined": True}


def test_discussions_require_sign_in():
    base = "/communities/circles/wildlife-guild/threads"
    assert client.get(base).status_code == 401
    assert client.post(base, json={"title": "Hello", "body": "World"}).status_code == 401
    assert client.get(f"{base}/1").status_code == 401
    assert client.post(f"{base}/1/replies", json={"body": "Hi"}).status_code == 401
    assert client.delete(f"{base}/1").status_code == 401
    assert client.delete(f"{base}/1/replies/1").status_code == 401


def test_thread_input_is_trimmed_and_validated():
    ok = communities.ThreadIn(title="  Hornbills at dawn ", body=" Seen near Thika. ")
    assert (ok.title, ok.body) == ("Hornbills at dawn", "Seen near Thika.")
    for bad in ({"title": "ab", "body": "x"}, {"title": "Fine title", "body": "   "}, {"title": "x" * 121, "body": "x"}):
        try:
            communities.ThreadIn(**bad)
        except ValueError:
            continue
        raise AssertionError(f"accepted {bad}")
    try:
        communities.ReplyIn(body="y" * 4001)
    except ValueError:
        pass
    else:
        raise AssertionError("accepted an oversized reply")


def test_reporting_and_posting_limits_exist():
    base = "/communities/circles/wildlife-guild/threads/1"
    assert client.post(f"{base}/report", json={}).status_code == 401
    assert client.post(f"{base}/replies/1/report", json={}).status_code == 401
    assert communities.HIDE_AFTER_REPORTS >= 2 and communities.POST_BURST >= 3
    assert communities.ReportIn(reason=None).reason is None
