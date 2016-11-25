define([
    'jquery',
    'lodash',

    'dojo/_base/declare',
    'dojo/dom-construct',
    'dijit/_TemplatedMixin',
    'dijit/layout/ContentPane',

    '../core/logger',

    'dojo/text!./templates/DiffOutput.html'
], function(
    $, _,

    declare, domConstruct, _TemplatedMixin,
    ContentPane,

    logger,
    template
) {

function _cliCol(cls, txt) {
    return $('<td>').addClass(cls).append(
        $('<div>').text(txt)
    );
}

function _cliLineNumberCol(cls, txt, lineIx) {
    var tr = _cliCol(cls, txt);
    tr.data('line', {
        ix : lineIx
    });

    return tr;
}

var DiffOutput = declare([ContentPane, _TemplatedMixin], {
    templateString : template,

    destroy : function() {
        // logger.error('DiffOutput.destroy : 00 : this=', this);
        this.inherited(arguments);
        // logger.error('DiffOutput.destroy : 10');
        this.destroyed = true;
    },

    postCreate : function() {
        var me = this;
        this.inherited(arguments);

        var search = $(me.domNode).find('div.search input').focus();

        search.keyup(function(evt) {
            if (evt.keyCode === 13) {
                logger.debug('keyup : ENTER : evt=', evt);
                logger.debug('val=', search.val());
                me._search(search.val());
            }
        });

        setTimeout(function() {
            search.focus();
        });
    },

    setCliContent : function(content) {
        this.setCliRows(content.split('\n'), []);
    },

    setCliRows : function(rows, collapseInfo) {
        var me = this;
        //var rows = content.split('\n');

        this.rows = rows;
        this.collapseInfo = collapseInfo;
/*
        me._collapseInfo = [
            {fromLine : 1,   toLine: 70, collapsed : true},
            {fromLine : 8,   toLine: 22, collapsed : true},
            {fromLine : 23,  toLine: 37, collapsed : true},
            {fromLine : 38,  toLine: 52, collapsed : true},
            {fromLine : 53,  toLine: 67, collapsed : true},

            {fromLine : 71,  toLine: 140, collapsed : true},

            {fromLine : 141, toLine: 210, collapsed : true},
            {fromLine : 211, toLine: 280, collapsed : true},
            {fromLine : 281, toLine: 350, collapsed : true},
            {fromLine : 351, toLine: 420, collapsed : true},
            {fromLine : 421, toLine: 491, collapsed : true}
        ];
*/
        me._clearContent();
        me._addCliContent(rows, '');
    },

    _search : function(searchText) {
        this._clearContent();
        this._addCliContent(this.rows, searchText);
    },


    _clearContent : function() {
        $(this.domNode).find('tbody').empty();
    },

    _addCliContent : function(rows, searchText) {
        var me = this;
        var body = $($(me.domNode).find('tbody')[0]);

        if (searchText.length > 0) {
            searchText = RegExp(searchText, 'g');
        }

        _.each(rows, function(row, rowIx) {
            me._addOneCliRow(body, rowIx, row, searchText);
        });


        body.find('td.cli-left-col-number').click(function(evt) {
            var target = $(evt.target);

            if (!target.is('tr')) {
                target = $(target.parent());
            }

            var d = target.data('line');
            var ci = me._getRowCollapseInfo(me.collapseInfo, d.ix);

            if (ci.collapsed) {
                ci.collapsed = false;
            } else {
                ci.collapsed = true;
            }

            me._clearContent();
            me._addCliContent(me.rows, searchText);
        });
    },

    /* jshint maxcomplexity:13 */
    _addOneCliRow : function(body, rowIx, row, search) {
        var tr;

        var ci = this._getRowCollapseInfo(this.collapseInfo, rowIx);
        var extraLineClass = '';
        var rowIxStr = rowIx.toString();
        var searchHit = false;

        if (_.isString(search)) {
            // String
            if ((search.length > 0) && (row.search(search) >= 0)) {
                searchHit = true;
            }
        } else if ( search && (row.search(search) >= 0)) {
            // RegExp
            searchHit = true;
        }

        if (ci && ci.collapsed) {
            if ((rowIx > ci.fromLine) && !searchHit) {
                return;
            }

            if (rowIx === ci.fromLine) {
                extraLineClass = 'collapse-first-row';
                rowIxStr += ' >';
                row += ' ...';
            }

        } else if (ci && !ci.collapsed) {
            if (rowIx === ci.fromLine) {
                rowIxStr += ' <';
            }
        }

        if (searchHit) {
            extraLineClass += ' search-hit';
        }

        var rowArgs = {
            body           : body,
            rowIx          : rowIx,
            rowIxStr       : rowIxStr,
            row            : row,
            extraLineClass : extraLineClass,
            collapseInfo   : ci
        };

        if (row.length === 0) {
            tr = this._getCliBothRow(rowArgs);
        } else if (row[0] === '+') {
            rowArgs.row = row;
            tr = this._getCliAddRow(rowArgs);
        } else if (row[0] === '-') {
            rowArgs.row = row;
            tr = this._getCliDeleteRow(rowArgs); // body, rowIx, row.substr(1));
        } else {
            tr = this._getCliBothRow(rowArgs);
        }

        body.append(tr);
    },

    _getCliBothRow : function(args) {
        var body = args.body;
        var rowIx = args.rowIx;
        var rowIxStr = args.rowIxStr;
        var row   = args.row;

        var tr = $('<tr>').addClass('cli-both').append(
                //_cliCol('cli-left-col-number', rowIxStr),
                _cliLineNumberCol('cli-left-col-number', rowIxStr, rowIx),
                _cliCol('cli-left-col', row),
                _cliCol('cli-right-col', row)
            );

        if (args.extraLineClass) {
            tr.addClass(args.extraLineClass);
        }

        return tr;
    },

    _getCliAddRow : function(args) {
        var body = args.body;
        var rowIx = args.rowIx;
        var rowIxStr = args.rowIxStr;
        var row = args.row;

        var tr = $('<tr>').addClass('cli-add').append(
                _cliLineNumberCol('cli-left-col-number', rowIxStr, rowIx),
                _cliCol('cli-left-col cli-add', ''),
                _cliCol('cli-right-col cli-add', row)
            );

        if (args.extraLineClass) {
            tr.addClass(args.extraLineClass);
        }

        return tr;
    },

    _getCliDeleteRow : function(args) { //body, rowIx, row) {
        var body = args.body;
        var rowIx = args.rowIx;
        var rowIxStr = args.rowIxStr;
        var row = args.row;

        var tr = $('<tr>').addClass('cli-delete').append(
                _cliLineNumberCol('cli-left-col-number', rowIxStr, rowIx),
                _cliCol('cli-left-col cli-delete', row),
                _cliCol('cli-right-col cli-delete', '')
            );

        if (args.extraLineClass) {
            tr.addClass(args.extraLineClass);
        }

        return tr;
    },


    _getRowCollapseInfo : function(collapseInfo, lineIx) {
        var ret;
        if (_.isArray(collapseInfo)) {
            _.each(collapseInfo, function(ci) {
                if ((lineIx >= ci.fromLine) && (lineIx <= ci.toLine)) {
                    ret = ci;
                    //logger.debug('_getRowCollapseInfo : lineIx=' + lineIx + ' : ret=', ret);

                    if (ci.collapsed === true) {
                        return false;
                    }
                } else if (ret && (lineIx > ret.toLine)) {
                    return false;
                }
            });
        }

        return ret;
    }
});

return DiffOutput;

});
