"""
Copyright (C) 2023-2025 Yaraku, Inc.

This file is part of Human Evaluation Tool.

Human Evaluation Tool is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by the
Free Software Foundation, either version 3 of the License,
or (at your option) any later version.

Human Evaluation Tool is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with
Human Evaluation Tool. If not, see <https://www.gnu.org/licenses/>.

Written by Giovanni G. De Giacomo <giovanni@yaraku.com>, August 2023
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Callable, TypeVar, cast

from flask import Blueprint, Flask, Response, jsonify, request
from flask.typing import ResponseReturnValue
from flask_jwt_extended import (
    create_access_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
    set_access_cookies,
    unset_jwt_cookies,
)
from sqlalchemy import select

from . import bcrypt, db
from .models import User


bp = Blueprint("auth", __name__)


@bp.post("/api/auth/register")
def register() -> ResponseReturnValue:
    """Public endpoint to create a new user account."""

    from datetime import datetime

    from sqlalchemy.exc import SQLAlchemyError

    data = request.get_json(silent=True) or {}
    required_fields = ["email", "password", "nativeLanguage"]
    if any(field not in data for field in required_fields):
        return {"message": "Missing required field"}, 422

    existing = db.session.execute(
        select(User).filter_by(email=data["email"])
    ).scalar_one_or_none()
    if existing is not None:
        return {"message": "An account with that email already exists"}, 409

    try:
        now = datetime.now()
        user = User(
            email=data["email"],
            password=bcrypt.generate_password_hash(data["password"]).decode("utf-8"),
            nativeLanguage=data["nativeLanguage"],
            createdAt=now,
            updatedAt=now,
        )
        db.session.add(user)
        db.session.commit()
        return {"message": "Account created successfully"}, 201
    except SQLAlchemyError as exc:
        db.session.rollback()
        return {"message": str(exc)}, 500


_F = TypeVar("_F", bound=Callable[..., ResponseReturnValue])


def _typed_jwt_required(*args: Any, **kwargs: Any) -> Callable[[_F], _F]:
    """Typed wrapper around :func:`flask_jwt_extended.jwt_required`."""

    return cast("Callable[[_F], _F]", jwt_required(*args, **kwargs))


@bp.after_app_request
def refresh_expiring_jwts(response: Response) -> Response:
    """Refresh the JWT cookie if the token is about to expire."""

    try:
        exp_timestamp = get_jwt()["exp"]
        now = datetime.now(timezone.utc)
        target_timestamp = datetime.timestamp(now + timedelta(minutes=15))
        if target_timestamp > exp_timestamp:
            identity = get_jwt_identity()
            if identity is None:
                return response
            access_token = create_access_token(identity=identity)
            set_access_cookies(response, access_token)
        return response
    except (RuntimeError, KeyError):
        # No valid JWT present – return the original response unchanged.
        return response


@bp.post("/api/auth/login")
def login() -> ResponseReturnValue:
    """Login endpoint that issues a JWT cookie."""

    data = request.get_json(silent=True) or {}

    email = data.get("email")
    password = data.get("password")
    remember = bool(data.get("remember"))

    if not email or not password:
        return {"success": False, "message": "Invalid username and password"}, 401

    user = db.session.execute(select(User).filter_by(email=email)).scalar_one_or_none()
    if user and bcrypt.check_password_hash(pw_hash=user.password, password=password):
        response = jsonify({"success": True})
        expires = timedelta(days=7) if remember else timedelta(hours=1)
        access_token = create_access_token(identity=user.id, expires_delta=expires)
        set_access_cookies(response, access_token)
        return response, 200

    return {"success": False, "message": "Invalid username and password"}, 401


@bp.post("/api/auth/logout")
def logout() -> ResponseReturnValue:
    """Logout endpoint that clears the JWT cookies."""

    response = jsonify({"success": True})
    unset_jwt_cookies(response)
    return response, 200


@bp.get("/api/auth/validate")
@_typed_jwt_required()
def validate() -> ResponseReturnValue:
    """Validate that the JWT token stored in cookies is still valid."""

    return jsonify({"success": False}), 200


@bp.get("/api/auth/me")
@_typed_jwt_required()
def me() -> ResponseReturnValue:
    """Return the current authenticated user's profile."""

    identity = get_jwt_identity()
    user = db.session.get(User, int(identity))
    if user is None:
        return {"message": "User not found"}, 404
    return jsonify(user.to_dict()), 200


@bp.post("/api/auth/change-password")
@_typed_jwt_required()
def change_password() -> ResponseReturnValue:
    """Change the current user's password."""

    from sqlalchemy.exc import SQLAlchemyError

    data = request.get_json(silent=True) or {}
    if "current_password" not in data or "new_password" not in data:
        return {"message": "Missing required fields"}, 422

    identity = get_jwt_identity()
    user = db.session.get(User, int(identity))
    if user is None:
        return {"message": "User not found"}, 404

    if not bcrypt.check_password_hash(pw_hash=user.password, password=data["current_password"]):
        return {"message": "Current password is incorrect"}, 401

    if len(data["new_password"]) < 8:
        return {"message": "New password must be at least 8 characters"}, 422

    try:
        user.password = bcrypt.generate_password_hash(data["new_password"]).decode("utf-8")
        user.updatedAt = datetime.now()
        db.session.commit()
        return jsonify({"message": "Password updated successfully"}), 200
    except SQLAlchemyError as exc:
        db.session.rollback()
        return {"message": str(exc)}, 500


def register_auth_blueprint(app: Flask) -> None:
    """Attach the authentication blueprint to the Flask app."""

    app.register_blueprint(bp)
