function base64urlToBuffer(base64url: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = window.btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function isWebAuthnSupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export async function registerTouchID(options: any): Promise<string> {
  if (!isWebAuthnSupported()) {
    throw new Error("Touch ID / WebAuthn is not supported by this browser.");
  }

  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64urlToBuffer(options.user.id),
    },
    excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  };

  const credential = (await navigator.credentials.create({
    publicKey,
  })) as PublicKeyCredential;

  if (!credential) {
    throw new Error("Touch ID prompt was cancelled or failed.");
  }

  const response = credential.response as AuthenticatorAttestationResponse;

  const attestationJSON = {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      attestationObject: bufferToBase64url(response.attestationObject),
      transports: typeof response.getTransports === "function" ? response.getTransports() : [],
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment,
  };

  return JSON.stringify(attestationJSON);
}

export async function authenticateTouchID(options: any): Promise<string> {
  if (!isWebAuthnSupported()) {
    throw new Error("Touch ID / WebAuthn is not supported by this browser.");
  }

  const publicKey: PublicKeyCredentialRequestOptions = {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((c: any) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  };

  const credential = (await navigator.credentials.get({
    publicKey,
  })) as PublicKeyCredential;

  if (!credential) {
    throw new Error("Touch ID authentication was cancelled or failed.");
  }

  const response = credential.response as AuthenticatorAssertionResponse;

  const assertionJSON = {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment,
  };

  return JSON.stringify(assertionJSON);
}
