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
import AnnotatorProgress from "../components/AnnotatorProgress";
import { assignEvaluation, unassignEvaluation, importEvaluation, getEvaluationBitexts, deleteEvaluationTask, deleteEvaluation } from "../services/apiAdmin";
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
    if (!window.confirm(`Supprimer l'utilisateur ${user.email} ? Cette action est irréversible.`)) return;
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
      <td>{user.isAdmin ? "Oui" : "Non"}</td>
      <td className="tw-space-x-2 tw-whitespace-nowrap">
        <button
          className="btn btn-sm btn-outline-secondary"
          disabled={busy}
          onClick={handleToggleAdmin}
        >
          {user.isAdmin ? "Retirer admin" : "Rendre admin"}
        </button>
        <button
          className="btn btn-sm btn-outline-danger"
          disabled={busy}
          onClick={handleDelete}
        >
          Supprimer
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
      toast.success(`Utilisateur ${newEmail} créé.`);
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
    if (!assignEvalId) { toast.error("Sélectionnez une évaluation."); return; }
    if (!assignUserEmail) { toast.error("Sélectionnez un utilisateur."); return; }

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
    if (!unassignEvalId) { toast.error("Sélectionnez une évaluation."); return; }
    if (!unassignUserEmail) { toast.error("Sélectionnez un utilisateur."); return; }
    const evalName = evaluations.find((ev) => String(ev.id) === unassignEvalId)?.name ?? "";
    if (!window.confirm(`Supprimer toutes les tâches de « ${evalName} » pour ${unassignUserEmail} ? Cela effacera également toutes leurs annotations et est irréversible.`)) return;

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

  // — Delete evaluation task state —
  const [deleteTaskEvalId, setDeleteTaskEvalId] = useState("");
  const [deleteTaskBitexts, setDeleteTaskBitexts] = useState(null);
  const [isLoadingBitexts, setIsLoadingBitexts] = useState(false);
  const [deletingBitextId, setDeletingBitextId] = useState(null);

  async function handleLoadBitexts(evalId) {
    setDeleteTaskEvalId(evalId);
    setDeleteTaskBitexts(null);
    if (!evalId) return;
    setIsLoadingBitexts(true);
    try {
      const rows = await getEvaluationBitexts({ evaluationId: Number(evalId) });
      setDeleteTaskBitexts(rows);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoadingBitexts(false);
    }
  }

  async function handleDeleteTask(bitextId) {
    if (!window.confirm("Supprimer cette tâche pour tous les utilisateurs ? Cela effacera toutes les annotations et est irréversible.")) return;
    setDeletingBitextId(bitextId);
    try {
      await deleteEvaluationTask({ evaluationId: Number(deleteTaskEvalId), bitextId });
      toast.success("Tâche supprimée.");
      setDeleteTaskBitexts((prev) => prev.filter((b) => b.bitext_id !== bitextId));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingBitextId(null);
    }
  }

  // — Delete evaluation state —
  const [deleteEvalId, setDeleteEvalId] = useState("");
  const [isDeletingEval, setIsDeletingEval] = useState(false);

  async function handleDeleteEvaluation(e) {
    e.preventDefault();
    if (!deleteEvalId) { toast.error("Sélectionnez une évaluation."); return; }
    const evalName = evaluations.find((ev) => String(ev.id) === deleteEvalId)?.name ?? "";
    if (!window.confirm(`Supprimer l'évaluation « ${evalName} » ? Cela effacera de manière permanente tous les segments, annotations et marquages pour tous les annotateurs. Cette action est irréversible.`)) return;

    setIsDeletingEval(true);
    try {
      const result = await deleteEvaluation({ evaluationId: Number(deleteEvalId) });
      toast.success(result.message);
      setDeleteEvalId("");
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsDeletingEval(false);
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
        if (!Array.isArray(parsed)) throw new Error("Le fichier doit contenir un tableau JSON.");
        setPairs(parsed);
        toast.success(`${parsed.length} segments chargés depuis ${file.name}`);
      } catch (err) {
        toast.error(`JSON invalide : ${err.message}`);
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

    if (!pairs) { toast.error("Veuillez sélectionner un fichier JSON."); return; }
    if (!evaluationName.trim()) { toast.error("Le nom de l'évaluation est requis."); return; }
    if (!systemName.trim()) { toast.error("Le nom du système est requis."); return; }
    if (selectedUsers.length === 0) { toast.error("Sélectionnez au moins un annotateur."); return; }

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

      {/* ── Annotator Progress ── */}
      <h2 className="tw-mb-4 tw-text-2xl tw-font-bold tw-text-gray-800">
        Admin — Progression des annotateurs
      </h2>
      <AnnotatorProgress />

      <hr className="tw-my-6" />

      {/* ── Create User ── */}
      <h2 className="tw-mb-4 tw-text-2xl tw-font-bold tw-text-gray-800">
        Admin — Créer un utilisateur
      </h2>
      <form onSubmit={handleCreateUser} className="tw-mb-10">
        <div className="tw-flex tw-flex-wrap tw-gap-4 tw-items-end">
          <div className="form-group">
            <label className="form-control-label tw-font-semibold" htmlFor="new_email">Courriel</label>
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
            <label className="form-control-label tw-font-semibold" htmlFor="new_password">Mot de passe</label>
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
            <label className="form-control-label tw-font-semibold" htmlFor="new_lang">Langue maternelle</label>
            <LanguageSelector
              className="form-control form-control-lg tw-mt-1"
              disabled={isCreating}
              id="new_lang"
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
            />
          </div>
          <button className="btn btn-primary tw-mb-1" disabled={isCreating} type="submit">
            {isCreating ? "Création…" : "Créer l'utilisateur"}
          </button>
        </div>
      </form>

      <hr className="tw-my-6" />

      {/* ── User List ── */}
      <h2 className="tw-mb-4 tw-text-2xl tw-font-bold tw-text-gray-800">
        Admin — Gérer les utilisateurs
      </h2>
      {users.length === 0 ? (
        <p className="tw-text-sm tw-text-gray-500 tw-mb-10">Aucun utilisateur trouvé.</p>
      ) : (
        <table className="table tw-mb-10 tw-text-sm">
          <thead>
            <tr>
              <th>Courriel</th>
              <th>Langue</th>
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
        Admin — Assigner une évaluation
      </h2>
      <form onSubmit={handleAssign} className="tw-mb-10">
        <div className="tw-flex tw-flex-wrap tw-gap-4 tw-items-end">
          <div className="form-group">
            <label className="form-control-label tw-font-semibold" htmlFor="assign_eval">
              Évaluation
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
              Utilisateur
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
            {isAssigning ? "Assignation…" : "Assigner"}
          </button>
        </div>
      </form>

      <hr className="tw-my-6" />

      {/* ── Unassign Evaluation ── */}
      <h2 className="tw-mb-4 tw-text-2xl tw-font-bold tw-text-gray-800">
        Admin — Supprimer des tâches d'annotation
      </h2>
      <p className="tw-mb-4 tw-text-sm tw-text-gray-600">
        Supprime toutes les tâches d'annotation d'un utilisateur (et leurs annotations) pour une évaluation donnée. Cette action est irréversible.
      </p>
      <form onSubmit={handleUnassign} className="tw-mb-10">
        <div className="tw-flex tw-flex-wrap tw-gap-4 tw-items-end">
          <div className="form-group">
            <label className="form-control-label tw-font-semibold" htmlFor="unassign_eval">
              Évaluation
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
              Utilisateur
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
            {isUnassigning ? "Suppression…" : "Supprimer les tâches"}
          </button>
        </div>
      </form>

      <hr className="tw-my-6" />

      {/* ── Delete Evaluation Task ── */}
      <h2 className="tw-mb-4 tw-text-2xl tw-font-bold tw-text-gray-800">
        Admin — Supprimer une tâche d'évaluation
      </h2>
      <p className="tw-mb-4 tw-text-sm tw-text-gray-600">
        Supprime définitivement un segment source d'une évaluation pour tous les annotateurs.
      </p>
      <div className="form-group tw-mb-4">
        <label className="form-control-label tw-font-semibold" htmlFor="delete_task_eval">
          Évaluation
        </label>
        <select
          className="form-control form-control-lg tw-mt-1"
          id="delete_task_eval"
          value={deleteTaskEvalId}
          onChange={(e) => handleLoadBitexts(e.target.value)}
        >
          <option value="">— select —</option>
          {evaluations.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
      </div>
      {isLoadingBitexts && <p className="tw-text-sm tw-text-gray-500">Chargement des tâches…</p>}
      {deleteTaskBitexts && deleteTaskBitexts.length === 0 && (
        <p className="tw-text-sm tw-text-gray-500 tw-mb-10">Aucune tâche trouvée pour cette évaluation.</p>
      )}
      {deleteTaskBitexts && deleteTaskBitexts.length > 0 && (
        <table className="table tw-mb-10 tw-text-sm">
          <thead>
            <tr>
              <th className="tw-w-10">#</th>
              <th>Source</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {deleteTaskBitexts.map((row) => (
              <tr key={row.bitext_id}>
                <td className="tw-text-gray-500">{row.task_number}</td>
                <td className="tw-whitespace-pre-wrap">{row.source}</td>
                <td className="tw-whitespace-nowrap">
                  <button
                    className="btn btn-sm btn-outline-danger"
                    disabled={deletingBitextId === row.bitext_id}
                    onClick={() => handleDeleteTask(row.bitext_id)}
                  >
                    {deletingBitextId === row.bitext_id ? "Suppression…" : "Supprimer"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <hr className="tw-my-6" />

      {/* ── Delete Evaluation ── */}
      <h2 className="tw-mb-4 tw-text-2xl tw-font-bold tw-text-gray-800">
        Admin — Supprimer une évaluation
      </h2>
      <p className="tw-mb-4 tw-text-sm tw-text-gray-600">
        Supprime définitivement un projet d'évaluation : tous les segments, annotations et marquages pour tous les annotateurs. Cette action est irréversible.
      </p>
      <form onSubmit={handleDeleteEvaluation} className="tw-mb-10">
        <div className="tw-flex tw-flex-wrap tw-gap-4 tw-items-end">
          <div className="form-group">
            <label className="form-control-label tw-font-semibold" htmlFor="delete_eval">
              Évaluation
            </label>
            <select
              className="form-control form-control-lg tw-mt-1"
              disabled={isDeletingEval}
              id="delete_eval"
              value={deleteEvalId}
              onChange={(e) => setDeleteEvalId(e.target.value)}
              required
            >
              <option value="">— select —</option>
              {evaluations.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-danger tw-mb-1" disabled={isDeletingEval} type="submit">
            {isDeletingEval ? "Suppression…" : "Supprimer l'évaluation"}
          </button>
        </div>
      </form>

      <hr className="tw-my-6" />

      {/* ── Import Evaluation ── */}
      <h2 className="tw-mb-6 tw-text-2xl tw-font-bold tw-text-gray-800">
        Admin — Importer une évaluation
      </h2>

      <form onSubmit={handleSubmit}>
        {/* JSON file */}
        <div className="form-group tw-mb-4">
          <label className="form-control-label tw-font-semibold" htmlFor="json_file">
            Fichier JSON source/cible
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
              {pairs.length} segments chargés depuis {fileName}
            </p>
          )}
          <p className="tw-mt-1 tw-text-sm tw-text-gray-500">
            Format attendu : <code>[{"{"}  "source": "...", "target": "..." {"}"}]</code>
          </p>
        </div>

        {/* Evaluation name */}
        <div className="form-group tw-mb-4">
          <label className="form-control-label tw-font-semibold" htmlFor="evaluation_name">
            Nom de l'évaluation
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
            Nom du système de TA
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
            Assigner aux annotateurs
          </label>
          {users.length === 0 ? (
            <p className="tw-mt-1 tw-text-sm tw-text-gray-500">Aucun utilisateur trouvé.</p>
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
          {isSubmitting ? "Import en cours…" : "Importer"}
        </button>
      </form>
    </div>
  );
}
