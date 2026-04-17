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
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success("Password updated successfully.");
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
        My Account
      </h2>
      {currentUser && (
        <p className="tw-mb-6 tw-text-gray-600">
          Signed in as <strong>{currentUser.email}</strong>
        </p>
      )}

      <h3 className="tw-mb-4 tw-text-lg tw-font-semibold tw-text-gray-700">
        Change Password
      </h3>
      <form onSubmit={handleSubmit} className="tw-max-w-sm">
        <div className="form-group tw-mb-4">
          <label className="form-control-label tw-font-semibold" htmlFor="current_password">
            Current password
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
            New password
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
            Confirm new password
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
          {isSubmitting ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
