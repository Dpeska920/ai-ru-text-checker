import base64

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_parse_txt_file(client):
    text = "Hello, World!"
    content = base64.b64encode(text.encode()).decode()

    response = await client.post(
        "/parse",
        json={"file_content": content, "file_type": "txt"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["text"] == text
    assert data["error"] is None


@pytest.mark.asyncio
async def test_parse_empty_file(client):
    content = base64.b64encode(b"").decode()

    response = await client.post(
        "/parse",
        json={"file_content": content, "file_type": "txt"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["text"] == ""
    assert data["error"] is not None
    assert "empty" in data["error"].lower()


@pytest.mark.asyncio
async def test_parse_unsupported_format(client):
    content = base64.b64encode(b"test").decode()

    response = await client.post(
        "/parse",
        json={"file_content": content, "file_type": "xlsx"},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_generate_documents(client):
    response = await client.post(
        "/generate",
        json={
            "original": "Hello world",
            "corrected": "Hello beautiful world",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["clean_doc"] != ""
    assert data["diff_doc"] != ""
    assert data["error"] is None


@pytest.mark.asyncio
async def test_generate_with_fact_changes(client):
    response = await client.post(
        "/generate",
        json={
            "original": "Глава Tesla Дональд Трамп",
            "corrected": "Глава Tesla Илон Маск",
            "fact_changes": [
                {
                    "original": "Дональд Трамп",
                    "corrected": "Илон Маск",
                    "context": "Глава Tesla",
                }
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["clean_doc"] != ""
    assert data["diff_doc"] != ""
    assert data["error"] is None


@pytest.mark.asyncio
async def test_generate_empty_texts(client):
    response = await client.post(
        "/generate",
        json={
            "original": "",
            "corrected": "",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["error"] is not None


@pytest.mark.asyncio
async def test_generate_same_text(client):
    text = "Same text"
    response = await client.post(
        "/generate",
        json={
            "original": text,
            "corrected": text,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["clean_doc"] != ""
    assert data["diff_doc"] != ""
    assert data["error"] is None
