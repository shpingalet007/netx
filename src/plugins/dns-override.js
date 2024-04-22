import dns from "dns";

import { OverridePlugin, PluginList } from "../helpers.js";

export class DnsOverrideList extends PluginList {
    static listParams = ["ip"];

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

    static parseList(rawList) {
        const list = {};

        const hosts = Object.keys(rawList);

        hosts.forEach((host) => {
            const hostData = rawList[host];

            const isIpV4 = ip => ip.includes(".");
            const isIpV6 = ip => ip.includes(":");
            const getIpVersion = (ip) => {
                if (isIpV6(ip)) return 'v6';
                if (isIpV4(ip)) return 'v4';
            }

            list[host] = { ip: {} };

            const isIpStringForm = (typeof hostData.ip === "string");
            const isIpArrayForm = Array.isArray(hostData.ip);
            const isIpObjectForm = (typeof hostData.ip === "object");

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
        });

        return list;
    }
}

export class DnsOverride extends OverridePlugin {
    static List = DnsOverrideList;

    static name = "DnsOverride";
    static target = dns;
    static mountPoint = "dns";
    static configParam = "dnsOverride";

    overrides = {
        lookup: (...args) => this.#lookup(...args),
    };

    #lookup = (hostname, options = DnsOverride.defaultLookupOptions, callback) => {
        this.axisInstance.logger.info(`Looking DNS records for ${hostname}`);

        const optionsIsNumber = Number.isInteger(options);
        const optionsIsObject = (typeof options === 'object' && !Array.isArray(options));

        if (optionsIsNumber) {
            const targetFamily = options;

            options = DnsOverride.defaultLookupOptions;
            options.family = targetFamily;
        } else if (optionsIsObject) {
            options = { ...DnsOverride.defaultLookupOptions, ...options };
        }

        if (options.all) {
            const allAddresses = this.list.getAllAddresses(hostname);

            if (!allAddresses) {
                this.sources.lookup(hostname, options, callback);
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

        const address = this.list.getAddress(hostname, requestedFamily);

        if (address) {
            this.axisInstance.logger.info(`Associations found for ${hostname}, sending them instead of real DNS records`);

            callback(null, address.ip, address.family);
            return;
        }

        this.axisInstance.logger.info(`Associations not found for ${hostname}, sending real DNS records`);

        this.sources.lookup(hostname, options, callback);
    };

    static protect() {
        DnsOverride.target = Object.freeze(DnsOverride.target);
    }

    static defaultLookupOptions = { family: 0, all: false, verbatim: true };
}
