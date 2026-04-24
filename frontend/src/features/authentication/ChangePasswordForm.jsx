import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

export default function ChangePasswordForm() {
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.message || "Failed to change password.");
      } else {
        toast.success("Password changed successfully.");
        navigate("/login");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form method="POST" onSubmit={handleSubmit}>
      <fieldset className="form-group">
        <legend className="border-bottom mb-4">Change Password</legend>
        <div className="form-group tw-my-2">
          <label className="form-control-label" htmlFor="email">Email</label>
          <input
            className="form-control form-control-lg"
            disabled={isLoading}
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-group tw-my-2">
          <label className="form-control-label" htmlFor="current-password">Current Password</label>
          <input
            className="form-control form-control-lg"
            disabled={isLoading}
            id="current-password"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="form-group tw-my-2">
          <label className="form-control-label" htmlFor="new-password">New Password</label>
          <input
            className="form-control form-control-lg"
            disabled={isLoading}
            id="new-password"
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="form-group tw-my-2">
          <label className="form-control-label" htmlFor="confirm-password">Confirm New Password</label>
          <input
            className="form-control form-control-lg"
            disabled={isLoading}
            id="confirm-password"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
      </fieldset>
      <div className="form-group tw-mt-2 tw-flex tw-items-center tw-justify-between">
        <Link className="tw-text-sm" to="/login">Back to login</Link>
        <input
          className="btn btn-outline-info"
          disabled={isLoading}
          type="submit"
          value="Change Password"
        />
      </div>
    </form>
  );
}
