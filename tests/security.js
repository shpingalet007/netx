import chai from "chai";

import { NetAxis } from "../src/netaxis.js";
import { List } from "../src/helpers.js";
import tls from "tls";
import dns from "dns";
import {DnsOverride} from "../src/plugins/dns-override.js";
import {SslPinning} from "../src/main.js";

const netx = new NetAxis({
    debug: true,
    readonly: true,
    listProvider: () => new List({
        "example.net": ["93.184.216.34", "INVALID_SECURITY_PIN"],
        "example.com": ["93.184.216.34", "F2AAD73D32683B716D2A7D61B51C6D5764AB3899"],
        "example.org": ["140.82.121.4"]
    }),
});

describe("Security", () => {
    it("Direct access, change list must fail", () => {
        try {
            netx.list = {};
        } catch (err) {
            chai.expect(err.message).to.contain("Cannot assign to read only property");
        }
    });

    it("Patch with defineProperty, change list must fail", () => {
        Object.defineProperty(netx, "#readonly", { value: false });

        try {
            netx.list = {};
        } catch (err) {
            chai.expect(err.message).to.contain("Cannot assign to read only property");
        }
    });

    netx.globalize();

    it("Trying to replace globalized netx directly", () => {
        try {
            global.netx = 'replaced';
        } catch (err) {
            chai.expect(err.message).to.contain("Cannot assign to read only property");
            return;
        }

        chai.expect.fail('Security breach: Netx was replaced!');
    });

    it("Trying to remove global with protectGlobal = true", () => {
        try {
            netx.unglobalize();
        } catch (err) {
            chai.expect(err.message).to.contain("Netx instance can not be unmounted from global scope");
            return;
        }

        chai.expect.fail('Security breach: Unglobalized succesfully!');
    });

    it("Properties modifications must fail", async () => {
        try {
            await netx.protect();

            NetAxis.defaultConfigurations = null;
        } catch (err) {
            chai.expect(err.message).to.contain("Cannot assign to read only property");
            return;
        }

        chai.expect.fail('Security breach: Properties changed successfully!');
    });

    it("TLS module protection", () => {
        return new Promise(async (resolve, reject) => {
            const { NetAxis: NetAxisM } = await import('../src/main.js');

            const netx1 = new NetAxisM({
                listProvider: () => new List({}),
            });

            const ssl1 = new SslPinning();

            netx1.use(ssl1);

            await netx1.protect();

            try {
                tls.checkServerIdentity = () => {
                    console.log('I am an malicious code for TLS...');
                    reject(Error('Malicious code injected'));
                };
            } catch(err) {
                chai.expect(err.message).to.contain("Cannot assign to read only property");
                resolve();
            }

            tls.connect(443, { host: "example.com" });

            socket.on('secureConnect', () => {
                chai.expect(socket.authorized).to.be.true;
                socket.end();
                resolve();
            });

            chai.expect.fail('Security breach: Unglobalized succesfully!');
        });
    });

    it("DNS module protection", () => {
        return new Promise(async (resolve, reject) => {
            const { NetAxis: NetAxisM } = await import('../src/main.js');

            const netx1 = new NetAxisM({
                listProvider: () => new List({}),
            });

            const dns1 = new DnsOverride();

            netx1.use(dns1);

            await netx1.protect();

            try {
                dns.lookup = () => {
                    console.log('I am an malicious code for DNS...');
                    reject(Error('Malicious code injected'));
                };
            } catch(err) {
                chai.expect(err.message).to.contain("Cannot assign to read only property");
                resolve();
            }

            const socket = tls.connect(443, { host: "example.com" });

            socket.on('secureConnect', () => {
                chai.expect(socket.authorized).to.be.true;
                socket.end();
                resolve();
            });

            chai.expect.fail('Security breach: Unglobalized succesfully!');
        });
    });
});
