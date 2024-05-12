# NetAxis

NetAxis is a versatile toolkit for Node.js, designed to enhance networking capabilities. With its modular design and plugin system, it extends core functionalities. Offering intuitive configuration management and seamless integration, NetAxis streamlines development for secure and efficient networking applications.

```js
import { DnsOverride } from "@netaxis/dns-override";
import { SslPinning } from "@netaxis/ssl-pinning";

const netx = new NetAxis({
  list: {
    "example.net": {
      ip: "93.184.215.14", // no DNS server needed
      pin: "E7035BCC1C18771F792F90866B6C1DF8DFAABDC0", // SSL pins
    },
  },
  overrideAll: false, // patch modules, default is false
  protectGlobal: true, // by default, global NetAxis instance can't be detached
});

netx.use(DnsOverride);

netx.use(SslPinning, {
  protectCore: true, // core module protection, applied in override mode, default is true
  override: true, // native module patching, default is false
});

// Protect itself and all patched native modules
netx.protect();

// Assign itself globally
netx.globalize(/* other name, netx by default */);

// 1. Using IP address from the configuration (DnsOverride)
// 2. Checking SSL certificate (SslPinning)
const res = await fetch(url, {
  // We can get rid of the agent by setting overrideAll: true
  agent: netx.agentCreator(),
});
```

## Architecture

NetAxis operates within two distinct modes: overriding and non-overriding.

In the overriding mode, it patches native libraries to intercept any functionality dependent on them. This interception ensures that such functionality is channeled through NetAxis, allowing for customized processing or enhancement.

Conversely, in the non-overriding mode, NetAxis provides network Agents for direct utilization or allows direct invocation of plugin methods. This mode offers a more straightforward approach, utilizing NetAxis-provided resources or leveraging plugin functionalities directly.

Overall, NetAxis's architecture encompasses these two modes, each offering unique pathways for integrating and enhancing networking functionalities within Node.js applications.

## Security

To ensure the security and integrity of critical functionalities within NetAxis, certain protection mechanisms are employed. In the overriding mode, where native libraries are patched to channel functionality through NetAxis, there exists a protection mode. This mode safeguards modules from potential detachment from native libraries.

The protection mode operates by removing the ability to patch native libraries, thereby fortifying the modules against any unauthorized modifications or interference. By implementing this protective measure, NetAxis enhances the security of its critical functionalities, ensuring their continued integrity and effectiveness within the network environment.

### Override Mode

Each module can operate in override mode. This can be assigned by setting `overrideAll: true` in the NetAxis configuration file or during instance initialization. Additionally, specific modules can be set to `override: true`. While this mode is off by default, enabling it is strongly recommended.

### Core Protection

In override mode, modules rewrite native functionality. However, there is an option to modify the core functionality again to remove NetAxis from it. Although certain functionality may not be security-critical, in some cases, this could pose a problem.

To safeguard native modules from future patching, the `protectCore: true` option can be set. By default, this functionality is disabled for compatibility reasons, but enabling it is recommended.

### Global Instance Protection

When `globalize(...)` function is called, by default NetAxis wouldn't allow to detach instance from global scope. This behavior can be disabled by setting `protectGlobal: false`.

### Readonly List

By default, list in the instance is protected. Can be disabled with `readonly: false`.

## More examples

### Override mode

```js
import { DnsOverride } from "@netaxis/dns-override";
import { SslPinning } from "@netaxis/ssl-pinning";

const netx = new NetAxis({
  list: {
    "example.net": {
      ip: "93.184.215.14",
      pin: "4DA25A6D5EF62C5F95C7BD0A73EA3C177B36999D",
    },
  },
  overrideAll: false,
  debug: true,
});

netx.use(DnsOverride);
netx.use(SslPinning);

const res = await fetch(url);

/** Logs
[07:36:22.848] [info] Looking DNS records for example.net
[07:36:22.852] [info] Associations found for example.net, sending them instead of real DNS records
[07:36:23.174] [info] General SSL security checks are enabled on host example.net
[07:36:23.175] [info] General SSL security checks of host example.net passed
[07:36:23.175] [info] Host example.net expects pin 4DA25A6D5EF62C5F95C7BD0A73EA3C177B36999D
[07:36:23.175] [info] SSL pins found for example.net, doing checks
 */
```
