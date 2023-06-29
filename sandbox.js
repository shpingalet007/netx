import fetch from 'node-fetch';
import { NetAxis } from "./main.js";
import { DnsOverride } from "./dns-override.js";

import dns from "dns";
import { SslPinning } from "./ssl-pinning.js";

const netaxis = new NetAxis({
    listPath: 'tests/axisrc.json',
});

const dnsOverride = new DnsOverride();
const sslPinning = new SslPinning();

netaxis.use(dnsOverride/*, { override: true }*/);
netaxis.use(sslPinning/*, { override: true }*/);

dns.lookup('example.net', 4, (err, addr, family) => {
    console.log(err, addr, family);
});

netaxis.dns.lookup('example.net', 4, (err, addr, family) => {
    console.log(err, addr, family);
});

const req = await fetch('https://example.net/');
console.log(await req.text());
