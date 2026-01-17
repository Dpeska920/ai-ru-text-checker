from pydantic import BaseModel


class ParseResponse(BaseModel):
    text: str
    error: str | None = None


class DiffResponse(BaseModel):
    clean_doc: str  # base64 encoded docx
    diff_doc: str  # base64 encoded docx
    error: str | None = None
