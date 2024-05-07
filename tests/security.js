import chai from "chai";

import { NetAxis } from "../src/netaxis.js";
import tls from "tls";
import dns from "dns";
import { DnsOverride } from "../src/plugins/dns-override.js";
import { SslPinning } from "../src/main.js";

const netx = new NetAxis({
  debug: true,
  readonly: true,
  protectGlobal: true,
  list: {
    "example.com": [
      "93.184.216.34",
      "F2AAD73D32683B716D2A7D61B51C6D5764AB3899",
    ],
  },
});

describe("Security", () => {
  it("List protection", () => {
    try {
      netx.list = {};
    } catch (err) {
      chai.expect(err.message).to.contain("Cannot assign to read only");
    }

    Object.defineProperty(netx, "#readonly", { value: false });

    try {
      netx.list = {};
    } catch (err) {
      chai.expect(err.message).to.contain("Cannot assign to read only");
    }
  });

  netx.globalize();

  it("Trying to replace globalized netx directly", () => {
    try {
      global.netx = "replaced";
    } catch (err) {
      chai
        .expect(err.message)
        .to.contain("Cannot assign to read only property");
      return;
    }

    chai.expect.fail("Security breach: Netx was replaced!");
  });

  it("Trying to remove global with protectGlobal = true", () => {
    try {
      netx.unglobalize();
    } catch (err) {
      chai
        .expect(err.message)
        .to.contain("Netx instance can not be unmounted from global scope");
      return;
    }

    chai.expect.fail("Security breach: Unglobalized succesfully!");
  });

  it("Properties modifications must fail", async () => {
    try {
      await netx.protect();

      NetAxis.defaultConfigurations = null;
    } catch (err) {
      chai
        .expect(err.message)
        .to.contain("Cannot assign to read only property");
      return;
    }

    chai.expect.fail("Security breach: Properties changed successfully!");
  });

  it("TLS module protection", () => {
    return new Promise(async (resolve, reject) => {
      const { NetAxis: NetAxisM } = await import("../src/main.js");

      const netx1 = new NetAxisM();

      const ssl1 = new SslPinning();

      netx1.use(ssl1, { protectCore: true });

      await netx1.protect();

      try {
        tls.checkServerIdentity = () => {
          console.log("I am an malicious code for TLS...");
          reject(Error("Malicious code injected"));
          socket.end();
        };

        const socket = tls.connect(443, { host: "example.com" });
      } catch (err) {
        chai
          .expect(err.message)
          .to.contain("Cannot assign to read only property");
        resolve();
      }
    });
  });

  it("DNS module protection", () => {
    return new Promise(async (resolve, reject) => {
      const { NetAxis: NetAxisM } = await import("../src/main.js");

      const netx1 = new NetAxisM();

      const dns1 = new DnsOverride();

      netx1.use(dns1, { protectCore: true });

      await netx1.protect();

      try {
        dns.lookup = () => {
          console.log("I am an malicious code for DNS...");
          reject(Error("Malicious code injected"));
          socket.end();
        };

        const socket = tls.connect(443, { host: "example.com" });
      } catch (err) {
        chai
          .expect(err.message)
          .to.contain("Cannot assign to read only property");
        resolve();
      }
    });
  });
});
