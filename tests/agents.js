import chai from "chai";

import tls from "tls";
import dns from "dns";

import fetch from "node-fetch";

import { SocksProxyAgent } from "socks-proxy-agent";

import { NetAxis } from "../src/netaxis.js";
import { DnsOverride } from "../src/plugins/dns-override.js";
import { SslPinning } from "../src/main.js";
import { WrappingAgent } from "../src/helpers.js";
import http from "http";
import * as net from "net";

describe("Agents support", () => {
  describe("Native behavior when no plugins set", () => {
    const netx = new NetAxis({
      list: {
        "example.net": {
          ip: "140.82.121.4",
        },
      },
    });

    it("Check native HTTP/S Agents", async () => {
      async function checkNative(url) {
        let body;

        try {
          const res = await fetch(url, {
            agent: netx.agentCreator(),
          });

          body = await res.text();
        } catch (err) {
          chai.expect.fail("Failed to fetch via HTTPS Agent");
          return;
        }

        chai.expect(body).to.include("<title>Example Domain</title>");
      }

      await checkNative("https://example.net/");
      await checkNative("http://example.net/");
    });

    it("Check SOCKS Proxy Agent", async () => {
      const socksAgent = (o) =>
        new SocksProxyAgent("socks://127.0.0.1:8889", o);
      const httpsAgent = new WrappingAgent("https", netx, socksAgent, {
        rejectUnauthorized: false,
      });

      let body;

      try {
        const res = await fetch("https://example.net/", {
          agent: httpsAgent,
        });

        body = await res.text();
      } catch (err) {
        if (err.message.includes("ECONNREFUSED")) {
          chai.expect.fail("Is SOCKS proxy running?");
          return;
        }

        chai.expect.fail("Failed to fetch. Is Agent okay?");
        return;
      }

      chai.expect(body).to.include("<title>Example Domain</title>");
    });
  });

  describe("DNS Override Plugin", async () => {
    const netx = new NetAxis({
      list: {
        "example.net": {
          ip: "140.82.121.4",
        },
      },
    });

    netx.use(new DnsOverride());

    it("Check native HTTP/S Agents", async () => {
      async function checkNative(url) {
        let body;

        try {
          const res = await fetch(url, {
            agent: netx.agentCreator(),
          });

          body = await res.text();
        } catch (err) {
          chai.expect(err.code).to.equal("ERR_TLS_CERT_ALTNAME_INVALID");
          chai.expect(err.message).to.include("Host: example.net");
          chai.expect(err.message).to.include("DNS:github.com");
          return;
        }

        chai.expect(body).to.include("<title>Example Domain</title>");
      }

      await checkNative("https://example.net/");
      await checkNative("http://example.net/");
    });

    it("Check SOCKS Proxy Agent", async () => {
      const socksAgent = (o) =>
        new SocksProxyAgent("socks://127.0.0.1:8889", o);
      const httpsAgent = new WrappingAgent("https", netx, socksAgent, {
        rejectUnauthorized: false,
      });

      let body;

      try {
        const res = await fetch("https://example.net/", {
          agent: httpsAgent,
        });

        body = await res.text();
      } catch (err) {
        if (err.message.includes("ECONNREFUSED")) {
          chai.expect.fail("Is SOCKS proxy running?");
          return;
        }

        chai.expect.fail("Failed to fetch. Is Agent okay?");
        return;
      }

      chai.expect(body).to.include("GitHub");
    });
  });

  describe("SSL Pinning Plugin", async () => {
    const netx = new NetAxis({
      list: {
        "example.net": {
          ip: "140.82.121.4",
        },
      },
    });

    netx.use(new DnsOverride());
    netx.use(new SslPinning(), {
      checkPinningOnly: true,
      socketOptions: {
        rejectUnauthorized: false,
      },
    });

    it("Check native HTTP/S Agents", async () => {
      async function checkNative(url) {
        let body;

        try {
          const res = await fetch(url, {
            agent: netx.agentCreator(),
          });

          body = await res.text();
        } catch (err) {
          chai.expect.fail("Failed to fetch via HTTPS Agent");
          return;
        }

        chai.expect(body).to.include("GitHub");
      }

      await checkNative("https://example.net/");
      await checkNative("http://example.net/");
    });

    it("Check SOCKS Proxy Agent", async () => {
      const socksAgent = (o) =>
        new SocksProxyAgent("socks://127.0.0.1:8889", o);
      const httpsAgent = new WrappingAgent("https", netx, socksAgent);

      let body;

      try {
        const res = await fetch("https://example.net/", {
          agent: httpsAgent,
        });

        body = await res.text();
      } catch (err) {
        if (err.message.includes("ECONNREFUSED")) {
          chai.expect.fail("Is SOCKS proxy running?");
          return;
        }

        chai.expect.fail("Failed to fetch. Is Agent okay?");
        return;
      }

      chai.expect(body).to.include("GitHub");
    });
  });
});

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 1;
