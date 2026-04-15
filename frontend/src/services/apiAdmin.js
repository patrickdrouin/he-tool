export async function importEvaluation({ evaluation, system, users, pairs }) {
  const response = await fetch("/api/admin/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ evaluation, system, users, pairs }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Import failed: ${response.status}`);
  }

  return data;
}
