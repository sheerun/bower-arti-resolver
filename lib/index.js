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
 * Returns an instance of resolver
 *
 *  @param {object} options, currently passed ones are:
 *
 *   config - bower configuration object
 *   logger - bower logger instance
 *
 *  @return {Resolver}
 */
function Resolver (options) {
    if (!(this instanceof Resolver)) {
        return new Resolver(options);
    }

    this.config = options.config;
}

/**
 * Tells whether resolver can support given source
 *
 * @param {string} source
 * @return {boolean}
 */
Resolver.prototype.matches = function (source) {
    return source.indexOf(ARTIFACTORY_PREFIX) === 0;
}

/**
 * Fetches list of available releases for given package.
 *
 * Proper semver releases have non-black "version" field.
 *
 * @param {string} source
 * @return {[{ release, target, version }]}
 */
Resolver.prototype.releases = function (source) {
    var registryUrl = utils.getRegistryUrl(this.config);
    var pair = utils.getOrgRepoPair(source)

    var requestUrl = registryUrl + '/refs/' + pair.org + '/' + pair.repo;

    return request(requestUrl, this.config).then(function (response) {
        return {
            releases: utils.extractReleases(response)
        }
    });
};

/**
 * Fetches given target to temporary directory and returns the path to it
 *
 * @param {string} source
 * @param {string} release
 * @param {object} options
 *
 *  options.cached - cached package
 *    source
 *    target
 *    version
 *    release
 *
 *  options.releases - result of targets method call
 *
 * @return {object|undefined}
 *
 *   contents
 *
 *     Temporary directory with fetched package
 *
 *   Returns undefined if bower should re-use existing package
 */
Resolver.prototype.contents = function (source, release, options) {
    // If there's cached version and it's semver, reuse it.
    if (options.cached && options.cached.version) return;

    var registryUrl = utils.getRegistryUrl(this.config);
    var pair = utils.getOrgRepoPair(source)

    var requestUrl = registryUrl + '/binaries/' + pair.org + '/' + pair.repo + '.git/' + release;

    var downloadPath = tmp.dirSync();

    return download(requestUrl, downloadPath.name, this.config)
        .then(function (file) {
            var extractPath = tmp.dirSync();

            return extract(file, extractPath.name).then(function () {
                downloadPath.removeCallback();

                return {
                    contents: extractPath.name
                };
            });
        });
}

module.exports = Resolver;
