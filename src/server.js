const http = require("http");
const { URL } = require("url");
const { json } = require("./lib/util");

const auth = require("./http/authController");
const vehicles = require("./http/vehiclesController");
const stations = require("./http/stationsController");
const queue = require("./http/queueController");
const sessions = require("./http/sessionsController");
const mechanics = require("./http/mechanicsController");
const serviceRequests = require("./http/serviceRequestsController");
const wallet = require("./http/walletController");
const coupons = require("./http/couponsController");
const loyalty = require("./http/loyaltyController");
const holds = require("./http/holdsController");
const marketplace = require("./http/marketplaceController");
const stationExtras = require("./http/stationExtrasController");
const routePlanning = require("./routes/routePlanning");
const maps = require("./routes/maps");
const stationReviews = require("./http/stationReviewsController");
const recommendations = require("./http/recommendationsController");

const PORT = process.env.PORT || 4000;

// Minimal hand-rolled router — deliberately dependency-free for Phase 1
// local dev. Swap this file for a NestJS app module (per the build spec's
// tech stack) when moving toward production; every route handler below is
// already a plain async (req, res, ...params) function, so porting the
// logic into NestJS controllers is mostly a lift-and-shift.
const routes = [
  { method: "POST", pattern: /^\/auth\/otp\/request$/, handler: (req, res) => auth.otpRequest(req, res) },
  { method: "POST", pattern: /^\/auth\/otp\/verify$/, handler: (req, res) => auth.otpVerify(req, res) },
  { method: "POST", pattern: /^\/auth\/logout$/, handler: (req, res) => auth.logout(req, res) },

  { method: "POST", pattern: /^\/vehicles$/, handler: (req, res) => vehicles.createVehicle(req, res) },
  { method: "GET", pattern: /^\/vehicles$/, handler: (req, res) => vehicles.listVehicles(req, res) },
  { method: "PATCH", pattern: /^\/vehicles\/([^/]+)$/, handler: (req, res, m) => vehicles.updateVehicle(req, res, m[1]) },

  { method: "POST", pattern: /^\/stations$/, handler: (req, res) => stations.createStation(req, res) },
  { method: "GET", pattern: /^\/stations\/mine$/, handler: (req, res) => stations.myStations(req, res) },
  { method: "GET", pattern: /^\/stations\/nearby$/, handler: (req, res, m, q) => stations.nearbyStations(req, res, q) },
  { method: "POST", pattern: /^\/stations\/([^/]+)\/activate$/, handler: (req, res, m) => stations.activateStation(req, res, m[1]) },
  { method: "GET", pattern: /^\/stations\/([^/]+)\/chargers$/, handler: (req, res, m) => stations.listChargers(req, res, m[1]) },
  { method: "POST", pattern: /^\/stations\/([^/]+)\/chargers$/, handler: (req, res, m) => stations.addCharger(req, res, m[1]) },
  { method: "GET", pattern: /^\/stations\/([^/]+)\/sessions$/, handler: (req, res, m) => stations.stationSessions(req, res, m[1]) },
  { method: "GET", pattern: /^\/stations\/([^/]+)\/analytics$/, handler: (req, res, m) => stationExtras.getAnalytics(req, res, m[1]) },
  { method: "POST", pattern: /^\/stations\/([^/]+)\/featured-listing$/, handler: (req, res, m) => stationExtras.createFeaturedListing(req, res, m[1]) },

  { method: "POST", pattern: /^\/route\/plan$/, handler: (req, res) => routePlanning.planRoute(req, res) },

  { method: "GET", pattern: /^\/maps\/geocode$/, handler: (req, res, m, q) => maps.geocode(req, res, q) },
  { method: "GET", pattern: /^\/maps\/geocode\/compare$/, handler: (req, res, m, q) => maps.compareGeocode(req, res, q) },
  { method: "GET", pattern: /^\/maps\/reverse-geocode$/, handler: (req, res, m, q) => maps.reverseGeocode(req, res, q) },
  { method: "GET", pattern: /^\/maps\/places\/search$/, handler: (req, res, m, q) => maps.searchPlaces(req, res, q) },

  { method: "POST", pattern: /^\/station-reviews$/, handler: (req, res) => stationReviews.createStationReview(req, res) },
  { method: "GET", pattern: /^\/stations\/([^/]+)\/reviews$/, handler: (req, res, m) => stationReviews.listStationReviews(req, res, m[1]) },

  { method: "GET", pattern: /^\/recommendations\/nearby$/, handler: (req, res, m, q) => recommendations.getRecommendations(req, res, q) },
  { method: "PATCH", pattern: /^\/chargers\/([^/]+)$/, handler: (req, res, m) => stations.updateCharger(req, res, m[1]) },

  { method: "GET", pattern: /^\/queue\/([^/]+)$/, handler: (req, res, m) => queue.getQueue(req, res, m[1]) },
  { method: "PATCH", pattern: /^\/queue\/([^/]+)$/, handler: (req, res, m) => queue.updateQueue(req, res, m[1]) },

  { method: "POST", pattern: /^\/sessions$/, handler: (req, res) => sessions.startSession(req, res) },
  { method: "PATCH", pattern: /^\/sessions\/([^/]+)$/, handler: (req, res, m) => sessions.endSession(req, res, m[1]) },
  { method: "GET", pattern: /^\/sessions$/, handler: (req, res) => sessions.listSessions(req, res) },

  { method: "POST", pattern: /^\/mechanics\/register$/, handler: (req, res) => mechanics.registerMechanic(req, res) },
  { method: "GET", pattern: /^\/mechanics\/me$/, handler: (req, res) => mechanics.myMechanicProfile(req, res) },
  { method: "POST", pattern: /^\/mechanics\/documents$/, handler: (req, res) => mechanics.uploadDocument(req, res) },
  { method: "GET", pattern: /^\/mechanics\/([^/]+)\/reviews$/, handler: (req, res, m) => serviceRequests.listMechanicReviews(req, res, m[1]) },
  { method: "GET", pattern: /^\/service-requests\/mine$/, handler: (req, res) => serviceRequests.myAssignedRequests(req, res) },
  { method: "GET", pattern: /^\/service-requests\/nearby$/, handler: (req, res, m, q) => serviceRequests.nearbyRequests(req, res, q) },
  { method: "POST", pattern: /^\/service-requests$/, handler: (req, res) => serviceRequests.createServiceRequest(req, res) },
  { method: "GET", pattern: /^\/service-requests\/([^/]+)$/, handler: (req, res, m) => serviceRequests.getServiceRequest(req, res, m[1]) },
  { method: "PATCH", pattern: /^\/service-requests\/([^/]+)$/, handler: (req, res, m) => serviceRequests.updateServiceRequest(req, res, m[1]) },
  { method: "POST", pattern: /^\/mechanic-reviews$/, handler: (req, res) => serviceRequests.createReview(req, res) },

  { method: "GET", pattern: /^\/wallet$/, handler: (req, res) => wallet.getWallet(req, res) },
  { method: "POST", pattern: /^\/wallet\/topup$/, handler: (req, res) => wallet.topupWallet(req, res) },

  { method: "POST", pattern: /^\/coupons$/, handler: (req, res) => coupons.createCoupon(req, res) },
  { method: "GET", pattern: /^\/coupons\/mine$/, handler: (req, res) => coupons.myCoupons(req, res) },
  { method: "POST", pattern: /^\/coupons\/validate$/, handler: (req, res) => coupons.validateCoupon(req, res) },

  { method: "GET", pattern: /^\/loyalty\/account$/, handler: (req, res) => loyalty.getLoyaltyAccount(req, res) },

  { method: "POST", pattern: /^\/holds$/, handler: (req, res) => holds.createHold(req, res) },
  { method: "GET", pattern: /^\/holds\/mine$/, handler: (req, res) => holds.myHolds(req, res) },
  { method: "PATCH", pattern: /^\/holds\/([^/]+)\/cancel$/, handler: (req, res, m) => holds.cancelHold(req, res, m[1]) },

  { method: "POST", pattern: /^\/marketplace\/products$/, handler: (req, res) => marketplace.createProduct(req, res) },
  { method: "GET", pattern: /^\/marketplace\/products\/mine$/, handler: (req, res) => marketplace.myProducts(req, res) },
  { method: "GET", pattern: /^\/marketplace\/products$/, handler: (req, res, m, q) => marketplace.listProducts(req, res, q) },
  { method: "PATCH", pattern: /^\/marketplace\/products\/([^/]+)$/, handler: (req, res, m) => marketplace.updateProduct(req, res, m[1]) },
  { method: "POST", pattern: /^\/marketplace\/orders$/, handler: (req, res) => marketplace.createOrder(req, res) },
  { method: "GET", pattern: /^\/marketplace\/orders\/mine$/, handler: (req, res) => marketplace.myOrders(req, res) },
];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const query = Object.fromEntries(url.searchParams);

  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { status: "ok", service: "evmos-phase1-api" });
  }

  for (const route of routes) {
    if (route.method !== req.method) continue;
    const match = url.pathname.match(route.pattern);
    if (match) {
      try {
        await route.handler(req, res, match, query);
      } catch (err) {
        if (!res.headersSent) {
          if (!(err && err.status)) console.error(err);
          json(res, (err && err.status) || 500, { error: err.message || "Internal server error" });
        }
      }
      return;
    }
  }

  json(res, 404, { error: `No route for ${req.method} ${url.pathname}` });
});

server.listen(PORT, () => {
  console.log(`EVMOS Phase 1 API listening on http://localhost:${PORT}`);
});
