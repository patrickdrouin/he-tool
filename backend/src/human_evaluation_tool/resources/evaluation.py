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

import math
from datetime import datetime
from typing import Iterable

from flask import Blueprint, jsonify, request
from flask.typing import ResponseReturnValue
from flask_jwt_extended import get_jwt_identity, jwt_required
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
from ..utils import CATEGORY_NAME, SEVERITY_NAME


bp = Blueprint("evaluations", __name__)


def _current_time() -> datetime:
    return datetime.now()


def _annotations_for_evaluation(
    evaluation_id: int, user_id: int | None
) -> Iterable[Annotation]:
    stmt = select(Annotation).filter_by(evaluationId=evaluation_id)
    if user_id is not None:
        stmt = stmt.filter_by(userId=user_id)
    return db.session.execute(stmt).scalars().all()


@bp.get("/api/evaluations")
@jwt_required()
def read_evaluations() -> ResponseReturnValue:
    """Return all evaluations."""

    evaluations = db.session.execute(select(Evaluation)).scalars().all()
    return jsonify([evaluation.to_dict() for evaluation in evaluations]), 200


@bp.post("/api/evaluations")
@jwt_required()
def create_evaluation() -> ResponseReturnValue:
    """Create a new evaluation."""

    data = request.get_json(silent=True) or {}
    required_fields = ["name", "type"]
    if any(field not in data for field in required_fields):
        return {"message": "Missing required field"}, 422

    existing = db.session.execute(
        select(Evaluation).filter_by(name=data["name"])
    ).scalar_one_or_none()
    if existing is not None:
        return {"message": "Evaluation already exists"}, 409

    try:
        now = _current_time()
        evaluation = Evaluation(
            name=data["name"],
            type=data["type"],
            isFinished=bool(data.get("isFinished", False)),
            createdAt=now,
            updatedAt=now,
        )
        db.session.add(evaluation)
        db.session.commit()
        return jsonify(evaluation.to_dict()), 201
    except SQLAlchemyError as exc:
        db.session.rollback()
        return {"message": str(exc)}, 500


@bp.get("/api/evaluations/<int:evaluation_id>")
@jwt_required()
def read_evaluation(evaluation_id: int) -> ResponseReturnValue:
    """Return a specific evaluation."""

    evaluation = db.session.get(Evaluation, evaluation_id)
    if evaluation is None:
        return {"message": "Evaluation not found"}, 404
    return jsonify(evaluation.to_dict()), 200


@bp.get("/api/evaluations/<int:evaluation_id>/annotations")
@jwt_required()
def read_evaluation_annotations(evaluation_id: int) -> ResponseReturnValue:
    """Return annotations for a specific evaluation and the current user."""

    evaluation = db.session.get(Evaluation, evaluation_id)
    if evaluation is None:
        return {"message": "Evaluation not found"}, 404

    identity = get_jwt_identity()
    user_id = int(identity) if identity is not None else None
    annotations = _annotations_for_evaluation(evaluation_id, user_id)
    return jsonify([annotation.to_dict() for annotation in annotations]), 200


@bp.get("/api/evaluations/<int:evaluation_id>/results")
@jwt_required()
def read_evaluation_results(evaluation_id: int) -> ResponseReturnValue:
    """Return TSV formatted evaluation results."""

    if db.session.get(Evaluation, evaluation_id) is None:
        return {"message": "Evaluation not found"}, 404

    annotations = (
        db.session.execute(select(Annotation).filter_by(evaluationId=evaluation_id))
        .scalars()
        .all()
    )

    results: list[str] = []
    for annotation in annotations:
        bitext = db.session.get(Bitext, annotation.bitextId)
        user = db.session.get(User, annotation.userId)
        if bitext is None or user is None:
            continue
        document = db.session.get(Document, bitext.documentId)
        if document is None:
            continue
        markings = (
            db.session.execute(select(Marking).filter_by(annotationId=annotation.id))
            .scalars()
            .all()
        )

        for marking in markings:
            annotation_system = db.session.execute(
                select(AnnotationSystem).filter_by(
                    annotationId=annotation.id, systemId=marking.systemId
                )
            ).scalar_one_or_none()
            system = db.session.get(System, marking.systemId)

            if annotation_system is None or system is None:
                continue

            row: list[str] = []
            row.append(system.name)
            row.append(document.name)
            row.append(str(bitext.id))
            row.append(str(bitext.id))
            row.append(user.email.split("@")[0])

            translation_text = annotation_system.translation or ""
            if marking.isSource:
                source = bitext.source.replace("\n", "<br>").split(" ")
                source.insert(marking.errorStart, "<v>")
                source.insert(marking.errorEnd + 2, "</v>")
                row.append(" ".join(source))
                row.append(translation_text.replace("\n", "<br>"))
            else:
                translation = translation_text.replace("\n", "<br>").split(" ")
                translation.insert(marking.errorStart, "<v>")
                translation.insert(marking.errorEnd + 2, "</v>")
                row.append(bitext.source.replace("\n", "<br>"))
                row.append(" ".join(translation))

            row.append(CATEGORY_NAME[marking.errorCategory])
            row.append(SEVERITY_NAME[marking.errorSeverity])
            row.append(annotation.comment or "")

            results.append("\t".join(row) + "\n")

    return jsonify(results), 200


_SEVERITY_WEIGHT: dict[str, float] = {
    "no-error": 0.0,
    "not-judgeable": 0.0,
    "minor": 1.0,
    "major": 5.0,
    "critical": 25.0,
}


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    """Return Pearson r for two equal-length lists, or None if undefined."""
    n = len(xs)
    if n < 2:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = math.sqrt(
        sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys)
    )
    return num / den if den > 0 else None


def _spearman(xs: list[float], ys: list[float]) -> float | None:
    """Return Spearman ρ for two equal-length lists, or None if undefined."""
    n = len(xs)
    if n < 2:
        return None

    def _ranks(vals: list[float]) -> list[float]:
        indexed = sorted(enumerate(vals), key=lambda iv: iv[1])
        ranks = [0.0] * n
        i = 0
        while i < n:
            j = i
            while j < n - 1 and indexed[j + 1][1] == indexed[j][1]:
                j += 1
            avg_rank = (i + j) / 2 + 1
            for k in range(i, j + 1):
                ranks[indexed[k][0]] = avg_rank
            i = j + 1
        return ranks

    return _pearson(_ranks(xs), _ranks(ys))


@bp.get("/api/evaluations/<int:evaluation_id>/iaa")
@jwt_required()
def read_evaluation_iaa(evaluation_id: int) -> ResponseReturnValue:
    """Return inter-annotator agreement statistics for an evaluation.

    Response shape:
    {
      "annotators": ["alice@example.com", "bob@example.com"],
      "segments": [
        {
          "bitext_id": 1,
          "source": "...",
          "scores": {"alice@example.com": 6.0, "bob@example.com": 1.0}
        },
        ...
      ],
      "correlations": [
        {
          "annotator_a": "alice@example.com",
          "annotator_b": "bob@example.com",
          "n_segments": 20,
          "pearson": 0.87,
          "spearman": 0.82
        }
      ]
    }
    """

    if db.session.get(Evaluation, evaluation_id) is None:
        return {"message": "Evaluation not found"}, 404

    annotations = (
        db.session.execute(select(Annotation).filter_by(evaluationId=evaluation_id))
        .scalars()
        .all()
    )

    # Build: bitext_id -> annotator_email -> MQM score
    scores: dict[int, dict[str, float]] = {}
    annotator_set: set[str] = set()

    for annotation in annotations:
        user = db.session.get(User, annotation.userId)
        if user is None:
            continue
        email = user.email
        annotator_set.add(email)

        markings = (
            db.session.execute(select(Marking).filter_by(annotationId=annotation.id))
            .scalars()
            .all()
        )
        segment_score = sum(
            _SEVERITY_WEIGHT.get(m.errorSeverity, 0.0)
            for m in markings
            if not m.isSource
        )

        scores.setdefault(annotation.bitextId, {})[email] = segment_score

    annotators = sorted(annotator_set)

    # Build segment list (only bitexts annotated by at least one user)
    segments = []
    for bitext_id, user_scores in sorted(scores.items()):
        bitext = db.session.get(Bitext, bitext_id)
        segments.append({
            "bitext_id": bitext_id,
            "source": bitext.source if bitext else "",
            "scores": user_scores,
        })

    # Pairwise correlations over segments both annotators have scored
    correlations = []
    for i, a in enumerate(annotators):
        for b in annotators[i + 1:]:
            shared = [
                (seg["scores"][a], seg["scores"][b])
                for seg in segments
                if a in seg["scores"] and b in seg["scores"]
            ]
            if not shared:
                continue
            xs, ys = zip(*shared)
            xs, ys = list(xs), list(ys)
            correlations.append({
                "annotator_a": a,
                "annotator_b": b,
                "n_segments": len(shared),
                "pearson": _pearson(xs, ys),
                "spearman": _spearman(xs, ys),
            })

    return jsonify({
        "annotators": annotators,
        "segments": segments,
        "correlations": correlations,
    }), 200


@bp.put("/api/evaluations/<int:evaluation_id>")
@jwt_required()
def update_evaluation(evaluation_id: int) -> ResponseReturnValue:
    """Update an evaluation."""

    evaluation = db.session.get(Evaluation, evaluation_id)
    if evaluation is None:
        return {"message": "Evaluation not found"}, 404

    data = request.get_json(silent=True) or {}
    required_fields = ["name", "type"]
    if any(field not in data for field in required_fields):
        return {"message": "Missing required field"}, 422

    conflict = db.session.execute(
        select(Evaluation).filter(
            Evaluation.id != evaluation_id, Evaluation.name == data["name"]
        )
    ).scalar_one_or_none()
    if conflict is not None:
        return {"message": "Evaluation already exists"}, 409

    try:
        evaluation.name = data["name"]
        evaluation.type = data["type"]
        if "isFinished" in data:
            evaluation.isFinished = bool(data["isFinished"])
        evaluation.updatedAt = _current_time()
        db.session.commit()
        return jsonify(evaluation.to_dict()), 200
    except SQLAlchemyError as exc:
        db.session.rollback()
        return {"message": str(exc)}, 500


@bp.delete("/api/evaluations/<int:evaluation_id>")
@jwt_required()
def delete_evaluation(evaluation_id: int) -> ResponseReturnValue:
    """Delete an evaluation."""

    evaluation = db.session.get(Evaluation, evaluation_id)
    if evaluation is None:
        return {"message": "Evaluation not found"}, 404

    try:
        db.session.delete(evaluation)
        db.session.commit()
        return jsonify({}), 204
    except SQLAlchemyError as exc:
        db.session.rollback()
        return {"message": str(exc)}, 500
