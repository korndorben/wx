/**
 * Created by itachi on 16/4/25.
 */

define(["util"], function (util) {
    return can.Component.extend({
        tag: "storemenusearch",
        template: can.view(util.getView("storemenu.search.mustache")),
        viewModel: {
            storeMenuList: null,
            purchaseTotalNum: 0,
            purchaseTotalPrice: 0,
            purchaseOriginalPrice: 0,
            isModify: can.compute(true),
            isTotalDiscount: can.compute(function () {
                return this.attr("purchaseTotalPrice") != this.attr("purchaseOriginalPrice");
            }),
            showCartBar: can.compute(function () {
                return this.attr("purchaseTotalNum") > 0;
            }),
            totalNumForShow: can.compute(function () {
                var purchaseTotalNum = this.attr("purchaseTotalNum");
                return purchaseTotalNum ? (purchaseTotalNum > 99 ? "N" : purchaseTotalNum) : "";
            }),
            totalPriceForShow: can.compute(function () {
                var purchaseTotalPrice = this.attr("purchaseTotalPrice");
                if (purchaseTotalPrice) {
                    purchaseTotalPrice = parseFloat(purchaseTotalPrice);
                    if (purchaseTotalPrice < 0) {
                        purchaseTotalPrice = 0;
                    }
                }
                return purchaseTotalPrice.toFixed(2);
            }),
            totalOriginalPriceForShow: can.compute(function () {
                var purchaseTotalPrice = this.attr("purchaseOriginalPrice");
                if (purchaseTotalPrice) {
                    purchaseTotalPrice = parseFloat(purchaseTotalPrice);
                    if (purchaseTotalPrice < 0) {
                        purchaseTotalPrice = 0;
                    }
                }
                return purchaseTotalPrice.toFixed(2)
            }),
            cartTemplate: null,
            selectionTemplate: null,
            selectedTemplate: null,
            cartData: {},
            searchSuggestion: [],
            searchResult: [],
            searchRecord: [],
            orderInfo: null,
            showClearInput: false,
            hideListener: null,
            destory: function () {
                console.info("destory");
            },
            init: function () {
                var self = this, timeInterval = null;
                self.attr("wapcontext", Config.wapcontext);
                self.attr("searchRecord", JSON.parse(util.getLocalItem("store.menu.search")) || []);
                self.attr("orderInfo", util.getOrderInfo());
                self.attr("storeMenuList", util.getSessionItem("store.menu.list"));
                self._render();
                self.refreshStoreMenuList();
                timeInterval = setTimeout(function () {
                    clearTimeout(timeInterval);
                    util.Busy.stop();
                }, 500);
                this.hideListener = function (evt) {
                    console.info(evt);
                    if ($("#selected-lay-js").length > 0) {
                        self.hideSelectedBox();
                    } else if ($("#selection-lay-js").length > 0) {
                        self.hideSelectionBox();
                    } else if ($("#cert-lay-js").length > 0) {
                        self.hideCartBox();
                    } else if($("#layer-box02-js").length > 0){
                        self.hideDetailBox();
                    }else if($("#setMeal-lay-js").length > 0){
                        self.hideSetMealBox();
                    }
                };
                window.addEventListener('popstate', self.hideListener, false);
            },
            _render: function () {
                $("#wrapper-main").height(window.innerHeight);
                $(".carte-box").width(window.innerWidth);
                $(".menulist").width(window.innerWidth);
                var $container = $("#wrapper-box-js");
                if (this.showCartBar()) {
                    $container.css("bottom", 50);
                } else {
                    $container.css("bottom", 0);
                }
                $container.css("top", 44);
            },
            _seachByKey: function (key) {
                var self = this;
                var searchSuggestion = [];
                if (key) {
                    var searchKeyArray = [];
                    var searchResultArray = [];
                    can.each(self.storeMenuList, function (storeMenu, storeMenuIndex) {
                        can.each(storeMenu.menus, function (menu, menuIndex) {
                            console.info(menu["name"]);
                            if ((util.isContainStringNOCaseInsensitive(menu["name"], key)
                                || util.isContainStringNOCaseInsensitive(menu["brevityCode"], key)
                                || util.isContainStringNOCaseInsensitive(menu["code"], key))
                                && $.inArray(menu.systemId, searchKeyArray) < 0) {
                                searchKeyArray.push(menu.systemId);
                                var searchKeyObject = {};
                                searchKeyObject["systemId"] = menu.systemId;
                                searchKeyObject["name"] = menu.name;
                                searchKeyObject["firstLevelIndex"] = storeMenuIndex;
                                searchKeyObject["secondLevelIndex"] = menuIndex;
                                searchSuggestion.push(searchKeyObject);
                                searchResultArray.push(menu);
                            }
                        });
                    });
                }
                if (this.showCartBar() && searchResultArray.length > 0)
                    $(".order-layer").removeClass("hideCartBar").addClass("showCartBar");
                self.attr("searchRecord", JSON.parse(util.getLocalItem("store.menu.search")) || []);
                return {searchSuggestion: searchSuggestion, searchResult: searchResultArray};
            },
            _syncPurchaseNumber: function (searchItem) {
                var orderInfo = this.orderInfo;
                can.each(orderInfo.items, function (item, index) {
                    if (searchItem.foodGroupStatus == 0) {
                        if (item.systemId == searchItem.systemId) {
                            searchItem.quantity = item.quantity;
                        }
                    } else {
                        can.each(searchItem.foodChoice, function (childFoodObject, j) {
                            if (childFoodObject.systemId == item.systemId) {
                                childFoodObject.quantity = item.quantity;
                            }
                        });
                    }
                });
            },
            closeSearch: function () {
                var self = this;
                Util.Busy.start();
                if (this.isModify()) {
                    var selectedFoodItems = self.genSyncOrderItems();
                    var orderObject = util.getOrderInfo();
                    orderObject.items = selectedFoodItems;
                    util.saveOrderInfo(orderObject);
                    self.isModify(false);
                    util.removeLocalTempOrders();
                }
                window.removeEventListener("popstate", self.hideListener);
                Util.Route.back({pageChageOption: null});
            },
            clearSearch: function () {
                var self = this;
                // 清空搜索栏
                $("#searchKey").val("");
                // 清空搜索结果
                self.attr("searchResult", []);

                var searchRecord = JSON.parse(util.getLocalItem("store.menu.search")) || [];
                if (searchRecord.length > 0) {
                    $("#hos-box-js").show();
                }
            },
            searchByKey: function () {
                $(".search-lading-area").hide();
                var self = this;
                var searchKey = $.trim($("#searchKey").val());
                if (!searchKey) {
                    Util.showInstantMessage({
                        content: "请输入搜索关键字",
                        duration: 3000
                    });
                    return;
                }
                var searchRecord = JSON.parse(util.getLocalItem("store.menu.search")) || [];
                var isSearched = false;
                can.each(searchRecord, function (searchRecordItem, index) {
                    if (searchRecordItem.searchKey === searchKey) {
                        isSearched = true;
                    }
                });
                if (!isSearched) {
                    if (searchRecord.length >= 5) {
                        searchRecord[0] = {"searchKey": searchKey};
                    } else {
                        searchRecord.unshift({"searchKey": searchKey});
                    }
                }
                util.setLocalItem("store.menu.search", JSON.stringify(searchRecord));
                var searchResultItems = this._seachByKey(searchKey).searchResult;
                if (searchResultItems && searchResultItems.length > 0) {
                    $(".carte-box").show();
                    $("#rest-un-js").hide();
                    $("#hos-box-js").hide();
                    can.each(searchResultItems, function (searchItem, index) {
                        self._syncPurchaseNumber(searchItem);
                    });
                    self.attr("searchResult", searchResultItems);
                } else {
                    $("#rest-un-js").show();
                    $("#hos-box-js").show();
                }
                util.lazyLoad.lazy({time_out: 1000});
            },
            settlement: function (H, G, I) {
                var self = this;
                util.Busy.start();
                if (this.isModify()) {
                    var selectedFoodItems = self.genSyncOrderItems();
                    var orderObject = util.getOrderInfo();
                    orderObject.items = selectedFoodItems;
                    util.saveOrderInfo(orderObject);
                    self.isModify(false);
                    util.removeLocalTempOrders();
                }
                window.clearInterval(window.adInterval);
                util.Route.route(this, {page: "order", func: "tallyup"});//tallyup
                I.preventDefault();
                return false
            },
            genSyncOrderItems: function () {
                var orderInfo = util.getOrderInfo();
                var orderItemsArray = new Array();
                var self = this;
                var selectedItemsDictionary = {};

                // 搜集所有已经选择的菜品
                can.each(self.attr("storeMenuList"), function (storeMenu, K) {
                    can.each(storeMenu.attr("menus"), function (menu, N) {
                        menu.selectedItems.forEach(function (selectedItem) {
                            orderItemsArray.push({
                                systemId: selectedItem.systemId,
                                parentId: selectedItem.parentId,
                                price: selectedItem.price,
                                originalPrice: selectedItem.originalPrice,
                                isDiscount: selectedItem.price != selectedItem.originalPrice,
                                quantity: selectedItem.quantity,
                                name: selectedItem.name,
                                parentName: selectedItem.parentName,
                                isParent: selectedItem.isParent,
                                setMealFlag: selectedItem.setMealFlag,
                                deleted: 0,
                                taste: selectedItem.taste,
                                index: menu.index,
                                menuIndex: menu.menuIndex,
                                isSpecification: menu.isSpecification,// 带口味的哦
                                remainQuantity: menu.currentRemainQuantity,
                                totalRemainQuantity: menu.remainQuantity,
                                items:selectedItem.items ? selectedItem.items.attr() : []
                            });
                        });
                    })
                });
                return orderItemsArray;
            },
            _renderCart: function () {
                var orderInfo = util.getOrderInfo();
                var orderItems = orderInfo.items;
                var totalObject = util.calculateSum();
                this.attr("purchaseTotalNum", totalObject.quantity);
                this.attr("purchaseTotalPrice", totalObject.price);
                this.attr("purchaseOriginalPrice", totalObject.originalPrice);
                var self = this;
                if (orderItems && orderItems.length > 0) {
                    self.cartData.attr("orderedItems", orderItems);
                    util.Busy.stop();
                } else {
                    $("#cart-box").hide();
                    $("#cart-box").remove();
                    this.cartTemplate = null;
                    self.cartData.attr("orderedItems", []);
                    util.Busy.stop();
                }
            },
            _addProductNum: function (event, model, baseQuantity) {
                if (!model.activeFlag) {
                    util.showInstantMessage({content: "该产品目前无法订购，请谅解"});
                    return;
                }

                var quantity = model.attr("quantity");
                model.attr("quantity", quantity + baseQuantity);

                var currentRemainQuantity = model.attr("currentRemainQuantity");
                model.attr("currentRemainQuantity", currentRemainQuantity - 1);
                if(!model.setMealFlag){
                    if (model.selectedItems.length == 0) {
                        model.selectedItems.push({
                            systemId: model.selectedSystemId,
                            parentId: model.selectedSystemId,
                            price: model.selectedPrice,
                            originalPrice: model.originalPrice,
                            isDiscount: model.price != model.originalPrice,
                            quantity: model.quantity,
                            name: model.name,
                            setMealFlag: model.setMealFlag,
                            parentName: model.parentName,
                            taste: model.selectedTaste,
                            isParent: model.isParent,
                            deleted: 0
                        });
                    } else {
                        model.selectedItems[0].quantity = model.attr("quantity");
                    }
                }
                this.updateItemTopClass(model, true, baseQuantity);
                this.updateLocalCartInfo(model, true, baseQuantity)
            },
            _fly: function () {
                var currentTapElement = $(event.target).offset();
                var Q = window.innerHeight - 40,
                    screenLeftEdgeToCartIconCenterX = 30,
                    circleElementLeft = currentTapElement.left + 10,
                    circleElementTop = currentTapElement.top + 10;
                var $circleElements = $("#pointDivs .point-pre").first().removeClass("point-pre").css({
                    left: circleElementLeft + "px",
                    top: circleElementTop + "px"
                });
                var firstCircleElement = $circleElements.find(".point-inner");
                setTimeout(function () {
                    $circleElements[0].style.webkitTransform = "translate3d(0," + (Q - circleElementTop) + "px,0)";
                    firstCircleElement[0].style.webkitTransform = "translate3d(" + (screenLeftEdgeToCartIconCenterX - circleElementLeft) + "px,0,0)";
                    setTimeout(function () {
                        $circleElements.removeAttr("style").addClass("point-pre");
                        firstCircleElement.removeAttr("style");
                        // 购物篮动画效果
                        $("#cart-animate").animate("zoomInout", 200);
                    }, 550);
                }, 1);
            },
            _minusProductNum: function (model) {
                var quantity = model.quantity - 1;
                var currentRemainQuantity = model.attr("currentRemainQuantity");
                model.attr("currentRemainQuantity", currentRemainQuantity + 1);
                model.attr("quantity", quantity < 0 ? 0 : quantity);
                this.updateLocalCartInfo(model, false, 1);
            },
            // 更新左侧分类
            updateItemTopClass: function (model, isAdd, baseQuantity) {
                // 搜索界面不需要更新左侧
                return false;
            },
            // 更新购物车
            updateLocalCartInfo: function (model, isAdd, baseQuantity) {
                this.isModify(true);
                var purchaseTotalNum = this.purchaseTotalNum;
                var operatedPurchaseTotalNum = isAdd ? purchaseTotalNum + baseQuantity : purchaseTotalNum - baseQuantity;
                this.attr("purchaseTotalNum", operatedPurchaseTotalNum);
                var purchaseTotalPrice = this.purchaseTotalPrice;
                var purchaseOriginalTotalPrice = this.purchaseOriginalPrice;
                // 总现价
                var operatedPurchaseTotalNum = isAdd ? (purchaseTotalPrice * 100) + (model.selectedPrice * 100 * baseQuantity) : (purchaseTotalPrice * 100) - (model.selectedPrice * 100);
                operatedPurchaseTotalNum = operatedPurchaseTotalNum / 100;
                this.attr("purchaseTotalPrice", operatedPurchaseTotalNum);
                // 总原价
                var operatedOriginalTotalNum = isAdd ? (purchaseOriginalTotalPrice * 100) + (model.originalPrice * 100 * baseQuantity) : (purchaseOriginalTotalPrice * 100) - (model.originalPrice * 100);
                operatedOriginalTotalNum = operatedOriginalTotalNum / 100;
                this.attr("purchaseOriginalPrice", operatedOriginalTotalNum);

            },
            updateCartOrderItem: function (orderItemModel, isAdd) {
                var self = this;
                var orderInfo = util.getOrderInfo();
                var menuList = this.attr("storeMenuList");
                var menuObject = menuList[orderItemModel.index].menus[orderItemModel.menuIndex];

                // 判断是否超出可订购范围
                var currentRemainQuantity = menuObject["currentRemainQuantity"];
                var remainQuantity = menuObject["remainQuantity"];
                var quantity = menuObject.quantity;

                // 需要沽清时判断
                if (!orderItemModel.isParent && isAdd && currentRemainQuantity == 0) {
                    util.showInstantMessage({content: "该产品最多可订购" + remainQuantity + "份"});
                    return;
                }

                // 剩余数量
                orderItemModel.remainQuantity = orderItemModel.remainQuantity - isAdd ? 1 : -1;

                // 新增、减少数量
                if (isAdd) {
                    orderItemModel.quantity = orderItemModel.quantity + 1;
                } else {
                    orderItemModel.quantity = orderItemModel.quantity - 1;
                    orderItemModel.quantity = orderItemModel.quantity < 0 ? 0 : orderItemModel.quantity;
                }

                // 更新剩余数量
                menuObject.attr("currentRemainQuantity", currentRemainQuantity + (isAdd ? -1 : 1));

                // 更新购物车数据
                $.each(orderInfo.items, function (index, foodObject) {
                    if (foodObject.systemId === orderItemModel.systemId && foodObject.taste == orderItemModel.taste) {
                        if (!isAdd && orderItemModel.quantity === 0) {
                            orderInfo.items.splice(index, 1);
                        } else {
                            foodObject.quantity = orderItemModel.quantity;
                            foodObject.remainQuantity = orderItemModel.remainQuantity;
                        }
                        return false;
                    }
                });

                // 更新已经选择的菜品 ,必须要使用menuObject.attr("selectedItems")，对于后续需要解开值的属性，之前应该采用attr属性访问
                menuObject.attr("selectedItems").forEach(function (selectedItem, index) {
                    if (selectedItem.systemId == orderItemModel.systemId && selectedItem.taste == orderItemModel.taste) {
                        if (orderItemModel.quantity == 0) {
                            menuObject.attr("selectedItems").splice(index, 1);
                        } else {
                            selectedItem.attr("quantity", orderItemModel.quantity);
                        }
                        return false;
                    }
                });

                self.modifyStoreMenuList(orderItemModel, isAdd)
                self._renderCart();
            },
            modifyStoreMenuList: function (orderItemModel, isAdd) {
                var modifyFlag = false;
                var self = this;
                var matchedElements = can.$("li[systemId='" + orderItemModel.parentId + "']");
                if (matchedElements.length > 0) {
                    for (var index = 0; index < matchedElements.length; index++) {
                        var currentElementViewModel = can.data(can.$("li[systemId='" + orderItemModel.parentId + "']").eq(index), "menuVo");
                        if (currentElementViewModel.quantity) {
                            var quantity = currentElementViewModel.attr("quantity");
                            quantity = isAdd ? quantity + 1 : quantity - 1;
                            currentElementViewModel.attr("quantity", quantity);
                            self.updateItemTopClass(currentElementViewModel, isAdd, 1);
                            modifyFlag = true;
                            break
                        }
                    }
                }
                if (!modifyFlag) {
                    console.info("没有找到对应可用的菜单项")
                }
            },
            _renderCart: function () {
                var orderInfo = util.getOrderInfo();
                var orderItems = orderInfo.items;
                var totalObject = util.calculateSum();
                this.attr("purchaseTotalNum", totalObject.quantity);
                this.attr("purchaseTotalPrice", totalObject.price);
                this.attr("purchaseOriginalPrice", totalObject.originalPrice);
                var self = this;
                if (orderItems && orderItems.length > 0) {
                    self.cartData.attr("orderedItems", orderItems);
                    util.Busy.stop();
                } else {
                    $("#cart-box").hide();
                    $("#cart-box").remove();
                    this.cartTemplate = null;
                    self.cartData.attr("orderedItems", []);
                    util.Busy.stop();
                }
            },
            triggerCart: function () {
                if ($("#cart-box").length > 0 && "block" == $("#cart-box").css("display")) {
                    $("#layer-box01-js").trigger("tap");
                    return false
                }
                var self = this;
                if (!self.cartTemplate) {
                    self.cartTemplate = can.view(util.getView("storeMenu.cartInfo.mustache"), self.cartData);
                    $("#wrapper-main").append(self.cartTemplate);
                }
                var F = null;
                $("#cert-lay-js").css({
                    "bottom": -325 + "px"
                });
                $("#cart-box").css({
                    "position": "absolute",
                    "top": 0,
                    "bottom": "0px",
                    "width": "100%"
                }).on("touchstart", function (event) {
                    F = event.touches[0].clientY
                }).on("touchmove", function (event) {
                    var I = event.target.className;
                    if (I == "layer-box01") {
                        event.preventDefault();
                        return false
                    }
                    if (event.touches[0].clientY < F) {
                        if ($(".ow-y").scrollTop() >= $(".ow-y")[0].scrollHeight - $(".ow-y").height()) {
                            event.preventDefault();
                            return false
                        }
                    } else {
                        if ($(".ow-y").scrollTop() == 0) {
                            event.preventDefault();
                            return false
                        }
                    }
                });
                $("#cart-box").show();
                $("#layer-box01-js").removeClass("shadow-hide").addClass("shadow-show");
                $("#cert-lay-js").removeClass("cart-box-slidedown").addClass("cart-box-slideup");
                history.pushState({selector: "cert-lay-js"}, "cert-lay-js", '#cert-lay-js');
                util.Busy.start();
                if (self.isModify()) {
                    var selectedFoodItems = self.genSyncOrderItems();
                    var orderObject = util.getOrderInfo();
                    orderObject.items = selectedFoodItems;
                    util.saveOrderInfo(orderObject);
                    self.isModify(false);
                    util.removeLocalTempOrders();
                }
                self._renderCart();
                return false
            },
            refreshStoreMenuList: function () {
                var self = this;
                var orderInfo = util.getOrderInfo();
                var renderedOrderArray = new Array();
                if (orderInfo.items && orderInfo.items.length > 0) {
                    // 还原已选菜品
                    can.each(orderInfo.items, function (orderItem, orderItemIndex) {
                        var storeMenuIndex = orderItem.index;
                        var menuIndex = orderItem.menuIndex;
                        var menu = self.attr("storeMenuList")[storeMenuIndex].menus[menuIndex];
                        var quantity = menu.attr("quantity");
                        var remainQuantity = menu.attr("remainQuantity");
                        menu.attr("quantity", quantity + orderItem.quantity);
                        // 当前剩余数量
                        menu.attr("currentRemainQuantity", remainQuantity - menu.attr("quantity"));
                        menu.selectedItems.push({
                            systemId: orderItem.systemId,
                            parentId: orderItem.parentId,
                            price: orderItem.price,
                            quantity: orderItem.quantity,
                            modify: true,
                            name: orderItem.name,
                            deleted: 0,
                            originalPrice: orderItem.originalPrice,
                            taste: orderItem.taste,
                            isDiscount: orderItem.isDiscount,
                            index: orderItem.index,
                            parentName: orderItem.parentName,
                            isParent: orderItem.isParent,
                            menuIndex: orderItem.menuIndex,
                            items:orderItem.items
                        });
                    });

                    // 还原分类总数量
                    can.each(self.attr("storeMenuList"), function (storeMenu, storeMenuIndex) {
                        var topClassObject = storeMenu;
                        var totalNumber = 0;
                        can.each(storeMenu.attr("menus"), function (menu, menuIndex) {
                            totalNumber += menu.quantity;
                        });
                        topClassObject.attr("purchaseCount", totalNumber);
                    });

                } else {
                    can.each(this.attr("storeMenuList"), function (storeMenu, N) {
                        can.each(storeMenu.attr("menus"), function (menu, P) {
                            menu.attr("quantity", 0);
                            if (menu.isParent == 1) {
                                $.each(menu.children, function (index, childMenu) {
                                    childMenu.attr("quantity", 0);
                                });
                            }
                        });
                        storeMenu.attr("purchaseCount", 0);
                    })
                }
                var F = util.calculateSum();
                this.attr("purchaseTotalNum", F.quantity);
                this.attr("purchaseTotalPrice", F.price);
                this.attr("purchaseOriginalPrice", F.originalPrice);
            },
            // 确认选择菜品
            confirmSelection: function (confirmedMenuObject, addOrMinus) {
                this.isModify(true);
                var menuList = this.attr("storeMenuList");
                var outerMenuObject = menuList[confirmedMenuObject.index].menus[confirmedMenuObject.menuIndex];
                var quantity = confirmedMenuObject["quantity"];
                var baseQuantity = quantity - outerMenuObject.attr("quantity");
                if (addOrMinus) {
                    baseQuantity = quantity;
                    quantity = quantity + outerMenuObject.attr("quantity");
                }
                // 更新已选数量
                outerMenuObject.attr("quantity", quantity);
                // 更新左侧分类栏
                this.updateItemTopClass(outerMenuObject, true, baseQuantity);
                // 当前还剩余多少份
                outerMenuObject.attr("currentRemainQuantity", outerMenuObject.remainQuantity - quantity);
                // 更新总购买量
                this.attr("purchaseTotalNum", this.purchaseTotalNum + baseQuantity);
                // 更新总现价
                this.attr("purchaseTotalPrice", parseFloat(this.purchaseTotalPrice) + confirmedMenuObject.selectedTotalPrice);
                // 更新总原价
                this.attr("purchaseOriginalPrice", parseFloat(this.purchaseOriginalPrice) + confirmedMenuObject.selectedOriginalTotalPrice);
                // 合并重复项
                if (addOrMinus) {
                    // 是否存在相同的
                    var existSameMenu = false;
                    for (var i = 0; i < outerMenuObject.selectedItems.length; i++) {
                        var selectedItem = outerMenuObject.selectedItems[i];
                        if (selectedItem.systemId == confirmedMenuObject.selectedSystemId
                            && selectedItem.taste == confirmedMenuObject.selectedTaste) {
                            existSameMenu = true;
                            selectedItem.quantity = selectedItem.quantity + confirmedMenuObject["quantity"];
                        }
                    }
                    if (!existSameMenu) {
                        if (confirmedMenuObject.isParent) {
                            var selectedChildObject = confirmedMenuObject.children[confirmedMenuObject.selectedChildIndex];
                            var combineName = confirmedMenuObject.selectedTaste == ""
                                ? ("\"" + selectedChildObject.name + "\"")
                                : ("\"" + selectedChildObject.name + "\"+\"" + confirmedMenuObject.selectedTaste + "\"");
                            outerMenuObject.attr("selectedItems").push({
                                systemId: confirmedMenuObject.selectedSystemId,
                                parentId: confirmedMenuObject.systemId,
                                price: selectedChildObject.price,
                                setMealFlag: selectedChildObject.setMealFlag,
                                isParent: 1,
                                parentName: outerMenuObject.name,
                                originalPrice: selectedChildObject.originalPrice,
                                isDiscount: selectedChildObject.price != selectedChildObject.originalPrice,
                                quantity: confirmedMenuObject.quantity,
                                name: combineName,
                                taste: confirmedMenuObject.selectedTaste,
                                deleted: 0
                            });
                        } else {
                            outerMenuObject.attr("selectedItems").push({
                                systemId: confirmedMenuObject.selectedSystemId,
                                parentId: confirmedMenuObject.selectedSystemId,
                                price: confirmedMenuObject.price,
                                setMealFlag: confirmedMenuObject.setMealFlag,
                                originalPrice: confirmedMenuObject.originalPrice,
                                isDiscount: confirmedMenuObject.price != confirmedMenuObject.originalPrice,
                                quantity: confirmedMenuObject.quantity,
                                name: confirmedMenuObject.name + "(" + confirmedMenuObject.selectedTaste + ")",
                                taste: confirmedMenuObject.selectedTaste,
                                deleted: 0,
                                isParent: 0
                            });
                        }
                    }
                } else {
                    var confirmedSelectedItems = [];
                    for (var i = 0; i < confirmedMenuObject.selectedItems.length; i++) {
                        var selectedItem = confirmedMenuObject.selectedItems[i];
                        if (!selectedItem.deleted) {
                            confirmedSelectedItems.push(selectedItem);
                        }
                    }
                    outerMenuObject.attr("selectedItems", confirmedSelectedItems);
                }
            },
            // 隐藏选择框体(加)
            hideSelectionBox: function () {
                $("#selection-lay-js").removeClass("menu-selection-box-slideup").addClass("menu-selection-box-slidedown");
                $("#layer-selection-js").addClass("shadow-hide");
                var timeout = setTimeout(function () {
                    $("#menu-selection-box").hide();
                    $("#menu-selection-box").remove();
                    clearTimeout(timeout);
                }, 300);
                this.selectionTemplate = null;
            },
            // 隐藏已选择框体(减)
            hideSelectedBox: function () {
                $("#selected-lay-js").removeClass("menu-selected-box-slideup").addClass("menu-selected-box-slidedown");
                $("#layer-selected-js").addClass("shadow-hide");
                var timeout = setTimeout(function () {
                    $("#menu-selected-box").hide();
                    $("#menu-selected-box").remove();
                    clearTimeout(timeout);
                }, 300);
                this.selectedTemplate = null;
            },
            // 隐藏购物车
            hideCartBox: function () {
                $("#cert-lay-js").removeClass("cart-box-slideup").addClass("cart-box-slidedown");
                $("#layer-box01-js").addClass("shadow-hide");
                var timeout = setTimeout(function () {
                    $("#cart-box").hide();
                    $("#cart-box").remove();
                    clearTimeout(timeout);
                }, 300);
                this.cartTemplate = null;
            },
            hideDetailBox: function () {
                $("#pic_cover").hide();
                $("#pic_cover").remove();
            },
            // 隐藏选择框体(套餐选择)
            hideSetMealBox: function () {
                $("#setMeal-lay-js").removeClass("menu-selection-box-slideup").addClass("menu-selection-box-slidedown");
                $("#layer-setMeal-js").addClass("shadow-hide");
                var timeout = setTimeout(function () {
                    $("#menu-setMeal-box").hide();
                    $("#menu-setMeal-box").remove();
                    clearTimeout(timeout);
                }, 300);
                this.setMealTemplate = null;
            },
            _mealAddition:function(currentModel,event){

                var self = this;

                if(currentModel.setMealInfo.multipleItems.length == 0)
                    this._addProductNum(event, currentModel, 1);

                var confirmMenuObject = currentModel.attr();
                confirmMenuObject.quantity = 1;
                confirmMenuObject.currentSelectedPrice = confirmMenuObject.price;
                currentModel.attr("confirmMenuObject", confirmMenuObject);

                if(!self.setMealFlag){
                    self.setMealTemplate = can.view(util.getView("storeMenu.setMeal.mustache"), currentModel.confirmMenuObject);
                    $("#wrapper-main").append(self.setMealTemplate);
                }

                var F = null;
                var height = 300;
                $("#setMeal-lay-js").css({
                    "height": height + "px",
                    "bottom": -height + "px"
                });
                $("#menu-setMeal-box").css({
                    "position": "absolute",
                    "top": 0,
                    "bottom": 0,
                    "width": "100%"
                }).on("touchstart", function (event) {
                    F = event.touches[0].clientY
                }).on("touchmove", function (event) {
                    return false;
                });
                $("#menu-setMeal-box").show();
                $("#setMeal-lay-js").removeClass("menu-selection-box-slidedown").addClass("menu-selection-box-slideup");
                $("#layer-setMeal-js").addClass("shadow-show");
                history.pushState({selector: "menu-setMeal-box"}, "setMeal", '#menu-setMeal-box');

            },
            _singleAddition:function(currentModel,event){

                var self = this;

                // 没有子级的菜品才需要判断剩余数量
                if (currentModel.children.length == 0) {
                    // 剩余数量判断
                    var quantity = currentModel.quantity;
                    var remainQuantity = parseInt(currentModel.remainQuantity);
                    if (quantity >= currentModel.remainQuantity) {
                        util.showInstantMessage({content: "该产品最多可订购" + remainQuantity + "份"});
                        return false;
                    }
                }

                var confirmMenuObject = currentModel.attr();
                confirmMenuObject.quantity = 1;
                currentModel.attr("confirmMenuObject", confirmMenuObject);
                if (currentModel.children.length > 0 || currentModel.specificationInfo.length > 0) {
                    if (!self.selectionTemplate) {
                        self.selectionTemplate = can.view(util.getView("storeMenu.selection.mustache"), currentModel.confirmMenuObject);
                        $("#wrapper-main").append(self.selectionTemplate);
                    }
                    var F = null;
                    var height = 174;
                    if (currentModel.children.length > 0) {
                        var rowCount = parseInt((currentModel.children.length - 1) / 4);
                        if (rowCount <= 0) {
                            height = height + 96;
                        } else {
                            height = height + 96 + rowCount * 42;
                        }
                    }
                    if (currentModel.specificationInfo.length > 0) {
                        var rowCount = parseInt((currentModel.specificationInfo.length - 1) / 4);
                        if (rowCount <= 0) {
                            height = height + 96;
                        } else {
                            height = height + 96 + rowCount * 42;
                        }
                    }
                    $("#selection-lay-js").css({
                        "height": height + "px",
                        "bottom": -height + "px"
                    });
                    $("#menu-selection-box").css({
                        "position": "absolute",
                        "top": 0,
                        "bottom": 0,
                        "width": "100%"
                    }).on("touchstart", function (event) {
                        F = event.touches[0].clientY
                    }).on("touchmove", function (event) {
                        return false;
                    });
                    $("#menu-selection-box").show();
                    $("#selection-lay-js").removeClass("menu-selection-box-slidedown").addClass("menu-selection-box-slideup");
                    $("#layer-selection-js").addClass("shadow-show");
                    history.pushState({selector: "menu-selection-box"}, "selection", '#menu-selection-box');
                } else {
                    this._addProductNum(event, currentModel, 1);
                }
            }
        },
        helpers: {
            isShowCartBar: function (H) {
                var F = $("#wrapper-box-js");
                if (this.showCartBar()) {
                    $(".order-layer").removeClass("hideCartBar").addClass("showCartBar");
                    F.css("bottom", 50);
                } else {
                    $(".order-layer").removeClass("showCartBar").addClass("hideCartBar");
                    F.css("bottom", 0);
                }
                F.css("top", 44);
            }
        },
        events: {
            "#pr-lay-close-js tap": function () {
                var self = this;
                history.back();
                self.scope.hideDetailBox();
                return false;
            },
            "#layer-box02-js tap": function (G, H) {
                var self = this;
                var F = H.gesture.target.id;
                if (F != "layer-box02-js") {
                    return false;
                }
                history.back();
                self.scope.hideDetailBox();
                return false;
            },
            ".pr-pic tap": function (element, event) {
                var model = can.data($(element).parent().parent().parent(), "menuVo");
                var popWindowHtml = can.view(util.getView("storeMenu.popWindow.mustache"), model);
                can.$("#wrapper-main").append(popWindowHtml);
                var height = $(document).height();
                var width = $(document).width();
                $(".pr_lay").css("height", height);
                $(".pr_lay").css("width", width);
                //$(".pr_lay").css("left", 20);
                $(".img-box").height(width);
                $(".img-box").width(width);
                $("#popContent").height(height - 44);
                $("#pic_cover").show();
                $("#layer-box02-js").removeClass("shadow-hide").addClass("shadow-show");
                $("#pic_cover").css("height", height);
                // 异步加载图片路径
                $("#pic_cover img").attr("src", $("#pic_cover img").attr("real_src")).removeAttr("real_src");

                var F = null;
                $("#pic_cover").on("touchstart", function (event) {
                    F = event.touches[0].clientY;
                    console.info("start->" + F);
                }).on("touchmove", function (event) {
                    var I = event.target.className;
                    console.info("move->" + I);
                    if (I == "layer-box02") {
                        event.preventDefault();
                        console.info("return false move->" + I);
                        return false
                    }
                    if (event.touches[0].clientY < F) {
                        if ($(".order-detail-content").scrollTop() >= $(".order-detail-content")[0].scrollHeight - $(".order-detail-content").height()) {
                            event.preventDefault();
                            console.info("return false move->" + I);
                            return false
                        }
                    } else {
                        if ($(".order-detail-content").scrollTop() == 0) {
                            event.preventDefault();
                            console.info("return false move->" + I);
                            return false
                        }
                    }
                });
                history.pushState({selector: "layer-box02-js"}, "layer-box02-js", '#menu-detail-box');
            },
            "#recordkey tap": function (element) {
                $("#hos-box-js").hide();
                $(".carte-box").hide();
                $("#rest-un-js").hide();
                $(".search-lading-area").show();
                var currentSearchKey = $.trim($(element).text());
                $("#searchKey").val(currentSearchKey);
                $("#searchKey").focus();
                $(".search-button").trigger("tap");
            },
            "#searchKey input": function (element, event) {
                var self = this;
                $("#hos-box-js").hide();
                $(".carte-box").hide();
                $("#rest-un-js").hide();
                $(".search-lading-area").show();
                var currentSearchKey = $.trim($(element).val());
                if (currentSearchKey) {
                    this.scope.attr("showClearInput", true);
                } else {
                    this.scope.attr("searchRecord", []);
                    this.scope.attr("showClearInput", false);
                    if (util.getLocalItem("store.menu.search")){
                        $("#hos-box-js").show();
                    }
                }
                this.scope.attr("searchSuggestion", this.scope._seachByKey(currentSearchKey).searchSuggestion);
            },
            ".search-landing-li tap": function (element, event) {
                $(".carte-box").show();
                $(".search-lading-area").hide();
                var searchItemModel = can.data(can.$(element), "searchItem");
                var searchItem = this.scope.storeMenuList[searchItemModel.firstLevelIndex].menus[searchItemModel.secondLevelIndex];
                this.scope._syncPurchaseNumber(searchItem);
                this.scope.attr("searchResult", [searchItem]);
                util.lazyLoad.lazy({time_out: 1000});
                console.info(searchItemModel);
            },
            ".check_item tap":function(element,event){
                var currentModel = can.data(can.$(element).parent().parent().parent().parent(), "menuVo");
                var categoryItem = can.data(can.$(element).parent().parent(), "category_item");
                // 需要选择0种，直接打满
                if(categoryItem.requireQuantity == 0){
                    categoryItem.requireQuantity = categoryItem.items.length;
                }
                var checkItem = can.data(can.$(element), "check_item");
                var selected = checkItem.attr("selected");
                var selectedQuantity = categoryItem.attr("selectedQuantity");
                var selectedPrice = parseFloat(currentModel.attr("currentSelectedPrice"));
                var currentPrice = parseFloat(selectedPrice);
                // 只有一个选择的情况下
                if(selected){// 之前为选中，去掉勾选
                    checkItem.attr("selected",!selected);
                    categoryItem.attr("selectedQuantity",selectedQuantity - 1);
                    currentPrice = selectedPrice - checkItem.extendPrice;
                }// 已选择数量小于可选择数量，直接加上
                else if(categoryItem.selectedQuantity < categoryItem.requireQuantity){

                    checkItem.attr("selected",true);
                    categoryItem.attr("selectedQuantity",selectedQuantity + 1);

                    currentPrice = selectedPrice + checkItem.extendPrice;

                }else{// 可选择数量等于已选择数量,这种情况只有多选1时允许出现
                    if(categoryItem.requireQuantity == 1){
                        var extendTotalPrice = 0;
                        // 将其它去掉勾选,并统计之前已经勾选的扩展价格总额
                        can.each(categoryItem.attr("items"),function(item,itemIndex){
                            if(item.selected){
                                extendTotalPrice += item.extendPrice;
                            }
                            item.attr("selected",false);
                        });

                        checkItem.attr("selected",true);
                        categoryItem.attr("selectedQuantity",selectedQuantity + 1);

                        // 总共扩展价格
                        extendTotalPrice = extendTotalPrice - checkItem.extendPrice;
                        currentPrice = selectedPrice - extendTotalPrice;
                    }
                }
                currentModel.attr("currentSelectedPrice",currentPrice.toFixed(2));
            },
            // 菜单详细列表中的加菜
            ".listAdd tap": function (element, event) {
                var currentModel = can.data(can.$(element).parent().parent().parent().parent(), "menuVo");
                // 有套餐
                if(currentModel.setMealFlag){
                    this.scope._mealAddition(currentModel,event);
                }else{
                    this.scope._singleAddition(currentModel,event);
                }

            },
            // 菜单详细列表中的减菜
            ".listMinus tap": function (element, event) {
                var currentModel = can.data(can.$(element).parent().parent().parent().parent(), "menuVo");
                if (!currentModel.setMealFlag && currentModel.selectedItems.length > 1) {
                    var confirmMenuObject = currentModel.attr();
                    var self = this.scope;
                    currentModel.attr("confirmMenuObject", confirmMenuObject);
                    if (!self.selectedTemplate) {
                        self.selectedTemplate = can.view(util.getView("storeMenu.selected.mustache"), currentModel.confirmMenuObject);
                        $("#wrapper-main").append(self.selectedTemplate);
                    }
                    var F = null;
                    var height = 124 + currentModel.selectedItems.length * 52;
                    var bottom = height >= 332 ? -332 : -height;
                    $("#selected-lay-js").css({
                        "height": height + "px",
                        "bottom": bottom + "px",
                        "max-height": "332px"
                    });
                    $("#selected-ow-y").css({
                        "height": currentModel.selectedItems.length * 52 + "px",
                        "max-height": "208px"
                    });
                    $("#menu-selected-box").css({
                        "position": "absolute",
                        "top": 0,
                        "bottom": 0,
                        "width": "100%"
                    }).on("touchstart", function (event) {
                        F = event.touches[0].clientY
                    }).on("touchmove", function (event) {
                        var I = event.target.className;
                        if (I == "layer-box01") {
                            event.preventDefault();
                            return false;
                        }
                        if (event.touches[0].clientY < F) {
                            if ($(".ow-y").scrollTop() >= $(".ow-y")[0].scrollHeight - $(".ow-y").height()) {
                                event.preventDefault();
                                return false
                            }
                        } else {
                            if ($(".ow-y").scrollTop() == 0) {
                                event.preventDefault();
                                return false
                            }
                        }
                    });
                    $("#menu-selected-box").show();
                    $("#selected-lay-js").removeClass("menu-selected-box-slidedown").addClass("menu-selected-box-slideup");
                    $("#layer-selected-js").addClass("shadow-hide");
                    history.pushState({selector: "menu-selected-box"}, "selected", '#menu-selected-box');
                } else {
                    if(currentModel.selectedItems.length > 1){
                        util.showInstantMessage({content: "存在多份套餐菜品不一致，请到购物车删减相应套餐"});
                        return;
                    }

                    this.scope._minusProductNum(currentModel);
                    currentModel.selectedItems[0].attr("quantity", currentModel.selectedItems[0].quantity - 1);
                    if (currentModel.selectedItems[0].quantity == 0) {
                        currentModel.attr("selectedItems", []);
                    }
                }
            },
            ".border tap": function (element) {
                var type = element.attr("type");
                var menuModel = can.data(can.$(element).parent().parent().parent().parent().parent(), "menuVo");
                if (type == "child") {
                    var childModel = can.data(can.$(element), "child");
                    // 取消选择之前的
                    if (menuModel.selectedChildIndex >= 0) {
                        var lastSelectedModel = menuModel.children[menuModel.selectedChildIndex];
                        lastSelectedModel.attr("selected", 0);
                    }
                    // 选择当前的
                    childModel.attr("selected", 1);
                    // 重新记录
                    menuModel.selectedChildIndex = childModel.index;
                    menuModel.selectedSystemId = childModel.systemId;
                    menuModel.selectedPrice = childModel.price;
                    menuModel.selectedOriginalPrice = childModel.originalPrice;
                } else {
                    var specificationModel = can.data(can.$(element), "specification");
                    // 取消选择之前的
                    if (menuModel.selectedSpecificationIndex >= 0) {
                        var lastSelectedModel = menuModel.specificationInfo[menuModel.selectedSpecificationIndex];
                        lastSelectedModel.attr("selected", 0);
                    }
                    // 选择当前的
                    specificationModel.attr("selected", 1);
                    // 重新记录
                    menuModel.selectedSpecificationIndex = specificationModel.index;
                    // 记录当前选择的口味
                    menuModel["selectedTaste"] = specificationModel.name;
                }
                if (menuModel.selectedSpecificationIndex >= 0 && menuModel.selectedChildIndex >= 0) {
                    menuModel.attr("currentSelectedPrice", menuModel.selectedPrice);
                    menuModel.attr("selectedOk", 1);
                }
            },
            ".selection-add tap": function (element, event) {
                var currentMenuModel = can.data(can.$(element).parent().parent().parent().parent(), "menuVo");
                if (currentMenuModel.selectedOk == 0) return;

                // 界面默认为1
                if (currentMenuModel.quantity == 0) {
                    currentMenuModel.quantity = 1;
                }
                var quantity = currentMenuModel.quantity;


                var currentRemainQuantity = currentMenuModel.currentRemainQuantity;
                var remainQuantity = currentMenuModel.remainQuantity;
                if (!currentMenuModel.isParent && quantity + 1 > currentRemainQuantity) {
                    util.showInstantMessage({content: "该产品最多还可订购" + currentRemainQuantity + "份"});
                    return false;
                }

                currentMenuModel.attr("quantity", quantity + 1);
                if (currentMenuModel.quantity > 1) {
                    currentMenuModel.attr("canMinus", 1);
                }
            },
            ".selection-minus tap": function (element) {
                var currentMenuModel = can.data(can.$(element).parent().parent().parent().parent(), "menuVo");
                if (currentMenuModel.quantity == 1) {
                    currentMenuModel.attr("canMinus", 0);
                    return;
                }
                var quantity = currentMenuModel.quantity;
                currentMenuModel.attr("quantity", quantity - 1);
            },
            "#confirm-add-button tap": function (element) {
                var confirmedMenuObject = can.data(can.$(element).parent().parent().parent().parent(), "menuVo");
                if(confirmedMenuObject.setMealFlag){
                    var already = true;
                    var setMealItems = [];
                    var selectedStrings = "";
                    //var extendTotalPrice = 0;
                    // 判断是否必选的都已经选好了，顺便添加已选菜品
                    can.each(confirmedMenuObject.setMealInfo.multipleItems,function(categoryItem,categoryItemIndex){
                        if(categoryItem.selectedQuantity < categoryItem.requireQuantity){
                            already = false;
                            util.showInstantMessage({content: categoryItem.categoryName + categoryItem.items.length+  "选" + categoryItem.requireQuantity + "还未选满"});
                            return false;
                        }else{
                            can.each(categoryItem.items,function(item,itemIndex){
                                if(item.selected){
                                    setMealItems.push({
                                        "id":item.systemId,
                                        "name":item.name,
                                        "quantity":item.quantity
                                    });
                                    selectedStrings += item.systemId;
                                }
                            });
                        }
                    });

                    // 如果菜品已经准备好了，添加必选菜
                    if(already){

                        // 修改额外数量
                        //var price = confirmedMenuObject.attr("price");
                        //confirmedMenuObject.attr("selectedPrice",price + extendTotalPrice);

                        // 添加必选菜
                        can.each(confirmedMenuObject.setMealInfo.requireItems,function(item){
                            setMealItems.push({
                                "id":item.systemId,
                                "name":item.name,
                                "quantity":item.quantity
                            });
                        });

                        // 添加到当前菜的已选队列中
                        var menuList = this.scope.attr("storeMenuList");
                        var outerMenuObject = menuList[confirmedMenuObject.index].menus[confirmedMenuObject.menuIndex];
                        outerMenuObject.attr("selectedPrice",confirmedMenuObject.attr("currentSelectedPrice"));


                        var existItem = null;

                        for(var i = 0;i < outerMenuObject.selectedItems.length;i++){
                            if(outerMenuObject.selectedItems[i].taste == selectedStrings){
                                existItem = outerMenuObject.selectedItems[i];
                                break;
                            }
                        }

                        // 存在即添加
                        if(existItem){
                            existItem.quantity = existItem.quantity + 1;
                        }else{
                            outerMenuObject.attr("selectedItems").push({
                                systemId: confirmedMenuObject.selectedSystemId,
                                parentId: confirmedMenuObject.selectedSystemId,
                                price: confirmedMenuObject.currentSelectedPrice,
                                setMealFlag: confirmedMenuObject.setMealFlag,
                                originalPrice: confirmedMenuObject.originalPrice,
                                isDiscount: confirmedMenuObject.price != confirmedMenuObject.originalPrice,
                                quantity: confirmedMenuObject.quantity,
                                name: confirmedMenuObject.name,
                                taste: selectedStrings,// 随机口味 方便后续做匹配,不然不能确认购物车中减去的是哪一个
                                deleted: 0,
                                isParent: 0,
                                items:setMealItems
                            });
                        }

                        console.info(outerMenuObject.setMealFlag);

                        // 更改数量
                        this.scope._addProductNum(event, outerMenuObject, 1);

                        // 关闭选择界面
                        $("#layer-setMeal-js").trigger("tap");
                    }


                }else{
                    confirmedMenuObject.selectedOriginalTotalPrice = confirmedMenuObject.selectedOriginalPrice * confirmedMenuObject.quantity;
                    confirmedMenuObject.selectedTotalPrice = confirmedMenuObject.selectedPrice * confirmedMenuObject.quantity;
                    // 确认选择
                    this.scope.confirmSelection(confirmedMenuObject, true);

                    // 关闭选择界面
                    $("#layer-selection-js").trigger("tap");
                }

            },
            // 已选择的减菜
            ".selectedMinus tap": function (element) {
                // 当前待确认的模型
                var currentConfirmMenuModel = can.data(can.$(element).parent().parent().parent().parent().parent(), "menuVo");
                // 当前操作的模型
                var orderItemModel = can.data(can.$(element).parent().parent(), "orderItem");
                // 如果当前模型只有一个数量了，直接删除
                if (orderItemModel.quantity == 1) {
                    $.each(currentConfirmMenuModel.selectedItems, function (index, selectedItem) {
                        if (selectedItem.systemId === orderItemModel.systemId && selectedItem.taste == orderItemModel.taste) {
                            selectedItem.attr("deleted", 1);
                            return false;
                        }
                    });
                } else {
                    var orderItemQuantity = orderItemModel.attr("quantity");
                    orderItemModel.attr("quantity", orderItemQuantity - 1);
                }
                var quantity = currentConfirmMenuModel.quantity;
                currentConfirmMenuModel.attr("quantity", quantity - 1);
                // 选择的总现价
                currentConfirmMenuModel.selectedTotalPrice -= orderItemModel.price * 1;
                // -总原价
                currentConfirmMenuModel.selectedOriginalTotalPrice -= orderItemModel.originalPrice * 1;
                // 如果全部删除完毕，自动确认
                if (currentConfirmMenuModel.selectedItems.filter(function (item) {
                        return item.deleted == 1;
                    }).length == currentConfirmMenuModel.selectedItems.length) {
                    //alert("删除完毕");
                    $("#confirm-minus-button").trigger("tap");
                }
            },
            "#confirm-minus-button tap": function (element) {
                // 待确认的菜单模型
                var confirmedMenuObject = can.data(can.$(element).parent().parent().parent(), "menuVo");
                // 确认选择
                this.scope.confirmSelection(confirmedMenuObject, false);
                // 关闭选择界面
                $("#layer-selected-js").trigger("tap");
            },
            // 购物车中的加菜
            ".cartAdd tap": function (element, G) {
                var orderItemModel = can.data(can.$(element).parent().parent(), "orderItem");
                this.scope.updateCartOrderItem(orderItemModel, true)
            },
            // 购物车中的减菜
            ".cartMinus tap": function (element) {
                var orderItemModel = can.data(can.$(element).parent().parent(), "orderItem");
                this.scope.updateCartOrderItem(orderItemModel, false);
            },
            "#emptyCart tap": function () {
                var self = this;
                util.confirm({description: "确认清空购物车？"}, function () {
                    util.Busy.start();
                    var orderInfo = util.getOrderInfo();
                    orderInfo.items = [];
                    util.saveOrderInfo(orderInfo);
                    $("#cart-box").hide();
                    $("#cart-box").remove();
                    self.scope.cartTemplate = null;

                    // 更新已经选择的菜品
                    var menuList = self.scope.attr("storeMenuList");
                    menuList.forEach(function (storeMenu) {
                        storeMenu.menus.forEach(function (menuObject) {
                            menuObject.attr("selectedItems", []);
                        });
                    });
                    self.scope.refreshStoreMenuList();
                    util.Busy.stop();
                })
            },
            // 触碰加菜外部遮罩隐藏
            "#layer-selection-js tap": function () {
                history.back();
                this.scope.hideSelectionBox();
                return false;
            },
            "#layer-setMeal-js tap": function () {
                history.back();
                this.scope.hideSetMealBox();
                return false;
            },
            // 触碰减菜外部遮罩隐藏
            "#layer-selected-js tap": function () {
                history.back();
                this.scope.hideSelectedBox();
                return false;
            },
            // 触碰购物车外部遮罩隐藏购物车
            "#layer-box01-js tap": function () {
                history.back();
                this.scope.hideCartBox();
                return false;
            },
            "#clear tap": function (D, E) {
                util.removeLocalItem("store.menu.search");
                this.scope.attr("searchRecord").splice(0);
            }
        }
    });
});
