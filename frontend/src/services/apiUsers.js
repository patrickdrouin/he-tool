import { getCookie } from "./utils";

export async function deleteUser({ id }) {
  const response = await fetch(`/api/users/${id}`, {
    method: "DELETE",
    headers: { "X-CSRF-TOKEN": getCookie("csrf_access_token") },
    credentials: "same-origin",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `Delete failed: ${response.status}`);
  }
}

export async function setUserAdmin({ id, isAdmin }) {
  const response = await fetch(`/api/users/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": getCookie("csrf_access_token"),
    },
    credentials: "same-origin",
    body: JSON.stringify({ isAdmin }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Update failed: ${response.status}`);
  }

  return data;
}
