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

		const configurations = { ...NetAxis.defaultConfigurations, ...configs };
		const { debug, readonly, protectGlobal, listPath, listProvider } = configurations;

		this.config = { debug, readonly, protectGlobal, listProvider };

		this.config.listPath = (listPath.endsWith('.json'))
			? listPath
			: path.join(listPath, NetAxis.defaultConfigurations.listPath);

		this.#readonly = readonly;
		this.#protectGlobal = protectGlobal;

		if (!listProvider) {
			const config = NetAxis.fsConfigProvider(this.config.listPath);
			const list = config.list;
			this._list = new List(list);
		} else {
			this._list = listProvider();
		}

		betterLogging(this.logger);

		if (debug) {
			this.logger.logLevel = 4;
		}

		const self = this;

		Object.defineProperties(this, {
			list: {
				writable: false,
				configurable: false,
				value: {
					set(value) {
						if (self.#readonly && self._list) {
							this.logger.warn("List was marked as readonly");
						}

						self._list = value;
					},
					get() {
						return self._list;
					}
				}
			}
		})
	}

	async use(plugin, options) {
		await plugin.instantiate(this, options);
		plugin.parseConfig();
		this.plugins[plugin.constructor.name] = plugin;
	}

	static defaultConfigurations = {
		listPath: 'axisrc.json',
		debug: false,
		readonly: true,
		protectGlobal: true,
	};

	static fsConfigProvider(listPath) {
		const fullListPath = path.join(process.cwd(), listPath);
		const list = fs.readFileSync(fullListPath, { encoding: "utf-8" });

		return JSON.parse(list);
	}

	globalize(globalName = NetAxis.GlobalName) {
		const globalParams = {};
		globalParams._netxGlobalPoint = {
			value: globalName,
			writable: false,
			configurable: !this.#protectGlobal,
		};
		globalParams[globalName] = {
			value: this,
			writable: false,
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

	createAgent(protocol, args) {
		return new WrappingAgent(this, () => new http.Agent(args));
	}
}
