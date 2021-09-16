;
(function () {
    "use strict";

    var $form_add_task = $(".add-task"), //选中.add-task的表单
        task_list = [],
        $task_detail = $(".task-detail"),
        $mask = $(".mask"),
        $update_form, //选中.task-detail的表单
        $task_detail_content, //选中.task-detail的标题
        $task_detail_content_input, //选中.task-detail的标题input
        $task_detail_content_textarea,
        $msg = $(".msg"),
        // $bell = $(".bell"),
        //$(window)不需要双引号
        $window = $(window),
        $body = $("body");

    init();

    //第一次打开，初始化task_list
    function init() {
        //store.clearAll();
        //localStorage没有内容则返回空数组，避免添加时store.get返回undefined (Cannot read property)。
        //有内容则返回对象，利用JSON.parse解析JSON字符串，以{"content":"new_task的值"}对象形式存入空数组。
        task_list = store.get("task_list") || []; //问题：没加双引号！！！

        //一开始如果有数据，则全部渲染显示出来  对于jquery对象的判断，最好是使用length来判断。
        if (task_list.length) {
            render_task_list();
        }
        
        //任务定时提醒
        task_remind_check();
    }

    //set更新localStorage数据并刷新view模板列表
    function refresh_task_list() {
        //key为task_list,new_task的值value以JSON字符串格式‘{"content":"new_task的值"}’存入localStorage
        store.set("task_list", task_list);
        render_task_list();
    }

    //添加功能开始

    //表单的添加按钮提交时触发
    $form_add_task.on("submit", add_task_submit);

    function add_task_submit(e) {
        e.preventDefault();
        //问题：作用域，不要把独立的东西写进全局，不然就不是修改，而是不断的重写一个
        var new_task = {};
        //获取输入内容
        var $input = $(this).find("input[name=content]")
        new_task.content = $input.val();
        //new_task的content为空（即不存在）则不执行
        if (!new_task.content) return;
        //如果已经存在new_task那就add并存入localStorage
        if (add_task(new_task)) {
            //清空input
            $input.val(null).focus();
        }
    }

    //添加new_task到localStorage
    function add_task(new_task) {
        //new_task对象添加到task_list数组，供view模板显示
        task_list.push(new_task);
        //更新localStorage数据并刷新view模板列表
        refresh_task_list();
        //问题：调用函数要有return,否则将默认返回undefined，所以submit时不会执行render_task_list()!!!
        return true;
        // console.log("task_list", task_list);
    }

    //显示单个任务
    function render_task_item(data, index) {
        //问题：if(!)如果index值为0，那么就会变为true，造成第一条无法显示，所以使用undefined作判断
        //如果data或index没有传进来即不存在则不执行
        if (!data || index === undefined) return;
        //删除和详情 <span></span>之间要有空格。
        //删除功能1、设置data-index属性来嵌入自定义数据，使其像ID一样可以传进删除函数
        var list_item = "<div class='task-item' data-index='" + index + "'>" +
            "<span><input class='complete' type='checkbox' " + (data.complete ? "checked" : "") + "></span>" +
            "<span class='todo_txt'>" + data.content + "</span>" +
            "<div class='fr'>" +
            "<span class='delete-btn'>删除</span> <span class='detail-btn'>详情</span>" +
            "</div>" +
            "</div>";
        return $(list_item);
    }

    //显示任务列表
    function render_task_list() {
        var $task_list = $(".task-list");
        //每次添加后都清除之前的HTML内容
        $task_list.html('');

        var complete_items = [];
        //任务分类，渲染未完成任务
        for (var i = 0; i < task_list.length; i++) {
            //已完成的任务 转移到complete_items数组     
            var item = task_list[i];
            //筛选满足complete的item
            if (item && item.complete) {
                //task_list[i]的内容赋给complete_items[i]查看详情
                complete_items[i] = item;
            }
            //未完成的任务
            else {
                var $task = render_task_item(item, i);
                //倒序添加到.task_list 
                $task_list.prepend($task);
            }
        }
        //将complete_items数组里已完成的任务渲染出来，放到列表下方
        for (var j = 0; j < complete_items.length; j++) {
            //complete_items[j]如果改成item，显示的将是task_list[i]的最后一个内容
            $task = render_task_item(complete_items[j], j);
            //如果无法渲染则跳过，避免超出循环次数j 造成$task里多出来的undefined不能读取addClass
            if (!$task) continue;
            $task.addClass("completed");
            $task_list.append($task);
        }

        //问题：每次刷新都要监听一次有没有触发删除按钮，否则只能执行一次，第二次删除时无法监听造成无反应
        listen_task_delete();
        listen_task_detail();
        listen_task_complete();
    }

    //添加功能结束

    //删除功能开始

    //监听点击删除按钮事件  
    function listen_task_delete() {
        //问题：等待全部task_item加载class='delete'完毕才能用$找到删除按钮
        $('.delete-btn').on("click", function () {
            var $this = $(this);
            //找到删除按钮的div task-item元素
            var $item = $this.parent().parent();
            //调用 .data()获取HTML数据属性值
            var index = $item.data("index");
            pop("确定要删除？").then(function (r) {
                //如果点击的是确定按钮
                if (r) {
                    // console.log("r", r); 
                    r ? delete_task(index) : null;
                }
            });          
            //console.log("$item.data(index)", $item.data("index"));
        });
    }

    //删除任务
    function delete_task(index) {
        //if条件为null / undefined / 0 / NaN / "" 表达式时，都会被解释为false
        //问题：if(!)如果index值为0，那么就会变为true，造成第一条无法删除，所以使用undefined作判断
        //如果index没有初始化并传进来即index不存在 或者 task_list里没有index 则不执行
        if (index == undefined || !task_list[index]) return;
        //删除当前task，delete会设置对象为null
        delete task_list[index];
        //删除一条就刷新一次列表
        refresh_task_list();
        $(".add-task input").focus();
    }

    //删除功能结束

    //查看详情和修改更新内容开始

    //监听打开详情事件
    function listen_task_detail() {
        var index;
        //双击任务条打开详情
        $(".task-item").on("dblclick", function () {
            index = $(this).data("index");
            show_task_detail(index);
        });
        //单击详情按钮打开详情
        $(".detail-btn").on("click", function () {
            var $this = $(this);
            //找到详情按钮的div task-item元素
            var $item = $this.parent().parent();
            //调用 .data()获取HTML数据属性值
            index = $item.data("index");
            show_task_detail(index);
        })
    }

    //渲染详情模板并显示详情和遮罩
    function show_task_detail(index) {
        render_task_detail(index);
        $task_detail.show();
        $mask.show();
    }

    //渲染详情模板并显示详情,监听更新按钮提交事件
    function render_task_detail(index) {
        if (index == undefined || !task_list[index]) return;
        var item = task_list[index];
        // console.log("item", item);
        //问题 (item.desc || '') (item.content || '') item属性没有值则设置为空字符串
        var tpl = "<form>" +
            "<div class='content'>" + (item.content || '') + "</div>" +
            "<div><input style='display:none;' name='content' type='text' value='" + (item.content || '') + "' autofocus autocomplete='off'></input></div>" +
            "<div><div class='desc'><textarea name='desc'>" + (item.desc || '') + "</textarea></div></div>" +
            "<div class='remind'><label>提醒时间</label><input class='datetime' name='remind_date' type='text' autocomplete='off' value='" + (item.date || "") + "'>" +
            "<div><button type='submit'>更新</button></div></div>" +
            "</form>";

        $task_detail.html(null); //清空旧模板
        $task_detail.html(tpl); //将新模板添加到task_detail
        $(".datetime").datetimepicker();
        //触发更新按钮提交输入内容到localStorage
        $update_form = $task_detail.find("form");
        $update_form.on("submit", function (e) {
            //阻止submit的默认行为
            e.preventDefault();
            var data = {};
            data.content = $(this).find("[name=content]").val();
            data.desc = $(this).find("[name=desc]").val();
            data.date = $(this).find("[name=remind_date]").val();
            //console.log("data", data);
            //第二个参数不能用item，item是以前存的值，不是新输入的,所以新建data对象传数据
            update_task(index, data);
            hide_task_detail();
        });
        //选中task_detail标题内容
        $task_detail_content = $task_detail.find(".content");
        //选中task_detail标题的input
        $task_detail_content_input = $update_form.find("[name=content]");
        //选中task_detail的描述文本域
        $task_detail_content_textarea = $update_form.find("[name=desc]");
        if ($task_detail_content_input.val() == "" || $task_detail_content_input.val() == undefined) {
            $task_detail_content.hide();
            $task_detail_content_input.show();
        }
        $task_detail_content.on("click", function () {
            $task_detail_content.hide();
            $task_detail_content_input.show();
        });
    }

    //点击遮罩 隐藏详情和遮罩
    $mask.on("click", hide_task_detail);

    function hide_task_detail() {
        $task_detail.hide();
        $mask.hide();
    }

    //更新任务对象到localStorage并刷新页面模板列表
    function update_task(index, data) {
        if (index == undefined || !task_list[index]) return;
        //将两个对象的内容合并到第一个对象,
        //也就是用data对象的同名属性修改task_list[index]的同名属性形成一个新对象。
        //但是实际不会改变task_list[index]。
        task_list[index] = $.extend({}, task_list[index], data);
        refresh_task_list();
        // console.log("task_list[index]", task_list[index]);
    }

    //查看详情和修改更新内容结束

    //标记完成状态开始

    //监听完成任务，勾选checkbox时，更新任务对象到localStorage并刷新页面模板列表
    function listen_task_complete() {
        $(".task-list .complete").on("click", function () {
            var $this = $(this);
            // var $is_complete = $this.is(":checked");  
            //获取对应的task_list数组里的索引         
            var index = $this.parent().parent().data("index");
            //根据索引获取对应的task_list数组里的对象
            var item = get(index);
            //如果第二次点击 {complete: false}
            if (item.complete) {
                update_task(index, {
                    complete: false
                });
                // $this.prop("checked", true); 
                //因为update_task每次会重新刷新view页面,勾选被刷新，
                //所以view页面的勾选要交给render_task_item
            }
            //第一次点击 {complete: true}
            else {
                update_task(index, {
                    complete: true
                });
                // $this.prop("checked", false);
            }
        })
    }

    function get(index) {
        return store.get("task_list")[index];
    }

    //标记完成状态结束
    
    //自定义确认弹出层开始
    function pop(arg) {
        if (!arg) {
            console.error("pop title is required");
        }

        var conf = {},
            $box,
            $mask,
            $title,
            $content,
            $confirm,
            $cancel,
            confirm_result,
            timer,
            dfd;

        //异步操作：deffer返回promise，持续等待，承诺用户点击(返回结果)之后一定返回数据(另一个结果)
        dfd = $.Deferred();

        if (typeof arg == "string") {
            conf.title = arg;
        } else {
            conf = $.extend(conf, arg);
        }

        $box = $("<div>" +
            "<div class='pop_title'>" + conf.title + "</div>" +
            "<div class='pop_content'>" +
            "<button style='margin-right: 5px;' type='button' class='confirm'>确定</button>" +
            "<button type='button' class='cancel'>取消</button>" +
            "</div>" +
            "</div>").css({
            position: "fixed",
            color: "#2d4059",
            width: 300,
            padding: "10px",
            background: "#fff",
            "border-radius": "5px",
            "box-shadow": "0 1px 6px rgba(32, 33, 36, 0.28)"
        });

        $mask = $("<div></div>").css({
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            background: "rgba(0, 0, 0, .3)"
        });

        $title = $box.find(".pop_title").css({
            padding: "15px 10px",
            "text-align": "center",
            "font-size": "18px",
            "font-weight": "bold"
        });

        $content = $box.find(".pop_content").css({
            padding: "5px 10px",
            "text-align": "center"
        });

        $confirm = $content.find("button.confirm");
        $cancel = $content.find("button.cancel");

        //定时检查(轮询)用户选择点击哪个按钮
        timer = setInterval(function () {
            //如果用户点击了任意一个按钮
            if (confirm_result !== undefined) {
                //用于耗时的代码中，不知道什么时候，等待用户点击才能返回结果
                dfd.resolve(confirm_result);
                //用户点击之后不再检查用户选择点击哪个按钮
                clearInterval(timer);
                disappear_pop();
            }
        }, 50);

        //弹出层消失
        function disappear_pop() {
            $mask.remove();
            $box.remove();
        }

        //点击确认按钮返回的结果
        $confirm.on("click", on_confirm);

        //点击取消按钮取消
        $cancel.on("click", on_cancel);

        //点击遮罩时取消
        $mask.on("click", on_cancel);

        function on_confirm() {
            confirm_result = true;
        }

        function on_cancel() {
            confirm_result = false;
        }

        //调整弹出层盒子位置
        function adjust_box_position() {
            var window_width = $window.width(),
                window_height = $window.height(),
                box_width = $box.width(),
                box_height = $box.height(),
                move_x,
                move_y;

            move_x = (window_width - box_width) / 2;
            move_y = (window_height - box_height) / 2;
            $box.css({
                left: move_x,
                top: move_y
            })
        }

        //水平缩放时实现动态居中
        $window.on("resize", function () {
            adjust_box_position();
        });
        //appendTo()追加到元素内，append追加到元素外
        $mask.appendTo($body);
        $box.appendTo($body);
        //触发缩放事件进行居中
        $window.resize();
        //return .promise()之后可以使用then方法,then方法可以传数据，而且不会阻止后台或者其他内容的运行
        return dfd.promise();
    }

    //自定义确认弹出层结束

    //定时提醒功能开始

    function task_remind_check() {
        var current_time;
        //定时检查所有任务项的提醒时间是否超过当前时间
        var timer = setInterval(function () {
            for (var i = 0; i < task_list.length; i++) {
                var item = get(i),
                    task_time;
                //如果没有设置提醒时间或者已完成则不往下执行    
                if (!item || !item.date || item.complete) {
                    continue;
                }
                current_time = (new Date()).getTime();
                task_time = (new Date(item.date)).getTime();
                // console.log("current_time", current_time);
                // console.log("task_time", task_time);
                if (current_time - task_time >= 1) {
                    show_msg(item.content, i);
                    // update_task(i, {informed: true}); //闹钟提醒只能设置一次                                  
                }
            }
        }, 500)
    }

    //渲染提示信息模板，监听点击确认按钮事件
    function render_remind_msg(msg, index) {
        var tpl =
            '<div class="msg-content" data-index="' + index + '">' + msg + '</div>' +
            '<div class="confirmed">知道了</div>';
        $msg.html(tpl);
        //设置新对象 
        var data = {};
        $(".confirmed").on("click", function () {
            // console.log("1", 1);
            hide_msg();
            // $bell.get(0).pause();
            //根据HTML数据属性data-index，使用.data()找到localStorage中要更新的那一个的data对象
            //把data对象的date提醒时间清空，实现重新设置提醒闹钟
            var index = $(this).siblings('.msg-content').data('index');
            data.date = "";
            update_task(index, data);
        });
    }

    //显示提醒并播放警铃
    function show_msg(msg, index) {
        //如果没有信息则不显示提示信息模板
        if (!msg) return;
        render_remind_msg(msg, index);
        $msg.show();
        //.get() 则会获取单个DOM元素节点，index以 0 开始计数 
        // $bell.get(0).play();
        // var promise = document.querySelector('video').play();

        // if (promise !== undefined) {
        //     promise.then(_ => {
        //          $bell.get(0).pause();
        //     }).catch(error => {
        //         // Autoplay was prevented.
        //         // Show a "Play" button so that user can start playback.
        //     });
        // }
    }

    //隐藏提醒
    function hide_msg() {
        $msg.hide();
    }

    //定时提醒功能结束
})();