import chai from "chai";

import tls from "tls";
import dns from "dns";

import fetch from "node-fetch";

import { SocksProxyAgent }  from "socks-proxy-agent";

import { NetAxis } from "../src/netaxis.js";
import { DnsOverride } from "../src/plugins/dns-override.js";
import { SslPinning } from "../src/main.js";
import { WrappingAgent } from "../src/helpers.js";
import {Agent as BaseAgent, req} from 'agent-base';
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import http from "http";
import * as net from "net";

describe("Agents support", () => {
    describe("Native behavior when no plugins set", () => {
        const netx = new NetAxis({
            list: {
                "example.net": {
                    "ip": "140.82.121.4",
                }
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
                    chai.expect.fail('Failed to fetch via HTTPS Agent');
                    return;
                }

                chai.expect(body).to.include('<title>Example Domain</title>');
            }

            await checkNative('https://example.net/');
            await checkNative('http://example.net/');
        });

        it("Check SOCKS Proxy Agent", async () => {
            const socksAgent = o => new SocksProxyAgent('socks://127.0.0.1:8889', o);
            const httpsAgent = new WrappingAgent('https', netx, socksAgent, {
                rejectUnauthorized: false,
            });

            let body;

            try {
                const res = await fetch('https://example.net/', {
                    agent: httpsAgent,
                });

                body = await res.text();
            } catch (err) {
                if (err.message.includes('ECONNREFUSED')) {
                    chai.expect.fail('Is SOCKS proxy running?');
                    return;
                }

                chai.expect.fail('Failed to fetch. Is Agent okay?');
                return;
            }

            chai.expect(body).to.include('<title>Example Domain</title>');
        });
    });

    describe("DNS Override Plugin", async () => {
        const netx = new NetAxis({
            list: {
                "example.net": {
                    "ip": "140.82.121.4",
                },
            }
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
                    chai.expect(err.code).to.equal('ERR_TLS_CERT_ALTNAME_INVALID');
                    chai.expect(err.message).to.include('Host: example.net');
                    chai.expect(err.message).to.include('DNS:github.com');
                    return;
                }

                chai.expect(body).to.include('<title>Example Domain</title>');
            }

            await checkNative('https://example.net/');
            await checkNative('http://example.net/');
        });

        it("Check SOCKS Proxy Agent", async () => {
            const socksAgent = o => new SocksProxyAgent('socks://127.0.0.1:8889', o);
            const httpsAgent = new WrappingAgent('https', netx, socksAgent, {
                rejectUnauthorized: false,
            });

            let body;

            try {
                const res = await fetch('https://example.net/', {
                    agent: httpsAgent,
                });

                body = await res.text();
            } catch (err) {
                if (err.message.includes('ECONNREFUSED')) {
                    chai.expect.fail('Is SOCKS proxy running?');
                    return;
                }

                chai.expect.fail('Failed to fetch. Is Agent okay?');
                return;
            }

            chai.expect(body).to.include('GitHub');
        });

        it("Check Custom Agent", async () => {
            /*class HttpProxyAgent extends BaseAgent {
                constructor(url, opts) {
                    super(opts);

                    const proxyUrl = new URL(url);

                    if (proxyUrl.protocol !== 'http:') {
                        throw Error('Unsupported protocol HTTP');
                    }

                    this.proxy = {
                        host: proxyUrl.hostname,
                        port: Number.parseFloat(proxyUrl.port)
                    };

                    this.proxySocket = this.initSocket();
                }

                async connect(req, opts) {
                    return this.proxySocket;
                }

                initSocket() {
                    return net.connect({
                        hostname: this.proxy.host,
                        port: this.proxy.port,
                    });
                }

                async addRequest(request, options) {
                    // Here you can access and manipulate raw packet data
                    //console.log('Raw packet data:', request);

                    // Call the original `addRequest` method to continue with the request
                    return super.addRequest(request, options);
                }

                createSocket(req, options, cb) {
                    let targetHost = req.host;

                    if (options.lookup) {
                        options.lookup(req.host, (err, address) => {
                            this.patchFullRequestPath(req, /!*'93.184.215.14' ||*!/ address);
                            super.createSocket(req, options, cb);
                        });

                        return;
                    }

                    this.patchFullRequestPath(req, targetHost);
                    super.createSocket(req, options, cb);
                }

                patchFullRequestPath(request, target) {
                    request.path = `${request.protocol}//${target}${request.path}`;

                    request._implicitHeader();
                }
            }*/

            process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

            const httpProxyAgent = o => new HttpProxyAgent('http://127.0.0.1:8888', o);
            const httpAgent = new WrappingAgent('http', netx, httpProxyAgent);

            let body;

            try {
                const res = await fetch('http://example.com/', {
                    agent: httpAgent,
                    /*lookup: (...a) => {
                        console.log(a);
                    }*/
                });

                body = await res.text();
            } catch (err) {
                if (err.message.includes('ECONNREFUSED')) {
                    chai.expect.fail('Is HTTP proxy running?');
                    return;
                }

                console.error(err);

                chai.expect.fail('Failed to fetch. Is Agent okay?');
                return;
            }

            chai.expect(body).to.include('GitHub');
        });

        /*it("Check HTTP Proxy Agent", async () => {
            const httpProxyAgent = o => new HttpProxyAgent('http://127.0.0.1:8888', o);
            const httpAgent = new WrappingAgent('http', netx, httpProxyAgent);
            const httpAgent = new http.Agent({
                lookup: (...a) => {
                    console.log(a);
                },
            });

            let body;

            try {
                const res = await fetch('http://example.net/', {
                    //agent: httpAgent,
                    lookup: (...a) => {
                        console.log(a);
                    }
                });

                body = await res.text();
            } catch (err) {
                if (err.message.includes('ECONNREFUSED')) {
                    chai.expect.fail('Is HTTP proxy running?');
                    return;
                }

                console.error(err);

                chai.expect.fail('Failed to fetch. Is Agent okay?');
                return;
            }

            chai.expect(body).to.include('GitHub');
        });*/
    });

    describe("SSL Pinning Plugin", async () => {
        const netx = new NetAxis({
            list: {
                "example.net": {
                    "ip": "140.82.121.4",
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
                    chai.expect.fail('Failed to fetch via HTTPS Agent');
                    return;
                }

                chai.expect(body).to.include('GitHub');
            }

            await checkNative('https://example.net/');
            await checkNative('http://example.net/');
        });

        it("Check SOCKS Proxy Agent", async () => {
            const socksAgent = o => new SocksProxyAgent('socks://127.0.0.1:8889', o)
            const httpsAgent = new WrappingAgent('https', netx, socksAgent);

            let body;

            try {
                const res = await fetch('https://example.net/', {
                    agent: httpsAgent,
                });

                body = await res.text();
            } catch (err) {
                if (err.message.includes('ECONNREFUSED')) {
                    chai.expect.fail('Is SOCKS proxy running?');
                    return;
                }

                chai.expect.fail('Failed to fetch. Is Agent okay?');
                return;
            }

            chai.expect(body).to.include('GitHub');
        });

        /*it("Check HTTPS Proxy Agent", async () => {
            const httpsAgentOptions = {
                keepAlive: true,
                timeout: 55000,
                maxSockets: 20,
                maxFreeSockets: 5,
                maxCachedSessions: 500,
            };

            const proxyRequestOptions = {
                protocol: "http:",
                host: "127.0.0.1",
                port: 8888,
                timeout: 123000,
                maxSockets: 100,
            };

            const httpsProxyAgent = o => new HttpsProxyAgent(httpsAgentOptions, proxyRequestOptions);
            const httpsAgent = new WrappingAgent('https', netx, httpsProxyAgent);

            let body;

            try {
                const res = await fetch('https://example.net/', {
                    agent: httpsAgent,
                });

                body = await res.text();
            } catch (err) {
                if (err.message.includes('ECONNREFUSED')) {
                    chai.expect.fail('Is SOCKS proxy running?');
                    return;
                }

                console.error(err);

                chai.expect.fail('Failed to fetch. Is Agent okay?');
                return;
            }

            chai.expect(body).to.include('GitHub');
        });*/
    });
});

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 1;
