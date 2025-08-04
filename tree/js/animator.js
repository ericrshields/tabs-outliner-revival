"use strict";

/** @preserve Copyright 2012, 2013, 2014, 2015 by Vladyslav Volovyk. All Rights Reserved. */

// Also take look for YUI 2: Animation (http://developer.yahoo.com/yui/animation/) - supported in all mobile browsers, suport Animation with Motion along a Curve, support Scroll Animation
//var animator = function() {
//
//	var private_var;
//
//	function private_method() {
//
//		// do stuff here
//
//	}
//
//	return {
//
//		method_1 : function() {
//
//			// do stuff here
//
//		},
//
//		method_2 : function() {
//
//			// do stuff here
//
//		}
//
//	};
//
//}();
function fadeIn(el, total, period) {
    var fps = 30,
        step= total/(period*fps),
        timeBetweenAnimSteps = 1000/fps;

    var opa=0;
    (function doScrollAnimationStep() {
        opa += step;
        el.style.opacity = opa;
        if( opa < total ) setTimeout(doScrollAnimationStep, timeBetweenAnimSteps);
    })();
}

var doScrollAnimationStepSetTimeoutId = null;
var scrollIntoViewAnimated = function(domObj) {
    // Без анимации ----------------------------------------------------------------------------------------------------
    // domObj.scrollIntoView(true);
    // Тоже самое но с учотом PADDING_TOP:
    var PADDING_TOP = 2;
    window.scrollTo(0, domObj.offsetTop - PADDING_TOP); // Заодно фиксанёт возможный X скрол

    // C анимацией -----------------------------------------------------------------------------------------------------
//    var PADDING_TOP = 2;
//    var targetY = function() { return domObj.offsetTop - PADDING_TOP }; // offsetTop can change during animation - so we must not cache it
//    var startY = window.scrollY;
//    var direction = ( (startY - targetY()) < 0)? 1: -1;
//
//    var fps = 30,
//        timeBetweenAnimSteps = 1000/fps,
//        scrollPixelsPerFrame = 40;
//
//    clearTimeout(doScrollAnimationStepSetTimeoutId);
//    (function doScrollAnimationStep() {
//        var newY = window.scrollY + direction * scrollPixelsPerFrame;
//
//        var nextDirection = ( (newY - targetY()) < 0)? 1: -1;
//        if( nextDirection === direction  ) {
//            window.scrollTo(0,  newY);
//            doScrollAnimationStepSetTimeoutId = setTimeout(doScrollAnimationStep, timeBetweenAnimSteps);
//        }
//        else /*переехали*/ {
//            window.scrollTo(0,  targetY()); // Ставим себя чотко куда просили
//        }
//    })();

    // Тоже самое одной строчкой с jQuery:
    //$('html,body').animate({'scrollTop': $("#"+id).offset().top},'slow');

};

var _animatorDiv = function() {
	var r = document.createElement("div");
	r.style.overflow = "hidden";	
	r.style.padding  = "0";
	
	r.style.webkitTransitionProperty = "height"; // Also webkitTransitionEnd listener must be renamed in case you rename this for mozila or opera
	r.style.webkitTransitionDuration = "0.3s";
	
	return r;
}();

function getAnimator(elem)
{
	if(!elem.parentNode) return null;	
	return elem.parentNode.thisIsAnimator ? elem.parentNode : null;
}

function addIfNotPresentAndAnimateExpand(mainnode, subnodes)
{
	var animator = getAnimator(subnodes);
	if(!animator) animator = suroundByAnimator(subnodes, 0);
	
	if(/*not present in HTML tree*/animator.parentNode == null)
		mainnode.appendChild(animator);

	animator.style.height = subnodes.clientHeight + "px";
	
	// Delete surounded div - animator when animation is finished ---------------------------------------
	animator.addEventListener("webkitTransitionEnd", onExpandCollapseTransitionEnd /*must be same as in Collase!*/, false);
}

function animateCollapseThenRemove(elem)
{
	var animator = getAnimator(elem);
	if(!animator) animator = suroundByAnimator(elem, elem.clientHeight);
	
	window.setTimeout(function() { animator.style.height = "0px";}, 1); // Woraround - webkitTransitionProperty неуспевают сработать и мы сразу в ноль падаем

	// In case colapsing animation now in progress there is registered some not needed now operation
	animator.addEventListener("webkitTransitionEnd", onExpandCollapseTransitionEnd /*must be same as in Expand!*/, false );
}

function onExpandCollapseTransitionEnd()
{
	var isFullyCollapsed = parseInt(this.style.height) == 0; // parseInt to trim "px", "em", "%", ... sufixes

	if(isFullyCollapsed)
		removeElementAndAllChilds(this);
	else
		replaceElementByFirstChild(this);
}

function removeElementAndAllChilds(elem)
{
	elem.parentNode.removeChild(elem);
}

function replaceElementByFirstChild(elem)
{
	var parent = elem.parentNode;
	var innernode = elem.firstChild;
	parent.replaceChild(innernode, elem);
}

function suroundByAnimator(elem, initHeight)
{
	// Create new animator --------------------------------------------
	var r = _animatorDiv.cloneNode(true);
	r.thisIsAnimator = true; // Так мы потом в коде будем проверять или парент анимируемого узла является временным аниматором, cloneNode не клонирует наши custom проперти
	r.style.height = initHeight + "px";
	
	// Surround --------------------------------------------------------
	if(elem.parentNode)	elem.parentNode.replaceChild(r, elem);
	r.appendChild(elem);
	
	return r;
}
