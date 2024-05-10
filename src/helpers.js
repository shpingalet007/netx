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
  static target = "no target";
  static isModule = false;
  static mountPoint = false;
  static configParam = false;
  static listParams = false;

  SelfStatic = this.constructor;

  overrides = {};
  sources = {};

  config = {};
  list = {};

  instantiate(axisInstance, options) {
    let targetObj = this.SelfStatic.target;

    this.axisInstance = axisInstance;

    const fileOpts = this.parseConfig(this.axisInstance.config);

    this.config = {
      ...OverridePlugin.DefaultInstantiateOptions,
      ...fileOpts,
      ...options,
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

    if (mountPoint) {
      axisInstance[mountPoint] = targetObj;
    }

    this.list = this.parseList(this.axisInstance._list);
  }

  parseConfig(NetAxisConfig) {
    return NetAxisConfig.pluginConfigs?.[this.SelfStatic.configParam] || {};
  }

  parseList(NetAxisList) {
    return new this.SelfStatic.List(NetAxisList);
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

  protect() {
    this.SelfStatic.target = Object.freeze(this.SelfStatic.target);
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

    if (
      type === "https" &&
      this.netx.plugins.SslPinning?.config.socketOptions
    ) {
      prepOptions = {
        ...this.netx.plugins.SslPinning?.config.socketOptions,
        ...prepOptions,
      };
    }

    this.targetAgent = agentCreator(prepOptions);

    if (this.netx.plugins.DnsOverride) {
      this.lookup = (...args) => {
        return this.netx.plugins.DnsOverride.overrides.lookup(...args);
      };

      // FIXME: This adds support for HTTP lookup but breaks other Proxy Agents
      /*const _createSocket = this.targetAgent.createSocket.bind(this.targetAgent);
			this.targetAgent.createSocket = (req, options, cb) => {
				const patchFullRequestPath = (request, target) => {
					const url = new URL(request.path);
					request.path = `${request.protocol}//${target}${url.pathname}`;
				}

				let targetHost = req.host;

				if (this.lookup) {
					this.lookup(req.host, (err, address) => {
						patchFullRequestPath(req, /!*'93.184.215.14' ||*!/ address);
						_createSocket(req, options, cb);
					});

					return;
				}

				patchFullRequestPath(req, targetHost);
				_createSocket(req, options, cb);
			}*/
    }

    if (this.netx.plugins.DnsOverride) {
      /** Support for https://github.com/TooTallNate/proxy-agents/tree/main/packages/socks-proxy-agent */
      this.targetAgent.shouldLookup = true;

      /** HTTP Proxy Agent experimental. TODO: Finish this */
      /*this.targetAgent.connectOpts = {
				...this.targetAgent.connectOpts,
				lookup: (...args) => this.lookup(...args),
			};*/
    }

    /** Support for https://github.com/TooTallNate/proxy-agents/tree/main/packages/socks-proxy-agent */
    if (this.netx.plugins.SslPinning) {
      this.targetAgent.options.socketOptions =
        this.netx.plugins.SslPinning?.config.socketOptions;
    }

    this.addRequest = (request, options) => {
      if (this.netx.plugins.SslPinning) {
        request.on("socket", (socket) => {
          socket.on("secureConnect", () => {
            const host = socket.servername;
            const cert = socket.getPeerCertificate();

            const identityCheck =
              this.netx.plugins.SslPinning.overrides.checkServerIdentity(
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

      if (this.netx.plugins.DnsOverride) {
        options.lookup = (...args) => this.lookup(...args);
      }

      return this.targetAgent.addRequest(request, options);
    };
  }
}
