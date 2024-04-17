import dns from "dns";

import { OverridePlugin, PluginList } from "../helpers.js";

class DnsOverrideListV2 extends PluginList {
    static listParams = ["ip"];
}

export class DnsOverride extends OverridePlugin {
    static List = DnsOverrideListV2;

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
            const allAddresses = this.axisInstance._list.getAllAddresses(hostname);

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

        const address = this.axisInstance._list.getAddress(hostname, requestedFamily);

        if (address) {
            this.axisInstance.logger.info(`Associations found for ${hostname}, sending them instead of real DNS records`);

            callback(null, address.ip, address.family);
            return;
        }

        this.axisInstance.logger.info(`Associations not found for ${hostname}, sending real DNS records`);

        this.sources.lookup(hostname, options, callback);
    };

    static defaultLookupOptions = { family: 0, all: false, verbatim: true };
}
