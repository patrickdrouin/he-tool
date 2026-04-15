# Human Evaluation Tool

A web-based tool for conducting human evaluation of machine translation outputs using the MQM (Multidimensional Quality Metrics) error taxonomy. Evaluators mark errors in MT output at the word level, categorize them, and assign severity levels.

## Features

- User authentication with admin/annotator roles
- MQM error marking with configurable category taxonomy
- Per-evaluation assignment of annotators
- Results export as TSV
- Admin interface for managing users and importing evaluation data
- PostgreSQL backend with multi-user support

## Demo

Below is a quick video showing how the Human Evaluation Tool looks and works:

https://github.com/yaraku/he-tool/assets/5934186/bb1dcf1c-a1e2-464c-af0a-1225e57eef56

## Project Structure

```
backend/        Flask REST API (SQLAlchemy, Flask-JWT-Extended, Flask-Migrate)
frontend/       React web app (Vite, TailwindCSS, React Query)
public/         Built frontend assets (output of npm run build)
config/         Project configuration (MQM category taxonomy)
data/           Sample evaluation datasets
scripts/        Utility scripts (category codegen)
```

## Prerequisites

- [Podman](https://podman.io/) (or Docker — commands are identical)
- `podman compose` or `podman-compose` for the multi-container setup

For manual setup you also need Python 3.10+, Node.js 18+, PostgreSQL 16+, and Poetry.

## Installation and Setup

### Option 1: Podman Compose with PostgreSQL (Recommended)

This is the production-ready path. PostgreSQL data is persisted in a named volume and survives container restarts.

1. Copy and configure the environment file:
```sh
cp .env.example .env
# Edit .env — at minimum set DB_PASSWORD and JWT_SECRET_KEY.
# Generate a secret key with:
#   python3 -c "import secrets; print(secrets.token_hex(32))"
```

2. Start everything:
```sh
podman compose up
```

On first start the app container runs `flask db upgrade` to create the schema, then starts gunicorn. Open http://localhost:8000.

To rebuild after code changes:
```sh
podman compose up --build
```

To stop:
```sh
podman compose down
```

### Option 2: Single container (SQLite demo)

No PostgreSQL needed. Runs with an in-memory SQLite database pre-seeded with a demo user (`yaraku@yaraku.com` / `yaraku`) and a sample evaluation.

```sh
podman build -t he-tool .
podman run --rm -p 8000:8000 he-tool
```

> **Note:** The build installs Poetry versions satisfying `>=1.5,<1.7` by default.
> Override with `--build-arg POETRY_VERSION_CONSTRAINT="==1.6.1"` if needed.

### Option 3: Manual Setup

1. Set up PostgreSQL and create a database:
```sh
sudo -u postgres createdb he_tool
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
```

2. Set up the backend:
```sh
cd backend

# Install dependencies
poetry install

# Create .env
cat > .env << EOL
FLASK_APP=human_evaluation_tool:app
DB_HOST=localhost
DB_PORT=5432
DB_NAME=he_tool
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET_KEY=development-secret-key
EOL

# Apply migrations
poetry run flask db upgrade

# Start the development server
poetry run python main.py
```

3. Set up the frontend (in a new terminal):
```sh
cd frontend
npm install
npm run dev
```

4. Access the application at http://localhost:5173

---

## First-time Setup (PostgreSQL)

After the containers are running for the first time, you need to create an admin account. There are two ways:

**Option A — Create an admin directly via CLI:**
```sh
podman compose exec app flask create-user admin@example.com yourpassword fr --admin
```

**Option B — Register via the web UI, then grant admin:**
1. Go to http://localhost:8000/register and create your account
2. Then promote it to admin:
```sh
podman compose exec app flask make-admin admin@example.com
```

Log out and back in after being granted admin — the **Admin** link will appear in the navigation bar.

---

## Admin Workflow

The Admin page (`/admin`) is only visible to users with admin privileges.

### Creating Users

Fill in the **Create User** form at the top of the Admin page:
- Email address
- Password
- Native language

Users can also self-register at `/register`, in which case they start as regular annotators (no admin privileges).

### Importing an Evaluation

Prepare a JSON file containing a list of source/target pairs:

```json
[
  { "source": "The source sentence in English.", "target": "La phrase cible en français." },
  { "source": "Another sentence.", "target": "Une autre phrase." }
]
```

- **`source`** — the original text
- **`target`** — the MT output to be annotated

A sample file is available at `data/sample_en_fr.json`.

On the Admin page, under **Import Evaluation**:
1. Select your JSON file
2. Enter an evaluation name (must be unique)
3. Enter the MT system name (e.g. "DeepL", "Google Translate")
4. Check the annotators to assign
5. Click **Import**

The evaluation appears immediately in the **Evaluations** list for the selected annotators.

Alternatively, use the CLI:
```sh
podman compose exec app flask import-json data/sample_en_fr.json \
    --evaluation "EN-FR Study 1" \
    --system "DeepL" \
    --user alice@example.com \
    --user bob@example.com
```

---

## Annotator Workflow

1. **Register** at `/register` (or have an admin create your account)
2. Go to **Evaluations** in the navigation bar — your assigned evaluations are listed
3. Click an evaluation to open it in the annotation interface
4. Right-click on a word (or drag to select multiple words) to open the marking popup
5. Choose an error category and severity, then click **+** to save the marking
6. Use **Previous / Next** to move between segments
7. When finished, all segments are marked as done

> **Tip for trackpad users:** two-finger tap = right-click on Mac trackpads.

---

## CLI Reference

All commands run inside the app container with `podman compose exec app flask <command>`.

| Command | Description |
|---|---|
| `flask create-user EMAIL PASSWORD LANG [--admin]` | Create a new user. Add `--admin` to grant admin privileges. |
| `flask make-admin EMAIL` | Grant admin privileges to an existing user. |
| `flask import-json FILE --evaluation NAME --system NAME --user EMAIL …` | Import a JSON evaluation dataset and assign annotators. |
| `flask db upgrade` | Apply pending database migrations (runs automatically on container start). |
| `flask db migrate -m "description"` | Generate a new migration after changing a model. |

---

## Customizing MQM Error Categories

Error categories are defined in `config/categories.txt` using a simple indented format:

```
000: No Error

Accuracy
  A01: Mistranslation
  A02: Omission
  A03: Addition
  ...

Fluency
  F01: Grammar
  F02: Spelling
  ...
```

Rules:
- Top-level lines without a colon → group header (shown as `<optgroup>` in the selector)
- Indented lines with a colon → `ID: Label` entry
- Lines starting with `#` and blank lines are ignored
- The **ID** is stored in the database — changing it requires a migration
- The **Label** is display-only and safe to edit at any time

After editing the file, regenerate the backend constants and the frontend selector component:

```sh
python3 scripts/gen_categories.py
podman compose up --build   # rebuild to apply frontend changes
```

---

## Development

### Backend Development

The backend is built with Flask and uses:
- SQLAlchemy for database ORM
- Flask-JWT-Extended for authentication (cookie-based JWT with CSRF protection)
- Flask-Migrate / Alembic for database migrations

Key commands:
```sh
cd backend
poetry run flask db upgrade              # Apply pending migrations
poetry run flask db migrate -m "desc"   # Generate a new migration after model changes
poetry run python main.py               # Run development server
poetry run gunicorn --bind 0.0.0.0:8000 human_evaluation_tool:app  # Run with Gunicorn
```

### Frontend Development

The frontend is built with React and uses:
- Vite for build tooling
- TailwindCSS for styling
- React Query for data fetching

Key commands:
```sh
cd frontend
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

---

## Database Schema

| Table | Description |
|---|---|
| `user` | Annotators and admins (`isAdmin` flag) |
| `document` | Named container for source/target bitexts |
| `bitext` | Individual source sentences and optional reference translations |
| `evaluation` | An annotation project (groups bitexts + annotators) |
| `system` | An MT system being evaluated |
| `annotation` | Assignment of a user to a bitext within an evaluation |
| `annotation_system` | The MT output (translation) linked to an annotation |
| `marking` | A single error marking (span + category + severity) |

Migrations live in `backend/migrations/versions/` and run automatically on container start.

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. For backend changes, install dependencies with `poetry install --with dev` and run:
   - `poetry run black --check src tests`
   - `poetry run isort --check-only src tests`
   - `poetry run flake8 src tests`
   - `poetry run mypy src tests`
   - `poetry run pytest`
4. Commit your changes
5. Push to the branch
6. Create a Pull Request and ensure the **Backend CI** workflow passes when touching backend code.

## License

This project is licensed under the GPL-3.0 License — see the LICENSE file for details.
