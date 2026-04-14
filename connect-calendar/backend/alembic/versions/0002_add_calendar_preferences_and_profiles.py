"""add calendar preferences and profile tables

Revision ID: 0002_cal_prefs
Revises: 0001_create_calendar_tables
Create Date: 2026-03-29
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0002_cal_prefs"
down_revision = "0001_create_calendar_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ux_calendar_owner_primary",
        "calendar",
        ["owner_uid"],
        unique=True,
        postgresql_where=sa.text("is_primary = true"),
    )

    op.create_table(
        "calendar_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("owner_uid", sa.String(length=128), nullable=False),
        sa.Column("theme_mode", sa.String(length=16), nullable=False, server_default="device"),
        sa.Column("density", sa.String(length=32), nullable=False, server_default="comfortable"),
        sa.Column("weekend_tint", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("locale", sa.String(length=32), nullable=False, server_default="en-US"),
        sa.Column("primary_time_zone", sa.String(length=64), nullable=False, server_default="UTC"),
        sa.Column("secondary_time_zone_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("secondary_time_zone", sa.String(length=64), nullable=True),
        sa.Column("week_start", sa.String(length=16), nullable=False, server_default="sunday"),
        sa.Column("default_view", sa.String(length=32), nullable=False, server_default="Month"),
        sa.Column("dim_past_events", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("upcoming_meeting_minutes", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("default_video_provider", sa.String(length=32), nullable=False, server_default="none"),
        sa.Column("default_scheduling_duration_minutes", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("default_scheduling_window_days", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("default_visibility", sa.String(length=32), nullable=False, server_default="default"),
        sa.Column("default_availability", sa.String(length=32), nullable=False, server_default="busy"),
        sa.Column("show_declined_events", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("show_completed_tasks", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("show_weekends", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("event_notifications", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("all_day_notifications", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("other_notifications", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("time_blocking_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("workday_start", sa.String(length=8), nullable=False, server_default="09:00"),
        sa.Column("workday_end", sa.String(length=8), nullable=False, server_default="17:00"),
        sa.Column("ai_notes_mode", sa.String(length=32), nullable=False, server_default="manual-readiness"),
        sa.Column("ai_notes_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("ai_notes_auto_schedule_scope", sa.String(length=32), nullable=False, server_default="selected"),
        sa.Column("ai_notes_selected_calendar_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("ai_notes_display_name", sa.String(length=120), nullable=False, server_default="ElimuLink Notes"),
        sa.Column("ai_notes_join_message", sa.String(length=255), nullable=False, server_default="Taking notes for this session."),
        sa.Column("ai_notes_content", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("ai_notes_provider", sa.String(length=32), nullable=False, server_default="manual"),
        sa.Column("ai_notes_call_link", sa.Text(), nullable=True),
        sa.Column("smart_deadline_reminders_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("smart_deadline_reminder_interval_hours", sa.Integer(), nullable=False, server_default="24"),
        sa.Column("smart_deadline_continue_overdue", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("smart_deadline_stop_on_completed", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("calendar_interest_selections", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_calendar_preferences_owner_uid", "calendar_preferences", ["owner_uid"], unique=True)

    op.create_table(
        "calendar_profile_overrides",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("owner_uid", sa.String(length=128), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=True),
        sa.Column("photo_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_calendar_profile_overrides_owner_uid", "calendar_profile_overrides", ["owner_uid"], unique=True)

    op.create_table(
        "calendar_day_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("owner_uid", sa.String(length=128), nullable=False),
        sa.Column("note_date", sa.Date(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("owner_uid", "note_date", name="uq_calendar_day_notes_owner_date"),
    )
    op.create_index("ix_calendar_day_notes_owner_uid", "calendar_day_notes", ["owner_uid"], unique=False)

    op.create_table(
        "calendar_visibility_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("owner_uid", sa.String(length=128), nullable=False),
        sa.Column("calendar_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("calendar.id", ondelete="CASCADE"), nullable=False),
        sa.Column("visible", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("owner_uid", "calendar_id", name="uq_calendar_visibility_owner_calendar"),
    )
    op.create_index("ix_calendar_visibility_preferences_owner_uid", "calendar_visibility_preferences", ["owner_uid"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_calendar_visibility_preferences_owner_uid", table_name="calendar_visibility_preferences")
    op.drop_table("calendar_visibility_preferences")

    op.drop_index("ix_calendar_day_notes_owner_uid", table_name="calendar_day_notes")
    op.drop_table("calendar_day_notes")

    op.drop_index("ix_calendar_profile_overrides_owner_uid", table_name="calendar_profile_overrides")
    op.drop_table("calendar_profile_overrides")

    op.drop_index("ix_calendar_preferences_owner_uid", table_name="calendar_preferences")
    op.drop_table("calendar_preferences")

    op.drop_index("ux_calendar_owner_primary", table_name="calendar")
