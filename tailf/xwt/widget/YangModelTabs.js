define('tailf/xwt/widget/YangModelTabs', [
    'jquery',
    'lodash',

    'dojo',
    'dojo/dom-construct',
	'dojo/dom-style',
    'dojo/_base/declare',
    'dojo/data/ObjectStore',
    'dojo/store/Memory',

    'dijit/registry',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/layout/ContentPane',
    'dijit/Tooltip',
    'dijit/form/Button',
    'dijit/layout/_LayoutWidget',

    'xwt/widget/layout/XwtContentPane',
    'xwt/widget/layout/XwtTabContainer',

    'tailf/global',
    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcHelper',
    'tailf/core/protocol/JsonRpcErr',

    'tailf/dijit/render-hints',
    'tailf/dijit/schema/ModelContainer',
    'tailf/dijit/schema/web-storage',

    './schema/Table',

    'dojo/store/Memory',
    'gridx/core/model/cache/Sync',
    'gridx/Grid'

],
function(
    $, _,

    dojo, domConstruct, domStyle, declare,
    ObjectStore, MemoryStore,

    registry, _WidgetBase, _TemplatedMixin,
    ContentPane, Tooltip,
    Button, _LayoutWidget,

    XwtContentPane, XwtTabContainer,

    TailfGlobal, logger, JsonRpc, JsonRpcHelper, JsonRpcErr,

    renderHints, ModelContainer, schemaStorage,
    SchemaTable,

    Memory, Cache, Grid
){
    var _nofGridColumns = 4;

    var _iconClassInfo = 'icon-desktop';
    var _iconClassContainer = 'icon-folder-close-alt';
    var _iconClassList      = 'icon-list-view';
    var _iconClassAction    = 'icon-gear';

    return declare([_LayoutWidget], {

        // Object with the following functions
        //   getModelHref(keypath)
        //   navigateToHref(href)
        href   : undefined,

        inlineEditFactory : undefined,
        dialogFactory     : undefined,


        _tabContainer   : undefined,
        _currentKeypath : undefined,
        _tabsState      : {},

        postCreate : function() {
            this.inherited(arguments);
            this.actionResultGrid = undefined;
        },

        destroy : function() {
            this.inherited(arguments);
        },

        moveToKeypath : function(keypath) {
            this.destroyDescendants();

            this._currentKeypath = keypath;

            this._createWidgets(keypath).done(function() {
            });
        },

        _createWidgets : function(keypath) {
            var me = this;
            var deferred = $.Deferred();

            var namespace = '';
            var path = keypath;
            var genericPath = renderHints.genericPath(keypath);
            var ch = renderHints.getContainerHints(genericPath);
            var insertValues = ch.insertValues;

            JsonRpcHelper.read().done(function(th) {
                JsonRpcHelper.getSchema(th, namespace, path, 1, insertValues)
                    .done(function(schema) {
                        var header = me._getHeaderWidget(schema);
                        me.addChild(header);

                        me._createTabWidgetsMain(th, schema);

                        deferred.resolve();
                    })
                    .fail(function(err) {
                        logger.error('getSchema failed! err=', err);
                    });
            });

            return deferred.promise();
        },

        _getHeaderWidget : function(schema) {
            var content = '';
            var kp = schema.getKeypath();

            content += '<div class="schema-path">';
            content += TailfGlobal.keypathRenderer().html(kp);
            content += '</div>';

            content += '<div class="schema-info">';
            content += schema.getInfo();
            content += '</div>';

            var header = new ContentPane({
                'class' : 'tailf-xwt-yang-model-tabs-header',
                content : content
            });


            return header;
        },

        _createTabWidgetsMain : function(th, schema) {
            var me = this;

            var tc = new XwtTabContainer({
                // Note: Class name order important!
                baseClass : 'tailf dijitTabContainer',

                style: 'height: 100%; width: 100%;'
            });

            tc.watch('selectedChildWidget', function(name, oval, nval){
                me._tabSelected(oval, nval);
            });

            me._tabContainer = tc;

            var kind = schema.getKind();
            var pane;

            if (kind === 'list') {
                pane = me._createChildTabWidget(tc, 1, schema);
                tc.addChild(pane);

                me._tabSelected(undefined, pane);
            } else if (kind === 'action') {
                pane = me._createChildTabWidget(tc, 1, schema);
                tc.addChild(pane);

                me._tabSelected(undefined, pane);
            } else {
                me._createTabWidgetsDefaultMain(th, schema, tc);
            }

            me.addChild(tc);
            tc.startup();
        },

        _createTabWidgetsDefaultMain : function(th, schema, tabContainer) {
            var me = this;
            var tc = tabContainer;

            var kind = schema.getKind();
            var addInfoTab = kind === 'list-entry';

            me.tabInfo = [];

            function _addInfoTab() {
                var leafs = [];

                _.each(schema.getChildren(), function(child) {
                    var kind = child.getKind();

                    if ((kind !== 'container') && (kind !== 'list')) {
                        leafs.push(child);
                    }
                });

                var pane = me._createInfoTabWidget(tc, schema, leafs);

                me.tabInfo.unshift({
                    pane          : pane,
                    ns            : schema.getNamespace(),
                    path          : schema.getQualifiedName(),
                    parentKeypath : schema.getKeypath(),
                    keypath       : null //child.getKeypath()
                });

                //tc.addChild(pane);
            }

            var children = schema.getChildren();

            _.each(children, function(child, ix) {
                var kind = child.getKind();

                if ((kind === 'container') || (kind === 'list')) {
                    var pane = me._createChildTabWidget(tc, ix + 1, child);

                    me.tabInfo.push({
                        pane          : pane,
                        ns            : child.getNamespace(),
                        path          : child.getQualifiedName(),
                        parentKeypath : schema.getKeypath(),
                        keypath       : child.getKeypath()
                    });

                    //tc.addChild(pane);
                } else {
                    addInfoTab = true;
                }
            });

            if (me.tabInfo.length === 0) {
                // FIXME : Not bullet-proof, what about 'rouge' leafs apart from container and list
                _addInfoTab();
            } else if (addInfoTab) {
                _addInfoTab();
            }

            _.each(me.tabInfo, function(info, ix) {
                info.pane.yang.paneIx = ix;
                tc.addChild(info.pane);
            });


            setTimeout(function() {
                var paneIx = 0;
                var tabState = me._tabsState[me._currentKeypath];

                if (tabState && (tabState.currentIx < me.tabInfo.length)) {
                    paneIx = tabState.currentIx;
                }

                // FIXME : I don't understand why this is necessary
                if (paneIx === 0) {
                    me._tabSelected(undefined, me.tabInfo[paneIx].pane);
                } else {
                    me._tabContainer.selectChild(me.tabInfo[paneIx].pane);
                }
            });
        },

        _createInfoTabWidget : function(parentWidget, schema, leafs) {
            var cp = new ContentPane({

                'class'    : 'tailf-yang-tab-content tailf-yang-tab-content-info',
                region : 'center',

                //style : 'width: 100%;height:500px;', //background: red;',
                title         : schema.getName(),
                iconClass     : _iconClassInfo, //'icon-desktop',
                content       : 'INFO' // content
            });

            cp.yang = {
                parent : {
                    namespace : schema.getNamespace(),
                    keypath   : schema.getKeypath()
                },
                child : null,
                leafs : leafs
            };

            return cp;
        },

        _createChildTabWidget : function(parentWidget, ix, childSchema) {
            var me = this;

            var child = childSchema;

            var kind = child.getKind();
            var content = '';

            var iconClass = _iconClassContainer;

            if (kind === 'list') {
                iconClass = _iconClassList;
            } else if (kind === 'action') {
                iconClass = _iconClassAction;
            }

            var cp = new ContentPane({
                'class'    : 'tailf-yang-tab-content',
                //style      : 'width: 100%;height:500px;', //background: red;',
                title      : child.getName(),
                iconClass  : iconClass,
                content    : content
            });

            // FIXME : Questionable creation of instance data, is this really ok???
            cp.yang = {
                paneIx : undefined,
                child : child
            };

            setTimeout(function() {
                var tt = new Tooltip({
                    // FIXME : tooltip id calculation somewhat brittle,
                    //         based on reverse-engineering of the DOM
                    connectId : [parentWidget.tablist.id + '_' + cp.id],
                    label     : child.getInfo()
                });
            });

            return cp;
         },

        _tabSelected : function(fromContent, toContent) {
            var me = this;

            if (fromContent !== undefined) {
                fromContent.destroyDescendants();
            }

            JsonRpcHelper.read().done(function(th) {
                toContent.destroyDescendants();

                var tabState = me._tabsState[me._currentKeyPath];
                if (!tabState) {
                    tabState = {
                        currentIx : undefined
                    };

                    me._tabsState[me._currentKeypath] = tabState;
                }

                tabState.currentIx = toContent.yang.paneIx;

                me._fillPaneWithModel(th, toContent).done(function() {
                });
            });
        },

        _fillPaneWithModel : function(th, pane) {
            var me = this;
            var deferred = $.Deferred();
            var yc = pane.yang.child;
            var ns;
            var path;

            setTimeout(function() {
            });

            if (pane.yang.leafs) {
                // Special info pane
                ns = pane.yang.parent.namespace;
                path = pane.yang.parent.keypath;

                JsonRpcHelper.getSchema(th, ns, path, 1, false)
                    .done(function(schema) {
                         me._fillPaneWithInfoLeafsMain(th, pane, schema, pane.yang.leafs);
                         deferred.resolve();
                    });
            } else {
                // Pane with schema
                ns = yc.getNamespace();
                path = yc.getKeypath();

                var genericPath = renderHints.genericPath(path);
                var ch = renderHints.getContainerHints(genericPath);
                var insertValues = ch.insertValues;

                JsonRpcHelper.getSchema(th, ns, path, 1, insertValues, true)
                    .done(function(schema) {
                        me._fillPaneWithModelMain(th, pane, schema);
                        deferred.resolve();
                    });
            }

            return deferred.promise();
        },

        _fillPaneWithInfoLeafsMain : function(th, pane, parentSchema, leafs) {
            var me = this;
            pane.destroyDescendants();

            // --- Header pane
            var infoContent = '';

            infoContent += 'INFO' + '<br>';

            var headerPane = ContentPane({
                content : infoContent
            });

            var mainPane = new ModelContainer({
                nofColumns   : _nofGridColumns,
                th           : th,
                parentSchema : parentSchema,
                schemas      : leafs
            });

            pane.addChild(headerPane);
            pane.addChild(mainPane);

            headerPane.startup();
            mainPane.startup();

            this._fixTabContentPaneSize(pane, headerPane, mainPane);
        },

        _fillPaneWithModelMain : function(th, pane, schema) {
            var me = this;

            pane.destroyDescendants();

            var headerPane = this._getModelHeaderPane(schema);
            var mainPane = this._getModelMainPane(th, schema);

            pane.addChild(headerPane);
            pane.addChild(mainPane);

            headerPane.startup();
            mainPane.startup();

            this._fixTabContentPaneSize(pane, headerPane, mainPane);
        },

        _fixTabContentPaneSize : function(pane, headerPane, mainPane) {
            var me = this;

            this.contentPane = pane;
            this.headerPane = headerPane;
            this.mainPane = mainPane;

            setTimeout(function() {
                me.layout();
            });
        },

        layout : function() {
            //logger.warn('YMT.layout : 00');

            if (!this.contentPane) {
                //logger.warn('YMT.layout : !this.contentPane');
                return;
            }

            //logger.warn('YMT.layout : 10');
            var $d = $(this.domNode);
            //var $dtpw = $($(this.contentPane.domNode).closest('div.dijitTabPaneWrapper')[0]);
            var $dtpw = $($(this.domNode).find('div.dijitTabPaneWrapper')[0]);

            var $ymth = $($d.find('div.tailf-xwt-yang-model-tabs-header')[0]);
            var $tabs= $($d.find('div.dijitTabListContainer-top')[0]);

            //logger.warn('YMT.layout : d=', this.domNode);
            //logger.warn('YMT.layout : $dtpw=', $dtpw.get()[0]);
            //logger.error('YMT.layout : d.height()=', $d.height());
            //logger.error('YMT.layout : ymth.height()=', $ymth.height());
            //logger.error('YMT.layout : tabs.height()=', $tabs.height());

            var $cp = $(this.contentPane.domNode);
            var $hp = $(this.headerPane.domNode);
            var $mp = $(this.mainPane.domNode);

            //logger.error('YMT.layout : cp=', this.contentPane.domNode);
            //logger.error('YMT.layout : hp=', this.headerPane.domNode);
            //logger.error('YMT.layout : mp=', this.mainPane.domNode);

            //logger.error('YMT.layout : 7 : $cp.height()=', $cp.height());
            //logger.error('YMT.layout : 7 : $hp.height()=', $hp.height());
            //logger.error('YMT.layout : 7 : $mp.height()=', $mp.height());

            var h = $d.height() - $ymth.height() - $tabs.height();
            var w = $d.width() - 100;

            // FIXME : Why does this happen, e.g. navigation from specific device do sync-action
            if (($dtpw.height() < h)) {
                $dtpw.height(h);
            }

            var scp = {
                w : w,
                h : h
            };

            var mcp = {
                w : w,
                h : h - 10
            };

            //logger.error('YMT.layout : scp=', scp);
            //logger.error('YMT.layout : mcp=', mcp);

            this.contentPane.resize(scp);

            if (_.isFunction(this.mainPane.resize)) {
                this.mainPane.resize(mcp);
            }
        },

        _getModelHeaderPane : function(schema) {
            var infoContent = '';

            /*
            infoContent += schema.getKind();
            infoContent += '&nbsp; (';
            infoContent += this._getSchemaFlagsStr(schema);
            infoContent += ')<br>';
            */

            //infoContent += schema.getKeypath() + '<br>';
            infoContent += schema.getInfo();

            return new ContentPane({
                content : infoContent
            });
        },

        _getSchemaFlagsStr : function(schema) {
            var infoContent = '';

            if (schema.isOper()) {
                infoContent += 'oper';
            } else {
                infoContent += 'config';
            }

            if (schema.isMandatory()) {
                infoContent += ',&nbsp;mandatory';
            } else {
                infoContent += ',&nbsp;not&nbsp;mandatory';
            }

            /*
            if (schema.exists()) {
                infoContent += ',&nbsp;exist';
            } else {
                infoContent += ',&nbsp;DOESNT EXIST';
            }
            */

            return infoContent;
        },

        _getModelMainPane : function(th, schema) {
            var me = this;
            var kind = schema.getKind();
            var ret;

            if (kind === 'list') {
                return new SchemaTable({
                    schema            : schema,
                    th                : th,
                    href              : this.href,
                    inlineEditFactory : this.inlineEditFactory,
                    dialogFactory     : this.dialogFactory
                });
            } else if (kind === 'container') {
                ret = me._getContainerMainPane(th, schema);
            } else if (kind === 'action') {
                ret = me._getContainerActionPane(th, schema);
            } else {
                throw new Error('Unknown pane type "' + kind + '"');
            }

            return ret;
        },

        _getContainerMainPane : function(th, schema) {
            var me = this;

            var grid = new ModelContainer({
                nofColumns   : _nofGridColumns,
                th           : th,
                parentSchema : schema,
                schemas      : schema.getChildren()
            });

            return grid;
        },

        _getContainerActionPane : function(th, schema) {
            var me = this;

            var inputs = [];
            var outputs = [];

            _.each(schema.getChildren(), function(child) {
                // Only use action input
                if (child.isActionInput()) {
                    inputs.push(child);
                }
            });

            var cp = new ContentPane({
            });

            var gridInput = new ModelContainer({
                nofColumns   : _nofGridColumns,
                th           : th,
                parentSchema : schema,
                schemas      : inputs
            });

            var gridOutput = new ModelContainer({
                nofColumns   : _nofGridColumns,
                th           : th,
                parentSchema : schema,
                schemas      : outputs
            });

            var button = new Button({
                'class'   : 'tailf-invoke-action',
                iconClass : 'icon-gear',
                label     : 'Invoke ' + schema.getName(),

                onClick : function() {
                    me._runAction(th, schema.getKeypath(), gridInput, gridOutput);
                }
            });

            cp.addChild(gridInput);
            cp.addChild(button);
            cp.addChild(gridOutput);

            $(gridInput.domNode).addClass('tailf-action-input-parameters');
            $(gridOutput.domNode).addClass('tailf-action-output-parameters');

            setTimeout(function() {
                me._addActionResultGrid(gridOutput);
                me.layout();
            });

            return cp;
        },

        _addActionResultGrid : function(gridParent) {
            var structure = [
                {id: 'name', name : 'Name'},
                {
                    id: 'value',
                    name : 'Value',
                    decorator : function(data) {
                        var re = /\s*(https?:\/\/[^\s$]+)/;

                        if(re.test(data)) {
                            return data.replace(re, '<a href="$1">$1</a>');
                        } else {
                            return data;
                        }
                    }
                }
            ];

            var store = new Memory({
                data : []
            });

            var grid = Grid({
                id: 'grid',
                cacheClass: Cache,
                store: store,
                structure: structure,

                style : 'width:100%;height:200px;'
            });

            grid.startup();
            gridParent.addChild(grid);

            this.actionResultGrid = grid;
        },

        _runAction : function(th, keypath, input, output) {
            var me = this;
            var params = me._getActionInputParameters(keypath, input);

            if (_.isObject(params.__ui_error)) {
                TailfGlobal.messages().information(params.__ui_error.text);
                return;
            }

            function _errReason(err) {
                var ret = '';

                if (err.data) {
                    if (_.isString(err.data.reason)) {
                        ret += err.data.reason;
                    } else {
                        _.each(err.data.reason, function(r) {
                            // FIXME : Getting strange error message from server for some actions
                            // that fails, e.g. southbound locked devices

                            if (_.isNumber(r)) {
                                ret += String.fromCharCode(r);
                            } else {
                                ret += '<br>';
                                ret += r;
                            }
                        });
                    }
                }

                return ret;
            }

            JsonRpc('action', {
                th     : th,
                path   : keypath,
                params : params,
                format : 'normal'
            }).done(function(result) {
                me._setActionResult(result);
            }).fail(function(err) {
                if (JsonRpcErr.isRpcMethodFailedErr(err)) {
                    TailfGlobal.messages().error('Action failed', _errReason(err));
                } else {
                    TailfGlobal.messages().error('Action failed', JsonRpcErr.getInfo(err), err);
                }
            });
        },

        _setActionResult : function(result) {
            var data = [];

            if ((result === true) || (result === false)) {
                data = [{
                    id  : 1,
                    name : 'Result',
                    value : result
                }];
            } else {
                _.each(result, function(item, ix) {
                    data.push({
                        id    : ix + 1,
                        name  : item.name,
                        value : _.escape(item.value)
                    });
                });
            }

            var store = new Memory({
                data : data
            });

            this.actionResultGrid.setStore(store);
        },

        _getActionInputParameters : function(keypath, inputContainer) {
            /* jshint maxcomplexity:11 */
            var ret = {};

            ret = {
            };

            function _error(text) {
                ret.__ui_error = {
                    text : text
                };
            }

            var widgets = inputContainer.getWidgets();

            _.each(widgets, function(w) {
                var kind = w.stmt.getKind();

                // FIXME : Implement list.
                if (kind === 'leaf') {
                    var rt = w.stmt.getRawType();
                    var v = w.widget.getValue();

                    if (_.isString(v)) {
                        v = v.trim();
                    }

                    if (rt.isEmptyType()) {
                        if (v !== false) {
                            ret[w.stmt.getName()] = '';
                        }
                    } else if (v === '') {
                        if (w.stmt.isMandatory()) {
                            _error('Mandatory field "' + w.stmt.getName() + '" not set.');
                            return false;
                        }
                    } else {
                        ret[w.stmt.getName()] = v;
                    }

                } else if (kind === 'leaf-list') {
                    var llValues = w.widget.getValues();
                    if (llValues.length > 0) {
                        ret[w.stmt.getName()] = llValues;
                    }
                } else if (kind === 'list') {
                    var l = w.widget;
                    ret[w.stmt.getName()] = w.widget.getActionValues();
                } else if (kind === 'container') {
                    var matchingItems = schemaStorage.getMatchingPrefixLeafValues(keypath);

                    // {dry-run: {outformat: "cli"}}}
                    _.each(matchingItems, function(item) {
                        if (item.value !== '') {
                            var key = item.path.substr(keypath.length + 1);

                            // FIXME : Only handle 1 container level and leafs
                            var strs = key.split('/');

                            var subKey = strs[0];
                            var content = strs[1];

                            if (content.indexOf(':') >= 0) {
                                content = content.split(':')[1];
                            }

                            var value = {};
                            value[content] = item.value;

                            ret[subKey] = value;
                        }
                    });
                } else {
                    // FIXME : Handle more input types in actions
                    throw new Error('Can\'t handle "' + kind + '" in input parameters');
                }
            });

            return ret;
        }
    });
});

