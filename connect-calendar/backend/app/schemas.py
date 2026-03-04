from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Any, Dict, Literal

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
    metadata: Dict[str, Any]
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