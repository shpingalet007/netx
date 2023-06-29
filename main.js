import fs from "fs";
import path from "path";
import betterLogging from "better-logging";

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

export class NetAxis {
    #readonly = true;
    #protectGlobal = true;
    _list = {};

    config = {};
    plugins = {};

    logger = {
        logLevel: -1,
        debug: console.debug,
        error: console.error,
        info: console.info,
        log: console.log,
        warn: console.warn,
    }

    constructor(configs) {
        const configurations = { ...NetAxis.defaultConfigurations, ...configs };
        const { debug, readonly, protectGlobal, listPath } = configurations;

        this.config = { debug, readonly, protectGlobal, listPath };

        this.#readonly = readonly;
        this.#protectGlobal = protectGlobal;

        const config = NetAxis.fsConfigProvider(listPath);
        const list = config.list;
        this._list = new List(list);

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
                        if (self.#readonly && self._list) {
                            this.logger.warn("List was marked as readonly");
                        }

                        self._list = value;
                    },
                    get() {
                        return self._list;
                    }
                }
            }
        })
    }

    async use(plugin, options) {
        await plugin.instantiate(this, options);
        plugin.parseConfig();
        this.plugins[plugin.name] = plugin;
    }

    static defaultConfigurations = {
        listPath: 'axisrc.json',
        debug: false,
        readonly: true,
        protectGlobal: true,
    };

    static fsConfigProvider(listPath) {
        const fullListPath = path.join(process.cwd(), listPath);
        const list = fs.readFileSync(fullListPath, { encoding: "utf-8" });

        return JSON.parse(list);
    }

    static wrapModule(target) {
        return new Proxy(target, {
            apply: function (target, thisArg, args) {
                return target(...args);
            },
            get: function (target, prop) {
                if (target.__wrappedmemory?.[prop]) {
                    return target.__wrappedmemory[prop];
                }

                if (typeof target[prop] === 'object') {
                    return NetAxis.wrapModule(target[prop]);
                }

                return target[prop];
            },
            set: function (target, prop, value) {
                if (typeof target.__wrappedmemory !== 'object') {
                    target.__wrappedmemory = {};
                }

                target.__wrappedmemory[prop] = value;
                return value;
            },
        });
    }
}
