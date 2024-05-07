import chai from "chai";
import dns from "dns";

import { NetAxis } from "../src/netaxis.js";
import { DnsOverride } from "../src/plugins/dns-override.js";

const dummyNetx = new NetAxis({
    list: {},
    readonly: true,
    debug: true,
});

const netx = new NetAxis({
    list: {
        "notexistdomain.com": {
            ip: [ "140.82.114.4", "140.82.112.3", "140.82.113.4" ]
        },
        "example.com": {
            ip: [ "140.82.114.4", "140.82.112.3", "140.82.113.4" ]
        },
    },
    readonly: true,
    debug: true,
});

const hookedCorrectValueV4 = { address: "140.82.114.4", family: 4 };

describe("Debug tests", () => {
    describe("dns.lookup() override", () => {
        describe("Request IPv4", () => {
            it("Error for not existing host", async () => {
                function dnsLookup(host, options) {
                    return new Promise((resolve, reject) => {
                        dns.lookup(host, options, (error, address, family) => {
                            if (error) {
                                resolve(error);
                                return;
                            }

                            resolve({ address, family });
                        });
                    });
                }

                function netxLookup(netx, host, options) {
                    return new Promise((resolve, reject) => {
                        netx.dns.lookup(host, options, (error, address, family) => {
                            if (error) {
                                resolve(error);
                                return;
                            }

                            resolve({ address, family });
                        });
                    });
                }

                const host = "notexistdomain.com";

                await dummyNetx.use(new DnsOverride());
                netx.use(new DnsOverride());

                const nativeResult = await dnsLookup(host, 4);
                const dummyNetxResult = await netxLookup(dummyNetx, host, 4);
                const hookedResult = await netxLookup(netx, host, 4);

                chai.expect(nativeResult).to.be.deep.equal(dummyNetxResult);

                // Hooked must give other value
                chai.expect(hookedResult).to.deep.equal(hookedCorrectValueV4);
            });
        });
    });
});
