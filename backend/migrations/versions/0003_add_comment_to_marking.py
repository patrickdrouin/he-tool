"""add comment to marking

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-17
"""

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("marking", sa.Column("comment", sa.String(1000), nullable=True))


def downgrade():
    op.drop_column("marking", "comment")
