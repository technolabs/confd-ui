//>>built
define("gridx/modules/TouchVScroller","dojo/_base/kernel dojo/_base/Deferred dojo/_base/declare dojo/query dojo/dom-class ./VScroller dojox/mobile/scrollable".split(" "),function(f,m,n,p,g,q,r){f.experimental("gridx/modules/TouchVScroller");return n(q,{constructor:function(){this.grid.touch&&(g.add(this.grid.domNode,"gridxTouchVScroller"),this.domNode.style.width="")},scrollToRow:function(a,c){if(this.grid.touch){var b=new m,d=p('[visualindex\x3d"'+a+'"]',this.grid.bodyNode)[0];d&&this._scrollable.scrollIntoView(d,
c);b.callback();return b}return this.inherited(arguments)},scroll:function(a){this.grid.touch?this._scrollable.scrollTo({y:a}):this.inherited(arguments)},position:function(){return this.grid.touch?this._scrollable.getPos().y:this.inherited(arguments)},_init:function(){if(this.grid.touch){var a=this.grid,c=a.view,b=a.header.innerNode,d=a.mainNode,k=a.bodyNode,f=a.vScroller.arg("scrollable")||{};scrollable=this._scrollable=new r(f);b.style.height=b.firstChild.offsetHeight+"px";scrollable.init({domNode:d,
containerNode:k,scrollDir:"none"==a.hScrollerNode.style.display?"v":"vh",noResize:!0});var h=function(){var l=a.layer&&a.layer._wrapper1.firstChild;return l&&l.firstChild};this.aspect(scrollable,"scrollTo",function(a){if("number"==typeof a.x){a=scrollable.makeTranslateStr({x:a.x});b.firstChild.style.webkitTransform=a;b.firstChild.style.transform=a;var e=h();e&&(e.style.webkitTransform=a,e.style.transform=a)}});this.aspect(scrollable,"slideTo",function(a,e,c){scrollable._runSlideAnimation({x:scrollable.getPos().x},
{x:a.x},e,c,b.firstChild,2);var d=h();d&&scrollable._runSlideAnimation({x:scrollable.getPos().x},{x:a.x},e,c,d,2)});this.aspect(scrollable,"stopAnimation",function(){g.remove(b.firstChild,"mblScrollableScrollTo2");var a=h();a&&g.remove(a,"mblScrollableScrollTo2")});this.aspect(a.hScroller,"refresh",function(){scrollable._h=k.scrollWidth>d.clientWidth});this._onBodyChange=function(){a.hLayout.reLayout();a.vLayout.reLayout()};this.model.when({start:c.rootStart,count:c.rootCount},function(){a.body.renderRows(0,
c.visualCount)})}else this.inherited(arguments)}})});
//# sourceMappingURL=TouchVScroller.js.map