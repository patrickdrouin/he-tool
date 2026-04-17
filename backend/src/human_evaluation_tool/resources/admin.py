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
    Marking,
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


@bp.post("/api/admin/assign")
@jwt_required()
def assign_evaluation() -> ResponseReturnValue:
    """Assign an existing evaluation to an existing user.

    Request body:
    {
        "evaluation_id": 3,
        "user_email": "alice@example.com"
    }

    Creates Annotation + AnnotationSystem rows for every bitext in the
    evaluation for the given user.  Returns 409 if the user is already
    fully assigned (i.e. already has an annotation for the first bitext).
    """

    data = request.get_json(silent=True) or {}
    missing = [f for f in ("evaluation_id", "user_email") if f not in data]
    if missing:
        return {"message": f"Missing required fields: {', '.join(missing)}"}, 422

    evaluation = db.session.get(Evaluation, int(data["evaluation_id"]))
    if evaluation is None:
        return {"message": "Evaluation not found"}, 404

    user = db.session.execute(
        select(User).filter_by(email=data["user_email"])
    ).scalar_one_or_none()
    if user is None:
        return {"message": f"No user with email '{data['user_email']}'"}, 404

    # Collect one representative existing annotation per bitext so we can copy
    # the system + translation data.
    existing_annotations = (
        db.session.execute(
            select(Annotation).filter_by(evaluationId=evaluation.id)
        )
        .scalars()
        .all()
    )

    if not existing_annotations:
        return {"message": "Evaluation has no segments to assign"}, 422

    # Build a map: bitextId -> first existing Annotation for that bitext
    bitext_to_annotation: dict[int, Annotation] = {}
    for ann in existing_annotations:
        bitext_to_annotation.setdefault(ann.bitextId, ann)

    # Check if user is already assigned to this evaluation
    already = db.session.execute(
        select(Annotation).filter_by(
            evaluationId=evaluation.id, userId=user.id
        ).limit(1)
    ).scalar_one_or_none()
    if already is not None:
        return {"message": f"User '{data['user_email']}' is already assigned to this evaluation"}, 409

    try:
        now = datetime.now()

        for bitext_id, ref_ann in bitext_to_annotation.items():
            annotation = Annotation(
                userId=user.id,
                evaluationId=evaluation.id,
                bitextId=bitext_id,
                isAnnotated=False,
                comment=None,
                createdAt=now,
                updatedAt=now,
            )
            db.session.add(annotation)
            db.session.flush()

            # Copy every system+translation from the reference annotation
            ref_systems = db.session.execute(
                select(AnnotationSystem).filter_by(annotationId=ref_ann.id)
            ).scalars().all()

            for ref_sys in ref_systems:
                db.session.add(AnnotationSystem(
                    annotationId=annotation.id,
                    systemId=ref_sys.systemId,
                    translation=ref_sys.translation,
                    createdAt=now,
                    updatedAt=now,
                ))

        db.session.commit()

        n = len(bitext_to_annotation)
        return jsonify({
            "message": f"Assigned {n} segments of '{evaluation.name}' to '{user.email}'",
        }), 201

    except SQLAlchemyError as exc:
        db.session.rollback()
        return {"message": str(exc)}, 500


@bp.delete("/api/admin/assign")
@jwt_required()
def unassign_evaluation() -> ResponseReturnValue:
    """Remove a user's assignment from an evaluation.

    Request body:
    {
        "evaluation_id": 3,
        "user_email": "alice@example.com"
    }

    Deletes all annotations (and their markings) for the given user+evaluation.
    """

    data = request.get_json(silent=True) or {}
    missing = [f for f in ("evaluation_id", "user_email") if f not in data]
    if missing:
        return {"message": f"Missing required fields: {', '.join(missing)}"}, 422

    evaluation = db.session.get(Evaluation, int(data["evaluation_id"]))
    if evaluation is None:
        return {"message": "Evaluation not found"}, 404

    user = db.session.execute(
        select(User).filter_by(email=data["user_email"])
    ).scalar_one_or_none()
    if user is None:
        return {"message": f"No user with email '{data['user_email']}'"}, 404

    annotations = (
        db.session.execute(
            select(Annotation).filter_by(evaluationId=evaluation.id, userId=user.id)
        )
        .scalars()
        .all()
    )

    if not annotations:
        return {"message": f"User '{data['user_email']}' has no tasks in this evaluation"}, 404

    try:
        n = len(annotations)
        for annotation in annotations:
            db.session.delete(annotation)
        db.session.commit()
        return jsonify({
            "message": f"Removed {n} tasks of '{evaluation.name}' from '{user.email}'",
        }), 200
    except SQLAlchemyError as exc:
        db.session.rollback()
        return {"message": str(exc)}, 500
