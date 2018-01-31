;(function(window, document, $, undefined) {
"use strict";

// Utility variables ------------------------------------------
var VIEWPORT_MIN_WIDTH = 1000; //(한컴) 일정확인 팝업 정중앙 대응 사이즈
var $document = $(document);

// Module definitions -----------------------------------------

/**
 * modalStore
 * @description     Object that controls shared overlay's visible state.
 */
var modalStore = {
    items: {},
    overlay: {
        $element: "#overlay",
        isActive: false
    },
    init: function() {
        modalStore.overlay.$element = $(modalStore.overlay.$element);
    },
    set: function(modalId) {
        modalStore.items[modalId] = true;
        modalStore.showOverlay();
    },
    unset: function(modalId) {
        modalStore.items[modalId] = false;
        modalStore.hideOverlay();
    },
    showOverlay: function() {
        if (modalStore.overlay.isActive) return;

        modalStore.overlay.$element.addClass("is-active");
        modalStore.overlay.isActive = true;

        blockScroll();
    },
    hideOverlay: function() {
        if (!modalStore.overlay.isActive) return;
        if (modalStore.hasActiveItem()) return;

        modalStore.overlay.$element.removeClass("is-active");
        modalStore.overlay.isActive = false;

        unblockScroll();
    },
    hasActiveItem: function() {
        var key, found = 0;

        for (key in modalStore.items) {
            if (!modalStore.items.hasOwnProperty(key)) continue;
            if (modalStore.items[key] === true) found++;
        }

        return Boolean(found);
    }
};

/**
 * @constructor
 * Modal
 * 
 * @description     Link trigger button to relevant popup layer. You can make
 *                  any element within the modal act like the close button,
 *                  by assignig them `js-modal-closer` class name.
 *
 * @param {object} config
 * @returns {Object} -- current Modal instance
 */
var ModalDefaults = {
    overlay: true,
    onShow: function() {},
    onHide: function() {}
};
var Modal = Modal || function(config) {
    var _this = this;

    // process config
    this.options = $.extend({}, ModalDefaults, config);

    this.id = uuid(); // unique id is required for shared overlay handling
    this.isOpen = false;

    // find DOM references
    this.$context = toJqueryElement(this.options.context);
    this.$trigger = this.options.context ? null : toJqueryElement(this.options.trigger);
    this.$layer = toJqueryElement(this.options.layer);
    this.$outside = this.options.overlay ? modalStore.overlay.$element : $document;

    // set .position() query if user passed the argument
    if (this.options.position) {
        this.position = {
            my: this.options.position.my,
            at: this.options.position.at
        };
    }

    // define context in dynamic handlers (workaround)
    this.close = this.close.bind(this);
    this._onOutsideClick = this._onOutsideClick.bind(this);
    this._onEscape = this._onEscape.bind(this);

    // initialize trigger's event
    if (this.$context) {
        this.$context.on("click", _this.options.trigger, function(e) {
            if (_this.options.stopPropagation) e.stopPropagation();
            _this.$trigger = $(this);
            _this.open();
        });
    } else {
        this.$trigger.on("click", function(e) {
            if (_this.options.stopPropagation) e.stopPropagation();
            _this.isOpen ? _this.close() : _this.open();
        });
    }

    return this;
};

Modal.prototype = {
    close: function() {
        if (!this.isOpen) return;

        var _this = this;

        // remove identifier className
        this.$trigger.removeClass("is-active");
        this.$layer.removeClass("is-active");

        // unbind closing event handler
        this.$layer.off("click", ".js-modal-closer", _this.close);
        this.$outside.off("click", _this._onOutsideClick);
        $document.off("keydown", _this._onEscape);

        // if overlay has been requested
        if (this.options.overlay) {
            // remove stack in modalStore
            modalStore.unset(this.id);
        }

        // reset position (required for next .position() calculation)
        if (this.position) {
            this.$layer.removeAttr("style");
        }

        // run `onHide` callback
        this.options.onHide(this);

        // update state flag
        this.isOpen = false;
    },
    open: function() {
        var _this = this;

        if (this.isOpen) return;
        
        // define layer position
        if (this.position) {
            this.position.of = this._getPositionBase();

            if (window.innerWidth < VIEWPORT_MIN_WIDTH) {
                this._forceCenter();
            } else {
                this.$layer.position(_this.position);
            }
        }
        // set overlay
        if (this.options.overlay) {
            modalStore.set(this.id);
        }

        // add identifier className
        this.$trigger.addClass("is-active");
        this.$layer.addClass("is-active");

        // bind closing event handler
        this.$layer.on("click", ".js-modal-closer", _this.close);

        setTimeout(function() {
            _this.$outside.on("click", _this._onOutsideClick);
            $document.on("keydown", _this._onEscape);
        }, 5);

        // run `onShow` callback
        this.options.onShow(this);

        // update state flag
        this.isOpen = true;
    },
    _onEscape: function(e) {
        if ((e.which || e.keyCode) === $.ui.keyCode.ESCAPE) this.close();
    },
    _onOutsideClick: function(e) {
        if (isDelegationTarget(e, this.$layer)) this.close();
    },
    _getPositionBase: function() {
        return this.options.position.of(this.$trigger);
    },
    _forceCenter: function() {
        var width  = this.$layer.outerWidth();
        var height = this.$layer.outerHeight();

        this.$layer.css({
            "margin-top": height * -0.5,
            "margin-left": width * -0.5,
            "position": "fixed",
            "top": "50%",
            "left": "50%"
        });
    }
};

/**
 * @constructor
 * Tabs
 * 
 * @description     Switch between multiple content panel by clicking on
 *                  radio buttons.
 *
 * @param {object} sObj -- object containing required selectors
 * @returns {Object} -- current tabs instance
 */
var Tabs = Tabs || function(sObj) {
    var _this = this;
    var checkedIndex;

    this.$container = $(sObj.container);
    this.$panels = $(sObj.panel, _this.$container);

    this.move = this.move.bind(this);

    $(sObj.tabGroup, _this.$container)
        .find(sObj.tab)
        .each(function(i, tab) {
            $(tab).data("sIndex", i);
            if (tab.checked) checkedIndex = i;
        })
        .end()
        .on("change", sObj.tab, _this.move);

    this.activeIndex = checkedIndex;

    return this;
};

Tabs.prototype.move = function(e) {
    var newIndex = $(e.target).data("sIndex");

    if (newIndex === this.activeIndex) return;

    this.$panels.removeClass("is-active").eq(newIndex).addClass("is-active");
    this.activeIndex = newIndex;
};

/**
 * searchUI
 * @description     Control UI components(e.g. reset button) in search form.
 */
var searchUI = {
    init: function(selector) {
        selector = selector || ".js-search-ui";

        return $(selector).each(function() {
            var $container = $(this);
            var $field = $(".js-search-field", $container);
            var $reset = $(".js-search-reset", $container);
            var resetShown = true;

            var toggleReset = function(value) {
                if (resetShown) {
                    if (!value) {
                        $reset.css("display", "none");
                        resetShown = false;
                    }
                } else if (value) {
                    $reset.css("display", "block");
                    resetShown = true;
                }
            };

            toggleReset($reset.val());

            $field.on("change cut paste keydown keyup", function() {
                toggleReset(this.value);
            });
        });
    }
};

/**
 * select2
 * @docs    https://select2.org/options
 */
var select2 = {
    prepare: function() {
        $.fn.select2.defaults.set("theme", "basic");
        $.fn.select2.defaults.set("minimumResultsForSearch", Infinity);
        $.fn.select2.defaults.set("noResults", function() {
            return "";
        });
    },
    init: function(selector) {
        var $select;
        var defaults = {
            language: {
                noResults: function() { return "" }
            }
        };
        toJqueryElement(selector).each(function() {
            $select = $(this);
            $select.select2($.extend(defaults, $select.data("config")));
            //console.log(this, $select.data("config"));
        });
    },
    update: function(selector, dataArray) {
        var $select = toJqueryElement(selector);
        var $option, key;

        // remove old options
        $select.html("");

        // insert new options
        dataArray.forEach(function(item) {
            $option = $("<option />").prop("value", item.value).text(item.text);
            $select.append($option);
        });

        // make select2 update based on the DOM changes above
        $select.trigger("change");
    },
    disable: function(selector) {
        return toJqueryElement(selector).prop("disabled", true);
    },
    enable: function(selector) {
        return toJqueryElement(selector).prop("disabled", false);
    }
};

/**
 * inputSelect
 * @description   Selectable box + custom input field.
 */
var inputSelect = {
    init: function(selectorObj) {
        var $container = toJqueryElement(selectorObj.container);
        var $field = $container.find(selectorObj.field);
        var $dropdown = $container.find(selectorObj.dropdown);

        var handleSelect = function(e) {
            var selectedValue = $(this).text();
            $field.val(selectedValue);
        };

        $field.on("focus", function(e) {
            $dropdown.addClass("is-active");
            // use `mousedown` instead of `click` since click fires after blur
            // thus making callback unreachable
            $dropdown.on("mousedown", "a", handleSelect);
        }).on("blur", function(e) {
            $dropdown.removeClass("is-active");
            $dropdown.off("mousedown", "a", handleSelect)
        });
    }
};

/**
 * DatePicker
 * @docs    http://api.jqueryui.com/1.11/datepicker/
 */
var datepicker = {
    i18n: {
        "ko-KR": {
            dateFormat: "yy.m.d",
            monthNames: ["1","2","3","4","5","6","7","8","9","10","11","12"],
            monthNamesShort: ["1","2","3","4","5","6","7","8","9","10","11","12"],
            dayNames: ["일요일","월요일","화요일","수요일","목요일","금요일","토요일"],
            dayNamesShort: ["일","월","화","수","목","금","토"],
            dayNamesMin: ["일","월","화","수","목","금","토"],
            nextText: "다음",
            prevText: "이전",
            currentText: "오늘",
            closeText: "닫기",
            firstDay: 0,
            showMonthAfterYear: true,
            yearSuffix: "."
        }
    },
    settings: {
        selectOtherMonths: true,
        showButtonPanel: true,
        showOtherMonths: true
    },
    prepare: function() {
        var i18n = datepicker.i18n["ko-KR"];
        $.datepicker.setDefaults(i18n);
    },
    init: function(selector) {
        var $container, settings;

        return toJqueryElement(selector).each(function() {
            $container = $(this);
            settings = $.extend({}, datepicker.settings, $container.data("config"));
            $container.datepicker(settings).addClass("is-init");
        });
    }
};

/**
 * TimePicker
 * @docs    http://jonthornton.github.io/jquery-timepicker/
 */
var timepicker = {
    defaults: {
        lang: {
            am: "오전",
            pm: "오후",
            AM: "오전",
            PM: "오후"
        },
        timeFormat: "a g:i"
    },
    disable: function(selector) {
        return toJqueryElement(selector).find(".timepicker-input").prop("disabled", true).end().addClass("is-disabled");
    },
    enable: function(selector) {
        return toJqueryElement(selector).find(".timepicker-input").prop("disabled", false).end().removeClass("is-disabled");
    },
    init: function(selector) {
        var $container, settings;

        return toJqueryElement(selector).each(function() {
            $container = $(this);

            var $input = $container.find(".timepicker-input");
            var $caret = $container.find(".timepicker-caret");
            var isVisible;

            settings = $.extend({}, timepicker.defaults, $container.data("config"));
            $input.timepicker(settings);

            $caret.on("click", function() {
                if (isVisible) {
                    $input.timepicker("hide");
                    isVisible = false;
                } else {
                    $input.timepicker("show");
                    isVisible = true;
                }
            });
        });
    }
};

/**
 * Noty
 * @docs    https://ned.im/noty/#/options
 */
var noty = {
    defaults: {
        type: "info", // info, success, warning, loading
        text: "",
        theme: "basic",
        layout: "bottomCenter",
        timeout: 3000,
        progressBar: false,
        animation: {
            open: "noty-in",
            close: "noty-out"
        }
    },
    queue: [],
    add: function(config) {
        var instance, mod, settings;

        if (config.type === "loading") {
            mod = {
                theme: "clean",
                layout: "center",
                modal: true,
                closeWith: [],
                timeout: false,
                animation: {
                    open: null,
                    close: null
                }
            };
        }

        settings = $.extend(true, {}, noty.defaults, config, mod);
        instance = new Noty(settings).show();

        // add noty instance to the queue to gain further control
        noty.queue.push(instance);

        if (settings.modal) blockScroll();

        return instance;
    },
    remove: function(instance) {
        // if a spacific noty instance is passed
        if (instance && typeof instance.close === "function") {
            instance.close();
        }
        // otherwise, close all instances
        else {
            // Noty.closeAll fails on notifications that do not use animation.
            // Noty.closeAll();
            noty.queue.forEach(function(n) {
                n.close();
            });
        }
        unblockScroll();
    }
};

/**
 * toggler
 * @description     collapse/expand widgets in sidebar
 */
var toggler = {
    defaults: {
        speed: 300,
        type: "slide"
    },
    collapse: function($trigger, $content, config) {
        $trigger.removeClass("is-active");

        switch (config.type) {
            case "slide":
                $content.stop().slideUp(config.speed);
            break;

            default:
                $content.removeClass("is-active");
            break;
        }
    },
    expand: function($trigger, $content, config) {
        $trigger.addClass("is-active");

        switch (config.type) {
            case "slide":
                $content.stop().slideDown(config.speed);
            break;

            default:
                $content.addClass("is-active");
            break;
        }
    },
    init: function(selectorObj, config) {
        var $container;
        var settings = $.extend({}, toggler.defaults, config);

        return toJqueryElement(selectorObj.container).each(function(i, container) {
            $container = $(container);

            $container.on("click", selectorObj.trigger, function(e) {
                var $trigger = $(this);
                var $content = (function() {
                    if (typeof selectorObj.content === "function") {
                        return selectorObj.content($trigger);
                    } else {
                        return $container.find(selectorObj.content);
                    }
                })();

                if ($trigger.hasClass("is-active")) {
                    toggler.collapse($trigger, $content, settings);
                } else {
                    toggler.expand($trigger, $content, settings);
                }
            });
        });
    }
};

/**
 * monthRespView
 * @description   Toggle schedules in month view based on viewport size.  
 */
var monthRespView = {
    elements: {
        $container: ".mv-month",
        $rows: ".mv-month-body-row-data",
        $restCounters: ".mv-month-body-row-data-rest-count"
    },
    MAX_VISIBLE: 6,
    toggle: function() {
        var rowHeight, availableHeight, restCountArr, restCountSlice, colspan;
        
        // calculate available space for schedule rows
        rowHeight = monthRespView.elements.$rows.first().outerHeight();
        availableHeight = rowHeight - 49; // -dayname(27px) -restcount(22px)
        restCountArr = []; // collection of hidden schedule's count for each calendar day

        // loop through each rows(weeks)
        monthRespView.elements.$rows.each(function(i, row) {
            restCountSlice = [0, 0, 0, 0, 0, 0, 0];

            // look into each schedule rows
            $(row).find(".mv-month-body-row-data-sch").each(function(j, dataRow) {
                // if there are more schedules than the max visible number,
                // or if there is NOT enough avialable space for the schedules
                if ((j >= monthRespView.MAX_VISIBLE) || (availableHeight < (j + 1) * 21)) {
                    // hide row
                    dataRow.classList.add("is-hidden");

                    toArray(dataRow.cells).forEach(function(dataCell, k) {
                        // if the cell has a schedule within it
                        if (dataCell.childElementCount > 0) {
                            restCountSlice[k + colspan - 1]++;
                        }
                        // apply colspans it to the next loop index
                        colspan = dataCell.colSpan;
                    });
                } else {
                    // otherwise, reveal row
                    dataRow.classList.remove("is-hidden");
                }
            });

            // add rest counts of the row to the comprehensive count array
            restCountArr = restCountArr.concat(restCountSlice);
        })

        // using the count array above, update all `+N` counts
        monthRespView.elements.$restCounters.text(function(i) {
            return restCountArr[i] > 0 ? "+" + restCountArr[i] : "";
        });

        // if row height is too small to display counts, hide them
        //monthRespView.elements.$container[rowHeight < 32 ? "addClass" : "removeClass"]("hide-rest-counts");
    },
    init: function() {
        // parse `elements` object values as jQuery object
        monthRespView.elements = parseSelectorObj(monthRespView.elements);
        // launch toggle once
        monthRespView.toggle();
        // everytime the viewports updates, relaunch toggle
        // ** debounced: as the toggle method is pretty expensive, we would prefer
        // NOT to execute it everytime the resize event fires.
        $(window).on("resize orientationchange", debounce(monthRespView.toggle, 10));
    }
};

/**
 * colorPicker
 * @description     choose color from checkboxe ui
 */
var colorPicker = {
    init: function(selectorObj) {
        var $container = toJqueryElement(selectorObj.container);
        var $current = $container.find(selectorObj.current);

        $container.on("change", selectorObj.checkbox, function() {
            switchColor($current, this.value);
        });
    }
};

/**
 * fileView
 * @description     File manager layer's UI
 */
var fileView = {
    init: function() {
        var $container = $(".modal-schedule-add-file");

        // swap content view (list // grid)
        $container.find(".modal-content-view-toggler").click(function() {
            switch ($container.attr("data-file-view")) {
                case "list":
                    $container.attr("data-file-view", "grid");
                break;
                case "grid":
                    $container.attr("data-file-view", "list");
                break;
            }
        });

        // insert attached file info into the `attachment` row
        $container.find(".modal-content-switch-radio:eq(1)").change(function() {
            if (this.checked) {
                var $modal = $(".modal-schedule-edit");

                $modal
                    .find("input[type='file']")
                    .trigger("click")
                    .one("change", function(e) {
                        var files = e.target.files;
                        var fileInfo = "";

                        $.each(files, function(i, file) {
                            fileInfo += "<div>" + "<i class='icon-file-" + getFileExtension(file.name) + "'></i> " + file.name + "</div>";
                        });

                        $modal.find(".added-file").html(fileInfo).end()
                            .find(".modal-fieldset-row.attachment").addClass("has-attachment");
                        $container.removeClass("is-active");
                    });
            }
        });
    }
};

// Function executions ----------------------------------------

// Export modules to gain control from outside
exportModule("noty", noty);
exportModule("select2", select2);
exportModule("timepicker", timepicker);

// Execute immediately
modalStore.init();
select2.prepare();
datepicker.prepare();

// Execute when document gets ready
$(function() {

    // 헤더: 계정 추가 메뉴
    new Modal({
        trigger: ".header-nav-item-more",
        layer: ".header-nav-item-dropdown",
        overlay: false
    });

    // 사이드바: 새 일정
    new Modal({
        context: ".sidebar",
        trigger: ".add-new-event-button",
        layer: ".modal-schedule-edit",
        position: {
            of: function($trigger) {
                return $(".content");
            },
            my: "center",
            at: "center"
        }
    });
    // 사이드바: 위젯 숨기고 펼치기
    toggler.init({
        container: ".sidebar",
        trigger: ".sidebar-widget-toggler",
        content: function($toggler) {
            return $toggler.closest(".sidebar-widget").find(".sidebar-widget-content");
        }
    });
    // 사이드바: 캘린더 >> 추가 메뉴
    $(".my-groups-list-item-more").each(function() {
        var $trigger = $(this);
        var $layer = $trigger.parent().find(".my-groups-list-item-onoff");

        new Modal({
            trigger: $trigger,
            layer: $layer,
            overlay: false
        });
    });
    // 사이드바: 캘린더 >> 추가 메뉴 >> 캘린더 설정
    new Modal({
        context: ".sidebar",
        trigger: ".js-modal-calendar-edit-opener",
        layer: ".modal-calendar-edit"
    });
    // 사이드바: 캘린더 >> 추가 메뉴 >> 구글 캘린더 연결
    new Modal({
        context: ".sidebar",
        trigger: ".js-modal-gcalendar-link-opener",
        layer: ".modal-gcalendar-link"
    });
    // 사이드바: 캘린더 >> 추가 메뉴 >> 구글 캘린더 연결 해제
    new Modal({
        context: ".sidebar",
        trigger: ".js-modal-gcalendar-unlink-opener",
        layer: ".modal-gcalendar-unlink"
    });
    // 사이드바: 캘린더 >> 추가 메뉴 >> 구글 캘린더 싱크
    new Modal({
        context: ".sidebar",
        trigger: ".js-modal-gcalendar-sync-opener",
        layer: ".modal-gcalendar-sync"
    });
    
    // 캘린더 내비게이션: 일/주/월/일정 탭 전환
    new Tabs({
        container: ".main",
        tabGroup: ".main-nav-switch",
        tab: ".main-nav-switch-radio",
        panel: ".main-view-panel"
    });

    // 캘린더(월간): 새 일정 만들기 (빈 셀 클릭)
    new Modal({
        context: ".mv-month",
        trigger: ".mv-month-body-row",
        layer: ".modal-schedule-edit",
        position: {
            of: function($trigger) {
                return $(".content"); 
            },
            my: "center",
            at: "center"
        }
    });
    // 캘린더(월간 이외): 새 일정 만들기 (빈 셀 클릭)
    new Modal({
        context: ".main",
        trigger: ".js-sch-cell",
        layer: ".modal-schedule-edit",
        position: {
            of: function($trigger) {
                return $(".content"); 
            },
            my: "center",
            at: "center"
        }
    });
    // 캘린더(월간): 일정 보기
    new Modal({
        context: ".mv-month",
        trigger: ".js-sch",
        layer: ".modal-schedule-view",
        position: {
            of: function($trigger) {
                return $trigger.closest("td");
            },
            my: "left-1 top",
            at: "right top"
        },
        stopPropagation: true,
        onShow: switchModalIconColor
    });
    // 캘린더(주간, 종일일정): 일정 보기
    new Modal({
        context: ".mv-cols-week",
        trigger: ".all-sche",
        layer: ".modal-schedule-view",
        position: {
            of: function($trigger) {
                return $trigger.closest("td");
            },
            my: "left top",
            at: "right top"
        },
        stopPropagation: true,
        onShow: switchModalIconColor
    });
    // 캘린더(주간, 부분일정): 일정 보기
    new Modal({
        context: ".mv-cols-week",
        trigger: ".sch-time",
        layer: ".modal-schedule-view",
        position: {
            of: function($trigger) {
                return $trigger.closest(".sch-group");
            },
            my: "left top",
            at: "right top"
        },
        stopPropagation: true,
        onShow: switchModalIconColor
    });
    // 캘린더(일간): 일정 보기
    new Modal({
        context: ".mv-cols-day",
        trigger: ".js-sch",
        layer: ".modal-schedule-view",
        position: {
            of: function($trigger) {
                return $(".content");
            },
            my: "center",
            at: "center"
        },
        stopPropagation: true,
        onShow: switchModalIconColor
    });
    // 캘린더(월간): 일정 보기
    new Modal({
        context: ".mv-list-table",
        trigger: ".list-sch",
        layer: ".modal-schedule-view",
        position: {
            of: function($trigger) {
                return $trigger;
            },
            my: "left top",
            at: "left bottom"
        },
        onShow: switchModalIconColor
    });
    // 캘린더(월간): 일정 숨기고 보이기
    monthRespView.init();
    // 캘린더(월간): 숨은 일정 더 보기
    new Modal({
        context: ".mv-month",
        trigger: ".mv-month-body-row-data-rest-count",
        layer: ".modal-schedule-reveal",
        position: {
            of: function($trigger) {
                var index = $trigger.closest("td").index();
                return $trigger.closest(".mv-month-body-row").find(".mv-month-body-row-bg-cell:eq(" + index + ")");
            },
            my: "center",
            at: "center"
        },
        stopPropagation: true
    });
    // 캘린더(월간): 숨은 일정 >> 일정 보기
    new Modal({
        context: ".modal-schedule-reveal",
        trigger: ".sch-list-item-link",
        layer: ".modal-schedule-view", 
        position: {
            of: function($trigger) {
                return $(".content");
            },
            my: "center",
            at: "center"
        }
    });
    // 캘린더(공통): 일정 편집 (일정 보기 -> 일정 편집에도 적용 가능)
    new Modal({
        trigger: ".js-modal-schedule-edit-opener",
        layer: ".modal-schedule-edit",
        position: {
            of: function($trigger) {
                return $(".content");
            },
            my: "center",
            at: "center"
        }
    });
    // 팝업 내부: 일정 보기 또는 편집 >> 일정 삭제
    new Modal({
        trigger: ".js-modal-schedule-delete-opener",
        layer: ".modal-schedule-delete"
    });
    // 팝업 내부: 일정 보기 >> `반복`에 체크
    $(".modal-schedule-edit .schedule-repeat").change(function(e) {
        $(this).closest(".modal-fieldset-row")[this.checked ? "addClass" : "removeClass"]("is-repeating");
    });
    // 팝업 내부: 일정 보기 >> 일정 반복 주기 수정
    new Modal({
        trigger: ".js-modal-schedule-edit-inr-opener",
        layer: ".modal-schedule-edit-inr"
    });
    // 팝업 내부: 일정 보기 >> 지도 보이기/숨기기
    toggler.init({
        container: ".modal-schedule-view",
        trigger: ".js-location-map-show",
        content: function($trigger) {
            return $trigger.closest(".modal").find(".js-location-map");
        }
    }, {
        type: "none"
    });
    // 팝업 내부: 일정 편집 >> 지도 보이기/숨기기
    toggler.init({
        container: ".modal-schedule-edit",
        trigger: ".js-location-map-show",
        content: function($trigger) {
            return $trigger.closest(".modal").find(".js-location-map");
        }
    }, {
        type: "none"
    });
    // 팝업 내부: 일정 편집 >> 지도 삭제
    new Modal({
        trigger: ".js-modal-map-delete-opener",
        layer: ".modal-map-delete"
    });
    // 팝업 내부: 일정 편집 >> 파일 첨부
    new Modal({
        trigger: ".js-modal-schedule-add-file-opener",
        layer: ".modal-schedule-add-file"
    });
    // 팝업 내부: 일정 편집 >> 일정 색상 선택
    colorPicker.init({
        container: ".js-color-picker",
        checkbox: ".palette-state",
        current: ".palette-current-item"
    });

    // 팝업 내부: 넷피스 24 / 컴퓨터 탭 전환
    // new Tabs({
    //     container: ".modal-schedule-add-file",
    //     tabGroup: ".modal-content-switch",
    //     tab: ".modal-content-switch-radio",
    //     panel: ".modal-content-panel"
    // });

    // 검색 폼의 화면 출력을 제어
    searchUI.init(".js-search-ui");

    // select, input 태그에 select2 플러그인 적용
    select2.init(".js-select");

    // input + list에 inputSelect 모듈 적용
    inputSelect.init({
        container: ".js-input-select",
        field: ".js-input-select-field",
        dropdown: ".js-input-select-dropdown"
    });

    // datepicker, timepicker 컨테이너에 각각 플러그인 적용
    datepicker.init(".js-datepicker");
    timepicker.init(".js-timepicker");

    // 넷피스 24 리스트/그리드 뷰 전환
    fileView.init();

});

// TEST SCRIPTS (TO BE SAFELY REMOVED AFTER DEV) **************
$(function() {
    var testMap = {
        selector: "#mdLocationMapEdit",
        map: {
            zoom: 17,
            center: {
                lat: 37.401,
                lng: 127.1127
            },
            mapTypeControl: false,
            streetViewControl: false
        },
        marker: {
            position: {
                lat: 37.4006964,
                lng: 127.11218340000005
            }
        }
    };

    $(".modal-schedule-edit .js-location-map-show").click(function() {
        var $map = $(this).closest(".modal").find(testMap.selector);

        if (!$map.data("gmap-init")) {
            renderGoogleMaps(testMap);
            $map.data("gmap-init", true);
        }
    });

    function renderGoogleMaps(config) {
        var container = document.querySelector(config.selector),
            map, marker;

        if (!container) {
            console.error("Unable to find HTML element matching " + config.selector + ".");
            return;
        }

        map = new google.maps.Map(container, config.map);

        if (typeof config.marker === "object") {
            config.marker.map = map;
            marker = new google.maps.Marker(config.marker);
        }
    }
});

// Utility functions ------------------------------------------

function exportModule(name, module) {
    if (window[name]) {
        console.warn("exportModule Abort: " + name + " already exists in the global namespace.");
        return;
    }
    window[name] = module;
}
function uuid(a) {
    return a ? (a^Math.random()*16>>a/4).toString(16) : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, uuid);
}
function isJqueryElement(elem) {
    return (elem instanceof $);
}
function toJqueryElement(elem) {
    if (typeof elem === "undefined") {
        return null;
    }
    return isJqueryElement(elem) ? elem : $(elem);
}
function toPlainElement($elem) {
    if (typeof $elem === "undefined") return null;
    return isJqueryElement($elem) ? $elem[0] : $elem;
}
function parseSelectorObj(obj) {
    var key;
    for (key in obj) {
        if (!obj.hasOwnProperty(key)) continue;
        obj[key] = $(obj[key]);
    }
    return obj;
}
function toArray(collection) {
    return Array.prototype.slice.call(collection);
}
function isDelegationTarget(event, elem) {
    elem = toPlainElement(elem);
    return (event.target !== elem) && !(elem.contains(event.target));
}
function getFileExtension(filename) {
    var match = String(filename).match(/\.([^\.]+)$/);
    return match ? match[1] : "";
}
function blockScroll() {
    $("html").addClass("scroll-blocked");
}
function unblockScroll() {
    $("html").removeClass("scroll-blocked");
}
// Taken from Underscore.js
// The function will be called after it stops being called for N milliseconds.
// @param {Function} func -- callback function to execute
// @param {Boolean} wait -- waiting time before execution
// @param {Boolean} immediate -- trigger the function at the beginning instead
function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

// Custom functions -------------------------------------------

var colorClassNamePatt = /\b(txt|bg)-clr-(\d+)\b/;

function switchColor(el, colorIndex) {
    el = toPlainElement(el);
    var lookup = new RegExp(colorClassNamePatt.source, "g");

    if (colorClassNamePatt.test(el.className)) {
        el.className = el.className.replace(lookup, "$1-clr-" + colorIndex);
    }
}

function switchModalIconColor(modal) {
    var triggerColor = (function($el) {
        return $el.data("color") || $el.find(".sch-clr").attr("class").match(colorClassNamePatt)[2];
    })(modal.$trigger);

    if (isNaN(triggerColor) || triggerColor < 1 || 10 < triggerColor) {
        console.error(triggerColor + " is not a valid color value.");
    }
    if (triggerColor) {
        var icon = modal.$layer.attr("data-schedule-color", triggerColor);
    }
}
}(window, document, jQuery));
