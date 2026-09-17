"""
Tests for the admin resource (SciTradUM fork addition).

Only covers /api/admin/evaluations/<id>/dashboard for now — the rest of
admin.py (import, assign/unassign, delete, XML export) predates this file
and has no dedicated coverage yet.
"""

from human_evaluation_tool import db


def test_dashboard_returns_structured_results(
    auth_client,
    create_evaluation,
    create_document,
    create_bitext,
    create_annotation,
    create_system,
    create_annotation_system,
    create_marking,
):
    client, user = auth_client
    user.isAdmin = True
    db.session.commit()

    evaluation = create_evaluation(name="EN-FR pilot")
    document = create_document(name="Doc 1")
    bitext = create_bitext(document=document, source="The cat is black and white.", target="")
    system = create_system(name="DeepL")
    annotation = create_annotation(user=user, evaluation=evaluation, bitext=bitext, is_annotated=True)
    create_annotation_system(
        annotation=annotation, system=system, translation="Le chat est noire et blanc."
    )
    create_marking(
        annotation=annotation,
        system=system,
        error_start=3,
        error_end=3,
        error_category="A01",
        error_severity="major",
        is_source=False,
    )
    create_marking(
        annotation=annotation,
        system=system,
        error_start=0,
        error_end=0,
        error_category="L01",
        error_severity="minor",
        is_source=False,
    )

    response = client.get(f"/api/admin/evaluations/{evaluation.id}/dashboard")
    assert response.status_code == 200
    data = response.get_json()

    assert data["evaluation"]["name"] == "EN-FR pilot"
    assert len(data["segments"]) == 1
    seg = data["segments"][0]
    assert seg["documentName"] == "Doc 1"
    assert seg["source"] == "The cat is black and white."

    assert len(seg["annotations"]) == 1
    ann = seg["annotations"][0]
    assert ann["annotator"] == user.email
    assert ann["isAnnotated"] is True
    # major (weight 5) + minor (weight 1) = 6
    assert ann["score"] == 6.0

    assert len(ann["systems"]) == 1
    sys_entry = ann["systems"][0]
    assert sys_entry["systemName"] == "DeepL"
    assert sys_entry["translation"] == "Le chat est noire et blanc."
    assert len(sys_entry["markings"]) == 2

    m_major = next(m for m in sys_entry["markings"] if m["severity"] == "major")
    assert m_major["categoryLabel"] == "Accuracy/Mistranslation"
    assert m_major["categoryGroup"] == "Accuracy"
    assert m_major["text"] == "noire"  # word index 3 in "Le chat est noire et blanc."

    m_minor = next(m for m in sys_entry["markings"] if m["severity"] == "minor")
    assert m_minor["categoryGroup"] == "Linguist conventions"

    assert data["severityCounts"] == {"minor": 1, "major": 1, "critical": 0}
    assert data["categoryGroupCounts"] == {"Accuracy": 1, "Linguist conventions": 1}

    assert len(data["systemScores"]) == 1
    assert data["systemScores"][0]["system"] == "DeepL"
    assert data["systemScores"][0]["annotationCount"] == 1
    assert data["systemScores"][0]["markingCount"] == 2
    assert data["systemScores"][0]["avgScore"] == 6.0

    assert len(data["annotators"]) == 1
    annotator_stats = data["annotators"][0]
    assert annotator_stats["annotator"] == user.email
    assert annotator_stats["segmentsAnnotated"] == 1
    assert annotator_stats["segmentsSeen"] == 1
    assert annotator_stats["markingCount"] == 2
    assert annotator_stats["avgScore"] == 6.0


def test_dashboard_requires_admin(auth_client, create_evaluation):
    client, _ = auth_client
    evaluation = create_evaluation()
    response = client.get(f"/api/admin/evaluations/{evaluation.id}/dashboard")
    assert response.status_code == 403


def test_dashboard_not_found(auth_client):
    client, user = auth_client
    user.isAdmin = True
    db.session.commit()
    response = client.get("/api/admin/evaluations/999999/dashboard")
    assert response.status_code == 404
