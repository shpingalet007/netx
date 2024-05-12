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
  static logName = "ssl-pinning";
  static logColor = "brightCyan";
  static target = tls;
  static targetName = "tls";
  static mountPoint = "pins";
  static configParam = "sslPinning";

  instantiate(axisInstance, options) {
    super.instantiate(axisInstance, options);

    if (this.config.checkPinningOnly) {
      this.#warnGeneralDisabled();
    }
  }

  overrides = {
    checkServerIdentity: (...args) => this.#checkServerIdentity(...args),
  };

  #checkServerIdentity(hostname, cert) {
    if (!this.config.checkPinningOnly) {
      this.logger.log(
        `General SSL security checks are enabled on host ${hostname}`,
      );

      const err = this.sources.checkServerIdentity(hostname, cert);

      if (err) {
        SslPinning.assignErrorId(err);
        this.#logError(err, hostname);

        return err;
      }
    }

    const pins = this.list.getPinning(hostname);

    const sslFingerprint = cert.fingerprint.replaceAll(":", "");

    const isSslPinned = pins.length !== 0;
    const foundSslPin = pins.some((p) => p === sslFingerprint);

    this.logger.debug(`Host ${hostname} expects pin ${sslFingerprint.bold}`);

    const checksStateMsg = !isSslPinned
      ? `SSL pins not specified for ${hostname}, omitting checks`
      : `SSL pins found for ${hostname}, doing checks`;

    this.logger.debug(checksStateMsg);

    if (isSslPinned && !foundSslPin) {
      const msg = `NetAxis SSL pinning check failed for ${hostname}`;

      const untrustedCert = new Error(msg);
      untrustedCert.type = "netaxis";
      untrustedCert.reason = "Certificate pinning error";
      untrustedCert.host = hostname;
      untrustedCert.errno = "NETAXIS_UNTRUSTED_CERT_IN_CHAIN";
      untrustedCert.code = "NETAXIS_UNTRUSTED_CERT_IN_CHAIN";
      untrustedCert.cert = cert;

      SslPinning.assignErrorId(untrustedCert);
      this.#logError(untrustedCert, hostname);

      return untrustedCert;
    }

    if (isSslPinned) {
      this.#logPinningPassed(hostname);
    }
  }

  static assignErrorId(err) {
    if (err.netaxisId) {
      return;
    }

    err.netaxisId = Math.random().toString(16).slice(2, 8);
  }

  #warnGeneralDisabled(hostname) {
    this.logger.warn(`General SSL security checks are disabled`.yellow);
  }

  #logPinningFailed(hostname) {
    this.logger.info(
      `Certificate checks pinning failed for host ${hostname}`.red,
    );
  }

  #logPinningPassed(hostname) {
    this.logger.info(
      `Certificate checks pinning passed for host ${hostname}`.green,
    );
  }

  #logError(err, hostname) {
    if (err.code === "NETAXIS_UNTRUSTED_CERT_IN_CHAIN") {
      this.#logPinningFailed(hostname);
      return;
    }

    this.logger.info(
      `Certificate checks error ${err.netaxisId} for host ${hostname}, ${err.code}`
        .red,
    );
  }
}
