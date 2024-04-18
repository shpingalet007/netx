import https from "https";
import http from "http";

export class List {
	list = {};

	constructor(associations) {
		this.list = List.parseList(associations);
	}

	static parseList(associations) {
		const list = {};

		const hosts = Object.keys(associations);

		hosts.forEach((host) => {
			const hostData = associations[host];

			const isIpForm = (typeof hostData === "string");
			const isIpAndPinForm = Array.isArray(hostData);
			const isComplexForm = typeof hostData === "object";

			const isIpV4 = ip => ip.includes(".");
			const isIpV6 = ip => ip.includes(":");
			const getIpVersion = (ip) => {
				if (isIpV4(ip)) return 'v4';
				if (isIpV6(ip)) return 'v6';
			}

			list[host] = { ip: {}, pin: [] };

			if (isIpForm) {
				const ipVersion = getIpVersion(hostData);

				list[host].ip[ipVersion] = [hostData];
			} else if (isIpAndPinForm) {
				if (hostData[1]) {
					list[host].pin.push(hostData[1]);
				}

				const ipVersion = getIpVersion(hostData[0]);

				list[host].ip[ipVersion] = [hostData[0]];
			} else if (isComplexForm) {
				const isIpStringForm = (typeof hostData.ip === "string");
				const isIpArrayForm = Array.isArray(hostData.ip);
				const isIpObjectForm = (typeof hostData.ip === "object");

				const isPinStringForm = (typeof hostData.pin === "string");
				const isPinArrayForm = Array.isArray(hostData.pin);

				if (isIpStringForm) {
					const ipVersion = getIpVersion(hostData.ip);

					list[host].ip[ipVersion] = [hostData.ip];
				} else if (isIpArrayForm) {
					hostData.ip.forEach((ip) => {
						const ipVersion = getIpVersion(ip);
						const isVersionInObject = (ipVersion in list[host].ip);

						if (!isVersionInObject) {
							list[host].ip[ipVersion] = [];
						}

						list[host].ip[ipVersion].push(ip);
					});
				} else if (isIpObjectForm) {
					const isIpV4StringForm = (typeof hostData.ip?.v4 === "string");
					const isIpV4ArrayForm = Array.isArray(hostData.ip?.v4);
					const isIpV6StringForm = (typeof hostData.ip?.v6 === "string");
					const isIpV6ArrayForm = Array.isArray(hostData.ip?.v6);

					if (isIpV4StringForm && hostData.ip.v4.length) {
						list[host].ip.v4 = [hostData.ip.v4];
					} else if (isIpV4ArrayForm) {
						list[host].ip.v4 = [];

						hostData.ip.v4.forEach((ip) => {
							list[host].ip.v4.push(ip);
						});
					}

					if (isIpV6StringForm && hostData.ip.v6.length) {
						list[host].ip.v6 = [hostData.ip.v6];
					} else if (isIpV6ArrayForm) {
						list[host].ip.v6 = [];

						hostData.ip.v6.forEach((ip) => {
							list[host].ip.v6.push(ip);
						});
					}
				}

				if (isPinStringForm) {
					list[host].pin = [hostData.pin];
				} else if (isPinArrayForm) {
					list[host].pin = hostData.pin;
				}
			}
		});

		return list;
	}

	getPinning(host) {
		return this.list?.[host]?.pin || [];
	}

	getAddress(host, family = 4) {
		const isHostListed = (host in this.list);
		const isHostAddressEmpty = (!this.list?.[host]?.ip?.v4?.length && !this.list?.[host]?.ip?.v6?.length);

		if (!isHostListed || isHostAddressEmpty) return;

		const addr4 = this.list[host].ip?.v4?.[0];
		const addr6 = this.list[host].ip?.v6?.[0];

		if (!addr6 && !addr4) return;

		if ((family === 0 || family === 4) && addr4) return { ip: addr4, family: 4 };
		if ((family === 0 || family === 6) && addr6) return { ip: addr6, family: 6 };
		if (family === 6 && addr4) return { ip: `::ffff:${addr4}`, family: 6 };
	}

	getAllAddresses(host) {
		const ipV4 = this.list?.[host]?.ip?.v4;
		const ipV6 = this.list?.[host]?.ip?.v6;

		let ipV4List = [];
		let ipV6List = [];

		if (ipV4?.length) {
			ipV4.forEach((ip) => (
				ipV4List.push({ ip, family: 4 })
			));
		}

		if (ipV6?.length) {
			ipV6.forEach((ip) => (
				ipV6List.push({ ip, family: 6 })
			));
		}

		if (ipV4?.length && ipV6?.length) {
			return [...ipV4List, ...ipV6List];
		}

		if (ipV4?.length) {
			return ipV4List;
		}

		if (ipV6?.length) {
			return ipV6List;
		}
	}

	put(host, data) {}
	update(host, data) {}
	delete(host, data) {}
}

export class PluginList {
	static listParams = [];

	list = {};

	SelfStatic = this.constructor;

	constructor(list) {
		this.list = this.parseList(list);
	}

	getHostConfig(host, param) {
		if (!param) {
			return this.list[host];
		}

		return this.list[host][param];
	}

	parseList(list) {
		const cloneList = {...list};

		Object.keys(cloneList).forEach((host) => {
			const hostParams = cloneList[host]
			const pluginHostParams = {};

			this.SelfStatic.listParams.forEach((paramName) => {
				pluginHostParams[paramName] = hostParams[paramName]
			});

			cloneList[host] = pluginHostParams;
		});

		return cloneList;
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

	async instantiate(axisInstance, options) {
		let targetObj = this.SelfStatic.target;

		this.axisInstance = axisInstance;

		const fileOpts = this.parseConfig(this.axisInstance.config);

		const opts = { ...OverridePlugin.DefaultInstantiateOptions, ...fileOpts, ...options };

		if (!opts.override && !this.axisInstance.config.overrideAll) {
			targetObj = OverridePlugin.wrapModule(targetObj);
		}

		this.isProtected = opts.protectCore;

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

		this.list = this.parseList(this.axisInstance._list.list);
	}

	parseConfig(NetAxisConfig) {
		return NetAxisConfig.pluginConfigs?.[this.SelfStatic.configParam] || {};
	}

	parseList(NetAxisList) {
		return new this.SelfStatic.List(NetAxisList);
	}

	static wrapModule(target) {
		return new Proxy({...target}, {
			apply: function (target, thisArg, args) {
				return target(...args);
			},
			get: function (target, prop) {
				if (target.__wrappedmemory?.[prop]) {
					return target.__wrappedmemory[prop];
				}

				if (typeof target[prop] === 'object') {
					return OverridePlugin.wrapModule(target[prop]);
				}

				return target[prop];
			},
			set: function (target, prop, value) {
				if (typeof target.__wrappedmemory !== 'object') {
					target.__wrappedmemory = {};
				}

				target.__wrappedmemory[prop] = value;
				return value;
			},
		});
	}

	static DefaultInstantiateOptions = {
		override: false,
		protect: true,
	};
}

class WrappingAgentBase {
	constructor(type, ...args) {
		if (type === 'https') {
			return new https.Agent(...args);
		} else if (type === 'http') {
			return new http.Agent(...args);
		}
	}
}

export class WrappingAgent extends WrappingAgentBase {
	constructor(type, netx, agentCreator) {
		super(type);

		this.netx = netx;

		console.log(agentCreator.toString());

		this.targetAgent = agentCreator();
		this.targetAgent.shouldLookup = true;
	}

	lookup = (...args) => this.netx.dns.lookup(...args);

	addRequest(request, options) {
		request.on('socket', socket => {
			socket.on('secureConnect', () => {
				const host = socket.servername;
				const cert = socket.getPeerCertificate();

				const identityCheck = this.netx.pins.checkServerIdentity(host, cert);

				if (identityCheck instanceof Error) {
					request.emit('error', identityCheck);
					request.abort();
				}
			});
		});

		return this.targetAgent.addRequest(request, options);
	}
}
