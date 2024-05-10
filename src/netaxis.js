import path from "path";
import fs from "fs";
import https from "https";
import http from "http";

import betterLogging from "better-logging";

// TODO: Finish Socket Agent in future
import { WrappingAgent } from "./helpers.js";

export class NetAxis {
  static GlobalName = "netx";

  #readonly = true;
  #protectGlobal = true;
  _list = {};

  config = {};
  plugins = {};

  logger = {
    logLevel: -1,
    debug: console.debug,
    error: console.error,
    info: console.info,
    log: console.log,
    warn: console.warn,
  };

  constructor(config = {}) {
    let loadedConfig = {};

    if (typeof config === 'string') {
      let configPath = config;

      configPath = configPath.endsWith(".json") ? configPath : path.join(configPath, NetAxis.defaultConfigPath);

      loadedConfig = NetAxis.fsConfigProvider(configPath);
    } else {
      loadedConfig = {...config};
    }

    const configurations = {
      ...NetAxis.defaultConfigurations,
      ...loadedConfig,
    };
    const {
      debug,
      readonly,
      protectGlobal,
      pluginConfigs,
      list,
      overrideAll,
    } = configurations;

    this.config = {
      debug,
      readonly,
      protectGlobal,
      list,
      pluginConfigs,
      overrideAll,
    };

    this.#readonly = readonly;
    this.#protectGlobal = protectGlobal;

    this._list = list;

    betterLogging(this.logger);

    if (debug) {
      this.logger.logLevel = 4;
    }

    if (process.argv.includes("--netaxis-no-logs")) {
      this.logger.logLevel = -1;
    }

    const self = this;

    Object.defineProperty(this, "list", {
      set(value) {
        if (self.#readonly && self._list) {
          self.logger.warn("List was marked as readonly");
          throw TypeError("Cannot assign to read only NetAxis List object");
        }

        self._list = value;
      },
      get() {
        return self._list;
      },
      configurable: false,
    });
  }

  use(plugin, options) {
    let pluginInstance = plugin;

    if (typeof plugin === 'function') {
      pluginInstance = new plugin();
    }

    pluginInstance.instantiate(this, options);
    this.plugins[pluginInstance.constructor.name] = pluginInstance;
  }

  static defaultConfigPath = "axisrc.json";

  static defaultConfigurations = {
    list: {},
    debug: false,
    readonly: true,
    protectGlobal: true,
    overrideAll: false,
  };

  static fsConfigProvider(listPath) {
    const fullListPath = path.join(process.cwd(), listPath);

    let configRaw;

    try {
      configRaw = fs.readFileSync(fullListPath, { encoding: "utf-8" });
    } catch (err) {
      return {};
    }

    return JSON.parse(configRaw);
  }

  globalize(globalName = NetAxis.GlobalName) {
    const globalParams = {};
    globalParams._netxGlobalPoint = {
      value: globalName,
      writable: !this.#protectGlobal,
      configurable: !this.#protectGlobal,
    };
    globalParams[globalName] = {
      value: this,
      writable: !this.#protectGlobal,
      configurable: !this.#protectGlobal,
    };

    Object.defineProperties(global, globalParams);
  }

  unglobalize() {
    const globalName = global._netxGlobalPoint;

    if (!globalName) {
      this.logger.warn("No Netx instance is found in global scope");
      return;
    }

    try {
      delete global._netxGlobalPoint;
      delete global[globalName];
    } catch (err) {
      this.logger.error("Netx instance can not be unmounted from global scope");
      this.logger.warn(
        "If you really need to be able to remove Netx from global",
      );
      this.logger.warn(
        "use protectGlobal = false, but for security reasons we do not recommend it...",
      );
      throw Error("Netx instance can not be unmounted from global scope");
    }
  }

  async protect() {
    const module = await import("./netaxis.js");

    for (let pluginName in this.plugins) {
      const plugin = this.plugins[pluginName];

      if (plugin.isProtected) {
        this.plugins[pluginName].SelfStatic.target.netaxis = true;
        this.plugins[pluginName].protect?.();
      }
    }

    Object.defineProperty(module, "NetAxis", Object.freeze(NetAxis));
  }

  // TODO: Finish Socket Agent in future
  createAgent(protocol, args) {
    return this.agentCreator(args)({ protocol });
  }

  agentCreator() {
    return ({ protocol }) => {
      if (protocol.includes("https")) {
        return new WrappingAgent(
          "https",
          this,
          (opts) => new https.Agent(opts),
        );
      }

      if (protocol.includes("http")) {
        return new WrappingAgent("http", this, (opts) => new http.Agent(opts));
      }

      throw Error(`Unsupported protocol ${protocol}`);
    };
  }
}
