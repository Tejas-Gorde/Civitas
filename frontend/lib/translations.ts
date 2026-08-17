export type Language = "en" | "hi";

export interface StepInstruction {
  speak: string;
  display: string;
}


export const STEP_INSTRUCTIONS: Record<Language, Record<string, StepInstruction>> = {
  en: {
    identify: {
      speak: "Welcome to Civitas Secure Digital Voting System. Step 1. Please verify your voter eligibility.",
      display: "Enter your full name and voter registration ID to verify your eligibility.",
    },
    fingerprint: {
      speak: "Step 2. Fingerprint and Touch ID verification. Please use Touch ID when prompted by your device.",
      display: "Verify your identity using Mac Touch ID.",
    },
    face: {
      speak: "Step 3. Photo capture verification. Please position your face inside the camera frame. Click Capture Photo when ready.",
      display: "Take a clear photograph for this voting session.",
    },
    face_preview: {
      speak: "Please review your photo. Select Retake if the photo is unclear, or Confirm if the photo is correct.",
      display: "Make sure your face is clearly visible before continuing.",
    },
    challenge: {
      speak: "Challenge step. Please shake your hand in front of the camera. Get ready. Three, two, one. Challenge completed.",
      display: "Please shake your hand in front of the camera.",
    },
    ballot: {
      speak: "Step 5. Ballot selection. Please review the candidates carefully and select your preferred candidate.",
      display: "Select one candidate from the registered choices below.",
    },
    review: {
      speak: "Step 6. Review selection before submission.",
      display: "Review your selection carefully before final submission.",
    },
    receipt: {
      speak: "Step 7. Official receipt generated. Your vote has been recorded successfully.",
      display: "Official ballot receipt generated.",
    },
  },
  hi: {
    identify: {
      speak: "सिविटास सुरक्षित डिजिटल वोटिंग सिस्टम में आपका स्वागत है। चरण 1। कृपया अपनी मतदाता पात्रता सत्यापित करें।",
      display: "अपनी पात्रता सत्यापित करने के लिए अपना पूरा नाम और मतदाता पंजीकरण आईडी दर्ज करें।",
    },
    fingerprint: {
      speak: "चरण 2। फिंगरप्रिंट और Touch ID सत्यापन। जब आपका डिवाइस अनुरोध करे, तब Touch ID का उपयोग करें।",
      display: "Mac Touch ID का उपयोग करके अपनी पहचान सत्यापित करें।",
    },
    face: {
      speak: "चरण 3। फोटो कैप्चर सत्यापन। कृपया अपना चेहरा कैमरा फ्रेम के अंदर रखें। तैयार होने पर Capture Photo दबाएं।",
      display: "इस वोटिंग सत्र के लिए एक स्पष्ट फोटो खींचें।",
    },
    face_preview: {
      speak: "कृपया अपनी फोटो की समीक्षा करें। यदि फोटो स्पष्ट नहीं है तो Retake चुनें, या यदि फोटो सही है तो Confirm चुनें।",
      display: "आगे बढ़ने से पहले सुनिश्चित करें कि आपका चेहरा स्पष्ट दिखाई दे रहा है।",
    },
    challenge: {
      speak: "चैलेंज चरण। कृपया कैमरे के सामने अपना हाथ हिलाएँ। तैयार हो जाइए। तीन, दो, एक। चैलेंज पूरा हुआ।",
      display: "कृपया कैमरे के सामने अपना हाथ हिलाएँ।",
    },
    ballot: {
      speak: "चरण 5। मतपत्र चयन। कृपया उम्मीदवारों की ध्यानपूर्वक समीक्षा करें और अपने पसंदीदा उम्मीदवार का चयन करें।",
      display: "नीचे दिए गए पंजीकृत विकल्पों में से एक उम्मीदवार का चयन करें।",
    },
    review: {
      speak: "चरण 6। सबमिट करने से पहले अपने चयन की समीक्षा करें।",
      display: "अंतिम जमा करने से पहले अपने चयन की ध्यानपूर्वक समीक्षा करें।",
    },
    receipt: {
      speak: "चरण 7। आधिकारिक रसीद। आपका वोट सफलतापूर्वक दर्ज कर लिया गया है।",
      display: "आधिकारिक मतपत्र रसीद जनरेट हो गई है।",
    },
  },
};

export const CHALLENGE_TEXTS: Record<Language, Record<string, { speak: string; display: string }>> = {
  en: {
    blink: {
      speak: "Please blink once.",
      display: "Please blink once.",
    },
    turn_left: {
      speak: "Please turn your head slightly to the left.",
      display: "Please turn your head slightly to the left.",
    },
    turn_right: {
      speak: "Please turn your head slightly to the right.",
      display: "Please turn your head slightly to the right.",
    },
    smile: {
      speak: "Please smile.",
      display: "Please smile.",
    },
  },
  hi: {
    blink: {
      speak: "कृपया एक बार पलक झपकाएं।",
      display: "कृपया एक बार पलक झपकाएं।",
    },
    turn_left: {
      speak: "कृपया अपना सिर थोड़ा बाईं ओर घुमाएं।",
      display: "कृपया अपना सिर थोड़ा बाईं ओर घुमाएं।",
    },
    turn_right: {
      speak: "कृपया अपना सिर थोड़ा दाईं ओर घुमाएं।",
      display: "कृपया अपना सिर थोड़ा दाईं ओर घुमाएं।",
    },
    smile: {
      speak: "कृपया मुस्कुराएं।",
      display: "कृपया मुस्कुराएं।",
    },
  },
};

export const FEEDBACK_MESSAGES: Record<Language, Record<string, string>> = {
  en: {
    verify_failed: "The voter information could not be verified. Please check your name and registration ID and try again.",
    touch_success: "Touch ID verification successful. Proceeding to the next step.",
    touch_failed: "Touch ID verification was not completed. Please try again.",
    photo_captured: "Photo captured. Please review the image.",
    photo_retake: "Please position yourself in the camera frame and capture a new photo.",
    photo_confirmed: "Photo confirmed. Proceeding to challenge verification.",
    challenge_success: "Security challenge verified successfully.",
    challenge_failed: "Challenge was not detected. Please position your face clearly in the frame and try again.",
  },
  hi: {
    verify_failed: "मतदाता जानकारी सत्यापित नहीं की जा सकी। कृपया अपना नाम और पंजीकरण आईडी जांचें और पुनः प्रयास करें।",
    touch_success: "Touch ID सत्यापन सफल रहा। अगले चरण पर बढ़ रहे हैं।",
    touch_failed: "Touch ID सत्यापन पूरा नहीं हुआ। कृपया पुनः प्रयास करें।",
    photo_captured: "फोटो खींच ली गई है। कृपया फोटो की समीक्षा करें।",
    photo_retake: "कृपया खुद को कैमरा फ्रेम में रखें और एक नई फोटो खींचें।",
    photo_confirmed: "फोटो की पुष्टि हो गई है। चुनौती सत्यापन पर बढ़ रहे हैं।",
    challenge_success: "सुरक्षा चुनौती का सफलतापूर्वक सत्यापन हुआ।",
    challenge_failed: "चुनौती का पता नहीं चला। कृपया अपना चेहरा स्पष्ट रूप से फ्रेम में रखें और पुनः प्रयास करें।",
  },
};

