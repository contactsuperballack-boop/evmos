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

  createStation: (token, station) =>
    request("/stations", { method: "POST", body: station, token }),
  myStations: (token) => request("/stations/mine", { token }),
  activateStation: (token, stationId) =>
    request(`/stations/${stationId}/activate`, { method: "POST", token }),
  addCharger: (token, stationId, charger) =>
    request(`/stations/${stationId}/chargers`, { method: "POST", body: charger, token }),
  updateCharger: (token, chargerId, updates) =>
    request(`/chargers/${chargerId}`, { method: "PATCH", body: updates, token }),
  updateQueue: (token, chargerId, currentWaitEstimateMin) =>
    request(`/queue/${chargerId}`, {
      method: "PATCH",
      body: { current_wait_estimate_min: currentWaitEstimateMin },
      token,
    }),
  stationSessions: (token, stationId) =>
    request(`/stations/${stationId}/sessions`, { token }),
  getAnalytics: (token, stationId) => request(`/stations/${stationId}/analytics`, { token }),
  createFeaturedListing: (token, stationId, days) =>
    request(`/stations/${stationId}/featured-listing`, { method: "POST", body: { days }, token }),

  getWallet: (token) => request("/wallet", { token }),
  topupWallet: (token, amount) => request("/wallet/topup", { method: "POST", body: { amount }, token }),
};

export { BASE_URL };
