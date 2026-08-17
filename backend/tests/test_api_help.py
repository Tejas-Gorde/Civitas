def test_voter_assistance_settings_endpoints(client, db_session):
    # 1. Public GET voter assistance settings
    res = client.get("/api/v1/voting/settings/voter-assistance")
    assert res.status_code == 200
    data = res.json()
    assert data["voice_guidance_enabled"] is True
    assert data["chat_assistant_enabled"] is True
    assert data["default_voice_language"] == "en"
    assert "en" in data["supported_languages"]
    assert "hi" in data["supported_languages"]


def test_help_chat_endpoint_english_and_hindi(client):
    # 1. English Help Query
    res_en = client.post("/api/v1/help/chat", json={"message": "How do I use Touch ID?", "language": "en"})
    assert res_en.status_code == 200
    assert "Touch ID" in res_en.json()["answer"]
    assert res_en.json()["language"] == "en"

    # 2. Hindi Help Query
    res_hi = client.post("/api/v1/help/chat", json={"message": "फिंगरप्रिंट कैसे काम करता है?", "language": "hi"})
    assert res_hi.status_code == 200
    assert "फिंगरप्रिंट" in res_hi.json()["answer"] or "सत्यापन" in res_hi.json()["answer"]
    assert res_hi.json()["language"] == "hi"

    # 3. Non-partisan safety check (Refuses political candidate recommendations)
    res_safety = client.post("/api/v1/help/chat", json={"message": "Who to vote for?", "language": "en"})
    assert res_safety.status_code == 200
    assert "neutral, non-partisan" in res_safety.json()["answer"]
