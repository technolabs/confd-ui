define([
    'lodash',
    'tailf/dijit/result-window',
    'tailf/dijit/DiffOutput'
], function(
    _,
    resultWindow,
    DiffOutput
) {

function CliResult(args) {
    args = _.assign({
    }, args);

    this.args = args;
    this.fp = undefined;
}

CliResult.prototype.destroy = function() {
    if (this.fp) {
        this.fp.destroy();
    }
};

/*
 * args = {
 *      element : <element for the floating pane>
 *      title   : Floating pane title
 *      clearContent : true/false
 *  }
 */
CliResult.prototype.show = function(args) {
    if (!this.fp) {
        this.fp = resultWindow.getFloatingPaneWindow({
            element : args.element
        });

        this.content = new DiffOutput({
        });

        this.fp.addChild(this.content);
        this.fp.startup();
    }

    this.fp.setTitle(args.title);

    if (args.clearContent) {
        this.content.setCliRows([]);
    }

    this.fp.show();
};

CliResult.prototype.hide = function() {
    this.fp.hide();
};

CliResult.prototype.setContent = function(content) {
    this.content.setCliContent(content);
};

return CliResult;
});
