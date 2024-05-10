import tls from "tls";

import { OverridePlugin, PluginList } from "../helpers.js";

export class SslPinningList extends PluginList {
  static listParams = ["pin"];

  getPinning(host) {
    return this.list?.[host]?.pin || [];
  }

  static parseList(rawList) {
    const list = {};

    const hosts = Object.keys(rawList);

    hosts.forEach((host) => {
      const hostData = rawList[host];

      const isPinStringForm = typeof hostData.pin === "string";
      const isPinArrayForm = Array.isArray(hostData.pin);

      list[host] = {};

      if (isPinStringForm) {
        list[host].pin = [hostData.pin];
      } else if (isPinArrayForm) {
        list[host].pin = hostData.pin;
      }
    });

    return list;
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

  #checkServerIdentity(hostname, cert) {
    if (!this.config.checkPinningOnly) {
      this.axisInstance.logger.info(
        `General SSL security checks are enabled on host ${hostname}`,
      );

      const err = this.sources.checkServerIdentity(hostname, cert);

      if (err) {
        const msg = `Certificate checks failed for ${hostname}`;
        this.axisInstance.logger.warn(`${msg}, ${err.code}`);

        return err;
      }

      this.axisInstance.logger.info(
        `General SSL security checks of host ${hostname} passed`,
      );
    }

    const pins = this.list.getPinning(hostname);

    const sslFingerprint = cert.fingerprint.replaceAll(":", "");

    const isSslPinned = pins.length !== 0;
    const foundSslPin = pins.some((p) => p === sslFingerprint);

    this.axisInstance.logger.info(
      `Host ${hostname} expects pin ${sslFingerprint}`,
    );

    const checksStateMsg = !isSslPinned
      ? `SSL pins not specified for ${hostname}, omitting checks`
      : `SSL pins found for ${hostname}, doing checks`;

    this.axisInstance.logger.info(checksStateMsg);

    if (isSslPinned && !foundSslPin) {
      const msg = `Certificate checks failed for ${hostname}`;
      this.axisInstance.logger.warn(msg);

      const untrustedCert = new Error(msg);
      untrustedCert.type = "netaxis";
      untrustedCert.reason = "Certificate pinning error";
      untrustedCert.host = hostname;
      untrustedCert.errno = "NETAXIS_UNTRUSTED_CERT_IN_CHAIN";
      untrustedCert.code = "NETAXIS_UNTRUSTED_CERT_IN_CHAIN";
      untrustedCert.cert = cert;

      return untrustedCert;
    }
  }
}
