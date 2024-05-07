import chai from "chai";
import dns from "dns";
import tls from "tls";

import { NetAxis } from "../src/netaxis.js";
import { DnsOverride } from "../src/plugins/dns-override.js";
import { SslPinning } from "../src/plugins/ssl-pinning.js";

const dummyNetx = new NetAxis({
  list: {},
  readonly: true,
  debug: true,
});

const dummyAddresses = ["140.82.114.4", "140.82.112.3", "140.82.113.4"];

const netx = new NetAxis({
  list: {
    "notexistdomain.com": {
      ip: dummyAddresses,
      pin: [],
    },
    "example.com": {
      ip: dummyAddresses,
      pin: ["INVALID_PINNING"],
    },
  },
  readonly: true,
  debug: true,
});

await dummyNetx.use(new DnsOverride());

netx.use(new DnsOverride());
netx.use(new SslPinning());

const hookedCorrectValueV4 = { address: "140.82.114.4", family: 4 };
const hookedCorrectValueV6 = { address: "::ffff:140.82.114.4", family: 6 };

describe("Override functions", () => {
  describe("dns.lookup() override", () => {
    function dnsLookup(host, options) {
      return new Promise((resolve, reject) => {
        dummyNetx.plugins.DnsOverride.sources.lookup(
          host,
          options,
          (error, address, family) => {
            if (error) {
              resolve(error);
              return;
            }

            resolve({ address, family });
          },
        );
      });
    }

    function netxLookup(netxObj, host, options) {
      return new Promise((resolve, reject) => {
        netxObj.dns.lookup(host, options, (error, address, family) => {
          if (error) {
            resolve(error);
            return;
          }

          resolve({ address, family });
        });
      });
    }

    describe("Request IPv4", () => {
      it("Error for not existing host", async () => {
        const host = "notexistdomain.com";

        const nativeResult = await dnsLookup(host, 4);
        const dummyNetxResult = await netxLookup(dummyNetx, host, 4);
        const hookedResult = await netxLookup(netx, host, 4);

        chai.expect(nativeResult).to.be.deep.equal(dummyNetxResult);

        // Hooked must give other value
        chai.expect(hookedResult).to.deep.equal(hookedCorrectValueV4);
      });

      it("Family set as number", async () => {
        const host = "example.com";

        const nativeResult = await dnsLookup(host, 4);

        const netxList = {};
        netxList[host] = nativeResult.address;

        const wrapnetx = new NetAxis({
          list: netxList,
          debug: true,
          readonly: true,
        });

        netx.use(new DnsOverride());
        await wrapnetx.use(new DnsOverride());

        const wrappedResult = await netxLookup(wrapnetx, host, 4);
        const hookedResult = await netxLookup(netx, host, 4);

        chai.expect(nativeResult).to.deep.equal(wrappedResult);

        // Hooked must give other value
        chai.expect(hookedResult).to.deep.equal(hookedCorrectValueV4);
      });

      it("Family set as object", async () => {
        const host = "example.com";

        const nativeResult = await dnsLookup(host, { family: 4 });

        const netxList = {};
        netxList[host] = nativeResult.address;

        const wrapnetx = new NetAxis({
          list: netxList,
          debug: true,
          readonly: true,
        });

        netx.use(new DnsOverride());
        await wrapnetx.use(new DnsOverride());

        const netxResult = await netxLookup(wrapnetx, host, { family: 4 });
        const hookedResult = await netxLookup(netx, host, { family: 4 });

        chai.expect(nativeResult).to.deep.equal(netxResult);

        // Hooked must give other value
        chai.expect(hookedResult).to.deep.equal(hookedCorrectValueV4);
      });

      it("Request array of addresses", async () => {
        const host = "example.com";

        const nativeResult = await dnsLookup(host, { family: 4, all: true });

        const netxList = {};

        nativeResult.address.forEach((record) => {
          const data = { ip: { v4: [] } };

          data.ip.v4.push(record.address);

          netxList[host] = data;
        });

        const wrapnetx = new NetAxis({
          list: netxList,
          debug: true,
          readonly: true,
        });

        netx.use(new DnsOverride());
        await wrapnetx.use(new DnsOverride());

        const wrappedResult = await netxLookup(wrapnetx, host, {
          family: 4,
          all: true,
        });
        const hookedResult = await netxLookup(netx, host, {
          family: 4,
          all: true,
        });

        chai.expect(nativeResult).to.deep.equal(wrappedResult);

        // Hooked must give other value
        chai
          .expect(hookedResult.address[0])
          .to.deep.equal(hookedCorrectValueV4);
      });
    });

    describe("Request IPv6", () => {
      it("Error for not existing host", async () => {
        const host = "notexistdomain.com";

        const nativeResult = await dnsLookup(host, 6);
        const dummyNetxResult = await netxLookup(dummyNetx, host, 6);
        const hookedResult = await netxLookup(netx, host, 6);

        chai.expect(nativeResult).to.be.deep.equal(dummyNetxResult);

        // Hooked must give other value
        chai.expect(hookedResult).to.deep.equal(hookedCorrectValueV6);
      });

      it("Family set as number", async () => {
        const host = "example.com";

        const nativeResult = await dnsLookup(host, 6);

        const netxList = {};
        netxList[host] = { ip: { v6: nativeResult.address } };

        const wrapnetx = new NetAxis({
          list: netxList,
          debug: true,
          readonly: true,
        });

        netx.use(new DnsOverride());
        await wrapnetx.use(new DnsOverride());

        const wrappedResult = await netxLookup(wrapnetx, host, 6);
        const hookedResult = await netxLookup(netx, host, 6);

        chai.expect(nativeResult).to.deep.equal(wrappedResult);

        // Hooked must give other value
        chai.expect(hookedResult).to.deep.equal(hookedCorrectValueV6);
      });

      it("Family set as object", async () => {
        const host = "example.com";

        const nativeResult = await dnsLookup(host, { family: 6 });

        const netxList = {};
        netxList[host] = { ip: { v6: nativeResult.address } };

        const wrapnetx = new NetAxis({
          list: netxList,
          debug: true,
          readonly: true,
        });

        netx.use(new DnsOverride());
        await wrapnetx.use(new DnsOverride());

        const wrappedResult = await netxLookup(wrapnetx, host, { family: 6 });
        const hookedResult = await netxLookup(netx, host, { family: 6 });

        chai.expect(nativeResult).to.deep.equal(wrappedResult);

        // Hooked must give other value
        chai.expect(hookedResult).to.deep.equal(hookedCorrectValueV6);
      });

      it("Request array of addresses", async () => {
        const host = "example.com";

        const nativeResult = await dnsLookup(host, { family: 6, all: true });

        const netxList = {};

        nativeResult.address.forEach((record) => {
          const data = { ip: { v6: [] } };

          data.ip.v6.push(record.address);

          netxList[host] = data;
        });

        const netx = new NetAxis({
          list: netxList,
          debug: true,
          readonly: true,
        });

        netx.use(new DnsOverride());

        const netxResult = await netxLookup(netx, host, {
          family: 6,
          all: true,
        });

        chai.expect(nativeResult).to.deep.equal(netxResult);
      });
    });

    describe("Request IPv4 and IPv6", () => {
      it("Error for not existing host", async () => {
        const netx = new NetAxis({
          list: "./tests/axisrc.json",
        });

        netx.use(new DnsOverride());

        const host = "notexistdomain.com";

        const nativeResult = await dnsLookup(host, 0);
        const netxResult = await netxLookup(netx, host, 0);

        chai.expect(nativeResult).to.be.deep.equal(netxResult);
      });

      it("Family set as number", async () => {
        const host = "example.com";

        const nativeResult = await dnsLookup(host);

        const netxList = {};
        netxList[host] = { ip: {} };

        netxList[host].ip[`v${nativeResult.address}`] = nativeResult.address;

        const netx = new NetAxis({
          list: netxList,
          debug: true,
          readonly: true,
        });

        netx.use(new DnsOverride());

        const netxResult = await netxLookup(netx, host);

        chai.expect(nativeResult).to.deep.equal(netxResult);
      });

      it("Family set as object", async () => {
        const host = "example.com";

        const nativeResult = await dnsLookup(host);

        const netxList = {};
        netxList[host] = { ip: {} };

        netxList[host].ip[`v${nativeResult.address}`] = nativeResult.address;

        const netx = new NetAxis({
          list: netxList,
          debug: true,
          readonly: true,
        });

        netx.use(new DnsOverride());

        const netxResult = await netxLookup(netx, host);

        chai.expect(nativeResult).to.deep.equal(netxResult);
      });

      it("Request array of addresses", async () => {
        const host = "example.com";

        const nativeResult = await dnsLookup(host, { all: true });

        const netxList = {};

        nativeResult.address.forEach((record) => {
          const data = { ip: { v4: [], v6: [] } };

          if (record.family === 4) {
            data.ip.v4.push(record.address);
          } else if (record.family === 6) {
            data.ip.v6.push(record.address);
          }

          netxList[host] = data;
        });

        const netx = new NetAxis({
          list: netxList,
          debug: true,
          readonly: true,
        });

        netx.use(new DnsOverride());

        const netxResult = await netxLookup(netx, host, { all: true });

        chai.expect(nativeResult).to.deep.equal(netxResult);
      });
    });
  });

  describe("tls.checkServerIdentity() override", () => {
    it("SSL pinning must fail", (done) => {
      const socket = tls.connect(443, {
        host: "example.com",
        checkServerIdentity: (...args) =>
          netx.pins.checkServerIdentity(...args, { checkPinningOnly: true }),
      });

      socket.on("error", (err) => {
        chai.expect(err.type).to.be.equal("netaxis");
        chai.expect(socket.authorized).to.be.false;
        socket.end();
        done();
      });
    });

    it("SSL pinning must pass", (done) => {
      const socket = tls.connect(443, {
        host: "notexistdomain.com",
        lookup: (...args) => netx.dns.lookup(...args),
        checkServerIdentity: (...args) =>
          netx.pins.checkServerIdentity(...args),
      });

      socket.on("error", (err) => {
        chai.expect(err.code).to.be.equal("ERR_TLS_CERT_ALTNAME_INVALID");
        chai.expect(socket.authorized).to.be.false;
        socket.end();

        done();
      });
    });

    it("Certificate for other hostname throws error", (done) => {
      const socket = tls.connect(443, {
        host: "notexistdomain.com",
        lookup: (...args) => netx.dns.lookup(...args),
        checkServerIdentity: (...args) =>
          netx.pins.checkServerIdentity(...args),
      });

      socket.on("error", (err) => {
        chai.expect(err.code).to.be.equal("ERR_TLS_CERT_ALTNAME_INVALID");
        chai.expect(socket.authorized).to.be.false;
        socket.end();
        done();
      });
    });
  });
});
