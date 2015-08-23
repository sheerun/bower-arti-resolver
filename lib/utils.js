var semver = require('semver');
var createError = require('./createError');
var string = require('mout/string');

var ARTIFACTORY_PREFIX = "art://";

function clean(version) {
    var parsed = semver.parse(version);

    if (!parsed) {
        return null;
    }

    // Keep builds!
    return parsed.version + (parsed.build.length ? '+' + parsed.build.join('.') : '');
}

function releases(tags) {
    return tags.map(function (tag) {
        return {
            release: clean(tag.tag) || tag.tag,
            target: tag.tag,
            version: clean(tag.tag)
        };
    });
};

function tags(refs) {
    var tags = [];

    // For each line in the refs, match only the tags
    refs.forEach(function (line) {
        var match = line.match(/^([a-f0-9]{44})\s+refs\/tags\/(\S+)/);

        if (match && !string.endsWith(match[2], '^{}')) {
            tags.push({ tag: match[2], commit: match[1] })
        }
    });

    return tags;
};

function extractRefs(response) {
    return response
        .trim() // Trim trailing and leading spaces
        .split(/[\r\n]+/);
}

function extractReleases(response) {
    return releases(tags(extractRefs(response)));
}

function getRegistryUrl(config) {
    var registryUrl = config.registry.register;

    if (registryUrl.indexOf('artifactory') > -1) {
        return config.registry.register;
    }

    config.registry.search.forEach(function (searchRegistry) {
        if (searchRegistry.indexOf('artifactory') > -1) {
            return searchRegistry;
        }
    });

    throw createError('Artifactory registry not configured', 'ENOCONFIG', {
        details: 'You need to set Artifactory registry in config.registry.register or config.registry.search of .bowerrc'
    });
};

function getRepositoryName(source) {
    var match = source.replace(ARTIFACTORY_PREFIX, "").split("/")

    if (match.length < 2) {
        throw createError('Invalid Artifactory Package Name', 'EINVEND', {
            details: source + ' does not seem to be a valid Artifactory package name!'
        });
    }

    return match[0] + "/" + match[1];
};

exports.clean = clean;
exports.extractReleases = extractReleases;
exports.getRegistryUrl = getRegistryUrl;
exports.getRepositoryName = getRepositoryName;
exports.ARTIFACTORY_PREFIX = ARTIFACTORY_PREFIX;
