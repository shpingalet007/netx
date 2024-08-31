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
      modulePatchedFirstName =
        axisInstance.overrides.tls.netaxisPlugin.SelfStatic.logName;
    }

    //this.overrideTLSSocket(axisInstance);

    super.instantiate(axisInstance, options);

    if (isNotPatchedFirst) {
      this.#logWarnPriority(modulePatchedFirstName);
    }

    if (this.config.allowAll) {
      this.#logWarnAllIgnored();
      return;
    }

    if (this.config.allowExpiredCert) {
      this.logger.warn(`✔ Expired certificates are allowed`.yellow);
    }

    if (this.config.allowRootSelfSigned) {
      this.logger.warn(`✔ Self-signed CA certificates are allowed`.yellow);
    }

    if (this.config.allowSelfSigned) {
      this.logger.warn(`✔ Self-signed server certificates are allowed`.yellow);
    }

    if (this.config.allowUnverified) {
      this.logger.warn(
        `✔ Server certificates with verification issues are allowed`.yellow,
      );
    }

    if (this.config.allowCertAltName) {
      this.logger.warn(
        `✔ Invalid hostname in certificates are allowed`.yellow,
      );
    }
  }

  overrides = {
    checkServerIdentity: (...args) => this.#checkServerIdentity(...args),
  };

  patches = {
    connect: {
      dynamicInstructions: {
        "$0.checkServerIdentity": this.overrides.checkServerIdentity,
        "$R._handle.verifyError": (s, t) => this.#verifyError(s, t),
      },
    },
  };

  patchAgent(agent) {
    const patches = OverridePlugin.getPatchesSorted(
      this.patches.connect.dynamicInstructions,
    );

    const _createConnection = agent.createConnection.bind(agent);
    agent.createConnection = (...args) => {
      OverridePlugin.applyArgPatches(args, patches.arg);
      const socket = _createConnection(...args);
      return OverridePlugin.applyResPatches(socket, patches.res);
    };
  }

  #checkServerIdentity(hostname, cert) {
    const err = this.sources.checkServerIdentity(hostname, cert);

    if (!err || this.config.allowAll) {
      return;
    }

    const isAltnameInvalid = err.code === "ERR_TLS_CERT_ALTNAME_INVALID";

    SecManage.assignErrorId(err);

    if (this.config.allowCertAltName && isAltnameInvalid) {
      this.#logIgnoreErr(err);

      return;
    }

    return err;
  }

  #connectBefore = (options) => [
    { ...options, checkServerIdentity: this.overrides.checkServerIdentity },
  ];
  #connectAfter = (socket) => {
    const hostname = socket._host;

    OverridePlugin.dynamicPatch(socket, "_handle.verifyError", (source) =>
      this.#verifyError(source),
    );

    return socket;
  };

  #verifyError = (source, target) => {
    const hostname = target._host;
    const err = source();

    if (!err || this.config.allowAll) {
      return;
    }

    const isExpired = err.code === "CERT_HAS_EXPIRED";
    const isCaSelfSigned = err.code === "DEPTH_ZERO_SELF_SIGNED_CERT";
    const isSelfSigned = err.code === "SELF_SIGNED_CERT_IN_CHAIN";
    const isVerificationFail = err.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE";

    if (this.config.allowExpiredCert && isExpired) {
      SecManage.assignErrorId(err);
      this.#logIgnoreErr(err);
      return;
    }

    if (this.config.allowRootSelfSigned && isCaSelfSigned) {
      SecManage.assignErrorId(err);
      this.#logIgnoreErr(err);
      return;
    }

    if (this.config.allowSelfSigned && isSelfSigned) {
      SecManage.assignErrorId(err);
      this.#logIgnoreErr(err);
      return;
    }

    if (this.config.allowUnverified && isVerificationFail) {
      SecManage.assignErrorId(err);
      this.#logIgnoreErr(err);
      return;
    }

    SecManage.assignErrorId(err);
    this.#logError(err, hostname);

    return err;
  };

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

  #logWarnAllIgnored() {
    this.logger.warn(
      `‼ All errors are marked as allowed! Hope you know what you're doing O_o`
        .red,
    );
  }

  #logError(err, hostname) {
    this.logger.info(
      `Certificate checks error ${err.netaxisId} for host ${hostname}, ${err.code}`
        .yellow,
    );
  }

  #logIgnoreErr(err) {
    this.logger.info(
      `Certificate checks error ${err.netaxisId} was ignored, ${err.code}`
        .green,
    );
  }
}
