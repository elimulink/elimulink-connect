import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    String,
    Text,
    func,
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

    status: Mapped[ItemStatus] = mapped_column(SAEnum(ItemStatus, name="item_status"), nullable=False, default=ItemStatus.CONFIRMED)

    metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    calendar: Mapped["Calendar"] = relationship("Calendar", back_populates="items")