import { getCookie } from "./utils";

export async function assignEvaluation({ evaluationId, userEmail }) {
  const response = await fetch("/api/admin/assign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": getCookie("csrf_access_token"),
    },
    credentials: "same-origin",
    body: JSON.stringify({ evaluation_id: evaluationId, user_email: userEmail }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Assignment failed: ${response.status}`);
  }

  return data;
}

export async function unassignEvaluation({ evaluationId, userEmail }) {
  const response = await fetch("/api/admin/assign", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": getCookie("csrf_access_token"),
    },
    credentials: "same-origin",
    body: JSON.stringify({ evaluation_id: evaluationId, user_email: userEmail }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Unassign failed: ${response.status}`);
  }

  return data;
}

export async function getEvaluationBitexts({ evaluationId }) {
  const response = await fetch(`/api/admin/evaluations/${evaluationId}/bitexts`, {
    method: "GET",
    credentials: "include",
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Failed to load tasks: ${response.status}`);
  }

  return data;
}

export async function deleteEvaluationTask({ evaluationId, bitextId }) {
  const response = await fetch("/api/admin/task", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": getCookie("csrf_access_token"),
    },
    credentials: "same-origin",
    body: JSON.stringify({ evaluation_id: evaluationId, bitext_id: bitextId }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Failed to delete task: ${response.status}`);
  }

  return data;
}

export async function importEvaluation({ evaluation, system, users, pairs }) {
  const response = await fetch("/api/admin/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": getCookie("csrf_access_token"),
    },
    credentials: "same-origin",
    body: JSON.stringify({ evaluation, system, users, pairs }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Import failed: ${response.status}`);
  }

  return data;
}
