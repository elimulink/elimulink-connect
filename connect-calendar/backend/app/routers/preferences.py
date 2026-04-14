from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import AuthedUser, get_current_user
from app.models import Calendar, CalendarDayNote, CalendarPreference, CalendarVisibilityPreference
from app.schemas import (
    DayNoteOut,
    DayNotePatch,
    PreferencesOut,
    PreferencesPatch,
    VisibilityPreferencePatch,
    VisibilityPreferencesOut,
)

router = APIRouter(prefix="/api/v1", tags=["preferences"])


DEFAULT_APPEARANCE = {
    "density": "comfortable",
    "weekendTint": True,
    "themeMode": "device",
}

DEFAULT_SETTINGS = {
    "locale": "en-US",
    "primaryTimeZone": "UTC",
    "secondaryTimeZoneEnabled": False,
    "secondaryTimeZone": "",
    "weekStart": "sunday",
    "defaultView": "Month",
    "dimPastEvents": True,
    "upcomingMeetingMinutes": "30",
    "defaultVideoProvider": "none",
    "defaultSchedulingDurationMinutes": "30",
    "defaultSchedulingWindowDays": "30",
    "defaultVisibility": "default",
    "defaultAvailability": "busy",
    "showDeclinedEvents": True,
    "showCompletedTasks": True,
    "showWeekends": True,
    "eventNotifications": [{"id": "event-1", "type": "notification", "amount": "10", "unit": "minutes"}],
    "allDayNotifications": [{"id": "all-day-1", "type": "notification", "amount": "09:00", "unit": "time"}],
    "otherNotifications": {"desktop": True, "agenda": False, "taskSummary": False},
    "timeBlockingEnabled": False,
    "workdayStart": "09:00",
    "workdayEnd": "17:00",
    "aiNotesMode": "manual-readiness",
    "aiNotesEnabled": True,
    "aiNotesAutoScheduleScope": "selected",
    "aiNotesSelectedCalendarIds": [],
    "aiNotesDisplayName": "ElimuLink Notes",
    "aiNotesJoinMessage": "Taking notes for this session.",
    "aiNotesContent": {"summary": True, "recording": False, "transcript": False},
    "aiNotesProvider": "manual",
    "aiNotesCallLink": "",
    "smartDeadlineRemindersEnabled": True,
    "smartDeadlineReminderIntervalHours": "24",
    "smartDeadlineContinueOverdue": True,
    "smartDeadlineStopOnCompleted": True,
    "calendarInterestSelections": {
        "kenyaPublicHolidays": True,
        "otherObservances": False,
        "institutionCalendars": False,
        "globalReligious": False,
        "browseAll": False,
    },
}


def _normalize_json_list(value: Any, fallback: list[Any]) -> list[Any]:
    return value if isinstance(value, list) else fallback


def _normalize_json_dict(value: Any, fallback: dict[str, Any]) -> dict[str, Any]:
    return value if isinstance(value, dict) else fallback


def _serialize_preferences(pref: CalendarPreference | None) -> dict[str, Any]:
    appearance = dict(DEFAULT_APPEARANCE)
    settings = dict(DEFAULT_SETTINGS)
    settings["eventNotifications"] = [*DEFAULT_SETTINGS["eventNotifications"]]
    settings["allDayNotifications"] = [*DEFAULT_SETTINGS["allDayNotifications"]]
    settings["otherNotifications"] = dict(DEFAULT_SETTINGS["otherNotifications"])
    settings["aiNotesSelectedCalendarIds"] = [*DEFAULT_SETTINGS["aiNotesSelectedCalendarIds"]]
    settings["aiNotesContent"] = dict(DEFAULT_SETTINGS["aiNotesContent"])
    settings["calendarInterestSelections"] = dict(DEFAULT_SETTINGS["calendarInterestSelections"])

    if not pref:
      return {"appearance": appearance, "settings": settings}

    appearance.update(
        {
            "density": pref.density,
            "weekendTint": pref.weekend_tint,
            "themeMode": pref.theme_mode,
        }
    )
    settings.update(
        {
            "locale": pref.locale,
            "primaryTimeZone": pref.primary_time_zone,
            "secondaryTimeZoneEnabled": pref.secondary_time_zone_enabled,
            "secondaryTimeZone": pref.secondary_time_zone or "",
            "weekStart": pref.week_start,
            "defaultView": pref.default_view,
            "dimPastEvents": pref.dim_past_events,
            "upcomingMeetingMinutes": str(pref.upcoming_meeting_minutes),
            "defaultVideoProvider": pref.default_video_provider,
            "defaultSchedulingDurationMinutes": str(pref.default_scheduling_duration_minutes),
            "defaultSchedulingWindowDays": str(pref.default_scheduling_window_days),
            "defaultVisibility": pref.default_visibility,
            "defaultAvailability": pref.default_availability,
            "showDeclinedEvents": pref.show_declined_events,
            "showCompletedTasks": pref.show_completed_tasks,
            "showWeekends": pref.show_weekends,
            "eventNotifications": _normalize_json_list(pref.event_notifications, settings["eventNotifications"]),
            "allDayNotifications": _normalize_json_list(pref.all_day_notifications, settings["allDayNotifications"]),
            "otherNotifications": _normalize_json_dict(pref.other_notifications, settings["otherNotifications"]),
            "timeBlockingEnabled": pref.time_blocking_enabled,
            "workdayStart": pref.workday_start,
            "workdayEnd": pref.workday_end,
            "aiNotesMode": pref.ai_notes_mode,
            "aiNotesEnabled": pref.ai_notes_enabled,
            "aiNotesAutoScheduleScope": pref.ai_notes_auto_schedule_scope,
            "aiNotesSelectedCalendarIds": [str(v) for v in _normalize_json_list(pref.ai_notes_selected_calendar_ids, [])],
            "aiNotesDisplayName": pref.ai_notes_display_name,
            "aiNotesJoinMessage": pref.ai_notes_join_message,
            "aiNotesContent": _normalize_json_dict(pref.ai_notes_content, settings["aiNotesContent"]),
            "aiNotesProvider": pref.ai_notes_provider,
            "aiNotesCallLink": pref.ai_notes_call_link or "",
            "smartDeadlineRemindersEnabled": pref.smart_deadline_reminders_enabled,
            "smartDeadlineReminderIntervalHours": str(pref.smart_deadline_reminder_interval_hours),
            "smartDeadlineContinueOverdue": pref.smart_deadline_continue_overdue,
            "smartDeadlineStopOnCompleted": pref.smart_deadline_stop_on_completed,
            "calendarInterestSelections": _normalize_json_dict(
                pref.calendar_interest_selections,
                settings["calendarInterestSelections"],
            ),
        }
    )
    return {"appearance": appearance, "settings": settings}


def _apply_preferences(pref: CalendarPreference, payload: dict[str, Any]) -> None:
    appearance = payload["appearance"]
    settings = payload["settings"]
    pref.theme_mode = str(appearance.get("themeMode", DEFAULT_APPEARANCE["themeMode"]))
    pref.density = str(appearance.get("density", DEFAULT_APPEARANCE["density"]))
    pref.weekend_tint = bool(appearance.get("weekendTint", DEFAULT_APPEARANCE["weekendTint"]))
    pref.locale = str(settings.get("locale", DEFAULT_SETTINGS["locale"]))
    pref.primary_time_zone = str(settings.get("primaryTimeZone", DEFAULT_SETTINGS["primaryTimeZone"]))
    pref.secondary_time_zone_enabled = bool(
        settings.get("secondaryTimeZoneEnabled", DEFAULT_SETTINGS["secondaryTimeZoneEnabled"])
    )
    pref.secondary_time_zone = settings.get("secondaryTimeZone") or None
    pref.week_start = str(settings.get("weekStart", DEFAULT_SETTINGS["weekStart"]))
    pref.default_view = str(settings.get("defaultView", DEFAULT_SETTINGS["defaultView"]))
    pref.dim_past_events = bool(settings.get("dimPastEvents", DEFAULT_SETTINGS["dimPastEvents"]))
    pref.upcoming_meeting_minutes = int(settings.get("upcomingMeetingMinutes", DEFAULT_SETTINGS["upcomingMeetingMinutes"]))
    pref.default_video_provider = str(settings.get("defaultVideoProvider", DEFAULT_SETTINGS["defaultVideoProvider"]))
    pref.default_scheduling_duration_minutes = int(
        settings.get(
            "defaultSchedulingDurationMinutes",
            DEFAULT_SETTINGS["defaultSchedulingDurationMinutes"],
        )
    )
    pref.default_scheduling_window_days = int(
        settings.get("defaultSchedulingWindowDays", DEFAULT_SETTINGS["defaultSchedulingWindowDays"])
    )
    pref.default_visibility = str(settings.get("defaultVisibility", DEFAULT_SETTINGS["defaultVisibility"]))
    pref.default_availability = str(settings.get("defaultAvailability", DEFAULT_SETTINGS["defaultAvailability"]))
    pref.show_declined_events = bool(settings.get("showDeclinedEvents", DEFAULT_SETTINGS["showDeclinedEvents"]))
    pref.show_completed_tasks = bool(settings.get("showCompletedTasks", DEFAULT_SETTINGS["showCompletedTasks"]))
    pref.show_weekends = bool(settings.get("showWeekends", DEFAULT_SETTINGS["showWeekends"]))
    pref.event_notifications = _normalize_json_list(settings.get("eventNotifications"), DEFAULT_SETTINGS["eventNotifications"])
    pref.all_day_notifications = _normalize_json_list(settings.get("allDayNotifications"), DEFAULT_SETTINGS["allDayNotifications"])
    pref.other_notifications = _normalize_json_dict(settings.get("otherNotifications"), DEFAULT_SETTINGS["otherNotifications"])
    pref.time_blocking_enabled = bool(settings.get("timeBlockingEnabled", DEFAULT_SETTINGS["timeBlockingEnabled"]))
    pref.workday_start = str(settings.get("workdayStart", DEFAULT_SETTINGS["workdayStart"]))
    pref.workday_end = str(settings.get("workdayEnd", DEFAULT_SETTINGS["workdayEnd"]))
    pref.ai_notes_mode = str(settings.get("aiNotesMode", DEFAULT_SETTINGS["aiNotesMode"]))
    pref.ai_notes_enabled = bool(settings.get("aiNotesEnabled", DEFAULT_SETTINGS["aiNotesEnabled"]))
    pref.ai_notes_auto_schedule_scope = str(
        settings.get("aiNotesAutoScheduleScope", DEFAULT_SETTINGS["aiNotesAutoScheduleScope"])
    )
    pref.ai_notes_selected_calendar_ids = [
        str(value) for value in _normalize_json_list(settings.get("aiNotesSelectedCalendarIds"), [])
    ]
    pref.ai_notes_display_name = str(settings.get("aiNotesDisplayName", DEFAULT_SETTINGS["aiNotesDisplayName"]))
    pref.ai_notes_join_message = str(settings.get("aiNotesJoinMessage", DEFAULT_SETTINGS["aiNotesJoinMessage"]))
    pref.ai_notes_content = _normalize_json_dict(settings.get("aiNotesContent"), DEFAULT_SETTINGS["aiNotesContent"])
    pref.ai_notes_provider = str(settings.get("aiNotesProvider", DEFAULT_SETTINGS["aiNotesProvider"]))
    pref.ai_notes_call_link = settings.get("aiNotesCallLink") or None
    pref.smart_deadline_reminders_enabled = bool(
        settings.get("smartDeadlineRemindersEnabled", DEFAULT_SETTINGS["smartDeadlineRemindersEnabled"])
    )
    pref.smart_deadline_reminder_interval_hours = int(
        settings.get(
            "smartDeadlineReminderIntervalHours",
            DEFAULT_SETTINGS["smartDeadlineReminderIntervalHours"],
        )
    )
    pref.smart_deadline_continue_overdue = bool(
        settings.get("smartDeadlineContinueOverdue", DEFAULT_SETTINGS["smartDeadlineContinueOverdue"])
    )
    pref.smart_deadline_stop_on_completed = bool(
        settings.get("smartDeadlineStopOnCompleted", DEFAULT_SETTINGS["smartDeadlineStopOnCompleted"])
    )
    pref.calendar_interest_selections = _normalize_json_dict(
        settings.get("calendarInterestSelections"),
        DEFAULT_SETTINGS["calendarInterestSelections"],
    )


@router.get("/preferences", response_model=PreferencesOut)
def get_preferences(
    db: Session = Depends(get_db),
    user: AuthedUser = Depends(get_current_user),
):
    pref = db.query(CalendarPreference).filter(CalendarPreference.owner_uid == user.uid).first()
    return _serialize_preferences(pref)


@router.patch("/preferences", response_model=PreferencesOut)
def patch_preferences(
    payload: PreferencesPatch,
    db: Session = Depends(get_db),
    user: AuthedUser = Depends(get_current_user),
):
    pref = db.query(CalendarPreference).filter(CalendarPreference.owner_uid == user.uid).first()
    if not pref:
        pref = CalendarPreference(owner_uid=user.uid)
        db.add(pref)

    current = _serialize_preferences(pref if pref.id else None)
    if payload.appearance:
        current["appearance"].update(payload.appearance)
    if payload.settings:
        current["settings"].update(payload.settings)
    _apply_preferences(pref, current)
    db.commit()
    db.refresh(pref)
    return _serialize_preferences(pref)


@router.get("/visibility-preferences", response_model=VisibilityPreferencesOut)
def get_visibility_preferences(
    db: Session = Depends(get_db),
    user: AuthedUser = Depends(get_current_user),
):
    rows = (
        db.query(CalendarVisibilityPreference)
        .filter(CalendarVisibilityPreference.owner_uid == user.uid)
        .all()
    )
    return {"calendarVisibility": {str(row.calendar_id): bool(row.visible) for row in rows}}


@router.patch("/visibility-preferences", response_model=VisibilityPreferencesOut)
def patch_visibility_preferences(
    payload: VisibilityPreferencePatch,
    db: Session = Depends(get_db),
    user: AuthedUser = Depends(get_current_user),
):
    calendar = (
        db.query(Calendar)
        .filter(Calendar.id == payload.calendarId, Calendar.owner_uid == user.uid)
        .first()
    )
    if not calendar:
        raise HTTPException(status_code=404, detail="Calendar not found")

    row = (
        db.query(CalendarVisibilityPreference)
        .filter(
            CalendarVisibilityPreference.owner_uid == user.uid,
            CalendarVisibilityPreference.calendar_id == payload.calendarId,
        )
        .first()
    )
    if not row:
        row = CalendarVisibilityPreference(
            owner_uid=user.uid,
            calendar_id=payload.calendarId,
            visible=payload.visible,
        )
        db.add(row)
    else:
        row.visible = payload.visible
    db.commit()
    rows = (
        db.query(CalendarVisibilityPreference)
        .filter(CalendarVisibilityPreference.owner_uid == user.uid)
        .all()
    )
    return {"calendarVisibility": {str(item.calendar_id): bool(item.visible) for item in rows}}


@router.get("/day-notes", response_model=DayNoteOut)
def get_day_note(
    date_value: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    user: AuthedUser = Depends(get_current_user),
):
    note = (
        db.query(CalendarDayNote)
        .filter(CalendarDayNote.owner_uid == user.uid, CalendarDayNote.note_date == date_value)
        .first()
    )
    return {"noteDate": date_value, "content": note.content if note else ""}


@router.patch("/day-notes", response_model=DayNoteOut)
def patch_day_note(
    payload: DayNotePatch,
    db: Session = Depends(get_db),
    user: AuthedUser = Depends(get_current_user),
):
    note = (
        db.query(CalendarDayNote)
        .filter(
            CalendarDayNote.owner_uid == user.uid,
            CalendarDayNote.note_date == payload.noteDate,
        )
        .first()
    )

    content = payload.content or ""
    if not content.strip():
        if note:
            db.delete(note)
            db.commit()
        return {"noteDate": payload.noteDate, "content": ""}

    if not note:
        note = CalendarDayNote(owner_uid=user.uid, note_date=payload.noteDate, content=content)
        db.add(note)
    else:
        note.content = content
    db.commit()
    return {"noteDate": payload.noteDate, "content": content}
