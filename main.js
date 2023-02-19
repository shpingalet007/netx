import dns from "dns";
import tls from "tls";
import path from "path";
import fs from "fs";
import betterLogging from "better-logging";
import * as http from "http";
import * as https from "https";

export class List {
    list = {};

    constructor(associations) {
        this.list = List.parseList(associations);
    }

    static parseList(associations) {
        const list = {};

        const hosts = Object.keys(associations);

        hosts.forEach((host) => {
            const hostData = associations[host];

            const isIpForm = (typeof hostData === "string");
            const isIpAndPinForm = Array.isArray(hostData);
            const isComplexForm = typeof hostData === "object";

            const isIpV4 = ip => ip.includes(".");
            const isIpV6 = ip => ip.includes(":");
            const getIpVersion = (ip) => {
                if (isIpV4(ip)) return 'v4';
                if (isIpV6(ip)) return 'v6';
            }

            list[host] = { ip: {}, pin: [] };

            if (isIpForm) {
                const ipVersion = getIpVersion(hostData);

                list[host].ip[ipVersion] = [hostData];
            } else if (isIpAndPinForm) {
                if (hostData[1]) {
                    list[host].pin.push(hostData[1]);
                }

                const ipVersion = getIpVersion(hostData[0]);

                list[host].ip[ipVersion] = [hostData[0]];
            } else if (isComplexForm) {
                const isIpStringForm = (typeof hostData.ip === "string");
                const isIpArrayForm = Array.isArray(hostData.ip);
                const isIpObjectForm = (typeof hostData.ip === "object");

                const isPinStringForm = (typeof hostData.pin === "string");
                const isPinArrayForm = Array.isArray(hostData.pin);

                if (isIpStringForm) {
                    const ipVersion = getIpVersion(hostData.ip);

                    list[host].ip[ipVersion] = [hostData.ip];
                } else if (isIpArrayForm) {
                    hostData.ip.forEach((ip) => {
                        const ipVersion = getIpVersion(ip);
                        const isVersionInObject = (ipVersion in list[host].ip);

                        if (!isVersionInObject) {
                            list[host].ip[ipVersion] = [];
                        }

                        list[host].ip[ipVersion].push(ip);
                    });
                } else if (isIpObjectForm) {
                    const isIpV4StringForm = (typeof hostData.ip?.v4 === "string");
                    const isIpV4ArrayForm = Array.isArray(hostData.ip?.v4);
                    const isIpV6StringForm = (typeof hostData.ip?.v6 === "string");
                    const isIpV6ArrayForm = Array.isArray(hostData.ip?.v6);

                    if (isIpV4StringForm && hostData.ip.v4.length) {
                        list[host].ip.v4 = [hostData.ip.v4];
                    } else if (isIpV4ArrayForm) {
                        list[host].ip.v4 = [];

                        hostData.ip.v4.forEach((ip) => {
                            list[host].ip.v4.push(ip);
                        });
                    }

                    if (isIpV6StringForm && hostData.ip.v6.length) {
                        list[host].ip.v6 = [hostData.ip.v6];
                    } else if (isIpV6ArrayForm) {
                        list[host].ip.v6 = [];

                        hostData.ip.v6.forEach((ip) => {
                            list[host].ip.v6.push(ip);
                        });
                    }
                }

                if (isPinStringForm) {
                    list[host].pin = [hostData.pin];
                } else if (isPinArrayForm) {
                    list[host].pin = hostData.pin;
                }
            }
        });

        return list;
    }

    getPinning(host) {
        return this.list?.[host]?.pin || [];
    }

    getAddress(host, family = 4) {
        const isHostListed = (host in this.list);
        const isHostAddressEmpty = (!this.list?.[host]?.ip?.v4?.length && !this.list?.[host]?.ip?.v6?.length);

        if (!isHostListed || isHostAddressEmpty) return;

        const addr4 = this.list[host].ip?.v4?.[0];
        const addr6 = this.list[host].ip?.v6?.[0];

        if (!addr6 && !addr4) return;

        if ((family === 0 || family === 4) && addr4) return { ip: addr4, family: 4 };
        if ((family === 0 || family === 6) && addr6) return { ip: addr6, family: 6 };
        if (family === 6 && addr4) return { ip: `::ffff:${addr4}`, family: 6 };
    }
    getAllAddresses(host) {
        const ipV4 = this.list?.[host]?.ip?.v4;
        const ipV6 = this.list?.[host]?.ip?.v6;

        let ipV4List = [];
        let ipV6List = [];

        if (ipV4?.length) {
            ipV4.forEach((ip) => (
                ipV4List.push({ ip, family: 4 })
            ));
        }

        if (ipV6?.length) {
            ipV6.forEach((ip) => (
                ipV6List.push({ ip, family: 6 })
            ));
        }

        if (ipV4?.length && ipV6?.length) {
            return [...ipV4List, ...ipV6List];
        }

        if (ipV4?.length) {
            return ipV4List;
        }

        if (ipV6?.length) {
            return ipV6List;
        }
    }

    put(host, data) {}
    update(host, data) {}
    delete(host, data) {}
}

export class Netx {
    #list = null;
    #readonly = true;
    #protectGlobal = true;

    plugins = {};

    set list(value) {
        this.#list = value;
    };

    get list() {
        return this.#list;
    };

    logger = {
        logLevel: -1,
        debug: console.debug,
        error: console.error,
        info: console.info,
        log: console.log,
        warn: console.warn,
    }

    constructor(params) {
        const preparedParams = { ...Netx.defaultConstructorOptions, ...params };
        const { listProvider, debug, readonly, protectGlobal } = preparedParams;

        this.#readonly = readonly;
        this.#protectGlobal = protectGlobal;
        this.listProvider = listProvider;

        this.#list = this.listProvider();
        this.nativeLookup = dns.lookup;
        this.nativeCheckServerIdentity = tls.checkServerIdentity;

        betterLogging(this.logger);

        if (debug) {
            this.logger.logLevel = 4;
        }

        const self = this;

        Object.defineProperties(this, {
            list: {
                writable: false,
                configurable: false,
                value: {
                    set(value) {
                        if (self.#readonly && self.#list) {
                            this.logger.warn("List was marked as readonly");
                        }

                        self.#list = value;
                    },
                    get() {
                        return self.#list;
                    }
                }
            }
        })
    }

    install() {
        dns.lookup = (...args) => (
            this.lookup(...args)
        );

        tls.checkServerIdentity = (...args) => (
            this.checkServerIdentity(...args)
        );
    }

    uninstall() {
        dns.lookup = this.nativeLookup;
        tls.checkServerIdentity = this.nativeCheckServerIdentity;
    }

    globalize(globalName = 'netx') {
        const isGlobalProtected = this.#protectGlobal;

        const globalParams = {};
        globalParams._netxGlobalPoint = {
            value: globalName,
            writable: false,
            configurable: !isGlobalProtected,
        };
        globalParams[globalName] = {
            value: this,
            writable: false,
            configurable: !isGlobalProtected,
        };

        Object.defineProperties(global, globalParams);
    }

    unglobalize() {
        const globalName = global._netxGlobalPoint;

        if (!globalName) {
            this.logger.warn('No Netx instance is found in global scope');
            return;
        }

        try {
            delete global._netxGlobalPoint;
            delete global[globalName];
        } catch (err) {
            this.logger.error('Netx instance can not be unmounted from global scope');
            this.logger.warn('If you really need to be able to remove Netx from global');
            this.logger.warn('use protectGlobal = false, but for security reasons we do not recommend it...');
            throw Error('Netx instance can not be unmounted from global scope');
        }
    }

    lookup(hostname, options = Netx.defaultLookupOptions, callback) {
        this.logger.info(`Looking DNS records for ${hostname}`);

        const optionsIsNumber = Number.isInteger(options);
        const optionsIsObject = (typeof options === 'object' && !Array.isArray(options));

        if (optionsIsNumber) {
            const targetFamily = options;

            options = Netx.defaultLookupOptions;
            options.family = targetFamily;
        } else if (optionsIsObject) {
            options = { ...Netx.defaultLookupOptions, ...options };
        }

        if (options.all) {
            const allAddresses = this.#list.getAllAddresses(hostname);

            if (!allAddresses) {
                this.nativeLookup(hostname, options, callback);
                return;
            }

            const addressesPrepared = allAddresses.map((record) => {
                record.address = record.ip;
                delete record.ip;

                return record;
            });

            callback(null, addressesPrepared);
            return;
        }

        const requestedFamily = options.family || 0;

        const address = this.#list.getAddress(hostname, requestedFamily);

        if (address) {
            this.logger.info(`Associations found for ${hostname}, sending them instead of real DNS records`);

            callback(null, address.ip, address.family);
            return;
        }

        this.logger.info(`Associations not found for ${hostname}, sending real DNS records`);

        this.nativeLookup(hostname, options, callback);
    };

    checkServerIdentity(hostname, cert, extraOptions = {}) {
        if (!extraOptions.checkPinningOnly) {
            this.logger.info(`General SSL security checks are enabled on host ${hostname}`);

            const err = this.nativeCheckServerIdentity(hostname, cert);

            if (err) {
                const msg = `Certificate checks failed for ${hostname}`;
                this.logger.warn(`${msg}, ${err.code}`);

                return err;
            }

            this.logger.info(`General SSL security checks of host ${hostname} passed`);
        }

        const pins = this.#list.getPinning(hostname);

        const sslFingerprint = cert.fingerprint.replaceAll(':', '');

        const isSslPinned = (pins.length !== 0);
        const foundSslPin = pins.some(p => p === sslFingerprint);

        this.logger.info(`Host ${hostname} expects pin ${sslFingerprint}`);

        const checksStateMsg = (!isSslPinned)
            ? `SSL pins not specified for ${hostname}, omitting checks`
            : `SSL pins found for ${hostname}, doing checks`;

        this.logger.info(checksStateMsg);

        if (isSslPinned && !foundSslPin) {
            const msg = `Certificate checks failed for ${hostname}`;
            this.logger.warn(msg);

            const untrustedCert = new Error(msg);
            untrustedCert.type = "netx";
            untrustedCert.reason = "Certificate pinning error";
            untrustedCert.host = hostname;
            untrustedCert.errno = "UNTRUSTED_CERT_IN_CHAIN";
            untrustedCert.code = "UNTRUSTED_CERT_IN_CHAIN";
            untrustedCert.cert = cert;

            return untrustedCert;
        }
    };

    // TODO: Finish this later
    createSecureContext(options) {
        const context = this.nativeCreateSecureContext(options);

        const pem = fs
            .readFileSync("./proxy16/ca-untrusted-root.crt", { encoding: "ascii" })
            .replace(/\r\n/g, "\n");

        const certs = pem.match(/-----BEGIN CERTIFICATE-----\n[\s\S]+?\n-----END CERTIFICATE-----/g);

        if (!certs) {
            throw new Error(`Could not parse certificate ./rootCA.crt`);
        }

        certs.forEach(cert => {
            context.context.addCACert(cert.trim());
        });

        return context;
    };

    static defaultConstructorOptions = {
        listProvider: Netx.defaultListProvider,
        debug: false,
        readonly: true,
        protectGlobal: true,
    };

    static defaultLookupOptions = { family: 0, all: false, verbatim: true };

    static defaultListProvider() {
        const listPath = path.join(process.cwd(), "netxrc.json");
        const list = fs.readFileSync(listPath, { encoding: "utf-8" });
        const listObj = JSON.parse(list);

        return new List(listObj.associations);
    }

    loadPlugin(name) {
        function loadByName(pluginName) {
            return import(pluginName)
                .then((module) => {
                    return Promise.resolve(module);
                }).catch((err) => {
                    if (err.code === 'ERR_MODULE_NOT_FOUND') {
                        return Promise.resolve(false);
                    }

                    return Promise.reject(err);
                });
        }

        this.plugins[name] = loadByName(`@hydra/${name}`) || loadByName(name);
    }

    createAgent(protocol, args) {
        return new WrappingAgent(this, () => new http.Agent(args));
    }
}

class WrappingAgentBase {
    constructor(type, ...args) {
        if (type === 'https') {
            return new https.Agent(...args);
        } else if (type === 'http') {
            return new http.Agent(...args);
        }
    }
}

export class WrappingAgent extends WrappingAgentBase {
    constructor(type, netx, agentCreator) {
        super(type);

        this.netx = netx;

        console.log(agentCreator.toString());

        this.targetAgent = agentCreator();
        this.targetAgent.shouldLookup = true;
    }

    lookup = (...args) => this.netx.lookup(...args);

    addRequest(request, options) {
        request.on('socket', socket => {
            socket.on('secureConnect', () => {
                const host = socket.servername;
                const cert = socket.getPeerCertificate();

                const identityCheck = this.netx.checkServerIdentity(host, cert);

                if (identityCheck instanceof Error) {
                    request.emit('error', identityCheck);
                    request.abort();
                }
            });
        });

        return this.targetAgent.addRequest(request, options);
    }
}
