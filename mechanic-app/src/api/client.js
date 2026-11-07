// Points at the Phase 1 backend built earlier (src/server.js).
// Reads the URL from app.json's "extra.apiBaseUrl" (see the Setup section
// in this app's README) rather than hardcoding it here, since the right
// value depends entirely on how/where you're running things:
//   - iOS simulator on the same machine as the backend: http://localhost:4000
//   - Android emulator: http://10.0.2.2:4000 (not localhost)
//   - Physical phone via Expo Go: your machine's LAN IP, e.g.
//     http://192.168.1.42:4000, or an ngrok/tunnel URL
// Editing app.json means you don't have to touch source across all three
// apps every time you switch how you're testing.
import Constants from "expo-constants";

const configuredUrl = Constants.expoConfig?.extra?.apiBaseUrl;
const PLACEHOLDER = "http://CHANGE-ME-TO-YOUR-LAN-IP:4000";
const BASE_URL = configuredUrl && configuredUrl !== PLACEHOLDER ? configuredUrl : "http://localhost:4000";

if (!configuredUrl || configuredUrl === PLACEHOLDER) {
  console.warn(
    "[EVMOS] app.json's extra.apiBaseUrl is still the placeholder — falling back to " +
    "http://localhost:4000, which will NOT work from Expo Go on a physical device. " +
    "Set extra.apiBaseUrl in app.json to your machine's LAN IP or a tunnel URL before " +
    "testing on a real device."
  );
}

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  requestOtp: (phone) => request("/auth/otp/request", { method: "POST", body: { phone } }),
  verifyOtp: (phone, code, name, role) =>
    request("/auth/otp/verify", { method: "POST", body: { phone, code, name, role } }),
  logout: (token) => request("/auth/logout", { method: "POST", token }),

  myMechanicProfile: (token) => request("/mechanics/me", { token }),
  registerMechanic: (token, verificationDocsUrl) =>
    request("/mechanics/register", {
      method: "POST",
      body: { verification_docs_url: verificationDocsUrl || undefined },
      token,
    }),
  uploadDocument: (token, filename, mimeType, contentBase64) =>
    request("/mechanics/documents", {
      method: "POST",
      body: { filename, mime_type: mimeType, content_base64: contentBase64 },
      token,
    }),

  nearbyRequests: (token, lat, lng) =>
    request(`/service-requests/nearby?lat=${lat}&lng=${lng}`, { token }),
  myAssignedRequests: (token) => request("/service-requests/mine", { token }),
  acceptRequest: (token, requestId, mechanicId) =>
    request(`/service-requests/${requestId}`, {
      method: "PATCH",
      body: { status: "accepted", mechanic_id: mechanicId },
      token,
    }),
  completeRequest: (token, requestId) =>
    request(`/service-requests/${requestId}`, {
      method: "PATCH",
      body: { status: "completed" },
      token,
    }),
};

export { BASE_URL };
