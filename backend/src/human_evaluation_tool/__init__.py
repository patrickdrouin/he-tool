"""
Copyright (C) 2023-2025 Yaraku, Inc.

This file is part of Human Evaluation Tool.

Human Evaluation Tool is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by the
Free Software Foundation, either version 3 of the License,
or (at your option) any later version.

Human Evaluation Tool is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with
Human Evaluation Tool. If not, see <https://www.gnu.org/licenses/>.

Written by Giovanni G. De Giacomo <giovanni@yaraku.com>, August 2023
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping

import click
from dotenv import load_dotenv
from flask import Flask, Response, send_from_directory
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import select
from sqlalchemy.orm import DeclarativeBase


DB_ENV_VARIABLES = ("DB_HOST", "DB_NAME", "DB_PASSWORD", "DB_PORT", "DB_USER")


# Load environment variables from .env files once during import so the factory can
# rely on ``os.environ`` when configuring the application.
load_dotenv()

# Lazily initialised Flask extensions.


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)
bcrypt = Bcrypt()
jwt_manager = JWTManager()
migrate = Migrate()


def _configure_database(app: Flask) -> None:
    """Configure the SQLAlchemy database URI for the application."""

    if app.config.get("SQLALCHEMY_DATABASE_URI"):
        return

    missing = [key for key in DB_ENV_VARIABLES if key not in os.environ]
    if missing:
        missing_values = ", ".join(missing)
        raise RuntimeError(
            "Missing required database environment variables: " f"{missing_values}"
        )

    from urllib.parse import quote_plus

    user = os.environ["DB_USER"]
    password = quote_plus(os.environ["DB_PASSWORD"])
    host = os.environ["DB_HOST"]
    port = os.environ["DB_PORT"]
    name = os.environ["DB_NAME"]
    app.config[
        "SQLALCHEMY_DATABASE_URI"
    ] = f"postgresql://{user}:{password}@{host}:{port}/{name}"


def create_app(config_override: Mapping[str, Any] | None = None) -> Flask:
    """Create and configure the Flask application instance."""

    package_root = Path(__file__).resolve().parent
    src_root = package_root.parent
    backend_root = src_root.parent
    project_root = backend_root.parent
    static_folder_path = project_root / "public"
    static_folder_str = str(static_folder_path)

    app = Flask(
        __name__,
        static_folder=static_folder_str,
    )

    config_path = backend_root / "flask.config.json"
    if config_path.exists():
        app.config.from_file(str(config_path), load=json.load)

    if config_override:
        override_config = dict(config_override)
        app.config.update(override_config)
    else:
        override_config = {}

    secret_key = app.config.get("JWT_SECRET_KEY") or os.environ.get("JWT_SECRET_KEY")
    if not secret_key:
        raise RuntimeError("JWT_SECRET_KEY environment variable must be set")
    app.config["JWT_SECRET_KEY"] = secret_key
    app.config["JSON_SORT_KEYS"] = False

    explicit_uri_override = "SQLALCHEMY_DATABASE_URI" in override_config

    if not explicit_uri_override:
        env_uri = os.environ.get("SQLALCHEMY_DATABASE_URI")
        if env_uri:
            app.config["SQLALCHEMY_DATABASE_URI"] = env_uri

    _configure_database(app)

    db.init_app(app)
    bcrypt.init_app(app)
    jwt_manager.init_app(app)
    migrate.init_app(app, db)

    from . import auth
    from .resources import register_resources

    auth.register_auth_blueprint(app)
    register_resources(app)

    _maybe_seed_sqlite_sample_data(app)

    @app.cli.command("create-user")
    @click.argument("email")
    @click.argument("password")
    @click.argument("native_language")
    @click.option("--admin", "is_admin", is_flag=True, default=False,
                  help="Grant admin privileges to this user.")
    def create_user_command(email: str, password: str, native_language: str, is_admin: bool) -> None:
        """Create a new user.

        \b
        Usage:
            flask create-user EMAIL PASSWORD NATIVE_LANGUAGE [--admin]
        Example:
            flask create-user admin@example.com secret fr --admin
        """
        from .models import User

        existing = db.session.execute(
            select(User).filter_by(email=email)
        ).scalar_one_or_none()
        if existing is not None:
            click.echo(f"Error: user {email!r} already exists.", err=True)
            raise SystemExit(1)

        now = datetime.now()
        user = User(
            email=email,
            password=bcrypt.generate_password_hash(password).decode("utf-8"),
            nativeLanguage=native_language,
            isAdmin=is_admin,
            createdAt=now,
            updatedAt=now,
        )
        db.session.add(user)
        db.session.commit()
        role = "admin" if is_admin else "user"
        click.echo(f"Created {role} {email!r} (id={user.id}).")

    @app.cli.command("reset-password")
    @click.argument("email")
    @click.argument("new_password")
    def reset_password_command(email: str, new_password: str) -> None:
        """Reset the password for an existing user.

        \b
        Example:
            flask reset-password user@example.com newpassword123
        """
        from .models import User

        user = db.session.execute(
            select(User).filter_by(email=email)
        ).scalar_one_or_none()
        if user is None:
            click.echo(f"Error: no user with email {email!r}.", err=True)
            raise SystemExit(1)

        user.password = bcrypt.generate_password_hash(new_password).decode("utf-8")
        user.updatedAt = datetime.now()
        db.session.commit()
        click.echo(f"Password reset for {email!r}.")

    @app.cli.command("make-admin")
    @click.argument("email")
    def make_admin_command(email: str) -> None:
        """Grant admin privileges to an existing user.

        \b
        Example:
            flask make-admin user@example.com
        """
        from .models import User

        user = db.session.execute(
            select(User).filter_by(email=email)
        ).scalar_one_or_none()
        if user is None:
            click.echo(f"Error: no user with email {email!r}.", err=True)
            raise SystemExit(1)

        user.isAdmin = True
        db.session.commit()
        click.echo(f"User {email!r} is now an admin.")

    @app.cli.command("import-json")
    @click.argument("json_file", type=click.Path(exists=True))
    @click.option("--evaluation", "-e", required=True, help="Evaluation project name.")
    @click.option("--system", "-s", required=True, help="MT system name.")
    @click.option("--user", "-u", "user_emails", multiple=True, required=True,
                  help="Email of annotator to assign (repeat for multiple users).")
    def import_json_command(
        json_file: str, evaluation: str, system: str, user_emails: tuple[str, ...]
    ) -> None:
        """Import source/target pairs from a JSON file as an evaluation project.

        \b
        The JSON file must be a list of objects with "source" and "target" keys:
            [{"source": "...", "target": "..."}, ...]

        "source" is the original text; "target" is the MT output to annotate.

        \b
        Example:
            flask import-json data/sample_en_fr.json \\
                --evaluation "EN-FR Study 1" \\
                --system "DeepL" \\
                --user alice@example.com \\
                --user bob@example.com
        """
        import json as _json

        from sqlalchemy.exc import SQLAlchemyError

        from .models import (
            Annotation,
            AnnotationSystem,
            Bitext,
            Document,
            Evaluation,
            System,
            User,
        )

        # Load and validate JSON
        with open(json_file, encoding="utf-8") as f:
            pairs = _json.load(f)

        if not isinstance(pairs, list) or not pairs:
            click.echo("ERROR: JSON file must be a non-empty list.", err=True)
            raise SystemExit(1)

        missing = [i for i, p in enumerate(pairs) if "source" not in p or "target" not in p]
        if missing:
            click.echo(f"ERROR: items at indexes {missing} are missing 'source' or 'target'.", err=True)
            raise SystemExit(1)

        # Resolve users
        users: list[User] = []
        for email in user_emails:
            u = db.session.execute(select(User).filter_by(email=email)).scalar_one_or_none()
            if u is None:
                click.echo(f"ERROR: no user with email {email!r}. Create them first with flask create-user.", err=True)
                raise SystemExit(1)
            users.append(u)

        # Check evaluation name is available
        existing_eval = db.session.execute(
            select(Evaluation).filter_by(name=evaluation)
        ).scalar_one_or_none()
        if existing_eval is not None:
            click.echo(f"ERROR: evaluation {evaluation!r} already exists.", err=True)
            raise SystemExit(1)

        try:
            now = datetime.now()

            document = Document(name=evaluation, createdAt=now, updatedAt=now)
            db.session.add(document)
            db.session.flush()

            bitexts = [
                Bitext(
                    documentId=document.id,
                    source=p["source"],
                    target=None,
                    createdAt=now,
                    updatedAt=now,
                )
                for p in pairs
            ]
            db.session.add_all(bitexts)
            db.session.flush()

            mt_system = db.session.execute(
                select(System).filter_by(name=system)
            ).scalar_one_or_none()
            if mt_system is None:
                mt_system = System(name=system, createdAt=now, updatedAt=now)
                db.session.add(mt_system)
                db.session.flush()

            eval_obj = Evaluation(
                name=evaluation,
                type="error-marking",
                isFinished=False,
                createdAt=now,
                updatedAt=now,
            )
            db.session.add(eval_obj)
            db.session.flush()

            for user in users:
                for bitext, pair in zip(bitexts, pairs):
                    annotation = Annotation(
                        userId=user.id,
                        evaluationId=eval_obj.id,
                        bitextId=bitext.id,
                        isAnnotated=False,
                        comment=None,
                        createdAt=now,
                        updatedAt=now,
                    )
                    db.session.add(annotation)
                    db.session.flush()

                    db.session.add(AnnotationSystem(
                        annotationId=annotation.id,
                        systemId=mt_system.id,
                        translation=pair["target"],
                        createdAt=now,
                        updatedAt=now,
                    ))

            db.session.commit()

            click.echo(
                f"Imported {len(pairs)} segments into evaluation {evaluation!r} "
                f"(system: {mt_system.name!r}, "
                f"annotators: {[u.email for u in users]})."
            )

        except SQLAlchemyError as exc:
            db.session.rollback()
            click.echo(f"ERROR: {exc}", err=True)
            raise SystemExit(1)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def index(path: str) -> Response:
        if path and (static_folder_path / path).exists():
            return send_from_directory(static_folder_str, path)
        return send_from_directory(static_folder_str, "index.html")

    return app


def _maybe_seed_sqlite_sample_data(app: Flask) -> None:
    """Initialise a SQLite database with illustrative demo data.

    The development configuration falls back to SQLite when no explicit
    PostgreSQL configuration is provided. To make that experience usable out of
    the box we create a default user and a tiny evaluation dataset the first
    time the database starts empty.
    """

    uri = str(app.config.get("SQLALCHEMY_DATABASE_URI", ""))
    if not uri.startswith("sqlite"):
        return

    from .models import (
        Annotation,
        AnnotationSystem,
        Bitext,
        Document,
        Evaluation,
        System,
        User,
    )

    with app.app_context():
        db.create_all()

        default_email = "yaraku@yaraku.com"
        existing_user = db.session.execute(
            select(User).filter_by(email=default_email)
        ).scalar_one_or_none()
        if existing_user is not None:
            return

        now = datetime(2024, 1, 1, 12, 0, 0)

        try:
            user = User(
                email=default_email,
                password=bcrypt.generate_password_hash("yaraku").decode("utf-8"),
                nativeLanguage="en",
                createdAt=now,
                updatedAt=now,
            )
            db.session.add(user)
            db.session.flush()

            document = Document(
                name="Sample Machine Translation QA",
                createdAt=now,
                updatedAt=now,
            )
            db.session.add(document)
            db.session.flush()

            bitexts = [
                Bitext(
                    documentId=document.id,
                    source="The quick brown fox jumps over the lazy dog.",
                    target="A quick brown fox leaped over a resting dog.",
                    createdAt=now,
                    updatedAt=now,
                ),
                Bitext(
                    documentId=document.id,
                    source="Machine translation enables global communication.",
                    target=(
                        "Machine translation makes cross-language communication "
                        "easier."
                    ),
                    createdAt=now,
                    updatedAt=now,
                ),
            ]
            db.session.add_all(bitexts)
            db.session.flush()

            evaluation = Evaluation(
                name="Sample Evaluation",
                type="error-marking",
                isFinished=False,
                createdAt=now,
                updatedAt=now,
            )
            db.session.add(evaluation)
            db.session.flush()

            system = System(
                name="Test MT System",
                createdAt=now,
                updatedAt=now,
            )
            db.session.add(system)
            db.session.flush()

            translations = [
                "The quick brown fox jump over the lazy dogs.",
                "Machine translation enable global communications.",
            ]

            for bitext, translation in zip(bitexts, translations):
                annotation = Annotation(
                    userId=user.id,
                    evaluationId=evaluation.id,
                    bitextId=bitext.id,
                    isAnnotated=False,
                    comment=None,
                    createdAt=now,
                    updatedAt=now,
                )
                db.session.add(annotation)
                db.session.flush()

                annotation_system = AnnotationSystem(
                    annotationId=annotation.id,
                    systemId=system.id,
                    translation=translation,
                    createdAt=now,
                    updatedAt=now,
                )
                db.session.add(annotation_system)

            db.session.commit()
        except Exception as exc:  # pragma: no cover - defensive
            db.session.rollback()
            app.logger.warning("Failed to seed SQLite sample data: %s", exc)


def _create_default_app() -> Flask:
    """Create the production application used by WSGI servers."""

    default_config: dict[str, Any] = {}
    if "JWT_SECRET_KEY" not in os.environ:
        default_config["JWT_SECRET_KEY"] = "development-secret-key"
    if "SQLALCHEMY_DATABASE_URI" not in os.environ and not any(
        key in os.environ for key in DB_ENV_VARIABLES
    ):
        default_config["SQLALCHEMY_DATABASE_URI"] = "sqlite://"

    return create_app(default_config)


app = _create_default_app()

__all__ = [
    "DB_ENV_VARIABLES",
    "Base",
    "app",
    "bcrypt",
    "create_app",
    "db",
    "jwt_manager",
    "migrate",
]
