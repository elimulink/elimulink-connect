import uuid
from datetime import date, datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class ItemKind(str, Enum):
    EVENT = "EVENT"
    TASK = "TASK"
    WORKING_LOCATION = "WORKING_LOCATION"
    OUT_OF_OFFICE = "OUT_OF_OFFICE"


class ItemStatus(str, Enum):
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    TENTATIVE = "TENTATIVE"


class Calendar(Base):
    __tablename__ = "calendar"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_uid: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    color: Mapped[str] = mapped_column(String(32), nullable=False, default="#2F6B58")
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    items: Mapped[list["CalendarItem"]] = relationship(
        "CalendarItem",
        back_populates="calendar",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    visibility_preferences: Mapped[list["CalendarVisibilityPreference"]] = relationship(
        "CalendarVisibilityPreference",
        back_populates="calendar",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index(
            "ux_calendar_owner_primary",
            "owner_uid",
            unique=True,
            postgresql_where=text("is_primary = true"),
        ),
    )


class CalendarItem(Base):
    __tablename__ = "calendar_item"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    calendar_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("calendar.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    owner_uid: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    kind: Mapped[ItemKind] = mapped_column(SAEnum(ItemKind, name="item_kind"), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    all_day: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
    location_text: Mapped[str | None] = mapped_column(String(300), nullable=True)
    status: Mapped[ItemStatus] = mapped_column(
        SAEnum(ItemStatus, name="item_status"),
        nullable=False,
        default=ItemStatus.CONFIRMED,
    )
    item_metadata: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    calendar: Mapped["Calendar"] = relationship("Calendar", back_populates="items")


class CalendarPreference(Base):
    __tablename__ = "calendar_preferences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_uid: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    theme_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="device")
    density: Mapped[str] = mapped_column(String(32), nullable=False, default="comfortable")
    weekend_tint: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    locale: Mapped[str] = mapped_column(String(32), nullable=False, default="en-US")
    primary_time_zone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
    secondary_time_zone_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    secondary_time_zone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    week_start: Mapped[str] = mapped_column(String(16), nullable=False, default="sunday")
    default_view: Mapped[str] = mapped_column(String(32), nullable=False, default="Month")
    dim_past_events: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    upcoming_meeting_minutes: Mapped[int] = mapped_column(nullable=False, default=30)
    default_video_provider: Mapped[str] = mapped_column(String(32), nullable=False, default="none")
    default_scheduling_duration_minutes: Mapped[int] = mapped_column(nullable=False, default=30)
    default_scheduling_window_days: Mapped[int] = mapped_column(nullable=False, default=30)
    default_visibility: Mapped[str] = mapped_column(String(32), nullable=False, default="default")
    default_availability: Mapped[str] = mapped_column(String(32), nullable=False, default="busy")
    show_declined_events: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_completed_tasks: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_weekends: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    event_notifications: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    all_day_notifications: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    other_notifications: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    time_blocking_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    workday_start: Mapped[str] = mapped_column(String(8), nullable=False, default="09:00")
    workday_end: Mapped[str] = mapped_column(String(8), nullable=False, default="17:00")
    ai_notes_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="manual-readiness")
    ai_notes_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    ai_notes_auto_schedule_scope: Mapped[str] = mapped_column(String(32), nullable=False, default="selected")
    ai_notes_selected_calendar_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    ai_notes_display_name: Mapped[str] = mapped_column(String(120), nullable=False, default="ElimuLink Notes")
    ai_notes_join_message: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="Taking notes for this session.",
    )
    ai_notes_content: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    ai_notes_provider: Mapped[str] = mapped_column(String(32), nullable=False, default="manual")
    ai_notes_call_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    smart_deadline_reminders_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    smart_deadline_reminder_interval_hours: Mapped[int] = mapped_column(nullable=False, default=24)
    smart_deadline_continue_overdue: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    smart_deadline_stop_on_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    calendar_interest_selections: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class CalendarProfileOverride(Base):
    __tablename__ = "calendar_profile_overrides"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_uid: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class CalendarDayNote(Base):
    __tablename__ = "calendar_day_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_uid: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    note_date: Mapped[date] = mapped_column(Date, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("owner_uid", "note_date", name="uq_calendar_day_notes_owner_date"),
    )


class CalendarVisibilityPreference(Base):
    __tablename__ = "calendar_visibility_preferences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_uid: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    calendar_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("calendar.id", ondelete="CASCADE"),
        nullable=False,
    )
    visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    calendar: Mapped["Calendar"] = relationship("Calendar", back_populates="visibility_preferences")

    __table_args__ = (
        UniqueConstraint("owner_uid", "calendar_id", name="uq_calendar_visibility_owner_calendar"),
    )
