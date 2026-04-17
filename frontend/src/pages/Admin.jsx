/*
 * Copyright (C) 2023 Yaraku, Inc.
 *
 * This file is part of Human Evaluation Tool.
 *
 * Human Evaluation Tool is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * Human Evaluation Tool is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * Human Evaluation Tool. If not, see <https://www.gnu.org/licenses/>.
 */

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import Spinner from "../components/Spinner";
import LanguageSelector from "../components/LanguageSelector";
import { assignEvaluation, unassignEvaluation, importEvaluation } from "../services/apiAdmin";
import { register } from "../services/apiAuth";
import { deleteUser, setUserAdmin } from "../services/apiUsers";
import { useUsers } from "../features/admin/useUsers";
import { useEvaluations } from "../features/evaluations/useEvaluations";

function UserRow({ user, onRefresh }) {
  const [busy, setBusy] = useState(false);

  async function handleToggleAdmin() {
    setBusy(true);
    try {
      await setUserAdmin({ id: user.id, isAdmin: !user.isAdmin });
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete user ${user.email}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteUser({ id: user.id });
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>{user.email}</td>
      <td>{user.nativeLanguage}</td>
      <td>{user.isAdmin ? "Yes" : "No"}</td>
      <td className="tw-space-x-2 tw-whitespace-nowrap">
        <button
          className="btn btn-sm btn-outline-secondary"
          disabled={busy}
          onClick={handleToggleAdmin}
        >
          {user.isAdmin ? "Remove admin" : "Make admin"}
        </button>
        <button
          className="btn btn-sm btn-outline-danger"
          disabled={busy}
          onClick={handleDelete}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

export default function AdminPage() {
  const { users, isLoading: isUsersLoading } = useUsers();
  const { evaluations, isLoading: isEvaluationsLoading } = useEvaluations();
  const queryClient = useQueryClient();

  // — Create user state —
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newLang, setNewLang] = useState("fr");
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreateUser(e) {
    e.preventDefault();
    setIsCreating(true);
    try {
      await register({ email: newEmail, password: newPassword, nativeLanguage: newLang });
      toast.success(`User ${newEmail} created.`);
      setNewEmail(""); setNewPassword(""); setNewLang("fr");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsCreating(false);
    }
  }

  // — Assign evaluation state —
  const [assignEvalId, setAssignEvalId] = useState("");
  const [assignUserEmail, setAssignUserEmail] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  async function handleAssign(e) {
    e.preventDefault();
    if (!assignEvalId) { toast.error("Select an evaluation."); return; }
    if (!assignUserEmail) { toast.error("Select a user."); return; }

    setIsAssigning(true);
    try {
      const result = await assignEvaluation({
        evaluationId: Number(assignEvalId),
        userEmail: assignUserEmail,
      });
      toast.success(result.message);
      setAssignEvalId("");
      setAssignUserEmail("");
      queryClient.invalidateQueries({ queryKey: ["annotations"] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsAssigning(false);
    }
  }

  // — Unassign evaluation state —
  const [unassignEvalId, setUnassignEvalId] = useState("");
  const [unassignUserEmail, setUnassignUserEmail] = useState("");
  const [isUnassigning, setIsUnassigning] = useState(false);

  async function handleUnassign(e) {
    e.preventDefault();
    if (!unassignEvalId) { toast.error("Select an evaluation."); return; }
    if (!unassignUserEmail) { toast.error("Select a user."); return; }
    const evalName = evaluations.find((ev) => String(ev.id) === unassignEvalId)?.name ?? "";
    if (!window.confirm(`Remove all tasks of "${evalName}" from ${unassignUserEmail}? This will also delete all their markings and cannot be undone.`)) return;

    setIsUnassigning(true);
    try {
      const result = await unassignEvaluation({
        evaluationId: Number(unassignEvalId),
        userEmail: unassignUserEmail,
      });
      toast.success(result.message);
      setUnassignEvalId("");
      setUnassignUserEmail("");
      queryClient.invalidateQueries({ queryKey: ["annotations"] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsUnassigning(false);
    }
  }

  // — Import evaluation state —
  const [evaluationName, setEvaluationName] = useState("");
  const [systemName, setSystemName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [pairs, setPairs] = useState(null);
  const [fileName, setFileName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileRef = useRef(null);

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!Array.isArray(parsed)) throw new Error("File must contain a JSON array.");
        setPairs(parsed);
        toast.success(`Loaded ${parsed.length} segments from ${file.name}`);
      } catch (err) {
        toast.error(`Invalid JSON: ${err.message}`);
        setPairs(null);
        setFileName("");
        fileRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  function toggleUser(email) {
    setSelectedUsers((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!pairs) { toast.error("Please select a JSON file."); return; }
    if (!evaluationName.trim()) { toast.error("Evaluation name is required."); return; }
    if (!systemName.trim()) { toast.error("System name is required."); return; }
    if (selectedUsers.length === 0) { toast.error("Select at least one annotator."); return; }

    setIsSubmitting(true);
    try {
      const result = await importEvaluation({
        evaluation: evaluationName.trim(),
        system: systemName.trim(),
        users: selectedUsers,
        pairs,
      });
      toast.success(result.message);
      setEvaluationName("");
      setSystemName("");
      setSelectedUsers([]);
      setPairs(null);
      setFileName("");
      fileRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isUsersLoading || isEvaluationsLoading) return <Spinner />;

  return (
    <div className="content-section">

      {/* ── Create User ── */}
      <h2 className="tw-mb-4 tw-text-2xl tw-font-bold tw-text-gray-800">
        Admin — Create User
      </h2>
      <form onSubmit={handleCreateUser} className="tw-mb-10">
        <div className="tw-flex tw-flex-wrap tw-gap-4 tw-items-end">
          <div className="form-group">
            <label className="form-control-label tw-font-semibold" htmlFor="new_email">Email</label>
            <input
              className="form-control form-control-lg tw-mt-1"
              disabled={isCreating}
              id="new_email"
              type="email"
              placeholder="user@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-control-label tw-font-semibold" htmlFor="new_password">Password</label>
            <input
              className="form-control form-control-lg tw-mt-1"
              disabled={isCreating}
              id="new_password"
              type="password"
              placeholder="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-control-label tw-font-semibold" htmlFor="new_lang">Native language</label>
            <LanguageSelector
              className="form-control form-control-lg tw-mt-1"
              disabled={isCreating}
              id="new_lang"
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
            />
          </div>
          <button className="btn btn-primary tw-mb-1" disabled={isCreating} type="submit">
            {isCreating ? "Creating…" : "Create user"}
          </button>
        </div>
      </form>

      <hr className="tw-my-6" />

      {/* ── User List ── */}
      <h2 className="tw-mb-4 tw-text-2xl tw-font-bold tw-text-gray-800">
        Admin — Manage Users
      </h2>
      {users.length === 0 ? (
        <p className="tw-text-sm tw-text-gray-500 tw-mb-10">No users found.</p>
      ) : (
        <table className="table tw-mb-10 tw-text-sm">
          <thead>
            <tr>
              <th>Email</th>
              <th>Language</th>
              <th>Admin</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ["users"] })}
              />
            ))}
          </tbody>
        </table>
      )}

      <hr className="tw-my-6" />

      {/* ── Assign Evaluation ── */}
      <h2 className="tw-mb-4 tw-text-2xl tw-font-bold tw-text-gray-800">
        Admin — Assign Evaluation
      </h2>
      <form onSubmit={handleAssign} className="tw-mb-10">
        <div className="tw-flex tw-flex-wrap tw-gap-4 tw-items-end">
          <div className="form-group">
            <label className="form-control-label tw-font-semibold" htmlFor="assign_eval">
              Evaluation
            </label>
            <select
              className="form-control form-control-lg tw-mt-1"
              disabled={isAssigning}
              id="assign_eval"
              value={assignEvalId}
              onChange={(e) => setAssignEvalId(e.target.value)}
              required
            >
              <option value="">— select —</option>
              {evaluations.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-control-label tw-font-semibold" htmlFor="assign_user">
              User
            </label>
            <select
              className="form-control form-control-lg tw-mt-1"
              disabled={isAssigning}
              id="assign_user"
              value={assignUserEmail}
              onChange={(e) => setAssignUserEmail(e.target.value)}
              required
            >
              <option value="">— select —</option>
              {users.map((u) => (
                <option key={u.email} value={u.email}>{u.email}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary tw-mb-1" disabled={isAssigning} type="submit">
            {isAssigning ? "Assigning…" : "Assign"}
          </button>
        </div>
      </form>

      <hr className="tw-my-6" />

      {/* ── Unassign Evaluation ── */}
      <h2 className="tw-mb-4 tw-text-2xl tw-font-bold tw-text-gray-800">
        Admin — Delete Annotation Tasks
      </h2>
      <p className="tw-mb-4 tw-text-sm tw-text-gray-600">
        Remove all of a user&apos;s annotation tasks (and their markings) for a given evaluation. This cannot be undone.
      </p>
      <form onSubmit={handleUnassign} className="tw-mb-10">
        <div className="tw-flex tw-flex-wrap tw-gap-4 tw-items-end">
          <div className="form-group">
            <label className="form-control-label tw-font-semibold" htmlFor="unassign_eval">
              Evaluation
            </label>
            <select
              className="form-control form-control-lg tw-mt-1"
              disabled={isUnassigning}
              id="unassign_eval"
              value={unassignEvalId}
              onChange={(e) => setUnassignEvalId(e.target.value)}
              required
            >
              <option value="">— select —</option>
              {evaluations.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-control-label tw-font-semibold" htmlFor="unassign_user">
              User
            </label>
            <select
              className="form-control form-control-lg tw-mt-1"
              disabled={isUnassigning}
              id="unassign_user"
              value={unassignUserEmail}
              onChange={(e) => setUnassignUserEmail(e.target.value)}
              required
            >
              <option value="">— select —</option>
              {users.map((u) => (
                <option key={u.email} value={u.email}>{u.email}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-danger tw-mb-1" disabled={isUnassigning} type="submit">
            {isUnassigning ? "Deleting…" : "Delete tasks"}
          </button>
        </div>
      </form>

      <hr className="tw-my-6" />

      {/* ── Import Evaluation ── */}
      <h2 className="tw-mb-6 tw-text-2xl tw-font-bold tw-text-gray-800">
        Admin — Import Evaluation
      </h2>

      <form onSubmit={handleSubmit}>
        {/* JSON file */}
        <div className="form-group tw-mb-4">
          <label className="form-control-label tw-font-semibold" htmlFor="json_file">
            Source/target JSON file
          </label>
          <input
            ref={fileRef}
            className="form-control tw-mt-1"
            disabled={isSubmitting}
            id="json_file"
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
          />
          {pairs && (
            <p className="tw-mt-1 tw-text-sm tw-text-green-600">
              {pairs.length} segments loaded from {fileName}
            </p>
          )}
          <p className="tw-mt-1 tw-text-sm tw-text-gray-500">
            Expected format: <code>[{"{"}  "source": "...", "target": "..." {"}"}]</code>
          </p>
        </div>

        {/* Evaluation name */}
        <div className="form-group tw-mb-4">
          <label className="form-control-label tw-font-semibold" htmlFor="evaluation_name">
            Evaluation name
          </label>
          <input
            className="form-control form-control-lg tw-mt-1"
            disabled={isSubmitting}
            id="evaluation_name"
            type="text"
            placeholder="e.g. EN-FR Study 1"
            value={evaluationName}
            onChange={(e) => setEvaluationName(e.target.value)}
          />
        </div>

        {/* System name */}
        <div className="form-group tw-mb-4">
          <label className="form-control-label tw-font-semibold" htmlFor="system_name">
            MT system name
          </label>
          <input
            className="form-control form-control-lg tw-mt-1"
            disabled={isSubmitting}
            id="system_name"
            type="text"
            placeholder="e.g. DeepL"
            value={systemName}
            onChange={(e) => setSystemName(e.target.value)}
          />
        </div>

        {/* User selection */}
        <div className="form-group tw-mb-6">
          <label className="form-control-label tw-font-semibold">
            Assign to annotators
          </label>
          {users.length === 0 ? (
            <p className="tw-mt-1 tw-text-sm tw-text-gray-500">No users found.</p>
          ) : (
            <div className="tw-mt-2 tw-flex tw-flex-col tw-gap-2">
              {users.map((user) => (
                <label key={user.email} className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isSubmitting}
                    checked={selectedUsers.includes(user.email)}
                    onChange={() => toggleUser(user.email)}
                  />
                  <span>{user.email}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <button
          className="btn btn-primary"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Importing…" : "Import"}
        </button>
      </form>
    </div>
  );
}
