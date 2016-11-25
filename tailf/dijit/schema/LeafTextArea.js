define([
    'dojo/_base/declare',
    'dijit/form/Textarea'
    //'dojo/text!./templates/LeafTextArea.html'
], function(declare, TextArea) {


return declare('tailf/dijit/schema/LeafTextArea', [TextArea], {
    rows : '1',
    cols : 20,

    baseClass: "dijitTextBox dijitTextArea dijitExpandingTextArea tailf-leaf-textarea",

    layout : function() {
        //console.error('layout');
    },

    resize : function() {
        //console.error('resize');
    }
});

});
