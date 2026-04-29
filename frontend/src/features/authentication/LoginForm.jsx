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
import { Link } from "react-router-dom";

import { useLogin } from "./useLogin";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const { login, isLoading } = useLogin();

  function handleSubmit(e) {
    e.preventDefault();
    login({ email, password, remember });
  }

  return (
    <form method="POST" onSubmit={handleSubmit}>
      <fieldset className="form-group">
        <legend className="border-bottom mb-4">Connexion</legend>
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
        <div className="form-check tw-my-2">
          <input
            className="form-check-input"
            disabled={isLoading}
            id="remember"
            name="remember"
            type="checkbox"
            onChange={(e) => setRemember(e.target.checked)}
            value={remember}
          />
          <label className="form-check-label" htmlFor="remember">
            Se souvenir de moi
          </label>
        </div>
      </fieldset>
      <div className="form-group tw-mt-2 tw-flex tw-items-center tw-justify-between">
        <div className="tw-flex tw-flex-col tw-gap-1">
          <Link className="tw-text-sm" to="/register">
            Pas encore de compte ? Créer un compte
          </Link>
          <Link className="tw-text-sm" to="/change-password">
            Changer le mot de passe
          </Link>
        </div>
        <input
          className="btn btn-outline-info"
          disabled={isLoading}
          id="submit"
          name="submit"
          type="submit"
          value="Se connecter"
        />
      </div>
    </form>
  );
}
