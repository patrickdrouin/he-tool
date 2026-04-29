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
 *
 * Written by Giovanni G. De Giacomo <giovanni@yaraku.com>, August 2023
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import LanguageSelector from "../../components/LanguageSelector";
import { register } from "../../services/apiAuth";

export default function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("fr");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsLoading(true);
    try {
      await register({ email, password, nativeLanguage });
      toast.success("Compte créé. Vous pouvez maintenant vous connecter.");
      navigate("/login");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form method="POST" onSubmit={handleSubmit}>
      <fieldset className="form-group">
        <legend className="border-bottom mb-4">Inscription</legend>
        <div className="form-group tw-my-2">
          <label className="form-control-label" htmlFor="email">
            Courriel
          </label>
          <input
            className="form-control form-control-lg"
            disabled={isLoading}
            id="email"
            name="email"
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            value={email}
          />
        </div>
        <div className="form-group tw-my-2">
          <label className="form-control-label" htmlFor="password">
            Mot de passe
          </label>
          <input
            className="form-control form-control-lg"
            disabled={isLoading}
            id="password"
            name="password"
            onChange={(e) => setPassword(e.target.value)}
            required
            type="password"
            value={password}
          />
        </div>
        <div className="form-group tw-my-2">
          <label className="form-control-label" htmlFor="confirm_password">
            Confirmer le mot de passe
          </label>
          <input
            className="form-control form-control-lg"
            disabled={isLoading}
            id="confirm_password"
            name="confirm_password"
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </div>
        <div className="form-group tw-my-2">
          <label className="form-control-label" htmlFor="native_language">
            Langue maternelle
          </label>
          <LanguageSelector
            className="form-control form-control-lg"
            disabled={isLoading}
            id="native_language"
            name="native_language"
            onChange={(e) => setNativeLanguage(e.target.value)}
            required
            value={nativeLanguage}
          />
        </div>
      </fieldset>
      <div className="form-group tw-mt-2 tw-flex tw-items-center tw-justify-between">
        <Link className="tw-text-sm" to="/login">
          Déjà un compte ? Se connecter
        </Link>
        <input
          className="btn btn-outline-info"
          disabled={isLoading}
          id="submit"
          name="submit"
          type="submit"
          value="S'inscrire"
        />
      </div>
    </form>
  );
}
