// Central place that knows which map/geo providers are actually
// configured. Nothing else in the codebase should read process.env
// directly for these keys — go through here, so there's one place that
// knows the real state of provider configuration.

const config = {
  google: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || null,
  },
  mapbox: {
    accessToken: process.env.MAPBOX_ACCESS_TOKEN || null,
  },
};

module.exports = {
  isGoogleConfigured: () => !!config.google.apiKey,
  isMapboxConfigured: () => !!config.mapbox.accessToken,
  getGoogleApiKey: () => config.google.apiKey,
  getMapboxAccessToken: () => config.mapbox.accessToken,
};
