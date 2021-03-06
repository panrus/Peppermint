function Peppermint(_this, options) {
    var slider = {
            slides: [],
            left: 0
        },
        totalSlides,
        slidesPerPage,
        lastPageIndex,
        flickThreshold = 200, //Flick threshold (ms)
        activePage = 0,
        slideBlock,
        animationTimer,
        transitionEventName = null;

    //default options
    var o = {
        speed: 300, //transition between slides in ms
        touchSpeed: 300, //transition between slides in ms after touch
        startSlide: 0, //first slide to show
        mouseDrag: true, //enable mouse drag
        disableIfOneSlide: true,
        cssPrefix: 'peppermint-',
        slideHeightRatio: undefined,
        slideWidth: undefined,
        slidesContainer: undefined,
        onIncompleteSwipe: undefined, //user has dragged the slide, but it didn't trigger a slide change
        beforePageChange: undefined, //just before slide change
        onPageChange: undefined, //slide change callback
        onTransitionEnd: undefined, //after final animation completed
        onSetup: undefined //setup callback
    };

    //merge user options into defaults
    options && mergeObjects(o, options);

    var classes = {
        inactive: o.cssPrefix + 'inactive',
        active: o.cssPrefix + 'active',
        mouse: o.cssPrefix + 'mouse',
        drag: o.cssPrefix + 'drag',
        slides: o.cssPrefix + 'slides',
        mouseClicked: o.cssPrefix + 'mouse-clicked'
    };

    //feature detects
    var support = {
        transforms: testProp('transform'),
        transitions: testProp('transition')
    };

    function mergeObjects(targetObj, sourceObject) {
        for (var key in sourceObject) {
            if (sourceObject.hasOwnProperty(key)) {
                targetObj[key] = sourceObject[key];
            }
        }
    }

    function testProp(prop) {
        var prefixes = ['Webkit', 'Moz', 'O', 'ms'],
            block = document.createElement('div');

        if (block.style[prop] !== undefined) return true;

        prop = prop.charAt(0).toUpperCase() + prop.slice(1);
        for (var i in prefixes) {
            if (block.style[prefixes[i]+prop] !== undefined) return true;
        }

        return false;
    }

    function addClass(el, cl) {
        if (!new RegExp('(\\s|^)'+cl+'(\\s|$)').test(el.className)) {
            el.className += ' ' + cl;
        }
    }

    function removeClass(el, cl) {
        el.className = el.className.replace(new RegExp('(\\s+|^)'+cl+'(\\s+|$)', 'g'), ' ').replace(/^\s+|\s+$/g, '');
    }

    //n - page number (starting from 0)
    //speed - transition in ms, can be omitted
    function changeActivePage(n, speed) {
        if (n<0) {
            n = 0;
        }
        else if (n>lastPageIndex) {
            n = lastPageIndex;
        }

        o.beforePageChange && o.beforePageChange(activePage, n, n == 0, n == lastPageIndex);

        activePage = n;

        changePos(-n*slider.width, (speed===undefined?o.speed:speed));

        //API callbacks
        o.onPageChange && o.onPageChange(n);

        if (o.onTransitionEnd && (speed == 0 || transitionEventName === null)) {
            // If there was no transition or is transition end is not supported,
            // call onTransition end manually
            o.onTransitionEnd(n);
        }

      return n;
    }

    //changes position of the slider (in px) with given speed (in ms)
    function changePos(pos, speed) {
        var time = speed?speed+'ms':'';

        slideBlock.style.webkitTransitionDuration =
        slideBlock.style.MozTransitionDuration =
        slideBlock.style.msTransitionDuration =
        slideBlock.style.OTransitionDuration =
        slideBlock.style.transitionDuration = time;

        setPos(pos);
    }

    //fallback to `setInterval` animations for UAs with no CSS transitions
    function changePosFallback(pos, speed) {
        animationTimer && clearInterval(animationTimer);

        if (!speed) {
            setPos(pos);
            return;
        }

        var startTime = +new Date,
            startPos = slider.left;

        animationTimer = setInterval(function() {
            //rough bezier emulation
            var diff, y,
                elapsed = +new Date - startTime,
                f = elapsed / speed,
                bezier = [0, 0.7, 1, 1];

            function getPoint(p1, p2) {
                return (p2-p1)*f + p1;
            }

            if (f >= 1) {
                setPos(pos);
                clearInterval(animationTimer);
                return;
            }

            diff = pos - startPos;

            y = getPoint(
                    getPoint(getPoint(bezier[0], bezier[1]), getPoint(bezier[1], bezier[2])),
                    getPoint(getPoint(bezier[1], bezier[2]), getPoint(bezier[2], bezier[3]))
                    );

            setPos(Math.floor(y*diff + startPos));
        }, 15);
    }

    //sets position of the slider (in px)
    function setPos(pos) {
        slideBlock.style.webkitTransform = 'translate('+pos+'px,0) translateZ(0)';
        slideBlock.style.msTransform =
        slideBlock.style.MozTransform =
        slideBlock.style.OTransform =
        slideBlock.style.transform = 'translateX('+pos+'px)';

        slider.left = pos;
    }

    //`setPos` fallback for UAs with no CSS transforms support
    function setPosFallback(pos) {
        slideBlock.style.left = pos+'px';

        slider.left = pos;
    }

    function nextPage() {
        var n = activePage + 1;

        if (n > lastPageIndex) {
            n = 0;
        }

        return changeActivePage(n);
    }

    function prevPage() {
        var n = activePage - 1;

        if (n < 0) {
            n = lastPageIndex;
        }

        return changeActivePage(n);
    }

    //this should be invoked when the width of the slider is changed
    function onWidthChange() {
        setupSliderDimensions();
        changeActivePage(activePage, 0);
    }

    function addEvent(el, event, func, bool) {
        if (!event) return;

        el.addEventListener? el.addEventListener(event, func, !!bool): el.attachEvent('on'+event, func);
    }

    //init touch events
    function touchInit() {
        EventBurrito(slideBlock, {
            mouse: o.mouseDrag,
            start: function(event, start) {
                //firefox doesn't want to apply cursor from `:active` CSS rule, have to add a class :-/
                if (o.mouseDrag) addClass(_this, classes.drag);
            },
            move: function(event, start, diff, speed) {
                //if it's first slide and moving left or last slide and moving right -- resist!
                diff.x =
                diff.x /
                    (
                        (!activePage && diff.x > 0
                        || activePage == lastPageIndex && diff.x < 0)
                        ?
                        (Math.abs(diff.x)/slider.width*2 + 1)
                        :
                        1
                    );

                //change position of the slider appropriately
                changePos(diff.x - slider.width*activePage);
            },
            end: function(event, start, diff, speed) {
                if (diff.x) {
                    var ratio = Math.abs(diff.x)/slider.width,
                        //How many slides to skip. Remainder > 0.25 counts for one slide.
                        skip = Math.floor(ratio) + (ratio - Math.floor(ratio) > 0.25?1:0),
                        //Super-duper formula to detect a flick.
                        //First, it's got to be fast enough.
                        //Second, if `skip==0`, 20px move is enough to switch to the next slide.
                        //If `skip>0`, it's enough to slide to the middle of the slide minus `slider.width/9` to skip even further.
                        flick = diff.time < flickThreshold+flickThreshold*skip/1.8 && Math.abs(diff.x) - skip*slider.width > (skip?-slider.width/9:20);

                    skip += (flick?1:0);

                    if (diff.x < 0) {
                        changeActivePage(activePage+skip, o.touchSpeed);
                    }
                    else {
                        changeActivePage(activePage-skip, o.touchSpeed);
                    }


                    if (o.onIncompleteSwipe && skip == 0) o.onIncompleteSwipe(event); // User swiped, but not enough to change the slide
                } else if (o.onIncompleteSwipe) {
                    // User swiped, but vertically, not horizontally.
                    o.onIncompleteSwipe(event);
                }

                //remove the drag class
                if (o.mouseDrag) removeClass(_this, classes.drag);
            }
        });
    }

    function setupSliderDimensions(){
        if (o.slideWidth == undefined || o.slideWidth == 'full') {
            slider.width = _this.offsetWidth;

            if (o.slideWidth == undefined) {
                var slideWidth = slider.slides[0].offsetWidth;
                slidesPerPage = Math.round(slider.width / slideWidth);
            } else {
                slidesPerPage = 1;
                // have to do this in `px` because of webkit's rounding errors :-(
                slideBlock.style.width = slider.width * totalSlides + 'px';
                for (var i = 0; i < totalSlides; i++) {
                    slider.slides[i].style.width = slider.width + 'px';
                }
          }
        } else {
            _this.style.width = null;
            slidesPerPage = Math.floor(_this.offsetWidth / o.slideWidth);
            slider.width = slidesPerPage * o.slideWidth;
            var totalPages = Math.ceil(totalSlides / slidesPerPage);
            _this.style.width = slider.width + 'px';
            slideBlock.style.width = slider.width * totalPages + 'px';
        }
        if (o.slideHeightRatio) slideBlock.style.height = Math.ceil(slider.width * o.slideHeightRatio) + 'px';
        lastPageIndex = Math.ceil(totalSlides / slidesPerPage) - 1;
    }

    function setup() {
        var slideSource = o.slidesContainer || _this;

        if (o.disableIfOneSlide && slideSource.children.length <= 1) return;

        //If current UA doesn't support css transforms or transitions -- use fallback functions.
        //(Using separate functions instead of checks for better performance)
        if (!support.transforms || !!window.opera) setPos = setPosFallback;
        if (!support.transitions || !!window.opera) changePos = changePosFallback;

        slideBlock = o.slidesContainer || document.createElement('div');
        addClass(slideBlock, classes.slides);

        //get slides
        for (var i = 0, l = slideSource.children.length; i < l; i++) {
            var slide = slideSource.children[i];

            slider.slides.push(slide);

            //This solves tabbing problems:
            //When an element inside a slide catches focus we switch to that slide
            //and reset `scrollLeft` of the slider block.
            //`SetTimeout` solves Chrome's bug.
            //Event capturing is used to catch events on the slide level.
            //Since older IEs don't have capturing, `onfocusin` is used as a fallback.
            (function(x) {
                addEvent(slide, 'focus', slide.onfocusin = function(e) {
                    _this.scrollLeft = 0;
                    setTimeout(function() {
                        _this.scrollLeft = 0;
                    }, 0);
                    changeActivePage(Math.floor(x / slidesPerPage));
                }, true);
            })(i);
        }

        totalSlides = slider.slides.length;

        addClass(_this, classes.active);
        removeClass(_this, classes.inactive);
        o.mouseDrag && addClass(_this, classes.mouse);
        setupSliderDimensions();

        if (!o.slidesContainer) {
            _this.appendChild(slideBlock);
            for (var i = 0; i < totalSlides; i++) {
                slideBlock.appendChild(slider.slides[i]);
            }
        }

        transitionEventName = getTransitionEventName();

        if (o.onTransitionEnd && transitionEventName) {
            addEvent(slideBlock, transitionEventName, function() {
                o.onTransitionEnd(activePage);
            }, false);
        }

        //watch for slider width changes
        addEvent(window, 'resize', onWidthChange);
        addEvent(window, 'orientationchange', onWidthChange);

        //init first slide, timeout to expose the API first
        setTimeout(function() {
            changeActivePage(o.startSlide, 0);
        }, 0);

        touchInit();

        //API callback, timeout to expose the API first
        setTimeout(function() {
            o.onSetup && o.onSetup(totalSlides);
        }, 0);
    }

    // https://gist.github.com/O-Zone/7230245
    function getTransitionEventName() {
        var transitions = {
            'transition': 'transitionend',
            'WebkitTransition': 'webkitTransitionEnd',
            'MozTransition': 'transitionend',
            'OTransition': 'otransitionend'
        },
        elem = document.createElement('div');

        for (var t in transitions) {
            if (typeof elem.style[t] !== 'undefined') {
                return transitions[t];
            }
        }
        return null;
    }

    //Init
    setup();

    //expose the API
    return {
        slideTo: function(newPageNumber, speed) {
            if (newPageNumber != activePage) changeActivePage(newPageNumber, speed);
            return activePage;
        },

        next: nextPage,

        prev: prevPage,

        //get current slide number
        getCurrentPos: function() {
            return activePage;
        },

        //get total number of pages
        getTotalPages: function() {
            return lastPageIndex+1;
        },

        getSlidesPerPage: function() {
            return slidesPerPage;
        },

        //invoke this when the slider's width is changed
        recalcWidth: onWidthChange,

        getSliderDimensions: function() {
            return  [_this.offsetWidth, _this.offsetHeight];
        }
    };
};

//if jQuery is present -- create a plugin
if (window.jQuery) {
    (function($) {
        $.fn.Peppermint = function(options) {
            this.each(function() {
                $(this).data('Peppermint', Peppermint(this, options));
            });

            return this;
        };
    })(window.jQuery);
}