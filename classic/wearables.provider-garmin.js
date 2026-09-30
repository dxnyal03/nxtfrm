/* NXTFRM P1: Garmin adapter shell. No live OAuth, no secrets, no fake connection.
 * Collect is refused until a confidential backend can supply authenticated deliveries.
 */
"use strict";
(function (root) {
  var BOUNDARY = "p1.provider_garmin";
  var ADAPTER_ID = "nxtfrm.g3b.garmin.v1";
  var PROVIDER_ID = "garmin.connect";
  var LIVE_AUTH = Object.freeze({
    provider_id: PROVIDER_ID,
    protocol: "oauth2_confidential",
    confidential_secret_required: true,
    backend_present: false,
    credentials_in_repo: false,
    webhooks_required: "unknown_likely",
    pwa_can_complete_securely: false,
    decision: "LIVE PROVIDER AUTH DEFERRED — SECURE BACKEND / PROVIDER ACCESS REQUIRED"
  });

  function clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function authError() {
    var err = new Error(LIVE_AUTH.decision);
    err.code = "authentication_required";
    return err;
  }

  function createGarminAdapter(opts) {
    opts = opts || {};
    var connectionId = opts.connection_id || "unbound";
    return {
      adapter_id: ADAPTER_ID,
      provider_id: PROVIDER_ID,
      capabilities: ["metrics", "sleep", "activities", "body"],
      source_instance_ref: {
        kind: "api",
        provider_id: PROVIDER_ID,
        connection_id: connectionId
      },
      describe: function () {
        return {
          adapter_id: ADAPTER_ID,
          provider_id: PROVIDER_ID,
          live_auth: clone(LIVE_AUTH),
          collects: false
        };
      },
      getSourceInstanceRef: function () {
        return {
          kind: "api",
          provider_id: PROVIDER_ID,
          connection_id: connectionId
        };
      },
      collect: function () {
        throw authError();
      }
    };
  }

  var page = {
    ADAPTER_ID: ADAPTER_ID,
    PROVIDER_ID: PROVIDER_ID,
    LIVE_AUTH: LIVE_AUTH,
    describeLiveAuth: function () { return clone(LIVE_AUTH); },
    createAdapter: createGarminAdapter,
    status: function () {
      return {
        api: "NXT.wearables.providers.garmin",
        boundary: BOUNDARY,
        live_auth: false,
        network: false,
        secrets: false
      };
    }
  };

  if (typeof NXT === "object" && NXT && NXT.wearables) {
    NXT.wearables.providers = NXT.wearables.providers || {};
    NXT.wearables.providers.garmin = page;
  }
  root.NXTFRMWearableGarmin = page;
})(typeof globalThis !== "undefined" ? globalThis : this);
