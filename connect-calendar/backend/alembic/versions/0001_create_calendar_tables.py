"""create calendar tables

Revision ID: 0001_create_calendar_tables
Revises: 
Create Date: 2026-03-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_create_calendar_tables"
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind()
    item_kind_enum = postgresql.ENUM(
        "EVENT",
        "TASK",
        "WORKING_LOCATION",
        "OUT_OF_OFFICE",
        name="item_kind",
        create_type=False,
    )
    item_status_enum = postgresql.ENUM(
        "CONFIRMED",
        "CANCELLED",
        "TENTATIVE",
        name="item_status",
        create_type=False,
    )

    op.create_table(
        "calendar",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("owner_uid", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("color", sa.String(length=32), nullable=False, server_default="#2F6B58"),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_calendar_owner_uid", "calendar", ["owner_uid"], unique=False)

    item_kind_enum.create(bind, checkfirst=True)
    item_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "calendar_item",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("calendar_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("calendar.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_uid", sa.String(length=128), nullable=False),

        sa.Column("kind", item_kind_enum, nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),

        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),

        sa.Column("all_day", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("timezone", sa.String(length=64), nullable=False, server_default="UTC"),
        sa.Column("location_text", sa.String(length=300), nullable=True),

        sa.Column("status", item_status_enum, nullable=False, server_default="CONFIRMED"),

        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),

        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_index("ix_calendar_item_owner_uid", "calendar_item", ["owner_uid"], unique=False)
    op.create_index("ix_calendar_item_calendar_id", "calendar_item", ["calendar_id"], unique=False)
    op.create_index("ix_calendar_item_start_at", "calendar_item", ["start_at"], unique=False)
    op.create_index("ix_calendar_item_end_at", "calendar_item", ["end_at"], unique=False)

def downgrade() -> None:
    bind = op.get_bind()
    item_kind_enum = postgresql.ENUM(
        "EVENT",
        "TASK",
        "WORKING_LOCATION",
        "OUT_OF_OFFICE",
        name="item_kind",
        create_type=False,
    )
    item_status_enum = postgresql.ENUM(
        "CONFIRMED",
        "CANCELLED",
        "TENTATIVE",
        name="item_status",
        create_type=False,
    )

    op.drop_index("ix_calendar_item_end_at", table_name="calendar_item")
    op.drop_index("ix_calendar_item_start_at", table_name="calendar_item")
    op.drop_index("ix_calendar_item_calendar_id", table_name="calendar_item")
    op.drop_index("ix_calendar_item_owner_uid", table_name="calendar_item")
    op.drop_table("calendar_item")

    item_status_enum.drop(bind, checkfirst=True)
    item_kind_enum.drop(bind, checkfirst=True)

    op.drop_index("ix_calendar_owner_uid", table_name="calendar")
    op.drop_table("calendar")
