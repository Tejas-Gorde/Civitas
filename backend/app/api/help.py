import os
import re
from fastapi import APIRouter, HTTPException
from app.schemas import HelpChatRequest, HelpChatResponse

router = APIRouter(prefix="/help", tags=["Help & Assistance"])

# Non-partisan Help Knowledge Base in English and Hindi
HELP_KNOWLEDGE_EN = [
    (
        r"(verification|how.*work|process|flow|steps)",
        "Civitas Secure Voting follows an 8-step verification protocol: 1. Eligibility Check, 2. Touch ID Authentication, 3. Photo Capture, 4. Liveness Verification, 5. Security Challenge, 6. Ballot Selection, 7. Final Review, and 8. Official Receipt generation."
    ),
    (
        r"(touch id|fingerprint|mac|passkey|webauthn)",
        "When prompted, touch the Touch ID sensor on your Mac. Civitas uses WebAuthn platform authentication — your raw biometric fingerprint is verified locally on your device and is never sent to or stored by the server."
    ),
    (
        r"(photo|picture|camera|take photo|why photo)",
        "Step 3 captures a single photograph for audit verification during this specific voting session. Your photo is securely uploaded to the voting backend storage and is not used for face recognition matching."
    ),
    (
        r"(liveness|anti-spoof|3d|spoof)",
        "Step 4 Liveness Verification verifies that a real, physical person is present in front of the camera using texture sharpness and lighting indicators, preventing printed photo recasts."
    ),
    (
        r"(candidate|vote for|who should|choose|recommend|party|leader)",
        "Civitas is a neutral, non-partisan voting system. The assistant cannot recommend, promote, or compare any candidate. Please review all candidate manifestos carefully on the ballot screen to make your own choice."
    ),
    (
        r"(ballot|select|change|modify|submit|cast)",
        "On Step 6 (Ballot Selection), click on your chosen candidate. You will have a chance to review your selection on Step 7 before finally submitting your single-use ballot token."
    ),
    (
        r"(camera.*not working|black screen|permission|webcam)",
        "If your camera is not displaying: 1. Ensure camera permissions are allowed in Chrome browser settings, 2. Verify no other app (FaceTime, Zoom) is using the webcam, 3. Refresh the page to restart camera access."
    ),
    (
        r"(receipt|reference|confirm)",
        "After submitting your ballot, Step 8 generates a unique cryptographic receipt reference. Keep this reference as official confirmation that your vote was securely recorded in the election database."
    )
]

HELP_KNOWLEDGE_HI = [
    (
        r"(सत्यापन|प्रक्रिया|चरण|कैसे काम)",
        "सिविटास वोटिंग 8-चरणीय सत्यापन प्रक्रिया का पालन करती है: 1. पात्रता जांच, 2. Touch ID फिंगरप्रिंट, 3. फोटो कैप्चर, 4. लाइवनेस जांच, 5. सुरक्षा चुनौती, 6. मतपत्र चयन, 7. समीक्षा, और 8. आधिकारिक रसीद।"
    ),
    (
        r"(फिंगरप्रिंट|touch id|टच आईडी)",
        "अनुरोध किए जाने पर अपने Mac के Touch ID सेंसर पर उंगली रखें। आपका फिंगरप्रिंट डेटा आपके डिवाइस पर ही सत्यापित होता है और कभी भी सर्वर पर नहीं भेजा जाता।"
    ),
    (
        r"(फोटो|कैमरा|चित्र)",
        "चरण 3 में केवल इस वोटिंग सत्र के लिए आपकी एक फोटो कैप्चर की जाती है। यह फोटो सर्वर पर सुरक्षित रूप से सहेजी जाती है।"
    ),
    (
        r"(लाइवनेस|3d)",
        "चरण 4 लाइवनेस सत्यापन यह सुनिश्चित करता है कि कैमरे के सामने एक वास्तविक व्यक्ति मौजूद है।"
    ),
    (
        r"(उम्मीदवार|किसे वोट|पार्टी|नेता|सुझाव)",
        "सिविटास एक निष्पक्ष प्रणाली है। सहायक किसी भी उम्मीदवार का सुझाव या सिफारिश नहीं कर सकता। कृपया मतपत्र स्क्रीन पर सभी उम्मीदवारों की समीक्षा करके अपना स्वयं का निर्णय लें।"
    ),
    (
        r"(वोट कैसे|चयन|सबमिट|बदल)",
        "चरण 6 (मतपत्र) पर अपने पसंदीदा उम्मीदवार पर क्लिक करें। सबमिट करने से पहले आपको चरण 7 में अपनी पसंद की समीक्षा करने का अवसर मिलेगा।"
    ),
    (
        r"(कैमरा काम|अनुमति|वेबकैम)",
        "यदि आपका कैमरा काम नहीं कर रहा है: 1. क्रोम ब्राउज़र में कैमरा अनुमति सक्षम करें, 2. जांचें कि कोई अन्य ऐप (जैसे Zoom) कैमरे का उपयोग नहीं कर रहा है।"
    ),
    (
        r"(रसीद|प्रमाण पत्र)",
        "वोट सबमिट करने के बाद, चरण 8 एक अनूठी रसीद आईडी प्रदान करता है। इसे यह पुष्टि करने के लिए सुरक्षित रखें कि आपका वोट सफलतापूर्वक दर्ज किया गया है।"
    )
]


@router.post("/chat", response_model=HelpChatResponse)
async def help_chat(request: HelpChatRequest):
    msg = request.message.strip()
    lang = request.language.lower()

    if not msg:
        raise HTTPException(400, "Message cannot be empty")

    # Safety Guardrail: Refuse candidate recommendation / political influence attempts
    political_keywords = ["who to vote", "which candidate", "best candidate", "who should i", "vote for whom", "किसे वोट दें", "कौन सा उम्मीदवार"]
    if any(kw in msg.lower() for kw in political_keywords):
        if lang == "hi":
            return HelpChatResponse(
                answer="सिविटास एक निष्पक्ष और सुरक्षित प्रणाली है। मैं किसी भी उम्मीदवार की सिफारिश या तुलना नहीं कर सकता। कृपया अपनी व्यक्तिगत पसंद के अनुसार स्वतंत्र निर्णय लें।",
                language="hi"
            )
        return HelpChatResponse(
            answer="Civitas is a neutral, non-partisan voting system. I cannot recommend, compare, or suggest any candidate. Please review the official candidate details on the ballot screen and make your own independent choice.",
            language="en"
        )

    # Optional External AI Provider Integration if API Key is configured in environment
    ai_key = os.getenv("AI_API_KEY")
    if ai_key:
        try:
            # Here AI provider request can be executed via httpx if configured
            pass
        except Exception:
            pass

    # Domain-Specific Civitas Knowledge Engine Fallback
    knowledge_list = HELP_KNOWLEDGE_HI if lang == "hi" else HELP_KNOWLEDGE_EN

    for pattern, answer in knowledge_list:
        if re.search(pattern, msg, re.IGNORECASE):
            return HelpChatResponse(answer=answer, language=lang)

    # Default friendly instructions if query is generic
    if lang == "hi":
        return HelpChatResponse(
            answer="सिविटास हेल्प असिस्टेंट में आपका स्वागत है। आप मुझसे पात्रता, Touch ID, फोटो कैप्चर, लाइवनेस सत्यापन या वोट डालने की प्रक्रिया के बारे में प्रश्न पूछ सकते हैं।",
            language="hi"
        )

    return HelpChatResponse(
        answer="Welcome to Civitas Help Assistant. You can ask me about voter eligibility, Touch ID, photo capture, liveness verification, or how to review and cast your ballot.",
        language="en"
    )
