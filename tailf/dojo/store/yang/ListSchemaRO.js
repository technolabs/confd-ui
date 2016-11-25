// FIXME : Remove this class
// Based on dojo/store/JsonRest.js

define('tailf/dojo/store/yang/ListSchemaRO', [

    'dojo/_base/declare',
    'dojo/_base/Deferred',
    'dojo/store/util/QueryResults',

    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper'

], function(declare, Deferred, QueryResults, JsonRpc, JsonRpcHelper) {

// No base class, but for purposes of documentation, the base class is dojo/store/api/Store
var base = null;
/*===== base = Store; =====*/


return declare('ncs.store.yang.ListSchemaRO', base, {

    schema : null,
    fields : [],

    constructor : function(options) {
        declare.safeMixin(this, options);
    },

    query : function(query, options) {
        var me = this;

        var deferred = new Deferred();

        JsonRpcHelper.read().done(function(th) {
            me._read(th, deferred);
        });

        return QueryResults(deferred);
    },

    _read : function(th, deferred) {
        var me = this;

        var xpathExpr = me.schema.getName();
        var contextNode = me.schema.getParentKeypath();

        var leafs = me.fields;


        JsonRpcHelper.query({
            th             : th,
            xpath_expr     : xpathExpr, //'device',
            selection      : leafs,
            chunk_size     : 10,
            initial_offset : 1,
            context_node   : contextNode, //'/ncs:devices',
            result_as      : 'string'
        }).done(function(result) {
            result = me._buildReadResult(leafs, result);
            deferred.resolve(result);
        });

        /*
        JsonRpc('query_start', {
            th             : th,
            xpath_expr     : xpathExpr, //'device',
            selection      : leafs,
            chunk_size     : 10,
            initial_offset : 1,
            context_node   : contextNode, //'/ncs:devices',
            result_as      : 'string'
        }).done(function(result) {

            JsonRpc('query_result', {'qh' : result.qh}).done(function(queryResult) {
                var result = me._buildReadResult(leafs, queryResult);

                deferred.resolve(result);

                JsonRpc('query_stop', {qh : result.qh}).done(function() {
                });
            });
        });*/
    },

    _buildReadResult : function(leafs, queryResult) {
        var qr = queryResult;
        var ret = [];

        _.each(qr.results, function(r) {
            var row = {};

            _.each(leafs, function(leaf, ix) {
                row[leaf] = r[ix];
            });

            ret.push(row);
        });

        return ret;
    }

});

});
