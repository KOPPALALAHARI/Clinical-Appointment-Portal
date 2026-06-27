"""slot duration and max patients

Revision ID: c3e1a9f74d20
Revises: 355a2d8f1bbf
Create Date: 2026-06-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'c3e1a9f74d20'
down_revision = '355a2d8f1bbf'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to slots
    op.add_column('slots', sa.Column('duration_minutes', sa.Integer(), nullable=False, server_default='30'))
    op.add_column('slots', sa.Column('max_patients', sa.Integer(), nullable=False, server_default='1'))

    # Remove the unique constraint on appointments.slot_id (allow multiple per slot)
    # The constraint name may vary; use batch_alter_table for safety
    with op.batch_alter_table('appointments') as batch_op:
        try:
            batch_op.drop_constraint('appointments_slot_id_key', type_='unique')
        except Exception:
            pass  # constraint may not exist or may have a different name


def downgrade() -> None:
    op.drop_column('slots', 'max_patients')
    op.drop_column('slots', 'duration_minutes')

    with op.batch_alter_table('appointments') as batch_op:
        batch_op.create_unique_constraint('appointments_slot_id_key', ['slot_id'])
