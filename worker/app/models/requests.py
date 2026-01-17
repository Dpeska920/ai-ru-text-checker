from typing import Literal

from pydantic import BaseModel, Field


class ParseRequest(BaseModel):
    file_content: str = Field(..., description="Base64 encoded file content")
    file_type: Literal["docx", "doc", "pdf", "txt", "md"]


class FactChange(BaseModel):
    original: str
    corrected: str
    context: str
    source: str | None = None


class DiffRequest(BaseModel):
    original: str
    corrected: str
    fact_changes: list[FactChange] | None = None
