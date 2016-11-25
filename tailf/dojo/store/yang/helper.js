define('tailf/dojo/store/yang/helper', [
    'lodash'
], function(_) {

function m_objKeypath(keypath, keyNames, obj) {
    var keys = '';

    _.each(keyNames, function(key) {
        if (keys.length > 0) {
            keys += ' ';
        }

        keys += '"' + obj[key] + '"';
    });

    return keypath + '{' + keys + '}';
}

return {
    objKeypath : m_objKeypath
};

});
