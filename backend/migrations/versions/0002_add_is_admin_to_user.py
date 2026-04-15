"""add isAdmin to user

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-15 00:00:00.000001

"""
from alembic import op
import sqlalchemy as sa


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user",
        sa.Column("isAdmin", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade():
    op.drop_column("user", "isAdmin")
