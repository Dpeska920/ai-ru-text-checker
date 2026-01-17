import base64

import pytest

from app.services.parser_service import (
    CorruptedFileError,
    EmptyFileError,
    ParserService,
    UnsupportedFormatError,
)


@pytest.fixture
def parser():
    return ParserService()


class TestParserService:
    def test_parse_txt(self, parser):
        text = "Hello, World!"
        content = base64.b64encode(text.encode("utf-8")).decode()
        result = parser.parse(content, "txt")
        assert result == text

    def test_parse_md(self, parser):
        text = "# Header\n\nSome **bold** text"
        content = base64.b64encode(text.encode("utf-8")).decode()
        result = parser.parse(content, "md")
        assert result == text

    def test_parse_txt_cyrillic(self, parser):
        text = "Привет, мир! Это текст на русском языке."
        content = base64.b64encode(text.encode("utf-8")).decode()
        result = parser.parse(content, "txt")
        assert result == text

    def test_parse_txt_cp1251(self, parser):
        text = "Привет, мир!"
        content = base64.b64encode(text.encode("cp1251")).decode()
        result = parser.parse(content, "txt")
        assert result == text

    def test_parse_empty_content(self, parser):
        with pytest.raises(EmptyFileError):
            parser.parse("", "txt")

    def test_parse_empty_file(self, parser):
        content = base64.b64encode(b"").decode()
        with pytest.raises(EmptyFileError):
            parser.parse(content, "txt")

    def test_parse_whitespace_only(self, parser):
        content = base64.b64encode(b"   \n\n\t  ").decode()
        with pytest.raises(CorruptedFileError):
            parser.parse(content, "txt")

    def test_parse_invalid_base64(self, parser):
        with pytest.raises(CorruptedFileError):
            parser.parse("not-valid-base64!!!", "txt")

    def test_parse_unsupported_format(self, parser):
        content = base64.b64encode(b"test").decode()
        with pytest.raises(UnsupportedFormatError):
            parser.parse(content, "xlsx")

    def test_parse_doc_not_supported(self, parser):
        content = base64.b64encode(b"test").decode()
        with pytest.raises(UnsupportedFormatError):
            parser.parse(content, "doc")

    def test_parse_file_type_case_insensitive(self, parser):
        text = "Test"
        content = base64.b64encode(text.encode()).decode()
        result = parser.parse(content, "TXT")
        assert result == text
