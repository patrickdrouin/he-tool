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
from xml.etree import ElementTree as ET

from flask import Blueprint, Response, jsonify, request
from flask.typing import ResponseReturnValue
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, select
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
from .evaluation import _SEVERITY_WEIGHT


bp = Blueprint("admin", __name__)


def _require_admin() -> tuple | None:
    """Return a 403 response tuple if the current JWT user is not an admin, else None."""
    identity = get_jwt_identity()
    if identity is None:
        return {"message": "Unauthorized"}, 403
    user = db.session.get(User, int(identity))
    if user is None or not user.isAdmin:
        return {"message": "Admin access required"}, 403
    return None


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


@bp.get("/api/admin/evaluations/<int:evaluation_id>/bitexts")
@jwt_required()
def list_evaluation_bitexts(evaluation_id: int) -> ResponseReturnValue:
    """Return all source segments (bitexts) for an evaluation."""

    evaluation = db.session.get(Evaluation, evaluation_id)
    if evaluation is None:
        return {"message": "Evaluation not found"}, 404

    # Collect distinct bitext IDs referenced by this evaluation's annotations
    rows = (
        db.session.execute(
            select(Annotation.bitextId)
            .filter_by(evaluationId=evaluation_id)
            .distinct()
        )
        .scalars()
        .all()
    )

    result = []
    for i, bitext_id in enumerate(sorted(rows)):
        bitext = db.session.get(Bitext, bitext_id)
        if bitext:
            result.append({
                "bitext_id": bitext_id,
                "task_number": i + 1,
                "source": bitext.source,
            })

    return jsonify(result), 200


@bp.delete("/api/admin/task")
@jwt_required()
def delete_evaluation_task() -> ResponseReturnValue:
    """Delete a single source segment from an evaluation for all users.

    Deletes all annotations (and their markings) for the given bitext
    across every annotator, then deletes the bitext itself. If the
    parent document has no remaining bitexts it is also deleted.

    Request body: { "evaluation_id": 3, "bitext_id": 17 }
    """

    data = request.get_json(silent=True) or {}
    missing = [f for f in ("evaluation_id", "bitext_id") if f not in data]
    if missing:
        return {"message": f"Missing required fields: {', '.join(missing)}"}, 422

    evaluation = db.session.get(Evaluation, int(data["evaluation_id"]))
    if evaluation is None:
        return {"message": "Evaluation not found"}, 404

    bitext = db.session.get(Bitext, int(data["bitext_id"]))
    if bitext is None:
        return {"message": "Task not found"}, 404

    # Verify this bitext actually belongs to the evaluation
    belongs = db.session.execute(
        select(Annotation).filter_by(
            evaluationId=evaluation.id, bitextId=bitext.id
        ).limit(1)
    ).scalar_one_or_none()
    if belongs is None:
        return {"message": "Task does not belong to this evaluation"}, 404

    try:
        document_id = bitext.documentId
        # Cascade deletes all annotations + markings for this bitext
        db.session.delete(bitext)
        db.session.flush()

        # Delete the document if it has no remaining bitexts
        remaining = db.session.execute(
            select(func.count()).select_from(Bitext).filter_by(documentId=document_id)
        ).scalar()
        if remaining == 0:
            document = db.session.get(Document, document_id)
            if document:
                db.session.delete(document)

        db.session.commit()
        return jsonify({"message": "Task deleted"}), 200
    except SQLAlchemyError as exc:
        db.session.rollback()
        return {"message": str(exc)}, 500


@bp.delete("/api/admin/evaluation")
@jwt_required()
def delete_evaluation() -> ResponseReturnValue:
    """Delete an entire evaluation and all associated data.

    Deletes all annotations (and their markings), all bitexts, the
    parent document, and the evaluation record itself.

    Request body: { "evaluation_id": 3 }
    """

    data = request.get_json(silent=True) or {}
    if "evaluation_id" not in data:
        return {"message": "Missing evaluation_id"}, 422

    evaluation = db.session.get(Evaluation, int(data["evaluation_id"]))
    if evaluation is None:
        return {"message": "Evaluation not found"}, 404

    try:
        annotations = (
            db.session.execute(select(Annotation).filter_by(evaluationId=evaluation.id))
            .scalars()
            .all()
        )
        bitext_ids = {ann.bitextId for ann in annotations}

        for annotation in annotations:
            db.session.delete(annotation)
        db.session.flush()

        db.session.delete(evaluation)
        db.session.flush()

        # Remove bitexts (and their parent document) no longer referenced
        document_ids: set[int] = set()
        for bitext_id in bitext_ids:
            still_used = db.session.execute(
                select(func.count()).select_from(Annotation).filter_by(bitextId=bitext_id)
            ).scalar()
            if still_used == 0:
                bitext = db.session.get(Bitext, bitext_id)
                if bitext:
                    document_ids.add(bitext.documentId)
                    db.session.delete(bitext)
        db.session.flush()

        for doc_id in document_ids:
            remaining = db.session.execute(
                select(func.count()).select_from(Bitext).filter_by(documentId=doc_id)
            ).scalar()
            if remaining == 0:
                document = db.session.get(Document, doc_id)
                if document:
                    db.session.delete(document)

        db.session.commit()
        return jsonify({"message": "Evaluation deleted"}), 200

    except SQLAlchemyError as exc:
        db.session.rollback()
        return {"message": str(exc)}, 500


@bp.get("/api/admin/progress")
@jwt_required()
def get_progress() -> ResponseReturnValue:
    """Return annotation progress per user per evaluation.

    Response shape:
    [
      {
        "user_id": 1,
        "email": "alice@example.com",
        "total_tasks": 100,
        "total_done": 45,
        "total_in_progress": 12,
        "evaluations": [
          {
            "evaluation_id": 1,
            "evaluation_name": "EN-FR Study 1",
            "total": 50,
            "done": 23,
            "in_progress": 8
          }
        ]
      }
    ]

    "done"        = isAnnotated is True
    "in_progress" = has at least one marking but isAnnotated is False
    """

    users = db.session.execute(select(User).order_by(User.email)).scalars().all()

    # Pre-fetch all annotation IDs that have at least one marking (one query)
    annotated_ids_with_markings: set[int] = set(
        db.session.execute(
            select(Marking.annotationId).distinct()
        ).scalars().all()
    )

    result = []
    for user in users:
        annotations = (
            db.session.execute(select(Annotation).filter_by(userId=user.id))
            .scalars()
            .all()
        )

        if not annotations:
            continue

        # Group by evaluation
        eval_map: dict[int, dict] = {}
        for ann in annotations:
            eid = ann.evaluationId
            if eid not in eval_map:
                ev = db.session.get(Evaluation, eid)
                eval_map[eid] = {
                    "evaluation_id": eid,
                    "evaluation_name": ev.name if ev else str(eid),
                    "total": 0,
                    "done": 0,
                    "in_progress": 0,
                }
            eval_map[eid]["total"] += 1
            if ann.isAnnotated:
                eval_map[eid]["done"] += 1
            elif ann.id in annotated_ids_with_markings:
                eval_map[eid]["in_progress"] += 1

        evaluations = sorted(eval_map.values(), key=lambda e: e["evaluation_name"])
        result.append({
            "user_id": user.id,
            "email": user.email,
            "total_tasks": sum(e["total"] for e in evaluations),
            "total_done": sum(e["done"] for e in evaluations),
            "total_in_progress": sum(e["in_progress"] for e in evaluations),
            "evaluations": evaluations,
        })

    return jsonify(result), 200


@bp.get("/api/admin/evaluations/<int:evaluation_id>/export/xml")
@jwt_required()
def export_evaluation_xml(evaluation_id: int) -> ResponseReturnValue:
    """Export all annotations for an evaluation as an XML file.

    Each <segment> contains one <annotation> per annotator/system pair.
    Each <annotation> lists its <translation> and any <marking> elements,
    where <span start="N" end="N"> gives the word-index range and text.
    """

    if err := _require_admin():
        return err

    evaluation = db.session.get(Evaluation, evaluation_id)
    if evaluation is None:
        return {"message": "Evaluation not found"}, 404

    annotations = (
        db.session.execute(select(Annotation).filter_by(evaluationId=evaluation_id))
        .scalars()
        .all()
    )

    root = ET.Element(
        "evaluation",
        name=evaluation.name,
        exported=datetime.now().isoformat(timespec="seconds"),
    )

    # Group by bitext so each segment appears once
    bitext_map: dict[int, list[Annotation]] = {}
    for ann in annotations:
        bitext_map.setdefault(ann.bitextId, []).append(ann)

    for bitext_id, anns in sorted(bitext_map.items()):
        bitext = db.session.get(Bitext, bitext_id)
        if bitext is None:
            continue

        source_words = bitext.source.strip().split()

        seg_el = ET.SubElement(root, "segment", id=str(bitext_id))
        src_el = ET.SubElement(seg_el, "source")
        src_el.text = bitext.source

        for ann in anns:
            user = db.session.get(User, ann.userId)
            annotator = user.email if user else str(ann.userId)

            ann_systems = (
                db.session.execute(
                    select(AnnotationSystem).filter_by(annotationId=ann.id)
                )
                .scalars()
                .all()
            )

            for ann_sys in ann_systems:
                system = db.session.get(System, ann_sys.systemId)
                system_name = system.name if system else str(ann_sys.systemId)

                ann_el = ET.SubElement(
                    seg_el,
                    "annotation",
                    annotator=annotator,
                    system=system_name,
                    completed="true" if ann.isAnnotated else "false",
                )
                if ann.comment:
                    ann_el.set("comment", ann.comment)

                trans_el = ET.SubElement(ann_el, "translation")
                trans_el.text = ann_sys.translation or ""

                translation_words = (ann_sys.translation or "").strip().split()

                markings = (
                    db.session.execute(
                        select(Marking).filter_by(
                            annotationId=ann.id, systemId=ann_sys.systemId
                        )
                    )
                    .scalars()
                    .all()
                )

                for m in markings:
                    words = source_words if m.isSource else translation_words
                    span_text = " ".join(words[m.errorStart: m.errorEnd + 1])
                    m_el = ET.SubElement(
                        ann_el,
                        "marking",
                        severity=m.errorSeverity,
                        category=CATEGORY_NAME.get(m.errorCategory, m.errorCategory),
                        side="source" if m.isSource else "target",
                    )
                    if m.comment:
                        m_el.set("comment", m.comment)
                    span_el = ET.SubElement(
                        m_el, "span", start=str(m.errorStart), end=str(m.errorEnd)
                    )
                    span_el.text = span_text

    ET.indent(root)
    xml_str = '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(
        root, encoding="unicode"
    )

    safe_name = "".join(c if c.isalnum() or c in "-_." else "_" for c in evaluation.name)
    return Response(
        xml_str,
        mimetype="text/xml; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.xml"'},
    )


@bp.get("/api/admin/evaluations/<int:evaluation_id>/dashboard")
@jwt_required()
def read_evaluation_dashboard(evaluation_id: int) -> ResponseReturnValue:
    """Return a structured overview of an evaluation for the results dashboard.

    Unlike /results (flat TSV rows meant for export) and /iaa (agreement
    stats only), this nests everything the dashboard needs to render and
    filter without re-parsing markup: per-segment annotations, per-system
    translations, every marking with its category/severity resolved to
    human-readable labels, and a few pre-computed aggregates (category/
    severity distribution, per-system and per-annotator average scores).
    """

    if err := _require_admin():
        return err

    evaluation = db.session.get(Evaluation, evaluation_id)
    if evaluation is None:
        return {"message": "Evaluation not found"}, 404

    annotations = (
        db.session.execute(select(Annotation).filter_by(evaluationId=evaluation_id))
        .scalars()
        .all()
    )

    # Group annotations by bitext so each segment appears once, mirroring
    # the XML export above.
    bitext_map: dict[int, list[Annotation]] = {}
    for ann in annotations:
        bitext_map.setdefault(ann.bitextId, []).append(ann)

    documents: dict[int, dict] = {}
    systems: dict[int, dict] = {}
    annotator_stats: dict[str, dict] = {}
    category_group_counts: dict[str, int] = {}
    severity_counts: dict[str, int] = {"minor": 0, "major": 0, "critical": 0}
    system_totals: dict[int, dict] = {}

    segments = []

    for bitext_id, anns in sorted(bitext_map.items()):
        bitext = db.session.get(Bitext, bitext_id)
        if bitext is None:
            continue
        document = db.session.get(Document, bitext.documentId)
        if document is not None and document.id not in documents:
            documents[document.id] = {"id": document.id, "name": document.name}

        segment_annotations = []

        for ann in anns:
            user = db.session.get(User, ann.userId)
            annotator = user.email if user else str(ann.userId)
            stats = annotator_stats.setdefault(
                annotator,
                {
                    "annotator": annotator,
                    "segmentsAnnotated": 0,
                    "segmentsSeen": 0,
                    "markingCount": 0,
                    "scoreTotal": 0.0,
                    "wordCountTotal": 0,
                },
            )
            stats["segmentsSeen"] += 1
            if ann.isAnnotated:
                stats["segmentsAnnotated"] += 1

            ann_systems = (
                db.session.execute(
                    select(AnnotationSystem).filter_by(annotationId=ann.id)
                )
                .scalars()
                .all()
            )

            system_entries = []
            segment_score = 0.0
            segment_word_count = 0

            for ann_sys in ann_systems:
                system = db.session.get(System, ann_sys.systemId)
                system_name = system.name if system else str(ann_sys.systemId)
                if system is not None and system.id not in systems:
                    systems[system.id] = {"id": system.id, "name": system.name}

                translation_word_count = len((ann_sys.translation or "").split())
                segment_word_count += translation_word_count

                markings = (
                    db.session.execute(
                        select(Marking).filter_by(
                            annotationId=ann.id, systemId=ann_sys.systemId
                        )
                    )
                    .scalars()
                    .all()
                )

                marking_entries = []
                system_score = 0.0
                for m in markings:
                    label = CATEGORY_NAME.get(m.errorCategory, m.errorCategory)
                    group = label.split("/", 1)[0] if "/" in label else label
                    words = (
                        bitext.source.split()
                        if m.isSource
                        else (ann_sys.translation or "").split()
                    )
                    span_text = " ".join(words[m.errorStart: m.errorEnd + 1])

                    marking_entries.append({
                        "id": m.id,
                        "start": m.errorStart,
                        "end": m.errorEnd,
                        "isSource": m.isSource,
                        "category": m.errorCategory,
                        "categoryLabel": label,
                        "categoryGroup": group,
                        "severity": m.errorSeverity,
                        "severityLabel": SEVERITY_NAME.get(
                            m.errorSeverity, m.errorSeverity
                        ),
                        "comment": m.comment or "",
                        "text": span_text,
                    })

                    category_group_counts[group] = (
                        category_group_counts.get(group, 0) + 1
                    )
                    if m.errorSeverity in severity_counts:
                        severity_counts[m.errorSeverity] += 1

                    if not m.isSource:
                        weight = _SEVERITY_WEIGHT.get(m.errorSeverity, 0.0)
                        segment_score += weight
                        system_score += weight
                        stats["scoreTotal"] += weight
                        stats["markingCount"] += 1

                        if system is not None:
                            sys_totals = system_totals.setdefault(
                                system.id,
                                {
                                    "system": system.name,
                                    "scoreTotal": 0.0,
                                    "wordCountTotal": 0,
                                    "annotationCount": 0,
                                    "markingCount": 0,
                                },
                            )
                            sys_totals["scoreTotal"] += weight
                            sys_totals["markingCount"] += 1

                # MQM score for this one annotator/system pair, plus the
                # same normalized to errors-per-100-words so segments and
                # documents of different lengths stay comparable.
                system_entries.append({
                    "systemId": ann_sys.systemId,
                    "systemName": system_name,
                    "translation": ann_sys.translation or "",
                    "wordCount": translation_word_count,
                    "score": system_score,
                    "normalizedScore": (
                        system_score / translation_word_count * 100
                        if translation_word_count
                        else None
                    ),
                    "markings": marking_entries,
                })

                if system is not None:
                    sys_totals = system_totals.setdefault(
                        system.id,
                        {
                            "system": system.name,
                            "scoreTotal": 0.0,
                            "wordCountTotal": 0,
                            "annotationCount": 0,
                            "markingCount": 0,
                        },
                    )
                    sys_totals["annotationCount"] += 1
                    sys_totals["wordCountTotal"] += translation_word_count

            stats["wordCountTotal"] += segment_word_count

            segment_annotations.append({
                "annotator": annotator,
                "isAnnotated": ann.isAnnotated,
                "comment": ann.comment or "",
                "score": segment_score,
                "wordCount": segment_word_count,
                "normalizedScore": (
                    segment_score / segment_word_count * 100 if segment_word_count else None
                ),
                "systems": system_entries,
            })

        segments.append({
            "bitextId": bitext_id,
            "documentId": bitext.documentId,
            "documentName": document.name if document else "",
            "source": bitext.source,
            "annotations": segment_annotations,
        })

    annotators = [
        {
            "annotator": s["annotator"],
            "segmentsAnnotated": s["segmentsAnnotated"],
            "segmentsSeen": s["segmentsSeen"],
            "markingCount": s["markingCount"],
            "avgScore": (
                s["scoreTotal"] / s["segmentsSeen"] if s["segmentsSeen"] else None
            ),
            "wordCount": s["wordCountTotal"],
            # Errors per 100 words across everything this annotator scored —
            # the standard MQM normalization, comparable across annotators
            # regardless of how long their segments happened to be.
            "normalizedScore": (
                s["scoreTotal"] / s["wordCountTotal"] * 100 if s["wordCountTotal"] else None
            ),
        }
        for s in sorted(annotator_stats.values(), key=lambda s: s["annotator"])
    ]

    system_scores = [
        {
            "system": t["system"],
            "annotationCount": t["annotationCount"],
            "markingCount": t["markingCount"],
            "avgScore": (
                t["scoreTotal"] / t["annotationCount"] if t["annotationCount"] else None
            ),
            "wordCount": t["wordCountTotal"],
            "normalizedScore": (
                t["scoreTotal"] / t["wordCountTotal"] * 100 if t["wordCountTotal"] else None
            ),
        }
        for t in sorted(system_totals.values(), key=lambda t: t["system"])
    ]

    return jsonify({
        "evaluation": {"id": evaluation.id, "name": evaluation.name},
        "documents": sorted(documents.values(), key=lambda d: d["name"]),
        "systems": sorted(systems.values(), key=lambda s: s["name"]),
        "annotators": annotators,
        "systemScores": system_scores,
        "categoryGroupCounts": category_group_counts,
        "severityCounts": severity_counts,
        "segments": segments,
    }), 200
