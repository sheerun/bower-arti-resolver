var Q = require('q');
var url = require('url');
var string = require('mout/string');
var path = require('path');
var tmp = require('tmp');
var semver = require('semver');

var request = require('./request');
var download = require('./download');
var extract = require('./extract');
var utils = require('./utils');
var createError = require('./createError');

var ARTIFACTORY_PREFIX = "art://";

tmp.setGracefulCleanup();

/**
 * The factory returning an instance of Resolver.
 *
 * @param {object} config
 * @param {BowerLogger} logger
 */
function Resolver(config, logger) {
    this._config = config;
    this._logger = logger;
}

/**
 * Returns whether Resolver supports given source
 *
 * @param {string} source
 * @return {boolean}
 */
Resolver.prototype.matches = function (source) {
    return source.indexOf(ARTIFACTORY_PREFIX) === 0;
}


/**
 * Fetches list of available versions for given package
 *
 * @param {string} source
 * @return {Promise<[{ target: string, version: string }]>}
 */
Resolver.prototype.versions = function (source) {
    var registryUrl = utils.getRegistryUrl(this._config);
    var pair = utils.getOrgRepoPair(source)

    var requestUrl = registryUrl + '/refs/' + pair.org + '/' + pair.repo;

    return request(requestUrl, this._config).then(function (response) {
        return utils.extractVersions(response);
    });
};

/**
 * @param {string} source
 * @param {string} target
 * @param {Resolution} oldResolution - the Resolution returned from previous fetch
 * @return {Promise<{ directory: string, resolution: Resolution }>} Promise that resolves with temporary directory with fetched package
 * @return undefined If fetch returns undefined, it means to re-use oldResolution
 */
Resolver.prototype.fetch = function (source, target, oldResolution) {
    var registryUrl = utils.getRegistryUrl(this._config);
    var pair = utils.getOrgRepoPair(source)

    var requestUrl = registryUrl + '/binaries/' + pair.org + '/' + pair.repo + '.git/' + target;

    return Q.fcall(function () {
        // There is no cached resource yet, so just fetch
        if (!oldResolution) return false;

        // If cached resource is not semver, re-fetch it by default
        return oldResolution.version !== undefined;
    }).then(function (useCached) {
        if (useCached) return;

        var downloadPath = tmp.dirSync();
        var extractPath = tmp.dirSync();

        return download(requestUrl, downloadPath.name, this._config)
            .then(function (file) {
                return extract(file, extractPath.name).then(function () {
                    downloadPath.removeCallback();

                    var resolution = {
                        source: source,
                        target: target
                    }

                    if (semver.valid(target)) {
                        resolution.version = utils.clean(target);
                    }

                    return {
                        contents: extractPath.name,
                        resolution: resolution
                    }
                });
            })
    });
}

/**
 * Constructor for resolver instance.
 *
 * @param {object} options for Resolver that can optionally be used by any method.
 *
 * Currently supported:
 *
 *  config - configuration object of bower
 *  logger - instance of bower-logger
 */
module.exports = function (options) {
    return new Resolver(options.config, options.logger);
};
