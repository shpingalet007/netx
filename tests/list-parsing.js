import chai from "chai";

import { DnsOverrideList as ListDns } from "../src/plugins/dns-override.js";
import { SslPinningList as ListSsl } from "../src/plugins/ssl-pinning.js";

/*function testAddresses(configV4, configV6, correctPin) {
    it(`IPv4 address listed`, () => {
        const address = configV4.getAddress("site1.com");
        const addresses = configV4.getAllAddresses("site1.com");

        chai.expect(address.ip).to.equal("10.20.30.40");
        chai.expect(addresses).to.be.an("array");
        chai.expect(address.family).to.equal(4);
    });

    it(`IPv4 address listed, IPv6 requested`, () => {
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

function testPins(configV4, configV6, correctPin) {
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
    const configV4 = new ListDns({ "site1.com": "10.20.30.40" });
    const configV6 = new ListDns({ "site1.com": "2001:0db8" });

    testAddresses(configV4, configV6);
});

describe("Array configs", () => {
    const ipv4 = {
        "site1.com": {
            "ip": ["10.20.30.40"],
            "pin": ["SECURITY_PIN"]
        }
    };

    const ipv6 = {
        "site1.com": {
            "ip": ["2001:0db8"],
            "pin": ["SECURITY_PIN"]
        }
    };

    describe("IP associations", () => {
        const configV4 = new ListDns(ipv4);
        const configV6 = new ListDns(ipv6);

        testAddresses(configV4, configV6);
    });

    describe("SSL pins", () => {
        const configV4 = new ListSsl(ipv4);
        const configV6 = new ListSsl(ipv6);

        testAddresses(configV4, configV6, ["SECURITY_PIN"]);
    });
});

describe("Complex configs", () => {
    describe("Type 1", () => {
        const configV4 = new ListDns({
            "site1.com": {
                "ip": "10.20.30.40",
                "pin": "SECURITY_PIN",
            }
        });

        const configV6 = new ListDns({
            "site1.com": {
                "ip": "2001:0db8",
                "pin": "SECURITY_PIN",
            }
        });

        testAddresses(configV4, configV6);
    });
    describe("Type 2", () => {
        const configV4 = new ListDns({
            "site1.com": {
                "ip": ["10.20.30.40", "20.30.40.50"],
                "pin": ["SECURITY_PIN_1", "SECURITY_PIN_2"],
            }
        });

        const configV6 = new ListDns({
            "site1.com": {
                "ip": ["2001:0db8", "0db8:2001"],
                "pin": ["SECURITY_PIN_1", "SECURITY_PIN_2"],
            }
        });

        testAddresses(configV4, configV6, ["SECURITY_PIN_1", "SECURITY_PIN_2"]);
    });
    describe("Type 3", () => {
        const configIpV4 = new ListDns({
            "site1.com": {
                "ip": {
                    "v4": "10.20.30.40",
                },
                "pin": ["SECURITY_PIN_1", "SECURITY_PIN_2"],
            }
        });

        const configIpV6 = new ListDns({
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
        const configIpV4 = new ListDns({
            "site1.com": {
                "ip": {
                    "v4": ["10.20.30.40", "20.30.40.50"],
                },
                "pin": ["SECURITY_PIN_1", "SECURITY_PIN_2"],
            }
        });

        const configIpV6 = new ListDns({
            "site1.com": {
                "ip": {
                    "v6": ["2001:0db8", "0db8:2001"],
                },
                "pin": ["SECURITY_PIN_1", "SECURITY_PIN_2"],
            }
        });

        testAddresses(configIpV4, configIpV6, ["SECURITY_PIN_1", "SECURITY_PIN_2"]);
    });
});*/

describe("Lists parsing", () => {
  describe("DNS Override List", () => {
    it("Get IP associations", () => {
      const dnsList = new ListDns({
        "site1.com": {
          ip: ["10.20.30.40", "20.30.40.50", "::ffff:20.30.40.50"],
        },
      });

      const expected1 = [
        {
          ip: "10.20.30.40",
          family: 4,
        },
        {
          ip: "20.30.40.50",
          family: 4,
        },
        {
          ip: "::ffff:20.30.40.50",
          family: 6,
        },
      ];

      const expected2 = {
        ip: "10.20.30.40",
        family: 4,
      };

      const result1 = dnsList.getAllAddresses("site1.com");
      const result2 = dnsList.getAddress("site1.com");

      chai.expect(result1).to.be.deep.equal(expected1);
      chai.expect(result2).to.be.deep.equal(expected2);
    });
    it("IPv4 format, single record", () => {
      const dnsList1 = ListDns.parseList({
        "site1.com": {
          ip: "10.20.30.40",
        },
      });

      const dnsList2 = ListDns.parseList({
        "site1.com": {
          ip: "10.20.30.40",
        },
        "site2.com": {
          ip: "10.20.30.40",
        },
      });

      const expected1 = {
        "site1.com": {
          ip: {
            v4: ["10.20.30.40"],
          },
        },
      };

      const expected2 = {
        "site1.com": {
          ip: {
            v4: ["10.20.30.40"],
          },
        },
        "site2.com": {
          ip: {
            v4: ["10.20.30.40"],
          },
        },
      };

      chai.expect(dnsList1).to.be.deep.equal(expected1);
      chai.expect(dnsList2).to.be.deep.equal(expected2);
    });
    it("IPv4 format, multiple records", () => {
      const dnsList1 = ListDns.parseList({
        "site1.com": {
          ip: ["10.20.30.40", "20.30.40.50"],
        },
      });

      const dnsList2 = ListDns.parseList({
        "site1.com": {
          ip: ["10.20.30.40", "20.30.40.50"],
        },
        "site2.com": {
          ip: ["10.20.30.40", "20.30.40.50"],
        },
      });

      const expected1 = {
        "site1.com": {
          ip: {
            v4: ["10.20.30.40", "20.30.40.50"],
          },
        },
      };

      const expected2 = {
        "site1.com": {
          ip: {
            v4: ["10.20.30.40", "20.30.40.50"],
          },
        },
        "site2.com": {
          ip: {
            v4: ["10.20.30.40", "20.30.40.50"],
          },
        },
      };

      chai.expect(dnsList1).to.be.deep.equal(expected1);
      chai.expect(dnsList2).to.be.deep.equal(expected2);
    });
  });
  describe("SSL Pinning List", () => {
    it("Get Pin associations", () => {
      const sslList = new ListSsl({
        "site1.com": {
          pin: ["PIN_1"],
        },
      });

      const expected1 = ["PIN_1"];

      const result1 = sslList.getPinning("site1.com");

      chai.expect(result1).to.be.deep.equal(expected1);
    });
    it("Single pin", () => {
      const pinList1 = ListSsl.parseList({
        "site1.com": {
          pin: "PIN_1",
        },
      });

      const pinList2 = ListSsl.parseList({
        "site1.com": {
          pin: "PIN_1",
        },
        "site2.com": {
          pin: "PIN_2",
        },
      });

      const expected1 = {
        "site1.com": {
          pin: ["PIN_1"],
        },
      };

      const expected2 = {
        "site1.com": {
          pin: ["PIN_1"],
        },
        "site2.com": {
          pin: ["PIN_2"],
        },
      };

      chai.expect(pinList1).to.be.deep.equal(expected1);
      chai.expect(pinList2).to.be.deep.equal(expected2);
    });
    it("Multiple pins", () => {
      const pinList1 = ListSsl.parseList({
        "site1.com": {
          pin: ["PIN_1.1", "PIN_1.2"],
        },
      });

      const pinList2 = ListSsl.parseList({
        "site1.com": {
          pin: ["PIN_1.1", "PIN_1.2"],
        },
        "site2.com": {
          pin: ["PIN_2.1", "PIN_2.2"],
        },
      });

      const expected1 = {
        "site1.com": {
          pin: ["PIN_1.1", "PIN_1.2"],
        },
      };

      const expected2 = {
        "site1.com": {
          pin: ["PIN_1.1", "PIN_1.2"],
        },
        "site2.com": {
          pin: ["PIN_2.1", "PIN_2.2"],
        },
      };

      chai.expect(pinList1).to.be.deep.equal(expected1);
      chai.expect(pinList2).to.be.deep.equal(expected2);
    });
  });
});
