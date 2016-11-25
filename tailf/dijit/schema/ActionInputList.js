define([
    'jquery',
    'lodash',

    'dojo/dom-class',
    'dojo/_base/declare',
    'dojo/query',
    'dojo/store/Memory',

	'dijit/_WidgetBase',
	'dijit/_TemplatedMixin',
    'dijit/_Container',

    'dijit/form/_FormValueWidget',
    'dijit/form/Button',

	'dojo/text!./templates/ActionInputList.html',

    'tailf/core/logger',
    'tailf/core/yang/schema/Schema',

    'gridx/core/model/cache/Sync',
    'gridx/Grid',
    'gridx/modules/CellWidget',
    'gridx/modules/Edit'
], function(

    $, _,
    domClass, declare, query, Memory,

    _WidgetBase, _TemplateMixin, _Container, _FormValueWidget, Button,

    template,

    logger, Schema,

    Cache, Grid, CellWidget, Edit
) {


return declare([_WidgetBase, _TemplateMixin, _Container], {
	templateString: template,

    postCreate : function() {
        var me = this;

        this.inherited(arguments);
        var $t = $(this.domNode);
        var $header = $t.find('label');

        if (me.title) {
            $header.text(me.title);
        }

        var $tc = $t.find('tr.input-row div.table-container');
        me._addTable($tc, me.schema);
    },


    _addTable : function(parentNode, schema) {
        var me = this;
        var children = schema.getRawChildren();

        var structure = [
        ];

        _.each(children, function(child) {
            structure.push({
                id : child.name,
                name : child.name,
                field : child.name,
                editable : true
            });
        });

        var store = new Memory({
            data : []
        });

        var grid = Grid({
            //id: 'grid',
            cacheClass: Cache,
            store: store,
            structure: structure,

            style : 'width:100%;height:200px;',
            modules: [
                CellWidget,
                Edit
            ]
        });

        var addButton = new Button({
            'class'   : 'tailf-action-input-list-add-button',
            showLabel : false,
            iconClass : 'icon-plus',
            onClick : function() {
                me._grid.store.add({});
            }
        });

        me.addChild(addButton);
        setTimeout(function() {
            grid.startup();
            me.addChild(grid);
        });

        this._grid = grid;
    },

    getActionValues : function() {
        var ret = [];
        var cols = [];

        _.each(this._grid.structure, function(col) {
            cols.push(col.field);
        });

        _.each(this._grid.store.data, function(d) {
            var item = {};
            _.each(cols, function(col) {
                var v;

                if (d[col] && (typeof d[col] === 'string')) {
                    v = d[col].trim();
                }

                if (v) {
                    item[col] = v;
                }

            });

            if (!_.isEmpty(item)) {
                ret.push(item);
            }
        });

        return ret;
    }

});

});

