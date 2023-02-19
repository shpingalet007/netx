import chai from "chai";
import { List } from "../main.js";

function testAddresses(configV4, configV6, correctPin) {
    function checkPinning() {
        const pin = configV4.getPinning("site1.com");

        if (Array.isArray(pin)) {
            chai.expect(pin).to.deep.equal(correctPin);
        } else {
            chai.expect(pin).to.equal(correctPin);
        }
    }

    const pinTitle = (correctPin) ? "with SSL pinning " : "";

    it(`IPv4 address ${pinTitle}listed`, () => {
        const address = configV4.getAddress("site1.com");
        const addresses = configV4.getAllAddresses("site1.com");

        chai.expect(address.ip).to.equal("10.20.30.40");
        chai.expect(addresses).to.be.an("array");
        chai.expect(address.family).to.equal(4);

        if (correctPin) checkPinning();
    });

    it(`IPv4 address ${pinTitle}listed, IPv6 requested`, () => {
        const address = configV4.getAddress("site1.com", 6);
        const addresses = configV4.getAllAddresses("site1.com");

        chai.expect(address.ip).to.be.equal("::ffff:10.20.30.40");

        chai.expect(addresses[0].ip).to.be.equal("10.20.30.40");
        chai.expect(addresses[0].family).to.be.equal(4);
        chai.expect(addresses).to.be.an("array");

        if (correctPin) checkPinning();
    });

    it(`IPv6 address ${pinTitle}listed`, () => {
        const address = configV6.getAddress("site1.com", 6);
        const addresses = configV6.getAllAddresses("site1.com");

        chai.expect(address.ip).to.equal("2001:0db8");

        chai.expect(addresses[0].ip).to.be.equal("2001:0db8");
        chai.expect(addresses[0].family).to.be.equal(6);
        chai.expect(addresses).to.be.an("array");

        if (correctPin) checkPinning();
    });

    it(`IPv6 address ${pinTitle}listed, IPv4 requested`, () => {
        const address = configV6.getAddress("site1.com", 4);
        const addresses = configV6.getAllAddresses("site1.com");

        chai.expect(address).to.be.undefined;

        chai.expect(addresses[0].ip).to.be.equal("2001:0db8");
        chai.expect(addresses[0].family).to.be.equal(6);
        chai.expect(addresses).to.be.an("array");

        if (correctPin) checkPinning();
    });
}

describe("Light configs with IP only", () => {
    const configV4 = new List({ "site1.com": "10.20.30.40" });
    const configV6 = new List({ "site1.com": "2001:0db8" });

    testAddresses(configV4, configV6);
});

describe("Array configs", () => {
    describe("IP only configs", () => {
        const configV4 = new List({ "site1.com": ["10.20.30.40"] });
        const configV6 = new List({ "site1.com": ["2001:0db8"] });

        testAddresses(configV4, configV6);
    });

    describe("IP with SSL pins", () => {
        const configV4 = new List({ "site1.com": ["10.20.30.40", "SECURITY_PIN"] });
        const configV6 = new List({ "site1.com": ["2001:0db8", "SECURITY_PIN"] });

        testAddresses(configV4, configV6, ["SECURITY_PIN"]);
    });
});

describe("Complex configs", () => {
    describe("Type 1", () => {
        const configV4 = new List({
            "site1.com": {
                "ip": "10.20.30.40",
                "pin": "SECURITY_PIN",
            }
        });

        const configV6 = new List({
            "site1.com": {
                "ip": "2001:0db8",
                "pin": "SECURITY_PIN",
            }
        });

        testAddresses(configV4, configV6);
    });
    describe("Type 2", () => {
        const configV4 = new List({
            "site1.com": {
                "ip": ["10.20.30.40", "20.30.40.50"],
                "pin": ["SECURITY_PIN_1", "SECURITY_PIN_2"],
            }
        });

        const configV6 = new List({
            "site1.com": {
                "ip": ["2001:0db8", "0db8:2001"],
                "pin": ["SECURITY_PIN_1", "SECURITY_PIN_2"],
            }
        });

        testAddresses(configV4, configV6, ["SECURITY_PIN_1", "SECURITY_PIN_2"]);
    });
    describe("Type 3", () => {
        const configIpV4 = new List({
            "site1.com": {
                "ip": {
                    "v4": "10.20.30.40",
                },
                "pin": ["SECURITY_PIN_1", "SECURITY_PIN_2"],
            }
        });

        const configIpV6 = new List({
            "site1.com": {
                "ip": {
                    "v6": "2001:0db8",
                },
                "pin": ["SECURITY_PIN_1", "SECURITY_PIN_2"],
            }
        });

        testAddresses(configIpV4, configIpV6, ["SECURITY_PIN_1", "SECURITY_PIN_2"]);
    });
    describe("Type 4", () => {
        const configIpV4 = new List({
            "site1.com": {
                "ip": {
                    "v4": ["10.20.30.40", "20.30.40.50"],
                },
                "pin": ["SECURITY_PIN_1", "SECURITY_PIN_2"],
            }
        });

        const configIpV6 = new List({
            "site1.com": {
                "ip": {
                    "v6": ["2001:0db8", "0db8:2001"],
                },
                "pin": ["SECURITY_PIN_1", "SECURITY_PIN_2"],
            }
        });

        testAddresses(configIpV4, configIpV6, ["SECURITY_PIN_1", "SECURITY_PIN_2"]);
    });
});
