define('tailf/xwt/widget/Messages', [
    'xwt/widget/notification/Alert',

    'tailf/core/logger'
], function(Alert, logger) {

function _alert(type, args, extra, err) {
    var warn = new Alert({
        messageType : type,
        buttons : [{
            label : 'OK'
        }]
    });

    if (_.isString(args)) {
        var text = args;

        if (_.isString(extra)) {
            text += ' : ' + extra;
        }

        warn.setDialogContent(text);

        if (type === 'error') {
            logger.error(text, err);
        }
    } else {
        warn.setDialogContent(args.content);
    }
}

function m_information(args) {
    _alert('information', args);
}

function m_warning(args) {
    _alert('warning', args);
}

function m_error(args, extra, err) {
    _alert('error', args, extra, err);
}

function m_okCancel(text, okCallback) {
    var a = new Alert({
        messageType : 'warning',
        buttons     : [{
            label: 'OK',
            onClick: function() {okCallback();}
        }, {
            label: 'Cancel'
        }],

        dontShowAgainOption: false
    });

    a.setDialogContent(text);
}

var _ret = {
    information : m_information,
    warning     : m_warning,
    error       : m_error,
    okCancel    : m_okCancel
};

return _ret;
});
