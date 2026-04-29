import { useState } from "react";
import toast from "react-hot-toast";

import { changePassword } from "../services/apiAuth";
import { useAuth } from "../features/authentication/useAuth";

export default function ProfilePage() {
  const { currentUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Le nouveau mot de passe doit comporter au moins 8 caractères.");
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success("Mot de passe mis à jour avec succès.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="content-section">
      <h2 className="tw-mb-6 tw-text-2xl tw-font-bold tw-text-gray-800">
        Mon compte
      </h2>
      {currentUser && (
        <p className="tw-mb-6 tw-text-gray-600">
          Connecté en tant que <strong>{currentUser.email}</strong>
        </p>
      )}

      <h3 className="tw-mb-4 tw-text-lg tw-font-semibold tw-text-gray-700">
        Modifier le mot de passe
      </h3>
      <form onSubmit={handleSubmit} className="tw-max-w-sm">
        <div className="form-group tw-mb-4">
          <label className="form-control-label tw-font-semibold" htmlFor="current_password">
            Mot de passe actuel
          </label>
          <input
            className="form-control tw-mt-1"
            id="current_password"
            type="password"
            disabled={isSubmitting}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="form-group tw-mb-4">
          <label className="form-control-label tw-font-semibold" htmlFor="new_password">
            Nouveau mot de passe
          </label>
          <input
            className="form-control tw-mt-1"
            id="new_password"
            type="password"
            disabled={isSubmitting}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div className="form-group tw-mb-6">
          <label className="form-control-label tw-font-semibold" htmlFor="confirm_password">
            Confirmer le nouveau mot de passe
          </label>
          <input
            className="form-control tw-mt-1"
            id="confirm_password"
            type="password"
            disabled={isSubmitting}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Mise à jour…" : "Mettre à jour le mot de passe"}
        </button>
      </form>
    </div>
  );
}
