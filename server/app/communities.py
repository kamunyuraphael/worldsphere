"""Communities: public circles with real member counts, join/leave, and a members-only roster."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator

from app import auth, db

router = APIRouter(prefix="/communities", tags=["Communities"])

ROSTER_LIMIT = 50


def optional_user_id(authorization: str | None = Header(default=None)) -> int | None:
    """User id from a valid bearer token, or None for anonymous visitors (never raises)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    payload = auth.verify_token(authorization.split(" ", 1)[1].strip())
    return payload["uid"] if payload else None


def circle_dict(row: dict) -> dict:
    return {
        "slug": row["slug"],
        "name": row["name"],
        "description": row["description"],
        "category": row["category"],
        "memberCount": row["member_count"],
        "joined": bool(row["joined"]),
    }


CIRCLE_SELECT = (
    "SELECT c.slug, c.name, c.description, c.category, "
    "(SELECT COUNT(*) FROM circle_members m WHERE m.circle_slug = c.slug) AS member_count, "
    "EXISTS (SELECT 1 FROM circle_members m WHERE m.circle_slug = c.slug AND m.user_id = %s) AS joined "
    "FROM circles c"
)


def load_circle(conn, slug: str, user_id: int | None) -> dict:
    row = conn.execute(CIRCLE_SELECT + " WHERE c.slug = %s", (user_id, slug)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Circle not found.")
    return circle_dict(row)


@router.get("/circles")
def list_circles(user_id: int | None = Depends(optional_user_id)) -> dict:
    with db.connect() as conn:
        rows = conn.execute(CIRCLE_SELECT + " ORDER BY array_position(ARRAY['animal','plant','water'], c.category), c.slug", (user_id,)).fetchall()
    return {"circles": [circle_dict(r) for r in rows]}


@router.get("/circles/{slug}")
def get_circle(slug: str, user_id: int | None = Depends(optional_user_id)) -> dict:
    with db.connect() as conn:
        circle = load_circle(conn, slug, user_id)
        members = None
        if circle["joined"]:  # the roster is for members only
            rows = conn.execute(
                "SELECT u.name, m.joined_at FROM circle_members m JOIN users u ON u.id = m.user_id "
                "WHERE m.circle_slug = %s ORDER BY m.joined_at DESC LIMIT %s",
                (slug, ROSTER_LIMIT),
            ).fetchall()
            members = [{"name": r["name"], "joinedAt": r["joined_at"]} for r in rows]
    return {**circle, "members": members}


@router.post("/circles/{slug}/join")
def join_circle(slug: str, user: dict = Depends(auth.current_user)) -> dict:
    with db.connect() as conn:
        load_circle(conn, slug, user["id"])  # 404 if unknown
        conn.execute(
            "INSERT INTO circle_members (circle_slug, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (slug, user["id"]),
        )
        return load_circle(conn, slug, user["id"])


@router.delete("/circles/{slug}/join")
def leave_circle(slug: str, user: dict = Depends(auth.current_user)) -> dict:
    with db.connect() as conn:
        load_circle(conn, slug, user["id"])
        conn.execute("DELETE FROM circle_members WHERE circle_slug = %s AND user_id = %s", (slug, user["id"]))
        return load_circle(conn, slug, user["id"])


# ---------------------------------------------------------------- discussions (members only)

THREAD_LIMIT = 30
REPLY_LIMIT = 200
HIDE_AFTER_REPORTS = 3  # distinct members who report an item before it is hidden pending review
POST_BURST = 5          # max posts (threads + replies) per member per minute


def check_post_rate(conn, user_id: int) -> None:
    row = conn.execute(
        "SELECT (SELECT COUNT(*) FROM circle_threads WHERE author_id = %s AND created_at > now() - interval '1 minute') + "
        "(SELECT COUNT(*) FROM circle_replies WHERE author_id = %s AND created_at > now() - interval '1 minute') AS n",
        (user_id, user_id),
    ).fetchone()
    if row["n"] >= POST_BURST:
        raise HTTPException(status_code=429, detail="You're posting too fast. Wait a minute and try again.")


class ReportIn(BaseModel):
    reason: str | None = Field(default=None, max_length=200)


class ThreadIn(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    body: str = Field(min_length=1, max_length=4000)

    @field_validator("title", "body")
    @classmethod
    def _strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Cannot be empty.")
        return value


class ReplyIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)

    @field_validator("body")
    @classmethod
    def _strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Cannot be empty.")
        return value


def require_member(conn, slug: str, user_id: int) -> None:
    load_circle(conn, slug, user_id)  # 404 if the circle is unknown
    row = conn.execute(
        "SELECT 1 FROM circle_members WHERE circle_slug = %s AND user_id = %s", (slug, user_id)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=403, detail="Join this circle to take part in discussions.")


def thread_dict(row: dict, user_id: int) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "body": row["body"],
        "author": row["author_name"],
        "createdAt": row["created_at"],
        "replyCount": row.get("reply_count", 0),
        "lastActivity": row.get("last_activity", row["created_at"]),
        "mine": row["author_id"] == user_id,
        "hidden": bool(row.get("hidden", False)),
    }


def reply_dict(row: dict, user_id: int) -> dict:
    return {
        "id": row["id"],
        "body": row["body"],
        "author": row["author_name"],
        "createdAt": row["created_at"],
        "mine": row["author_id"] == user_id,
        "hidden": bool(row.get("hidden", False)),
    }


THREAD_SELECT = (
    "SELECT t.id, t.title, t.body, t.created_at, t.author_id, t.hidden, u.name AS author_name, "
    "(SELECT COUNT(*) FROM circle_replies r WHERE r.thread_id = t.id AND NOT r.hidden) AS reply_count, "
    "GREATEST(t.created_at, COALESCE((SELECT MAX(r.created_at) FROM circle_replies r WHERE r.thread_id = t.id), t.created_at)) AS last_activity "
    "FROM circle_threads t JOIN users u ON u.id = t.author_id"
)


def load_thread(conn, slug: str, thread_id: int, user_id: int) -> dict:
    row = conn.execute(
        THREAD_SELECT + " WHERE t.id = %s AND t.circle_slug = %s AND (NOT t.hidden OR t.author_id = %s)",
        (thread_id, slug, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Discussion not found.")
    return row


@router.get("/circles/{slug}/threads")
def list_threads(slug: str, user: dict = Depends(auth.current_user)) -> dict:
    with db.connect() as conn:
        require_member(conn, slug, user["id"])
        rows = conn.execute(
            THREAD_SELECT + " WHERE t.circle_slug = %s AND (NOT t.hidden OR t.author_id = %s) ORDER BY last_activity DESC LIMIT %s",
            (slug, user["id"], THREAD_LIMIT),
        ).fetchall()
    return {"threads": [thread_dict(r, user["id"]) for r in rows]}


@router.post("/circles/{slug}/threads", status_code=201)
def create_thread(slug: str, payload: ThreadIn, user: dict = Depends(auth.current_user)) -> dict:
    with db.connect() as conn:
        require_member(conn, slug, user["id"])
        check_post_rate(conn, user["id"])
        new = conn.execute(
            "INSERT INTO circle_threads (circle_slug, author_id, title, body) VALUES (%s, %s, %s, %s) RETURNING id",
            (slug, user["id"], payload.title, payload.body),
        ).fetchone()
        return thread_dict(load_thread(conn, slug, new["id"], user["id"]), user["id"])


@router.get("/circles/{slug}/threads/{thread_id}")
def get_thread(slug: str, thread_id: int, user: dict = Depends(auth.current_user)) -> dict:
    with db.connect() as conn:
        require_member(conn, slug, user["id"])
        thread = thread_dict(load_thread(conn, slug, thread_id, user["id"]), user["id"])
        rows = conn.execute(
            "SELECT r.id, r.body, r.created_at, r.author_id, r.hidden, u.name AS author_name "
            "FROM circle_replies r JOIN users u ON u.id = r.author_id "
            "WHERE r.thread_id = %s AND (NOT r.hidden OR r.author_id = %s) ORDER BY r.created_at, r.id LIMIT %s",
            (thread_id, user["id"], REPLY_LIMIT),
        ).fetchall()
    return {**thread, "replies": [reply_dict(r, user["id"]) for r in rows]}


@router.post("/circles/{slug}/threads/{thread_id}/replies", status_code=201)
def create_reply(slug: str, thread_id: int, payload: ReplyIn, user: dict = Depends(auth.current_user)) -> dict:
    with db.connect() as conn:
        require_member(conn, slug, user["id"])
        load_thread(conn, slug, thread_id, user["id"])
        check_post_rate(conn, user["id"])
        new = conn.execute(
            "INSERT INTO circle_replies (thread_id, author_id, body) VALUES (%s, %s, %s) RETURNING id, body, created_at, author_id",
            (thread_id, user["id"], payload.body),
        ).fetchone()
        return reply_dict({**new, "author_name": user["name"]}, user["id"])


@router.delete("/circles/{slug}/threads/{thread_id}", status_code=204)
def delete_thread(slug: str, thread_id: int, user: dict = Depends(auth.current_user)) -> None:
    with db.connect() as conn:
        require_member(conn, slug, user["id"])
        thread = load_thread(conn, slug, thread_id, user["id"])
        if thread["author_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="You can only delete your own discussions.")
        conn.execute("DELETE FROM circle_threads WHERE id = %s", (thread_id,))


@router.delete("/circles/{slug}/threads/{thread_id}/replies/{reply_id}", status_code=204)
def delete_reply(slug: str, thread_id: int, reply_id: int, user: dict = Depends(auth.current_user)) -> None:
    with db.connect() as conn:
        require_member(conn, slug, user["id"])
        load_thread(conn, slug, thread_id, user["id"])
        row = conn.execute(
            "SELECT author_id FROM circle_replies WHERE id = %s AND thread_id = %s", (reply_id, thread_id)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Reply not found.")
        if row["author_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="You can only delete your own replies.")
        conn.execute("DELETE FROM circle_replies WHERE id = %s", (reply_id,))


def _record_report(conn, table: str, col: str, item_id: int, author_id: int, user_id: int, reason: str | None) -> None:
    if author_id == user_id:
        raise HTTPException(status_code=400, detail="You can't report your own post.")
    conn.execute(
        f"INSERT INTO circle_reports ({col}, reporter_id, reason) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
        (item_id, user_id, (reason or "").strip() or None),
    )
    count = conn.execute(f"SELECT COUNT(DISTINCT reporter_id) AS n FROM circle_reports WHERE {col} = %s", (item_id,)).fetchone()["n"]
    if count >= HIDE_AFTER_REPORTS:
        conn.execute(f"UPDATE {table} SET hidden = TRUE WHERE id = %s", (item_id,))


@router.post("/circles/{slug}/threads/{thread_id}/report", status_code=204)
def report_thread(slug: str, thread_id: int, payload: ReportIn, user: dict = Depends(auth.current_user)) -> None:
    with db.connect() as conn:
        require_member(conn, slug, user["id"])
        thread = load_thread(conn, slug, thread_id, user["id"])
        _record_report(conn, "circle_threads", "thread_id", thread_id, thread["author_id"], user["id"], payload.reason)


@router.post("/circles/{slug}/threads/{thread_id}/replies/{reply_id}/report", status_code=204)
def report_reply(slug: str, thread_id: int, reply_id: int, payload: ReportIn, user: dict = Depends(auth.current_user)) -> None:
    with db.connect() as conn:
        require_member(conn, slug, user["id"])
        load_thread(conn, slug, thread_id, user["id"])
        row = conn.execute("SELECT author_id FROM circle_replies WHERE id = %s AND thread_id = %s", (reply_id, thread_id)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Reply not found.")
        _record_report(conn, "circle_replies", "reply_id", reply_id, row["author_id"], user["id"], payload.reason)
