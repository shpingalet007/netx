import { OverridePlugin } from "../helpers.js";
import tls from "tls";
import { SslPinningList } from "./ssl-pinning.js";

export class SecManage extends OverridePlugin {
  static List = SslPinningList;

  static name = "SecManage";
  static logName = "sec-manage";
  static logColor = "brightGreen";
  static target = tls;
  static targetName = "tls";
  static mountPoint = "secman";
  static configParam = "secManage";

  static flags = {
    patchFirst: true,
  };

  instantiate(axisInstance, options) {
    let isNotPatchedFirst = false;
    let modulePatchedFirstName = null;

    if (axisInstance.overrides.tls) {
      isNotPatchedFirst = true;
      modulePatchedFirstName = axisInstance.overrides.tls.netaxisPlugin;
    }

    super.instantiate(axisInstance, options);

    if (this.config.allowCertAltName) {
      this.logger.warn(`Invalid hostname in certificates are allowed`.yellow);
    }

    if (isNotPatchedFirst) {
      this.#logWarnPriority(modulePatchedFirstName);
    }
  }

  overrides = {
    checkServerIdentity: (...args) => this.#checkServerIdentity(...args),
  };

  #checkServerIdentity(hostname, cert) {
    const err = this.sources.checkServerIdentity(hostname, cert);

    if (err) {
      SecManage.assignErrorId(err);

      if (
        this.config.allowCertAltName &&
        err.code === "ERR_TLS_CERT_ALTNAME_INVALID"
      ) {
        this.#logIgnoreErrr(err);

        return;
      }

      return err;
    }
  }

  static assignErrorId(err) {
    if (err.netaxisId) {
      this.#logError(err, hostname);

      return;
    }

    err.netaxisId = Math.random().toString(16).slice(2, 8);
  }

  #logWarnPriority(netaxisPlugin) {
    this.logger.warn(
      `Plugin ${netaxisPlugin} already patched ${this.SelfStatic.targetName} module, ignoring`
        .yellow,
    );
  }

  #logError(err, hostname) {
    this.logger.info(
      `Certificate checks error ${err.netaxisId} for host ${hostname}, ${err.code}`
        .yellow,
    );
  }

  #logIgnoreErrr(err) {
    this.logger.info(
      `Certificate checks error ${err.netaxisId} was ignored, ${err.code}`
        .green,
    );
  }
}
