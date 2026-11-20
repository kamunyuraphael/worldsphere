"""Pydantic schemas for the WorldSphere server: auth + favorites."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


# ---- auth + favorites ----------------------------------------------------

class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: int
    name: str
    email: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class FavoriteIn(BaseModel):
    key: str = Field(min_length=1, max_length=255)
    source: Literal["gbif", "catalog", "destination", "attraction", "trip", "trip_plan"]
    name: str = Field(min_length=1, max_length=300)
    scientificName: str | None = Field(default=None, max_length=300)
    image: str | None = Field(default=None, max_length=2048)


class FavoriteOut(FavoriteIn):
    id: int
