import path from "path";
import fs from "fs";
import http from "http";

import betterLogging from "better-logging";

import { List, WrappingAgent } from "./helpers.js";

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
	}

	constructor(configs) {
		this.id = (Math.random() + 1).toString(36).substring(7);

		const configPath = configs?.listPath || NetAxis.defaultConfigurations.listPath;
		const fileConfig = NetAxis.fsConfigProvider(configPath);

		const configurations = { ...NetAxis.defaultConfigurations, ...fileConfig, ...configs };
		const { debug, readonly, protectGlobal, listPath, pluginConfigs, list, overrideAll } = configurations;

		this.config = { debug, readonly, protectGlobal, list, pluginConfigs, overrideAll };

		this.config.listPath = (listPath.endsWith('.json'))
			? listPath
			: path.join(listPath, NetAxis.defaultConfigurations.listPath);

		this.#readonly = readonly;
		this.#protectGlobal = protectGlobal;

		this._list = new List(list);

		betterLogging(this.logger);

		if (debug) {
			this.logger.logLevel = 4;
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
		})
	}

	async use(plugin, options) {
		await plugin.instantiate(this, options);
		this.plugins[plugin.constructor.name] = plugin;
	}

	static defaultConfigurations = {
		listPath: 'axisrc.json',
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
			this.logger.warn('No Netx instance is found in global scope');
			return;
		}

		try {
			delete global._netxGlobalPoint;
			delete global[globalName];
		} catch (err) {
			this.logger.error('Netx instance can not be unmounted from global scope');
			this.logger.warn('If you really need to be able to remove Netx from global');
			this.logger.warn('use protectGlobal = false, but for security reasons we do not recommend it...');
			throw Error('Netx instance can not be unmounted from global scope');
		}
	}

	async protect() {
		const module = await import('./netaxis.js');

		for (let pluginName in this.plugins) {
			const plugin = this.plugins[pluginName];

			if (plugin.isProtected) {
				this.plugins[pluginName].constructor.protect?.();
			}
		}

		Object.defineProperty(module, 'NetAxis', Object.freeze(NetAxis));
	}

	createAgent(protocol, args) {
		return new WrappingAgent(this, () => new http.Agent(args));
	}
}
