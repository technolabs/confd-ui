define('tailf/dijit/schema/Factory', [
    'lodash',

    'dojo',
    'dojo/store/Memory',

    'dijit/layout/ContentPane',
    'dijit/Tooltip',
    'dijit/form/Button',
    'dijit/form/TextBox',
    'dijit/form/Select',
    'dijit/form/ComboBox',
    'dijit/form/CheckBox',

    'dojox/layout/TableContainer',

    'tailf/global',
    'tailf/core/util',
    'tailf/core/yang/Keypath',
    'tailf/dijit/ModelLink',
    'tailf/dijit/form/Select',
    'tailf/dijit/schema/web-storage',
    'tailf/dijit/schema/ChoiceSelect',
    'tailf/dijit/schema/LeafTextBox',
    'tailf/dijit/schema/LeafTextArea',
    'tailf/dijit/schema/LeafList',
    'tailf/dijit/schema/ActionInputList',
    'tailf/dijit/schema/DateAndTime',

    'tailf/core/logger',
    'tailf/core/protocol/JsonRpc',
    'tailf/core/protocol/JsonRpcErr',
    'tailf/core/protocol/JsonRpcHelper'
], function(
_,

dojo, MemoryStore,

ContentPane, Tooltip, Button, TextBox, Select, ComboBox, CheckBox,

TableContainer,

tailfGlobal, tailfCoreUtil, keypath,
ModelLink, TailfSelect, schemaStorage, ChoiceSelect,
LeafTextBox, LeafTextArea, LeafList, ActionInputList, DateAndTime,

logger, jsonRpc, jsonRpcErr, jsonRpcHelper) {

var _iconClassInfo      = 'icon-desktop';
var _iconClassContainer = 'icon-folder-close-alt';
var _iconClassList      = 'icon-list-view';
var _iconClassAction    = 'icon-gear';

var _leafRefSelectThreshold = 100;

var _href;

var _leafReadTimeoutMs = 5000;

function _trace() {
    logger.tracePrefix('Factory : ', arguments);
}

function _getDefaultContainerChildWidget(schema) {
    var child = schema;

    var content = '';
    var kind = child.getKind();

    content += child.getKind() + ' : ' + child.getName() + '<br>';
    content += child.getKeypath();

    return new ContentPane({
        content : content
    });
}

function _getLeafContainerItemWidget(args) {
    var me = this;

    var th = args.th;
    var parentSchema = args.parentSchema;
    var leafSchema = args.leafSchema;
    var readOnly = args.readOnly;

    var ls = leafSchema;

    var layout = new TableContainer({
        showLabels: true,
        orientation: 'vert'
    });

    var rti = leafSchema.getRawType();
    var leafType;

    var widget;

    var textArgs = args;
    var booleanArgs = args;

    if (rti.isPrimitive()) {
        var ptn = rti.getPrimitiveTypeName();

        if (ls.isLeafRef()) {
            widget = _getLeafItemWidgetLeafRef(textArgs);
        } else if (ptn === 'boolean') {
            widget = _getLeafItemWidgetBoolean(booleanArgs);
        } else if (ptn === 'empty') {
            widget = _getLeafItemWidgetEmpty(booleanArgs);
        } else if (ptn === 'date-and-time') {
            widget = _getLeafItemWidgetDateAndTime(textArgs);
        } else {
            widget = _getLeafItemWidgetText(textArgs);
        }
    } else {
        leafType = parentSchema.getTypeInfo(rti.getNamespace(), rti.getName());

        if (leafType.isEnum()) {

            if (readOnly) {
                widget = _getLeafItemWidgetText(textArgs);
            } else {
                var enumArgs = args;
                enumArgs.leafType = leafType;

                widget = _getLeafItemWidgetEnum(enumArgs);
            }

        } else {
            widget = _getLeafItemWidgetText(textArgs);
        }
    }

    var updateInfo;

    function _setUpdateInfo(widget) {
        updateInfo = {
            th       : th,
            widget   : widget,
            orgValue : undefined,

            keypath  : ls.getKeypath()
        };
    }

    function _connectWrite(widget) {
        function _update() {
            if (args.writeServerValue) {
                _leafUpdateServerValue(updateInfo);
            } else if (args.writeBrowserStorageValue) {
                _leafUpdateBrowserValue(updateInfo);
            }
        }

        if (args.writeServerValue || args.writeBrowserStorageValue) {
            if (_.isFunction(widget._setExplicitFactoryUpdate)) {
                widget._setExplicitFactoryUpdate(_update);
            } else {
                dojo.connect(widget, 'onBlur', function() {
                    if (ptn !== 'empty') {
                        _update();
                    }
                });
            }
        }
    }

    function _connectRead() {
        setTimeout(function() {
            if (args.readServerValue) {
                if (ptn !== 'empty') {
                    _leafSetValueFromServer(updateInfo);
                }
            } else if (args.readBrowserStorageValue) {
                if (ptn !== 'empty') {
                    _leafSetValueFromBrowserStorage(updateInfo);
                }
            }

            _leafAddTooltip(widget, leafSchema, leafType, rti);
        });
    }

    function _finalizeLayout(layout, widget) {
        layout.addChild(widget);
        layout.startup();

        layout.getValue = function() {
            return widget.getValue();
        };
    }

    if (tailfCoreUtil.isJQueryDeferred(widget)) {
        var ret = $.Deferred();

        var deferred = widget;

        deferred.done(function(_widget) {
            widget = _widget;
            _setUpdateInfo(widget);
            _connectWrite(widget);
            _connectRead();

            _finalizeLayout(layout, widget);
            ret.resolve(layout);
        });

        return ret;
    } else {
        _setUpdateInfo(widget);
        _connectWrite(widget);
        _connectRead();
        _finalizeLayout(layout, widget);

        return layout;
    }
}

function _leafUpdateServerValue(updateInfo) {
    var me = this;
    var v = updateInfo.widget.getValue();

    /*jshint eqeqeq: false*/
    if (v != updateInfo.orgValue) {
        jsonRpcHelper.write().done(function(th) {
            var keypath = updateInfo.keypath;
            jsonRpc('set_value', {
                th: th,
                path: keypath,
                value: v
            }).done(function(result) {
                updateInfo.orgValue = v;
                _setLeafValidValue(updateInfo.widget);
            }).fail(function(err) {
                if (err.type === 'rpc.method.unknown_params_value') {
                    _setLeafInvalidValue(updateInfo.widget, err.data.reason);
                } else {
                    logger.error('setValue failed! : err=', err);
                }
            });
        });
    }
}

function _leafUpdateBrowserValue(updateInfo) {
    var path = updateInfo.keypath;
    var v = updateInfo.widget.getValue();

    /*jshint eqeqeq: false*/
    if (v != updateInfo.orgValue) {
        schemaStorage.setLeafValue(path, v);
    }

}

function _setLeafValidValue(widget) {
    var el = $(widget.domNode);
    el.removeClass('leaf-invalid-value');
    el.addClass('leaf-valid-value');
    el.find('div.tailf-leaf-error-text').text('');
 }

function _setLeafInvalidValue(widget, reason) {
    var el = $(widget.domNode);
    el.addClass('leaf-invalid-value');
    el.find('div.tailf-leaf-error-text').text(reason);
}

function _leafSetValueFromServer(updateInfo) {
    var path = updateInfo.keypath;

    jsonRpc.run('get_value', {th: updateInfo.th, path: path}, _leafReadTimeoutMs).done(function(result) {
        updateInfo.orgValue = result.value;
        updateInfo.widget.setValue(result.value);
    }).fail(function(err) {
        if (jsonRpcErr.isAjaxTimeoutErr(err)) {
            updateInfo.orgValue = '';
            updateInfo.widget.setValue('');
            _setLeafInvalidValue(updateInfo.widget, 'Read timeout from server');
        } else if (jsonRpcErr.isDataNotFoundErr(err)) {
            updateInfo.orgValue = '';
            updateInfo.widget.setValue('');
        } else {
            logger.error('_getLeafChildWidget : err=', err);
        }
    });
}

function _leafSetValueFromBrowserStorage(updateInfo) {
    var path = updateInfo.keypath;
    if (schemaStorage.hasLeafValue(path)) {
        var v = schemaStorage.getLeafValue(path);
        updateInfo.orgValue = v;
        updateInfo.widget.setValue(v);
    }
}

function _leafAddTooltip(widget, leafSchema, leafTypeInfo, rawTypeInfo) {
    var ls = leafSchema;
    var rti = rawTypeInfo;

    var toolTipText = '';

    if (ls.getInfo()) {
        toolTipText += ls.getInfo();
        toolTipText += '<br><br>';
    }
    toolTipText += 'Type:';


    if (rti.isPrimitive()) {
        toolTipText += '&nbsp' + rti.getPrimitiveTypeName();
    } else if (leafTypeInfo.isUnion()) {
        toolTipText += 'Union<br>';
        var unionTypes = leafTypeInfo.getUnionTypes();

        _.each(unionTypes, function(ut) {
            toolTipText += ut.name;

            if (ut.exactName) {
                var ns = ut.exactName.substr(0, ut.exactName.length - ut.name.length - 1);
                var module = tailfGlobal.getNamespaceModuleName(ns);

                toolTipText += '&nbsp;:&nbsp;' + module;
            }

            toolTipText += '<br>';
        });

    } else {
        toolTipText += '<br>';
        toolTipText += '&nbsp;&nbsp;' + rti.getName() + '<br>';
        toolTipText += '&nbsp;&nbsp;' + rti.getNamespace();
    }

    if (ls.isLeafRef()) {
        toolTipText += '<br>Leafref: ' + ls.getLeafRefTarget();
    }

    // FIXME : Does this really get the 'absolute' id?
    var id = widget.id;
    var tt = new Tooltip({
        connectId : [id],
        label     : toolTipText // ls.getInfo()
    });

}

// ------------------------------------------------------------------------

function _getSchemaTitleInfo(parentSchema, schema) {
    var ret = '';
    var rt = schema.getRawType();

    function _add(txt) {
        if (ret.length > 0) {
            ret += ', ';
        }

        ret += txt;
    }

    if (schema.exists() === false) {
        _add('NE');
    }

    if (schema.isReadOnly()) {
        _add('RO');
    }

    if (rt.isPrimitive()) {
        _add('P-' + rt.getName());
    } else {
        var npt = parentSchema.getTypeInfo(rt.getNamespace(), rt.getName());

        if (npt.isEnum()) {
            _add('enum');
        } else if (npt.isUnion()) {
            _add('union');
        }
    }

    if (schema._schema.__client__) {
        _add('__C__');
    }

    if (schema.isOperational()) {
        _add('oper');
    }

    if (ret.length > 0) {
        ret = '&nbsp;[' + ret + ']';
    }

    return ret;
}

function _getDeferredDummyWidget(args) {
    return _getLeafItemWidgetText(args);
}

function _getLeafItemWidgetText(args) {
    var th = args.th;
    var parentSchema = args.parentSchema;
    var ls = args.leafSchema;
    var readOnly = args.readOnly;

    var titleSuffix = '';

    if (args.debugInfo) {
        if (ls.getKind() === 'key') {
            titleSuffix = '&nbsp (k)';
        }

        titleSuffix += _getSchemaTitleInfo(parentSchema, ls);
    }

    var isTextArea = false;
    var tb;

    // FIXME: Generalize this as a configuration item
    if ((ls.getName() === 'device-modifications') && (readOnly === true)) {
        // Doesn't really work now
        isTextArea = false;
    }

    if (isTextArea) {
        var textAreaArgs = {
            title       : ls.getName() + titleSuffix,
            value       : '',
            readOnly    : true,
            intermediateChanges : false
        };

        tb = new LeafTextArea(textAreaArgs);

    } else {
        var textboxArgs = {
            title       : ls.getName() + titleSuffix,
            value       : '',
            readOnly    : readOnly,
            intermediateChanges : false
        };

        if (args.leafSchema.suppressEcho()) {
            textboxArgs.type = 'password';
        }

        tb = new LeafTextBox(textboxArgs);
    }

    return tb;
}

function _getLeafItemWidgetBoolean(args) {
    var parentSchema = args.parentSchema;
    var ls = args.leafSchema;

    var title = ls.getName();

    if (args.debugInfo) {
        title += _getSchemaTitleInfo(parentSchema, ls);
    }

    return _getSelectWidget(title, ['true', 'false']);
}

function _getLeafItemWidgetDateAndTime(args) {
    var th = args.th;
    var parentSchema = args.parentSchema;
    var ls = args.leafSchema;
    var readOnly = args.readOnly;

    var titleSuffix = '';

    if (args.debugInfo) {
        if (ls.getKind() === 'key') {
            titleSuffix = '&nbsp (k)';
        }

        titleSuffix += _getSchemaTitleInfo(parentSchema, ls);
    }

    var dt = new DateAndTime({
        title       : ls.getName() + titleSuffix,
        readOnly: readOnly
    });

    return dt;
}

function _getPresenceContainerWidget(args) {
    var layout = new TableContainer({
        showLabels: true,
        orientation: 'vert'
    });

    var widget = _getLeafItemWidgetEmpty(args);
    layout.addChild(widget);
    layout.startup();

    return layout;
}

function _getLeafItemWidgetEmpty(args) {
    var parentSchema = args.parentSchema;
    var ls = args.leafSchema;

    var title = ls.getName();

    if (args.debugInfo) {
        title += _getSchemaTitleInfo(parentSchema, ls);
    }

    function _setValue(value) {
        jsonRpcHelper.write().done(function(th) {
            var deferred;
            var path = ls.getKeypath();

            if (value === true) {
                deferred = jsonRpcHelper.createAllowExist(th, path);
            } else {
                deferred = jsonRpcHelper.deleteAllowNonExist(th, path);
            }

            deferred.fail(function(err) {
                logger.error('_setValue failed, path=' + path + ', err=', err);
            });
        });
    }

    var triggeredByGetValue = false;

    function _getValue() {
        jsonRpcHelper.read().done(function(th) {
            jsonRpc('exists', {
                th   : th,
                path : ls.getKeypath()
            }).done(function(result) {
                triggeredByGetValue = true;
                widget.setChecked(result.exists);
            }).fail(function(err) {
                logger.error('err=', err);
            });
        });
    }

    var widget = new CheckBox({
        title   : title,
        checked : false,

        onClick  : function() {
            triggeredByGetValue = false;
        },

        onChange : function(value) {
            if (!triggeredByGetValue && args.writeServerValue) {
                _setValue(value);
            }
            triggeredByGetValue = false;
        }
    });

    if (args.readServerValue) {
        _getValue();
    }
    return widget;
}

function _getLeafItemWidgetLeafRef(args) {
    if (args.readOnly === true) {
        return _getLeafItemWidgetText(args);
    }

    var deferred = $.Deferred();

    var th = args.th;
    var ls = args.leafSchema;
    var target = ls.getLeafRefTarget();
    var targetPrev = keypath.upOneLevel(target);

    $.when(
        jsonRpcHelper.getSchema(th, '', target, 1, false, false),
        jsonRpcHelper.getSchema(th, '', targetPrev, 1, false, false)
    ).done(function(schemaTarget, schemaTargetPrev) {
        function _defaultWidget() {
            var widget = _getLeafItemWidgetText(args);
            deferred.resolve(widget);
        }

        if (schemaTargetPrev.getKind() === 'list') {
            if (schemaTarget.getKind() === 'key') {
                _getLeafRefListKeyWidgetTh(th, targetPrev, ls.getName(), deferred, _defaultWidget);
            } else {
                // FIXME : In list but actual value not a key
                _defaultWidget();
            }
        } else {
            _defaultWidget();
        }

   }).fail(function(err) {
        logger.error('leafref : when err : err=', err);
    });

    return deferred.promise();
}

function _getLeafRefListKeyWidgetTh(th, path, title, deferred, defaultWidgetCallback) {

    function _selectWidget(path, count) {
        jsonRpc('get_list_keys', {
            th         : th,
            path       : path,
            chunk_size : count + 1 // + 1 for valid value even in empty lists
        }).done(function(result) {
            var options = [];

            _.each(result.keys, function(_itemKeys) {
                if (_itemKeys.length !== 1) {
                    logger.error('_selectWidget : _itemsKeys.length !== 1 : _itemKeys=', _itemKeys);
                }

                options.push(_itemKeys[0]);
            });

            var _explicitUpdate;

            var widget = new TailfSelect({
                title    : title,
                ownTitle : false,
                options  : options,
                onChange : function(val) {
                    if (_.isFunction(_explicitUpdate)) {
                        _explicitUpdate();
                    }
                }
            });

            // Don't get 'blur' event for this widget, use this fallback
            widget._setExplicitFactoryUpdate = function(explicitUpdate) {
                _explicitUpdate = explicitUpdate;
            };

            deferred.resolve(widget);
        }).fail(function(err) {
            logger.error('get_list_keys : path=' + path+ ' : err=', err);
        });
    }

    jsonRpc('count_list_keys', {
        th   : th,
        path : path
    }).done(function(result) {
        if (result.count <= _leafRefSelectThreshold) {
            _selectWidget(path, result.count);
        } else {
            defaultWidgetCallback();
        }
    });
}


function _getLeafItemWidgetEnum(args) {
    var th = args.th;
    var parentSchema = args.parentSchema;
    var readOnly = args.readOnly;
    var ls = args.leafSchema;
    var leafType = args.leafType;

    var options = [];
    _.each(leafType.getEnumLabels(), function(label) {
        options.push(label);
    });

    var title = ls.getName();

    if (args.debugInfo) {
        title += _getSchemaTitleInfo(parentSchema, ls);
    }

    return _getSelectWidget(title, options);
}

function _getSelectWidget(title, values) {
    var data = [];

    _.each(values, function(value) {
        data.push({
            name : value,
            id   : value
        });
    });

    var sel = new ComboBox({
        title   : title,
        store   : new MemoryStore({data : data})
    });

    return sel;
}


function _getChoiceContainerItemWidget(th, parentSchema, schema) {
    _trace('Choice : schema=', schema);

    var names = schema.getCaseNames();
    var deferred = $.Deferred();

    /*
    // FIXME: How to "really" handle not set choice case
    if (schema.getActiveCase() === undefined) {
        names.unshift('-');
    }
    */

    names.unshift('-');

    var path = parentSchema.getKeypath();

    _trace('Choice : parentSchema.kp=', path);
    _trace('Choice : schema.kp=', schema.getKeypath());
    _trace('Choice : schema.name=', schema.getName());
    _trace('Choice : path=', path);

    jsonRpc('get_case', {
        th     : th,
        path   : path,
        choice : schema.getName()
    }).done(function(result) {
        deferred.resolve(result['case']);
    }).fail(function(err) {
        logger.error('_getChoiceContainerItemWidget : getCase failed : err=', err);
        deferred.fail(err);
    });

    //return _getDefaultContainerChildWidget(schema);
    return new ChoiceSelect({
        header  : 'Choice - ' + schema.getName(),
        items   : names,
        current : deferred.promise(), //schema.getActiveCase(),
        style : {
            width : '200px'
        }
    });
}

function _getActionListInputWidget(args) {
    var widget = new ActionInputList({
        title  : args.schema.getName(),
        schema : args.schema
    });

    return widget;
}

function _getLeafListContainerItemWidget(args) {
    var th = args.th;
    var schema = args.leafSchema;
    var titleSuffix = '';

    if (args.debugInfo) {
        titleSuffix += '&nbsp (leaf-list)';
        titleSuffix += _getSchemaTitleInfo(args.parentSchema, schema);
    }

    var decorator;

    // FIXME: Generalize this to a model path callback
    function _modelADecorator(path, key) {
        return '<a href="#/model' + path + '{' + key + '}">' + key + '</a>';
    }

    // FIXME: Generalize this instead of hard-coding it
    if (schema.getName() === 'device-list') {
        decorator = function(value) {
            return _modelADecorator('/ncs:devices/device', value);
        };
    }

    var widget = new LeafList({
        title         : schema.getName() + titleSuffix,
        readOnly      : args.readOnly,
        schema        : schema,
        writeToServer : args.writeServerValue,

        callbacks : {
            addValueDialog : function(addArgs) {
                return args.callbacks.dialogs.addLeafListValue(addArgs);
            },
            addLeafRefValueDialog : function(addArgs) {
                return args.callbacks.dialogs.addLeafListLeafRefValue(addArgs);
            },

            decorator : decorator
        }
    });

    function _readAndSetValues() {
        jsonRpc('get_value', {
            th   : th,
            path : schema.getKeypath()
        }).done(function(result) {
            widget.setValues(result.value);
        }).fail(function(err) {
            if (jsonRpcErr.isDataNotFoundErr(err)) {
                widget.setValues([]);
            } else {
                logger.error('LEAFLIST : err=', err);
            }
        });
    }

    if (args.readServerValue) {
        var leafrefTarget = schema.getLeafRefTarget();

        if (schema.isLeafRef() && (leafrefTarget !== undefined) && (widget.callbacks.decorator === undefined)) {
            jsonRpcHelper.getSchema(th, '', leafrefTarget, 0, false, false).done(function(result) {
                if (result.getKind() === 'key') {
                    var items = leafrefTarget.split('/');
                    var basePath = '';

                    _.each(items, function(item, ix) {
                        if (ix < (items.length -1)) {
                            if (ix > 0) {
                                basePath += '/';
                            }

                            basePath += item;
                        }
                    });

                    widget.callbacks.decorator = function(value) {
                        return _modelADecorator(basePath, value);
                    };

                    _readAndSetValues();
                } else {
                    _readAndSetValues();
                }

            });
        } else {
            _readAndSetValues();
        }
    }

    return widget;
}

function _getIconHrefItemWidget(schema, iconClass) {
    var layout = new TableContainer({
        showLabels: false
    });

    var href = '#/model/' + schema.getKeypath();

    var link =  new ModelLink({
        text      : schema.getName(),
        iconClass : iconClass,
        href      : href
    });
    layout.addChild(link);

    return layout;
}

function _endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

function _getIconButtonWidget(schema, iconClass, noQualifiedNameAtEndOfKeypath) {
    var layout = new TableContainer({
        showLabels: false
    });

    var label = '&nbsp;' + schema.getName();

    // FIXME : Only works for actions
    var inputParams = schema.getInputParameters();
    var outputParams = schema.getOutputParameters();
    var keypath = schema.getKeypath();
    var tooltip;

    if (inputParams) {
        label += '...';
    }

    if (noQualifiedNameAtEndOfKeypath) {
        var qn = schema.getQualifiedName();
        if (_endsWith(keypath, qn)) {
            keypath = keypath.substr(0, keypath.length - qn.length) + schema.getName();
        }
    }

    var button = new Button({
        baseClass : 'dijitButton tailf',
        iconClass : iconClass,
        label     : label,

        onClick : function() {
            var href = _href.getModelHref(keypath);

            if (tooltip) {
                tooltip.close();
            }

            _href.navigateToHref(href);
        }

    });

    layout.addChild(button);

    setTimeout(function() {
        tooltip = new Tooltip({
            connectId : [button.id],
            label     : schema.getInfo()
        });
    });

    return layout;
}


// ------------------------------------------------------------------------
//                     LIST Inline
// ------------------------------------------------------------------------

function _getListInlineLeafEditWidget(th, parentSchema, leafSchema) {
    var rt = leafSchema.getRawType();

    if (rt.isPrimitive()) {
        // FIXME: Inline edit of primitive type, going for default now

        var ptn = rt.getPrimitiveTypeName();

        if (ptn === 'boolean') {
            return _getListInlineBooleanEditWidget();
        }

    } else {
        // Non-primitive type
        var leafType = parentSchema.getTypeInfo(
                                        rt.getNamespace(), rt.getName());

        if (leafType.isEnum()) {
            return _getListInlineEnumEditWidget(leafType);
        }
    }

    // Use default
    return undefined;
}

function _getListInlineBooleanEditWidget() {
    return _getListInlineSelectWidget(['true', 'false']);
}

function _getListInlineEnumEditWidget(leafType) {
    var options = [];

    _.each(leafType.getEnumLabels(), function(label) {
        options.push(label);
    });

    return _getListInlineSelectWidget(options);
}

function _getListInlineSelectWidget(values) {
    var data = [];

    _.each(values, function(value) {
        data.push({
            name : value,
            id   : value
        });
    });

    var sel = new ComboBox({
        //title   : title,
        store   : new MemoryStore({data : data})
    });

    return sel;
}


// ------------------------------------------------------------------------

function m_setHref(href) {
    _href = href;
}


/*
 * NOTE: May return a $.Deferred promise
 *
 */
function m_createContainerChildWidget(args) {
/* jshint maxcomplexity:16 */
    var th = args.th;
    var parentSchema = args.parentSchema;
    var schema = args.leafSchema;

    var kind = schema.getKind();
    var readOnly = schema.isReadOnly();
    var debugInfo = false;

    //_trace('kind=' + kind + ' : name=' + schema.getName() + ' : readOnly=', readOnly);

    var readServerValue = true;
    var writeServerValue = true;

    var readBrowserStorageValue = false;
    var writeBrowserStorageValue = false;

    if (args.readServerValue !== undefined) {
        readServerValue = args.readServerValue;
    }

    if (args.writeServerValue !== undefined) {
        writeServerValue = args.writeServerValue;
    }

    if ((parentSchema.getKind() === 'action') || schema.isActionInput() || schema.isActionOutput()) {
        readServerValue = false;
        writeServerValue = false;
    }

    if (schema.isActionInput()) {
        readBrowserStorageValue = true;
        writeBrowserStorageValue = true;
    }

    var widgetArgs = {
        th                       : th,
        parentSchema             : parentSchema,
        leafSchema               : schema,
        readOnly                 : readOnly,
        readServerValue          : readServerValue,
        writeServerValue         : writeServerValue,
        readBrowserStorageValue  : readBrowserStorageValue,
        writeBrowserStorageValue : writeBrowserStorageValue,
        debugInfo                : debugInfo,
        callbacks                : args.callbacks
    };

    if (kind === 'leaf') {
        return _getLeafContainerItemWidget(widgetArgs);
    } else if (kind === 'key') {
        return _getLeafContainerItemWidget(_.assign(widgetArgs, {
            readOnly         : true,
            writeServerValue : false
        }));
    } else if (kind === 'choice') {
        return _getChoiceContainerItemWidget(th, parentSchema, schema);
    } else if (kind === 'container') {
        if ((parentSchema === schema) && (parentSchema.isPresence())) {
            // NOTE: Trick to get a presence container checkbox
            return _getPresenceContainerWidget(widgetArgs);
        } else {
            return _getIconHrefItemWidget(schema, _iconClassContainer);
        }
    } else  if (kind === 'list') {
        if (parentSchema.getKind() === 'action') {
            return _getActionListInputWidget({
                parentSchema : parentSchema,
                schema       : schema,
                debugInfo    : debugInfo
            });
        } else {
            return _getIconHrefItemWidget(schema, _iconClassList);
        }
    } else if (kind === 'action') {
        // FIXME : Check why action hrefs can't end with a qualified name for services.
        return _getIconButtonWidget(schema, _iconClassAction, true);
    } else if (kind === 'leaf-list') {
        return _getLeafListContainerItemWidget(widgetArgs);
    } else {
        return _getDefaultContainerChildWidget(schema);
    }
}

function m_createDialogChildWidget(th, parentSchema, schema) {
    var kind = schema.getKind();
    var readOnly = schema.isReadOnly();

    if ((kind === 'leaf') || (kind === 'key')) {
        return _getLeafContainerItemWidget({
            th               : th,
            parentSchema     : parentSchema,
            leafSchema       : schema,
            readOnly         : readOnly,
            readServerValue  : false,
            writeServerValue : false,
            debugInfo        : false
        });
    } else {
        logger.error('Unsupported schema kind "' + kind + '"');
    }
 }

function m_createListInlineEditWidget(th, parentSchema, schema) {
    var kind = schema.getKind();

    if (kind === 'leaf') {
        return _getListInlineLeafEditWidget(th, parentSchema, schema);
    }

    // Use default
    return undefined;
}

return {
    setHref : m_setHref,

    createContainerChildWidget : m_createContainerChildWidget,
    createDialogChildWidget    : m_createDialogChildWidget,
    createListInlineEditWidget : m_createListInlineEditWidget
};

});

