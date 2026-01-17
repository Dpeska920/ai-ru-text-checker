from fastapi import APIRouter

from app.models import DiffRequest, DiffResponse, ParseRequest, ParseResponse
from app.services import DiffService, ParserService
from app.services.parser_service import (
    CorruptedFileError,
    EmptyFileError,
    UnsupportedFormatError,
)

router = APIRouter()

parser_service = ParserService()
diff_service = DiffService()


@router.post("/parse", response_model=ParseResponse)
async def parse_document(request: ParseRequest) -> ParseResponse:
    """Parse document and extract text."""
    try:
        text = parser_service.parse(request.file_content, request.file_type)
        return ParseResponse(text=text)
    except EmptyFileError as e:
        return ParseResponse(text="", error=str(e))
    except CorruptedFileError as e:
        return ParseResponse(text="", error=str(e))
    except UnsupportedFormatError as e:
        return ParseResponse(text="", error=str(e))
    except Exception as e:
        return ParseResponse(text="", error=f"Failed to parse document: {e}")


@router.post("/generate", response_model=DiffResponse)
async def generate_documents(request: DiffRequest) -> DiffResponse:
    """Generate clean and diff documents."""
    if not request.original and not request.corrected:
        return DiffResponse(
            clean_doc="", diff_doc="", error="Both original and corrected texts are empty"
        )

    try:
        clean_doc, diff_doc = diff_service.generate(
            request.original,
            request.corrected,
            request.fact_changes,
        )
        return DiffResponse(clean_doc=clean_doc, diff_doc=diff_doc)
    except Exception as e:
        return DiffResponse(
            clean_doc="", diff_doc="", error=f"Failed to generate documents: {e}"
        )
