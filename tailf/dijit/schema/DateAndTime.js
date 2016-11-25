define([
    'dojo/_base/declare',

    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/_FocusMixin',

    'dijit/form/TimeTextBox',
    'dijit/form/DateTextBox',

    'dojo/text!./templates/DateAndTime.html'
], function(
    declare,

    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    _FocusMixin,

    TimeTextBox,
    DateTextBox,

    template) {

    return declare([_WidgetBase, _FocusMixin, _TemplatedMixin, _WidgetsInTemplateMixin], {
        templateString : template,
        baseClass      : 'tailf-leaf-dateandtime',

        postCreate: function() {
            this.date.constraints = {
                selector: 'date',
                datePattern: 'yyyy-MM-dd',
                locale: 'en-us'
            };
            this.time.constraints = {
                selector: 'time',
                timePattern: 'HH:mm:ss',
                clickableIncrement: 'T00:30:00',
                visibleIncrement: 'T00:30:00',
                visibleRange: 'T01:00:00'
            };

            if(this.readOnly) {
                this.date.set('disabled', true);
                this.time.set('disabled', true);
            }
        },

        setValue: function(value) {
            console.log('SSS', value);
            //this.date.set('value', new Date());
            //this.time.set('value', '10:10:10');
        },

        getValue: function() {
            function pad(n) { return n < 10 ? '0' + n : n; }

            var vd = this.date.get('value'),
                vt = this.time.get('value'),
                val;
            console.log('SSY', vd);

            if(vd != null && vt != null) {
                var d = vd.getFullYear() + '-' + pad(vd.getMonth()+1) + '-' + pad(vd.getDate()),
                    t = pad(vt.getHours()) + ':' + pad(vd.getMinutes()) + ':' + pad(vd.getSeconds());

                val = d+'T'+t;
            }
            console.log('SSX', val);
            return val;
        }
    });
});
