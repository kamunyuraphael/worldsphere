"""Unit tests for signup validation helpers (no database or network needed)."""
import os

os.environ.setdefault("AUTH_SECRET", "x" * 40)

import pytest  # noqa: E402

from app import auth  # noqa: E402


@pytest.mark.parametrize("email", ["a@b.co", "name.surname+tag@example.com", "user@mail.example.co.ke"])
def test_valid_emails_are_accepted(email):
    assert auth.email_problem(email) is None


@pytest.mark.parametrize("email", ["plainaddress", "no-at.example.com", "a@b", "a@b.c", "two@@example.com", "sp ace@example.com", "@example.com", "a@" + "b" * 250 + ".com"])
def test_invalid_emails_are_rejected(email):
    assert auth.email_problem(email)


def test_short_password_rejected():
    assert "at least 8" in auth.password_problem("abc123")


def test_overlong_password_rejected():
    assert auth.password_problem("a1!" * 50)


@pytest.mark.parametrize("password", ["password", "Password123", "QWERTYUIOP", "WorldSphere"])
def test_common_passwords_rejected_case_insensitively(password):
    assert "too common" in auth.password_problem(password)


def test_password_equal_to_email_rejected():
    assert "same as your email" in auth.password_problem("Someone@Example.com", "someone@example.com")


def test_reasonable_password_accepted():
    assert auth.password_problem("tusker-Mara-2031!", "me@example.com") is None


def test_hash_roundtrip_still_works():
    stored = auth.hash_password("tusker-Mara-2031!")
    assert auth.verify_password("tusker-Mara-2031!", stored)
    assert not auth.verify_password("wrong-password", stored)
