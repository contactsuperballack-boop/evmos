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

  createVehicle: (token, vehicle) =>
    request("/vehicles", { method: "POST", body: vehicle, token }),
  listVehicles: (token) => request("/vehicles", { token }),
  updateVehicle: (token, vehicleId, vehicle) =>
    request(`/vehicles/${vehicleId}`, { method: "PATCH", body: vehicle, token }),

  nearbyStations: (lat, lng, radiusKm = 10) =>
    request(`/stations/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`),

  startSession: (token, chargerId) =>
    request("/sessions", { method: "POST", body: { charger_id: chargerId }, token }),
  endSession: (token, sessionId, kwhEstimate, couponCode) =>
    request(`/sessions/${sessionId}`, {
      method: "PATCH",
      body: { kwh_estimate: kwhEstimate, coupon_code: couponCode || undefined },
      token,
    }),
  listSessions: (token) => request("/sessions", { token }),

  requestMechanic: (token, faultType, lat, lng) =>
    request("/service-requests", {
      method: "POST",
      body: { fault_type: faultType, lat, lng },
      token,
    }),
  getServiceRequest: (token, requestId) => request(`/service-requests/${requestId}`, { token }),
  createReview: (token, serviceRequestId, rating, comment) =>
    request("/mechanic-reviews", {
      method: "POST",
      body: { service_request_id: serviceRequestId, rating, comment },
      token,
    }),

  planRoute: (token, originLat, originLng, destLat, destLng, remainingRangeKm) =>
    request("/route/plan", {
      method: "POST",
      body: {
        origin_lat: originLat,
        origin_lng: originLng,
        destination_lat: destLat,
        destination_lng: destLng,
        remaining_range_km: remainingRangeKm,
      },
      token,
    }),

  createStationReview: (token, sessionId, rating, comment) =>
    request("/station-reviews", {
      method: "POST",
      body: { session_id: sessionId, rating, comment },
      token,
    }),

  getRecommendations: (token, lat, lng, radiusKm = 15) =>
    request(`/recommendations/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`, { token }),

  getWallet: (token) => request("/wallet", { token }),
  topupWallet: (token, amount) =>
    request("/wallet/topup", { method: "POST", body: { amount }, token }),

  validateCoupon: (token, code, scope) =>
    request("/coupons/validate", { method: "POST", body: { code, scope }, token }),

  getLoyaltyAccount: (token) => request("/loyalty/account", { token }),

  createHold: (token, chargerId, durationMinutes) =>
    request("/holds", { method: "POST", body: { charger_id: chargerId, duration_minutes: durationMinutes }, token }),
  myHolds: (token) => request("/holds/mine", { token }),
  cancelHold: (token, holdId) => request(`/holds/${holdId}/cancel`, { method: "PATCH", token }),

  listProducts: (category) => request(`/marketplace/products${category ? `?category=${category}` : ""}`),
  createOrder: (token, productId, qty) =>
    request("/marketplace/orders", { method: "POST", body: { product_id: productId, qty }, token }),
  myOrders: (token) => request("/marketplace/orders/mine", { token }),
};

export { BASE_URL };
