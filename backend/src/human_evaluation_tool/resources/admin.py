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
"""

from __future__ import annotations

from datetime import datetime

from flask import Blueprint, jsonify, request
from flask.typing import ResponseReturnValue
from flask_jwt_extended import jwt_required
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from .. import db
from ..models import (
    Annotation,
    AnnotationSystem,
    Bitext,
    Document,
    Evaluation,
    System,
    User,
)


bp = Blueprint("admin", __name__)


@bp.post("/api/admin/import")
@jwt_required()
def import_evaluation() -> ResponseReturnValue:
    """Create an evaluation from a list of source/target pairs.

    Request body:
    {
        "evaluation": "My Evaluation",
        "system": "DeepL",
        "users": ["alice@example.com", "bob@example.com"],
        "pairs": [{"source": "...", "target": "..."}, ...]
    }
    """

    data = request.get_json(silent=True) or {}

    required = ["evaluation", "system", "users", "pairs"]
    missing = [f for f in required if f not in data]
    if missing:
        return {"message": f"Missing required fields: {', '.join(missing)}"}, 422

    pairs = data["pairs"]
    if not isinstance(pairs, list) or not pairs:
        return {"message": "'pairs' must be a non-empty list"}, 422

    bad = [i for i, p in enumerate(pairs) if "source" not in p or "target" not in p]
    if bad:
        return {"message": f"Items at indexes {bad} are missing 'source' or 'target'"}, 422

    user_emails = data["users"]
    if not isinstance(user_emails, list) or not user_emails:
        return {"message": "'users' must be a non-empty list of email addresses"}, 422

    # Resolve users
    users: list[User] = []
    for email in user_emails:
        u = db.session.execute(select(User).filter_by(email=email)).scalar_one_or_none()
        if u is None:
            return {"message": f"No user with email '{email}'"}, 404
        users.append(u)

    # Check evaluation name is available
    if db.session.execute(
        select(Evaluation).filter_by(name=data["evaluation"])
    ).scalar_one_or_none():
        return {"message": f"Evaluation '{data['evaluation']}' already exists"}, 409

    try:
        now = datetime.now()

        document = Document(name=data["evaluation"], createdAt=now, updatedAt=now)
        db.session.add(document)
        db.session.flush()

        bitexts = [
            Bitext(
                documentId=document.id,
                source=p["source"],
                target=None,
                createdAt=now,
                updatedAt=now,
            )
            for p in pairs
        ]
        db.session.add_all(bitexts)
        db.session.flush()

        mt_system = db.session.execute(
            select(System).filter_by(name=data["system"])
        ).scalar_one_or_none()
        if mt_system is None:
            mt_system = System(name=data["system"], createdAt=now, updatedAt=now)
            db.session.add(mt_system)
            db.session.flush()

        eval_obj = Evaluation(
            name=data["evaluation"],
            type="error-marking",
            isFinished=False,
            createdAt=now,
            updatedAt=now,
        )
        db.session.add(eval_obj)
        db.session.flush()

        for user in users:
            for bitext, pair in zip(bitexts, pairs):
                annotation = Annotation(
                    userId=user.id,
                    evaluationId=eval_obj.id,
                    bitextId=bitext.id,
                    isAnnotated=False,
                    comment=None,
                    createdAt=now,
                    updatedAt=now,
                )
                db.session.add(annotation)
                db.session.flush()

                db.session.add(AnnotationSystem(
                    annotationId=annotation.id,
                    systemId=mt_system.id,
                    translation=pair["target"],
                    createdAt=now,
                    updatedAt=now,
                ))

        db.session.commit()

        return jsonify({
            "message": f"Imported {len(pairs)} segments",
            "evaluation": eval_obj.to_dict(),
        }), 201

    except SQLAlchemyError as exc:
        db.session.rollback()
        return {"message": str(exc)}, 500
