import { Netx, List } from "../main.js";
import chai from "chai";

const netx = new Netx({
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

        chai.expect.fail('Netx was replaced');
    });

    it("Trying to remove global with protectGlobal = true", () => {
        try {
            netx.unglobalize();
        } catch (err) {
            chai.expect(err.message).to.contain("Netx instance can not be unmounted from global scope");
            return;
        }

        chai.expect.fail('Unglobalized succesfully!');
    });
});

// Object.defineProperty(window, 'netx', { value: 1000, writable: false })
