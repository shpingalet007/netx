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

    async instantiate(NetAxisInstance) {
        const targetObj = this.SelfStatic.target;
        const mountPoint = this.SelfStatic.mountPoint;

        this.NetAxisInstance = NetAxisInstance;

        const overrideKeys = Object.keys(this.overrides);

        overrideKeys.forEach((overrideKey, i) => {
            this.sources[overrideKey] = targetObj[overrideKey];

            targetObj[overrideKey] = this.overrides[overrideKey];

            if (mountPoint) {
                this.NetAxisInstance[mountPoint] = targetObj;
            }
        });

        this.config = this.parseConfig(this.NetAxisInstance.config);
        this.list = this.parseList(this.NetAxisInstance._list.list);
    }

    parseConfig(NetAxisConfig) {
        // Todo parse only needed
        return NetAxisConfig;
    }

    parseList(NetAxisList) {
        return new this.SelfStatic.List(NetAxisList);
    }
}
