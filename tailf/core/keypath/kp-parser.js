define('tailf/core/keypath/kp-parser', [
    'lodash',
    'tailf/core/logger',
    'tailf/core/keypath/kp-parser-gen'
], function(_, logger, pg) {

function _flatten(items, acc) {

    _.each(items, function(item) {
        if (_.isArray(item)) {
            _flatten(item, acc);
        } else {
            acc.push(item);
        }
    });

    return acc;
}

function _genTokensToTokens(gts) {
    var ret = [];

    /* jshint maxcomplexity:11 */
    _.each(_flatten(gts, []), function(gt) {

        /*jshint noempty: false */
        if (gt === null) {
            // Optional rule
        } else {
            var item = {
                type   : gt.type,
                text   : gt.text,
                offset : gt.offset
            };

            if (gt.type === 'name_sep') {
                item.type = '/';
            } else if (gt.type === 'ns') {
                item.type = 'ns';
            } else if (gt.type === 'ns_sep') {
                item.type = ':';
            } else if (gt.type === 'name') {
                // Do nothing
            } else if (gt.type === 'key') {
                if (gt.ns !== undefined) {
                    item.ns = gt.ns;
                }

                if (gt.key !== undefined) {
                    item.key = gt.key;
                }
            } else if (gt.type === 'key_lc') {
                item.type = '{';
                item.text = '{';
            } else if (gt.type === 'key_rc') {
                item.type = '}';
                item.text = '}';
            }

            ret.push(item);
        }
    });

    return ret;
}

// -----------------------------------------------------------------------------

function parse(txt) {
    var result;
    var genTokens;
    var tokens;
    var message;
    var errorOffset;

    try {
        genTokens = pg.parse(txt);
        tokens = _genTokensToTokens(genTokens);

        var status = 'ok';

        // Not complete errors
        if (tokens.length > 0) {
            var lastToken = tokens[tokens.length - 1];

            if (lastToken.type === ':') {
                status = 'SyntaxError';
                errorOffset = lastToken.offset;
            } else if (lastToken.type === '{') {
                status = 'SyntaxError';
                errorOffset = lastToken.offset;
            } else if (lastToken.type === 'key') {
                status = 'SyntaxError';
                errorOffset = lastToken.offset;
            }
        }

        result = {
            status : status,
            tokens : tokens,
            debug  : {
                generatedTokens : genTokens
            }
        };

        if (errorOffset !== undefined) {
            result.errorOffset = errorOffset;
        }

        if (message !== undefined) {
            result.message = message;
        }

    } catch (e) {
        var validUpToIx = e.offset - 1;
        var validText = txt.substr(0, validUpToIx);

        result = {
            status      : e.name,
            message     : e.message,
            errorOffset : e.offset
        };

        if (validText === '') {
            result.tokens = [];
        } else {
            try {
                result.tokens = _genTokensToTokens(pg.parse(validText));
            } catch (ee) {
                result.tokens = [];
            }
        }
    }

    return result;
}

// FIXME : Test-cases
function tokensToStr(tokens) {
    var ret = '';

    _.each(tokens, function(t) {
        ret += t.text;
    });

    return ret;
}

// FIXME : Test-cases
function getLastNamespace(tokens) {
    var ret = '';

    // FIXME : Iterate from the end instead.
    _.each(tokens, function(t) {
        if (t.type === 'ns') {
            ret = t.text;
        }
    });

    return ret;
}

// -----------------------------------------------------------------------------
/*
 * Returns a 'UI ready' result, useful e.g. to generate a keypath
 * with separate clickable links.
 *
 * EXAMPLE : /foo:bar/part-1/li{one}
 *
 *    var result = parser.parse('/foo:bar/part-1/li{one}');
 *    var uip = parser.tokensToUIParts(result.tokens);
 *
 *    assert.deepEqual(uip, [{
 *        text    : "/",
 *        keypath : undefined
 *    }, {
 *        text    : 'foo:bar',
 *        keypath : '/foo:bar'
 *    }, {
 *        text    : "/",
 *        keypath : undefined
 *    }, {
 *        text    : 'part-1',
 *        keypath : '/foo:bar/part-1'
 *    }, {
 *        text    : "/",
 *        keypath : undefined
 *    }, {
 *        text    : 'li',
 *        keypath : '/foo:bar/part-1/li'
 *    }, {
 *        text    : '{',
 *        keypath : undefined
 *    }, {
 *        text    : 'one',
 *        keypath : '/foo:bar/part-1/li{one}'
 *    }, {
 *        text    : '}',
 *        keypath : undefined
 *    }]);
 *
 */
function tokensToUIParts(tokens) {
    var ret = [];
    var currentKeypath = '';
    var currentName = '';
    var currentKey = '';

    var prevItem;
    var prevToken;

    function _push(item) {
        prevItem = item;
        ret.push(item);
    }

    _.each(tokens, function(token) {
        if (prevToken && (token.type !== '}') && (prevToken.type === 'key')) {
            currentKeypath += ' ';
        }

        currentKeypath += token.text;

        if (token.type === '/') {
            _push({
                text    : token.text,
                keypath : undefined
            });

        } else if (token.type === '{') {
            currentKey = '';
            _push({
                text    : token.text,
                keypath : undefined
            });
        } else if (token.type === '}') {
            _push({
                text    : currentKey,
                keypath : currentKeypath
            });

            _push({
                text    : token.text,
                keypath : undefined
            });

        } else if (token.type === 'key') {
            if (currentKey !== '') {
                currentKey += ' ';
            }
            currentKey += token.text;
        } else {
            currentName += token.text;

            if (token.type === 'name') {
                _push({
                    text    : currentName,
                    keypath : currentKeypath
                });

                currentName = '';
            }
        }

        prevToken = token;
    });

    return ret;
}

// -----------------------------------------------------------------------------

return {
    parse            : parse,
    tokensToStr      : tokensToStr,
    getLastNamespace : getLastNamespace,
    tokensToUIParts  : tokensToUIParts
};

});
