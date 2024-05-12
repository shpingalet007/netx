import https from "https";
import http from "http";

export class PluginList {
  static listParams = [];

  list = {};

  SelfStatic = this.constructor;

  constructor(list) {
    this.list = this.parseList(list);
  }

  // TODO: Aggregated configurations?
  /*getHostConfig(host, param) {
		if (!param) {
			return this.list[host];
		}

		return this.list[host][param];
	}*/

  parseList(list) {
    const preparedList = this.SelfStatic.parseList?.({ ...list });

    Object.keys(preparedList).forEach((host) => {
      const hostParams = preparedList[host];
      const pluginHostParams = {};

      this.SelfStatic.listParams.forEach((paramName) => {
        pluginHostParams[paramName] = hostParams[paramName];
      });

      preparedList[host] = pluginHostParams;
    });

    return preparedList;
  }
}

export class OverridePlugin {
  static name = "no name";
  static logName = "no log name";
  static logColor = "grey";
  static target = "no target";
  static targetName = "no target name";
  static isModule = false;
  static mountPoint = false;
  static configParam = false;
  static listParams = false;

  static flags = {};

  SelfStatic = this.constructor;

  overrides = {};
  sources = {};

  config = {};
  list = {};

  loggerBadge = (x) =>
    "[".grey + this.SelfStatic.logName[this.SelfStatic.logColor] + "]".grey;

  instantiate(axisInstance, options = {}) {
    this.axisInstance = axisInstance;

    this.logger = {
      debug: (...a) => this.axisInstance.logger.debug(this.loggerBadge(), ...a),
      error: (...a) => this.axisInstance.logger.error(this.loggerBadge(), ...a),
      info: (...a) => this.axisInstance.logger.info(this.loggerBadge(), ...a),
      log: (...a) => this.axisInstance.logger.log(this.loggerBadge(), ...a),
      warn: (...a) => this.axisInstance.logger.warn(this.loggerBadge(), ...a),
    };

    const targetName = this.SelfStatic.targetName;

    let targetObj =
      axisInstance.overrides[targetName] || this.SelfStatic.target;

    if (
      targetObj.netaxis &&
      this.SelfStatic.flags.patchFirst &&
      !options.ignorePatchFirst
    ) {
      this.axisInstance.logger.error("---------------------------");
      this.axisInstance.logger.error(
        `Plugin ${this.SelfStatic.name} must be utilized first to ensure expected behavior.`,
      );
      this.axisInstance.logger.error(
        `Currently, its functionality may result in unexpected outcomes.`,
      );
      this.axisInstance.logger.error(
        `Module ${this.SelfStatic.targetName} has already been patched by ${targetObj.netaxisPlugin}.`,
      );
      this.axisInstance.logger.error(
        "Developer may set flag".yellow,
        " ignorePatchFirst: true ".bgRed,
        "to ignore priority issues.".yellow,
      );
      this.axisInstance.logger.error("---------------------------");

      throw Error("Priority!!");
    }

    const fileOpts = this.parseConfig(this.axisInstance.config);

    this.config = {
      ...OverridePlugin.DefaultInstantiateOptions,
      ...fileOpts,
      ...options,
    };

    const pluginAgentOptions = this.SelfStatic.prepareAgentOptions(this.config);

    this.axisInstance.agentOptions = {
      ...this.axisInstance.agentOptions,
      ...pluginAgentOptions,
    };

    if (!this.config.override && !this.axisInstance.config.overrideAll) {
      targetObj = OverridePlugin.wrapModule(targetObj);

      this.isProtected = this.config.protectCore;
    }

    const mountPoint = this.SelfStatic.mountPoint;

    const overrideKeys = Object.keys(this.overrides);

    for (let i = 0; i < overrideKeys.length; i++) {
      const overrideKey = overrideKeys[i];

      this.sources[overrideKey] = targetObj[overrideKey];

      targetObj[overrideKey] = this.overrides[overrideKey];
    }

    targetObj.netaxis = true;
    targetObj.netaxisPlugin = this.SelfStatic.logName;

    if (!this.config.override && !this.axisInstance.config.overrideAll) {
      this.axisInstance.overrides[targetName] = targetObj;
    }

    if (mountPoint) {
      this.axisInstance[mountPoint] = targetObj;
    }

    this.list = this.parseList(this.axisInstance._list);
  }

  parseConfig(NetAxisConfig) {
    return NetAxisConfig.pluginConfigs?.[this.SelfStatic.configParam] || {};
  }

  parseList(NetAxisList) {
    return new this.SelfStatic.List(NetAxisList);
  }

  protect() {
    this.SelfStatic.target = Object.freeze(this.SelfStatic.target);
  }

  static wrapModule(target) {
    return new Proxy(
      { ...target },
      {
        apply: function (target, thisArg, args) {
          return target(...args);
        },
        get: function (target, prop) {
          if (target.__wrappedmemory?.[prop]) {
            return target.__wrappedmemory[prop];
          }

          if (typeof target[prop] === "object") {
            return OverridePlugin.wrapModule(target[prop]);
          }

          return target[prop];
        },
        set: function (target, prop, value) {
          if (typeof target.__wrappedmemory !== "object") {
            target.__wrappedmemory = {};
          }

          target.__wrappedmemory[prop] = value;
          return value;
        },
      },
    );
  }

  static prepareAgentOptions(config) {
    return config.socketOptions || {};
  }

  static DefaultInstantiateOptions = {
    override: false,
    protect: true,
  };
}

// TODO: Finish Socket Agent in future
class WrappingAgentBase {
  constructor(type, ...args) {
    if (type === "https") {
      return new https.Agent(...args);
    } else if (type === "http") {
      return new http.Agent(...args);
    }
  }

  static createAgent(type, ...args) {
    if (type === "https") {
      return new https.Agent(...args);
    } else if (type === "http") {
      return new http.Agent(...args);
    }
  }
}

export class WrappingAgent extends WrappingAgentBase {
  constructor(type, netx, agentCreator, options) {
    super(type, options);

    this.netx = netx;

    let prepOptions = { ...options };

    if (type === "https" && this.netx.overrides.tls) {
      prepOptions = {
        ...this.netx.plugins.agentOptions,
        ...prepOptions,
      };
    }

    this.targetAgent = agentCreator(prepOptions);

    if (this.netx.overrides.dns) {
      if (this.netx.overrides.dns.lookup) {
        this.lookup = this.netx.overrides.dns.lookup;

        /** Support for https://github.com/TooTallNate/proxy-agents/tree/main/packages/socks-proxy-agent */
        this.targetAgent.shouldLookup = true;
      }
    }

    if (this.netx.overrides.tls) {
      /** Support for https://github.com/TooTallNate/proxy-agents/tree/main/packages/socks-proxy-agent */
      this.targetAgent.options.socketOptions = this.netx.agentOptions;

      const _createConnection = this.targetAgent.createConnection.bind(
        this.targetAgent,
      );
      this.targetAgent.createConnection = (port, host, options) => {
        return _createConnection(
          {
            ...port,
            checkServerIdentity: this.netx.overrides.tls.checkServerIdentity,
          },
          host,
          options,
        );
      };
    }

    this.addRequest = (request, options) => {
      if (this.netx.overrides.tls) {
        request.on("socket", (socket) => {
          socket.on("secureConnect", () => {
            const host = socket.servername;
            const cert = socket.getPeerCertificate();

            const identityCheck = this.netx.overrides.tls.checkServerIdentity(
              host,
              cert,
            );

            if (identityCheck instanceof Error) {
              request.emit("error", identityCheck);
              request.abort();
            }
          });
        });
      }

      if (this.netx.overrides.dns) {
        options.lookup = (...args) => this.lookup(...args);
      }

      return this.targetAgent.addRequest(request, options);
    };
  }
}
