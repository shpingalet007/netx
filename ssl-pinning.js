import { OverridePlugin, PluginList } from "./plugin.js";

import tls from "tls";

class SslPinningList extends PluginList {
    static listParams = ["pin"];

    getPinning(host) {
        return this.list?.[host]?.pin || [];
    }
}

export class SslPinning extends OverridePlugin {
    static List = SslPinningList;

    static name = "SslPinning";
    static target = tls;
    static mountPoint = "pins";
    static configParam = "sslPinning";

    overrides = {
        checkServerIdentity: (...args) => this.#checkServerIdentity(...args),
    };

    #checkServerIdentity(hostname, cert, extraOptions = {}) {
        if (!extraOptions.checkPinningOnly) {
            this.axisInstance.logger.info(`General SSL security checks are enabled on host ${hostname}`);

            const err = this.sources.checkServerIdentity(hostname, cert);

            if (err) {
                const msg = `Certificate checks failed for ${hostname}`;
                this.axisInstance.logger.warn(`${msg}, ${err.code}`);

                return err;
            }

            this.axisInstance.logger.info(`General SSL security checks of host ${hostname} passed`);
        }

        const pins = this.list.getPinning(hostname);

        const sslFingerprint = cert.fingerprint.replaceAll(':', '');

        const isSslPinned = (pins.length !== 0);
        const foundSslPin = pins.some(p => p === sslFingerprint);

        this.axisInstance.logger.info(`Host ${hostname} expects pin ${sslFingerprint}`);

        const checksStateMsg = (!isSslPinned)
            ? `SSL pins not specified for ${hostname}, omitting checks`
            : `SSL pins found for ${hostname}, doing checks`;

        this.axisInstance.logger.info(checksStateMsg);

        if (isSslPinned && !foundSslPin) {
            const msg = `Certificate checks failed for ${hostname}`;
            this.axisInstance.logger.warn(msg);

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
}
