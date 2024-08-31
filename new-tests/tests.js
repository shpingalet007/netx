import nodeFetch from "node-fetch";

import { NetAxis } from "../src/netaxis.js";
import { DnsOverride, SecManage, SslPinning } from "../src/main.js";
import chai from "chai";

import dns from "dns";
import tls from "tls";

const _nativeDns = dns.lookup;

const simulateDnsDown = () =>
  (dns.lookup = (z, x, cb) => {
    const err = Error("ENOTFOUND");
    err.code = "ENOTFOUND";

    cb(err);
  });
const restoreDns = () => (dns.lookup = _nativeDns);

async function confirmDnsInaccessible() {
  try {
    await nodeFetch("http://example.net/");
  } catch (err) {
    chai.expect(err.code).to.equal("ENOTFOUND");
    return;
  }

  chai.expect.fail("Default DNS is accessible, invalid environment");
}

describe("Non overriding mode", () => {
  describe("Plugin DNS Override", () => {
    it("HTTP request", async () => {
      const netx = new NetAxis({
        list: {
          "example.net": {
            ip: "93.184.215.14",
          },
        },
        pluginConfigs: {
          dnsOverride: {},
        },
        socketOptions: {},
        debug: true,
        overrideAll: false,
      });

      netx.use(DnsOverride);

      simulateDnsDown();

      await confirmDnsInaccessible();

      let hookBody;

      try {
        const hookRes = await nodeFetch("http://example.net/", {
          agent: netx.agentCreator(),
        });

        hookBody = await hookRes.text();
      } catch (err) {
        chai.expect.fail("Failed to fetch via HTTPS Agent");
        return;
      }

      chai.expect(hookBody).to.include("Example Domain");

      restoreDns();
    });
    it("HTTPS request", async () => {
      const netx = new NetAxis({
        list: {
          "example.net": {
            ip: "140.82.121.4",
          },
        },
        pluginConfigs: {
          dnsOverride: {},
        },
        socketOptions: {
          // Primitive way to disable HTTPS errors
          rejectUnauthorized: false,
        },
        debug: true,
        overrideAll: true,
      });

      netx.use(DnsOverride);

      simulateDnsDown();

      await confirmDnsInaccessible();

      let hookBody;

      try {
        const hookRes = await nodeFetch("https://example.net/", {
          agent: netx.agentCreator(),
        });

        hookBody = await hookRes.text();
      } catch (err) {
        chai.expect.fail("Failed to fetch via HTTPS Agent");
        return;
      }

      chai.expect(hookBody).to.include("GitHub");

      restoreDns();
    });
  });
  describe("Plugin SSL Pinning", () => {
    it("Pin regular host", async () => {
      const netx = new NetAxis({
        list: {
          "example.net": {
            pin: "4DA25A6D5EF62C5F95C7BD0A73EA3C177B36999D",
          },
        },
        pluginConfigs: {
          dnsOverride: {},
        },
        socketOptions: {},
        debug: true,
        overrideAll: false,
      });

      netx.use(SslPinning);

      let hookBody;

      try {
        const hookRes = await nodeFetch("https://example.net/", {
          agent: netx.agentCreator(),
        });

        hookBody = await hookRes.text();
      } catch (err) {
        chai.expect.fail("Failed to fetch via HTTPS Agent");
        return;
      }

      chai.expect(hookBody).to.include("Example Domain");
    });
    it("Pin host with expired cert", async () => {
      const netx = new NetAxis({
        list: {
          "expired.badssl.com": {
            pin: "404BBD2F1F4CC2FDEEF13AABDD523EF61F1C71F3",
          },
        },
        pluginConfigs: {
          secManage: {
            allowAll: false,
            allowExpiredCert: true,
            allowCertAltName: true,
            allowRootSelfSigned: true,
            allowSelfSigned: true,
            allowUnverified: true,
          },
          sslPinning: {
            checkPinningOnly: true,
          },
        },
        socketOptions: {
          //rejectUnauthorized: false,
        },
        debug: true,
        overrideAll: false,
      });

      netx.use(SecManage);
      //netx.use(SslPinning);

      let hookBody;

      try {
        const hookRes = await nodeFetch("https://expired.badssl.com/", {
          agent: netx.agentCreator(),
        });

        hookBody = await hookRes.text();
      } catch (err) {
        console.error(err);
        chai.expect.fail(`Failed to fetch via HTTPS Agent, ${err.code}`);
        return;
      }

      chai.expect(hookBody).to.include("badssl");
      //chai.expect(hookBody).to.include('expired');
    });
  });
});
