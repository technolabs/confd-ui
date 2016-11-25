define([
    'lodash'
], function(
    _
) {

// NOTE : Originally used webstorage, rename eventually
var _storage = {
    leafs : {
    }
};

function m_setLeafValue(path, value) {
    if (_.isString(value)) {
        value = value.trim();
    }

    _storage.leafs[path] = value;
}

function m_getLeafValue(path) {
    return _storage.leafs[path];
}

function m_hasLeafValue(path) {
    return _storage.leafs[path] !== undefined;
}

function m_getMatchingPrefixLeafValues(prefix) {
    var ret = [];

    _.each(_storage.leafs, function(value, key) {
        if (key.indexOf(prefix) === 0) {
            ret.push({
                path  : key,
                value : value
            });
        }
    });

    return ret;
}

return {
    setLeafValue : m_setLeafValue,
    getLeafValue : m_getLeafValue,
    hasLeafValue : m_hasLeafValue,
    getMatchingPrefixLeafValues : m_getMatchingPrefixLeafValues
};

});
