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
import toast from "react-hot-toast";

import Spinner from "../components/Spinner";
import { importEvaluation } from "../services/apiAdmin";
import { useUsers } from "../features/admin/useUsers";

export default function AdminPage() {
  const { users, isLoading } = useUsers();
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
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="content-section">
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
