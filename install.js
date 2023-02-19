import { Netx } from "./main.js";

const netx = new Netx({});
netx.install();

global.netx = { instance: netx };
