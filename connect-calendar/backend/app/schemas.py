from datetime import date, datetime
from typing import Any, Dict, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

ItemKind = Literal["EVENT", "TASK", "WORKING_LOCATION", "OUT_OF_OFFICE"]
ItemStatus = Literal["CONFIRMED", "CANCELLED", "TENTATIVE"]


class UserOut(BaseModel):
    uid: str
    email: str | None = None


class CalendarOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_uid: str
    name: str
    color: str
    is_primary: bool
    created_at: datetime


class CalendarCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    color: str = Field(default="#2F6B58", max_length=32)
    is_primary: bool = False


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    calendar_id: UUID
    owner_uid: str
    kind: ItemKind
    title: str
    description: Optional[str] = None
    start_at: datetime
    end_at: datetime
    all_day: bool
    timezone: str
    location_text: Optional[str] = None
    status: ItemStatus
    metadata: Dict[str, Any] = Field(validation_alias="item_metadata")
    created_at: datetime
    updated_at: datetime


class ItemCreate(BaseModel):
    calendar_id: UUID
    kind: ItemKind
    title: str = Field(min_length=1, max_length=300)
    description: Optional[str] = None
    start_at: datetime
    end_at: datetime
    all_day: bool = False
    timezone: str = "UTC"
    location_text: Optional[str] = None
    status: ItemStatus = "CONFIRMED"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ItemUpdate(BaseModel):
    kind: Optional[ItemKind] = None
    title: Optional[str] = None
    description: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    all_day: Optional[bool] = None
    timezone: Optional[str] = None
    location_text: Optional[str] = None
    status: Optional[ItemStatus] = None
    metadata: Optional[Dict[str, Any]] = None


class AppearanceOut(BaseModel):
    density: str
    weekendTint: bool
    themeMode: str


class SettingsOut(BaseModel):
    locale: str
    primaryTimeZone: str
    secondaryTimeZoneEnabled: bool
    secondaryTimeZone: str
    weekStart: str
    defaultView: str
    dimPastEvents: bool
    upcomingMeetingMinutes: str
    defaultVideoProvider: str
    defaultSchedulingDurationMinutes: str
    defaultSchedulingWindowDays: str
    defaultVisibility: str
    defaultAvailability: str
    showDeclinedEvents: bool
    showCompletedTasks: bool
    showWeekends: bool
    eventNotifications: list[dict[str, Any]]
    allDayNotifications: list[dict[str, Any]]
    otherNotifications: dict[str, Any]
    timeBlockingEnabled: bool
    workdayStart: str
    workdayEnd: str
    aiNotesMode: str
    aiNotesEnabled: bool
    aiNotesAutoScheduleScope: str
    aiNotesSelectedCalendarIds: list[str]
    aiNotesDisplayName: str
    aiNotesJoinMessage: str
    aiNotesContent: dict[str, Any]
    aiNotesProvider: str
    aiNotesCallLink: str
    smartDeadlineRemindersEnabled: bool
    smartDeadlineReminderIntervalHours: str
    smartDeadlineContinueOverdue: bool
    smartDeadlineStopOnCompleted: bool
    calendarInterestSelections: dict[str, Any]


class PreferencesOut(BaseModel):
    appearance: AppearanceOut
    settings: SettingsOut


class PreferencesPatch(BaseModel):
    appearance: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None


class ProfileOverrideOut(BaseModel):
    displayName: Optional[str] = None
    photoURL: Optional[str] = None


class ProfileOverridePatch(BaseModel):
    displayName: Optional[str] = None
    photoURL: Optional[str] = None


class VisibilityPreferencesOut(BaseModel):
    calendarVisibility: Dict[str, bool]


class VisibilityPreferencePatch(BaseModel):
    calendarId: UUID
    visible: bool


class DayNoteOut(BaseModel):
    noteDate: date
    content: str


class DayNotePatch(BaseModel):
    noteDate: date
    content: str = ""
