"""unique slot per doctor start time

Revision ID: a7f2c0e81b45
Revises: c3e1a9f74d20
Create Date: 2026-06-27 00:00:00.000000

"""
from alembic import op

revision = 'a7f2c0e81b45'
down_revision = 'c3e1a9f74d20'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint("uq_slot_doctor_start", "slots", ["doctor_id", "start_time"])


def downgrade() -> None:
    op.drop_constraint("uq_slot_doctor_start", "slots", type_="unique")
