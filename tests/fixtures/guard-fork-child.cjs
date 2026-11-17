process.send([process.env.NODE_USE_ENV_PROXY, process.env.HTTPS_PROXY, process.env.NO_PROXY]);
process.exit(0);
