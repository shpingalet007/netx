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
  patches = {
    /*"connect": {
      before: () => {},
      after: () => {},
    }*/
  };
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
        `Module ${this.SelfStatic.targetName} has already been patched by ${targetObj.netaxisPlugin.SelfStatic.logName}.`,
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

    if (!this.config.override && !this.axisInstance.config.overrideAll) {
      targetObj = OverridePlugin.wrapModule(targetObj);

      this.isProtected = this.config.protectCore;

      if (this.patchAgent) {
        this.axisInstance.agentPatches.push(this.patchAgent.bind(this));
      }
    }

    const mountPoint = this.SelfStatic.mountPoint;

    const overrideKeys = Object.keys(this.overrides);

    for (let i = 0; i < overrideKeys.length; i++) {
      const overrideKey = overrideKeys[i];

      this.sources[overrideKey] = targetObj[overrideKey];

      targetObj[overrideKey] = this.overrides[overrideKey];
    }

    const patchKeys = Object.keys(this.patches);

    for (let i = 0; i < patchKeys.length; i++) {
      const patchKey = patchKeys[i];

      this.sources[patchKey] = targetObj[patchKey];

      // V2 Patching
      {
        const patches = OverridePlugin.getPatchesSorted(
          this.patches[patchKey].dynamicInstructions,
        );

        targetObj[patchKey] = (...args) => {
          /** Arguments patching */
          OverridePlugin.applyArgPatches(args, patches.arg);

          const result = this.sources[patchKey](...args);

          /** Results patching */
          return OverridePlugin.applyResPatches(result, patches.res);
        };
      }
    }

    targetObj.netaxis = true;
    targetObj.netaxisPlugin = this;

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

  static dynamicPatch(target, prop, value) {
    const getDeep = (target, prop) => {
      const keys = prop.split(".");
      let value = target;

      let last;

      for (let i = 0; i < keys.length; i++) {
        last = value;
        value = value[keys[i]];
      }

      return value?.bind?.(last);
    };
    const setDeep = (target, prop, value) => {
      const keys = prop.split(".");
      const lastKey = keys.pop();

      const obj = keys.reduce((acc, key) => acc && acc[key], target);
      if (obj && lastKey) {
        obj[lastKey] = value;
      }
    };

    const source = getDeep(target, prop);

    let val = value;

    if (typeof value === "function") {
      val = (...args) => {
        return value(source, target, ...args);
      };
    }

    setDeep(target, prop, val);
    return target;
  }

  static getPatchesSorted(patches) {
    const ArgPatchRegexp = /^\$(\d+)\./;
    const ResPatchRegexp = /^\$R(\d+)?\./;

    let arg = [];
    let res = [];

    Object.keys(patches).forEach((insName) => {
      if (ArgPatchRegexp.test(insName)) {
        const index = insName.match(ArgPatchRegexp)[1];
        const path = insName.split(".").slice(1).join(".");
        const fullPath = `${index}.${path}`;

        arg.push({
          path: fullPath,
          value: patches[insName],
        });

        return;
      }

      if (ResPatchRegexp.test(insName)) {
        const index = insName.match(ResPatchRegexp)[1] || 0;
        const path = insName.split(".").slice(1).join(".");
        const fullPath = `${index}.${path}`;

        res.push({
          path: fullPath,
          value: patches[insName],
        });
      }
    });

    return { arg, res };
  }

  static applyArgPatches(target, patches) {
    let patchedTarget = target;

    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];

      OverridePlugin.dynamicPatch(patchedTarget, patch.path, patch.value);
    }

    return patchedTarget;
  }

  static applyResPatches(target, patches) {
    let patchedTarget = target;

    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];

      if (!Array.isArray(patchedTarget) && patch.path.startsWith("0.")) {
        const path = patch.path.split(".").slice(1).join(".");

        OverridePlugin.dynamicPatch(patchedTarget, path, patch.value);
      } else {
        OverridePlugin.dynamicPatch(patchedTarget, patch.path, patch.value);
      }
    }

    return patchedTarget;
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

    this.netx.agentPatches.forEach((p) => p(this.targetAgent));

    if (this.netx.overrides.dns) {
      if (this.netx.overrides.dns.lookup) {
        this.lookup = this.netx.overrides.dns.lookup;

        /** Support for https://github.com/TooTallNate/proxy-agents/tree/main/packages/socks-proxy-agent */
        this.targetAgent.shouldLookup = true;
      }
    }

    if (this.netx.overrides.tls) {
      /** Support for https://github.com/TooTallNate/proxy-agents/tree/main/packages/socks-proxy-agent */
      this.targetAgent.options.socketOptions = this.netx.config.socketOptions;
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
