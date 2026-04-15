import { getCookie } from "./utils";

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
