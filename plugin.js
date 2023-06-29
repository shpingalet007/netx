import { NetAxis } from "./main.js";

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

    async instantiate(axisInstance, options = {}) {
        let targetObj = this.SelfStatic.target;

        if (!options.override) {
            const targetBaseObj = NetAxis.wrapModule(targetObj);
            targetObj = NetAxis.wrapModule(targetObj);
        }

        const mountPoint = this.SelfStatic.mountPoint;

        this.axisInstance = axisInstance;

        const overrideKeys = Object.keys(this.overrides);

        overrideKeys.forEach((overrideKey, i) => {
            this.sources[overrideKey] = targetObj[overrideKey];

            targetObj[overrideKey] = this.overrides[overrideKey];

            if (mountPoint) {
                this.axisInstance[mountPoint] = targetObj;
            }
        });

        this.config = this.parseConfig(this.axisInstance.config);
        this.list = this.parseList(this.axisInstance._list.list);
    }

    parseConfig(NetAxisConfig) {
        // Todo parse only needed
        return NetAxisConfig;
    }

    parseList(NetAxisList) {
        return new this.SelfStatic.List(NetAxisList);
    }
}
