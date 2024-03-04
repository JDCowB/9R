/*
新东东农场任务

种植，任务，抽奖，浇水

环境变量：
jd_XinFarm_plantSkuId // 需要种植的作物ID，详见脚本打印
jd_XinFarm_plant_mode // 种植模式 默认自动种植  填写 0 需填写种植ID变量   填写 1 自动随机种植等级3
jd_XinFarm_waternum // 浇水次数，默认 10次  自行修改
jd_XinFarm_Notify // 是否推送通知（true/false），默认不推送
代理变量：
支持API  代理池   具体请查看 Wiki

cron:45 2-22/6 * * *

*/

const $ = new Env('新东东农场任务')
const jdCookie = require('./jdCookie')
const notify = require('./utils/Rebels_sendJDNotify')
const common = require('./utils/Rebels_jdCommon')
const { H5st } = require('./utils/Rebels_H')
console.log('');
console.log(`==========${$.name}变量说明==========`);
console.log(`jd_XinFarm_plantSkuId // 种植ID`);
console.log(`jd_XinFarm_plant_mode // 种植模式 默认自动种植`);
console.log(`jd_XinFarm_waternum // 浇水次数，默认 10次`);
console.log(`jd_XinFarm_Notify // 是否通知(true/false)，默认不推送`);
console.log(`jd_XinFarm_ShowMsg // 是否显示汇总(true/false)，默认不汇总`);
console.log(`==========${$.name}提示结束==========`);
console.log('');
const plantSkuId = process.env.jd_XinFarm_plantSkuId || '' // 种植ID
const waternum = process.env.jd_XinFarm_waternum || 10 //浇水次数，默认 10次
const plant_mode = process.env.jd_XinFarm_plant_mode || '1' // 种植模式， 0为填写变量种植，1为自动种植
const isNotify = process.env.jd_XinFarm_Notify === 'true' // 是否推送通知，默认不推送
const showMsg = process.env.jd_XinFarm_ShowMsg === 'true' // 显示汇总
let time = Date.now();
const sign_linkId = 'LCH-fV7hSnChB-6i5f4ayw'
const draw_linkId = 'VssYBUKJOen7HZXpC8dRFA'
const award_map = {
    1: '水滴',
}
let cookie = ''
const cookiesArr = Object.keys(jdCookie)
    .map((key) => jdCookie[key])
    .filter((value) => value)
if (!cookiesArr[0]) {
    $.msg($.name, '【提示】请先获取Cookie')
    process.exit(1)
}

!(async () => {
    // 运行内容

    notify.config({ title: $.name })
    for (let i = 0; i < cookiesArr.length; i++) {
        $.index = i + 1
        cookie = cookiesArr[i]
        common.setCookie(cookie)
        $.UserName = decodeURIComponent(common.getCookieValue(cookie, 'pt_pin'))
        $.UA = common.genUA($.UserName)
        $.message = notify.create($.index, $.UserName)
        $.nickName = ''
        $.retry = 1
        console.log(`\n******开始【京东账号${$.index}】${$.nickName || $.UserName}******\n`)
        await Main()
        common.unsetCookie()
        if ($.runEnd) break
        await $.wait(3000)
    }
    if (isNotify && notify.getMessage()) {
        notify.updateContent(notify.content + `\n\n`)
        await notify.push()
    }
})()
    .catch((e) => $.logErr(e))
    .finally(() => $.done())

async function Main() {
    $.canWatering = true
    $.canWaterstop = false
    $.XinFarm_hot = false
    try {
        // 检查登录状态
        const loginStatus = await common.getLoginStatus(cookie)
        if (!loginStatus && typeof loginStatus === 'boolean') {
            console.log('账号无效')
            $.message.fix('账号无效')
            return
        }

        // 初始化
        $.farm_home = ''
        await sendRequest('farm_home')
        if ($.farm_home.bizCode === 0) {
            const treeFullStage = $.farm_home?.result?.treeFullStage // 是否已经种植
            // const bottleWater = $.farm_home?.result?.bottleWater // 水滴
            const waterTips = $.farm_home?.result?.waterTips || '' // 提示语
            const treeLevel = $.farm_home?.result?.treeLevel || 0 // 种植等级
            const completeTimes = $.farm_home?.result?.completeTimes || 0 // 已成功兑换水果次数
            const skuName = $.farm_home?.result?.skuName // 当前种植商品名称
            // const inviteCode = $.farm_home?.result?.farmHomeShare?.inviteCode // 助力码
            switch (treeFullStage) {
                case 0: // 未种植
                    $.farmTreeLevels = ''
                    await sendRequest('farm_tree_board')
                    $.farmTreeLevels = $.farm_tree_board?.farmTreeLevels
                    switch (plant_mode) {
                        case '0' :
                            console.log(`[填ID模式]当前尚未种植，可种植的商品如下：\n`)
                            if ($.farmTreeLevels.length) {
                                for (let item of $.farmTreeLevels) {
                                    const farmLevelTrees = item.farmLevelTrees // 该等级下的商品信息
                                    // const level = item.level // 等级
                                    const needDays = item.needDays // 最快成熟天数
                                    for (let i = 0; i < farmLevelTrees.length; i++) {
                                        const skuName = farmLevelTrees[i].skuName // 种植名字
                                        const uid = farmLevelTrees[i].uid //种植ID
                                        console.log(`${skuName}（最快成熟需要${needDays}天）\n种植变量ID：${uid}\n`)
                                    }
                                }
                                if (plantSkuId) {
                                    $.plantSuccess = false
                                    $.plantSkuId = plantSkuId
                                    console.log(`\n已填写种植ID[${$.plantSkuId}]，现在去种植~`)
                                    await sendRequest('farm_plant_tree')
                                    if ($.plantSuccess) {
                                        break
                                    }
                                } else {
                                    console.log(`未填写种植ID，请先填写后再次运行~`)
                                    $.showMsg += '未填写种植商品id变量，请先填写后再运行~'
                                    return
                                }
                            } else {
                                console.log(`没有可种植的作物：${JSON.stringify($.farm_tree_board)}`)
                                return
                            }
                            break
                        case '1' :
                            console.log(`[自动模式]当前尚未种植，自动随机选择种植\n`)
                            $.farmTreeLevels = $.farm_tree_board?.farmTreeLevels?.sort(function (a,b) {return b.level-a.level}) || [];
                            if ($.farmTreeLevels.length) {
                                $.best_level = $.farmTreeLevels[0].farmLevelTrees
                                let maxObj = null;
                                let maxValue = -Infinity;
                                $.best_level.forEach(item => {
                                const price = parseFloat(item.pPrice);
                                if (!isNaN(price) && price > maxValue) {
                                    maxValue = price;
                                    maxObj = item;
                                }
                                });
                                $.zdfarmLevelTrees = maxObj;
                                if($.zdfarmLevelTrees) {
                                    $.plantSuccess = false
                                    $.plantSkuId = $.zdfarmLevelTrees.uid
                                    console.log(`随机种植：[${$.zdfarmLevelTrees.skuName}，价值：${$.zdfarmLevelTrees.pPrice}元]，现在去种植~\n`)
                                    await sendRequest('farm_plant_tree')
                                    if ($.plantSuccess) {
                                        break
                                    }
                                    await $.wait(parseInt(Math.random() * 2000 + 2000, 10));
                                }
                            } else {
                                console.log(`没有可种植的作物：${JSON.stringify($.farm_tree_board)}`)
                                return
                            }
                            break;
                        default:
                            console.log(`${plant_mode} 错误，未匹配到对应模式\n`);
                    }
                    break
                case 1: // 发芽
                case 2: // 长大
                case 3: // 开花
                case 4: // 结果
                    console.log(`🌳 [等级${treeLevel}]${skuName}\n🌳 当前进度：${waterTips}(${treeFullStage}/5)\n🌳 已兑换水果： ${completeTimes} 次\n`)
                    $.showMsg = `🌳 [等级${treeLevel}]${skuName}\n🌳 当前进度：${waterTips}(${treeFullStage}/5)\n🌳 已兑换水果： ${completeTimes} 次\n`
                    break
                case 5: // 已成熟
                    console.log(`🎉 种植的 “${skuName}” 可以收获啦~`)
                    $.showMsg += `🎉 种植的 “${skuName}” 可以收获啦~`
                    await notify.sendNotify(`${$.name}成熟通知`, `【京东账号${$.index}】${$.nickName}\n种植的 “${skuName}” 可以收获啦~\n\n`)
                    console.log(`\n重新种植，可种植的商品如下：\n`)
                    $.farmTreeLevels = ''
                    await sendRequest('farm_tree_board')
                    $.farmTreeLevels = $.farm_tree_board?.farmTreeLevels
                    switch (plant_mode) {
                        case '0' :
                            console.log(`[填ID模式]当前尚未种植，可种植的商品如下：\n`)
                            if ($.farmTreeLevels.length) {
                                for (let item of $.farmTreeLevels) {
                                    const farmLevelTrees = item.farmLevelTrees // 该等级下的商品信息
                                    // const level = item.level // 等级
                                    const needDays = item.needDays // 最快成熟天数
                                    for (let i = 0; i < farmLevelTrees.length; i++) {
                                        const skuName = farmLevelTrees[i].skuName // 种植名字
                                        const uid = farmLevelTrees[i].uid //种植ID
                                        console.log(`${skuName}（最快成熟需要${needDays}天）\n种植变量ID：${uid}\n`)
                                    }
                                }
                                if (plantSkuId) {
                                    $.plantSuccess = false
                                    $.plantSkuId = plantSkuId
                                    console.log(`\n已填写种植ID[${$.plantSkuId}]，现在去种植~`)
                                    await sendRequest('farm_plant_tree')
                                    if ($.plantSuccess) {
                                        break
                                    }
                                } else {
                                    console.log(`未填写种植ID，请先填写后再次运行~`)
                                    $.showMsg += '未填写种植商品id变量，请先填写后再运行~'
                                    return
                                }
                            } else {
                                console.log(`没有可种植的作物：${JSON.stringify($.farm_tree_board)}`)
                                return
                            }
                            break
                        case '1' :
                            console.log(`[自动模式]当前尚未种植，自动随机选择种植\n`)
                            $.farmTreeLevels = $.farm_tree_board?.farmTreeLevels?.sort(function (a,b) {return b.level-a.level}) || [];
                            if ($.farmTreeLevels.length) {
                                $.best_level = $.farmTreeLevels[0].farmLevelTrees
                                let maxObj = null;
                                let maxValue = -Infinity;
                                $.best_level.forEach(item => {
                                const price = parseFloat(item.pPrice);
                                if (!isNaN(price) && price > maxValue) {
                                    maxValue = price;
                                    maxObj = item;
                                }
                                });
                                $.zdfarmLevelTrees = maxObj;
                                if($.zdfarmLevelTrees) {
                                    $.plantSuccess = false
                                    $.plantSkuId = $.zdfarmLevelTrees.uid
                                    console.log(`随机种植：[${$.zdfarmLevelTrees.skuName}，价值：${$.zdfarmLevelTrees.pPrice}元]，现在去种植~\n`)
                                    await sendRequest('farm_plant_tree')
                                    if ($.plantSuccess) {
                                        break
                                    }
                                    await $.wait(parseInt(Math.random() * 2000 + 2000, 10));
                                }
                            } else {
                                console.log(`没有可种植的作物：${JSON.stringify($.farm_tree_board)}`)
                                return
                            }
                            break;
                        default:
                            console.log(`${plant_mode} 错误，未匹配到对应模式\n`);
                    }
                    break
            }
            // 签到有奖
            await dailySign()
            if ($.XinFarm_hot) return
            // 做任务
            await doTask()
            if ($.XinFarm_hot) return
            // 每日任务抽奖
            await doTask_draw()
            // 领取助力奖励
            await getAssistRewards()
            // 去浇水
            await goWatering()
            // 做任务 //领取浇水奖励
            await doTask()
            // 通知
            if(showMsg) {
                console.log(`账号[${$.index}]详情汇总：\n${$.showMsg}`)
            }
            $.message.fix(`${$.showMsg}\n`)
        } else {
            switch ($.farm_home?.bizCode) {
                case -1001: // 异常
                    console.log(`${$.farm_home?.bizMsg}（状态码${$.farm_home?.bizCode}）`)
                    $.message.fix(`${$.farm_home?.bizMsg}`)
                    break
                default: {
                    console.log(`${$.farm_home?.bizMsg || '未知'}（状态码${$.farm_home?.bizCode || ''}）`)
                    break
                }
            }
            if ($.retry < 1) {
                $.retry++
                console.log(`等待5秒后重试，第${$.retry}次`)
                await $.wait(5000)
                await Main()
            }
        }
    } catch (e) {
        console.log(e.message)
    }
}

// 签到有奖
async function dailySign() {
    await sendRequest('dongDongFarmSignHome')
    const signInFlag = $.dongDongFarmSignHome?.signInFlag || 0 // 签到详情
    // const runningSignDay = $.dongDongFarmSignHome?.runningSignDay || 0 // 签到天数
    switch (signInFlag) {
        case 0: {
            console.log('去做任务 "每日签到"')
            await sendRequest('dongDongFarmSignIn')
            await $.wait(1000)
            await sendRequest('dongDongFarmSignHome')
            break
        }
        case 1: {
            // 已签到
            // console.log(`今日已完成签到任务，签到天数：${runningSignDay}`)
            break
        }
        default: {
            console.log(signInFlag)
            break
        }
    }
}

// 每日任务抽奖
async function doTask_draw() {
    $.apTaskList = ''
    await sendRequest('apTaskList')
    if($.apTaskList) {
        let XinapTaskList = $.apTaskList || [];
        for (let b = 0; b < XinapTaskList.length; b++) {
            $.taskTitle = XinapTaskList[b]['taskTitle'];
            $.apTaskListid = XinapTaskList[b]['id'];
            $.taskType = XinapTaskList[b]['taskType'];
            $.taskSourceUrl = XinapTaskList[b]['taskSourceUrl'];
            $.taskDoTimes = XinapTaskList[b]['taskDoTimes'];
            $.taskFinished = XinapTaskList[b]['taskFinished'];
            $.taskShowTitle = XinapTaskList[b]['taskShowTitle'];
            if (!$.taskFinished && $.taskType.includes('BROWSE_')) {
                for (let b = 0; b < 1; b++) {
                    console.log(`去做 ${$.taskShowTitle}`);
                    await sendRequest('apsDoTask') //完成任务
                    await $.wait(parseInt(Math.random() * 1500 + 2000, 10));
                }
            }
        }
    }
    await sendRequest('wheelsHome') //抽奖首页 获取抽奖次数
    if($.lotteryChances > 0 ) {
        console.log(`每日抽奖${$.lotteryChances || 0}次，去抽奖`)
        for (let b = 0; b < $.lotteryChances; b++) {
            await sendRequest('wheelsLottery') //取抽奖
            await $.wait(parseInt(Math.random() * 1500 + 2000, 10));
        }
        
    }
}

// 做任务
async function doTask() {
    let haveDoTask = false
    await sendRequest('farm_task_list')
    let taskList = $.farm_task_list?.taskList || [] // 任务列表
    for (let task of taskList) {
        const taskStatus = task?.taskStatus // 任务状态
        if (taskStatus === 3) continue // 跳过已完成的任务
        const mainTitle = task?.mainTitle // 任务名字
        // const subTitle = task?.subTitle // 任务要求
        // const waterCounts = task?.waterCounts // 获得水滴
        $.taskId = task?.taskId // 任务ID
        $.taskSourceUrl = task?.taskSourceUrl // 任务参数
        $.taskType = task?.taskType // 任务类型
        $.taskInsert = task?.taskInsert // 任务状态
        switch (taskStatus) {
            case 1: {
                // 未完成
                switch ($.taskType) {
                    case 'CUMULATIVE_TIMES': // 浇水任务
                    case 'ORDER_MARK': // 下单任务
                        break
                    case 'BROWSE_CHANNEL': // 浏览任务
                    case 'BROWSE_PRODUCT': // 浏览任务
                    default: {
                        if (task.taskSourceUrl) {
                            haveDoTask = true
                            console.log(`去做任务 "${mainTitle}"`)
                            await sendRequest('farm_do_task')
                            await $.wait(3000)
                        } else {
                            haveDoTask = true
                            await sendRequest('farm_task_detail')
                            await $.wait(3000)
                            const taskDetaiList = $.farm_task_detail?.taskDetaiList || [] // 任务列表
                            const taskDetail = taskDetaiList[0]
                            // console.log(taskDetail)
                            console.log(`去做任务 "${mainTitle}"`)
                            if (taskDetail) {
                                $.taskSourceUrl = taskDetail.itemId
                                $.taskInsert = taskDetail.taskInsert
                                await sendRequest('farm_do_task')
                                await $.wait(3000)
                            } else {
                                console.log('> 任务失败，没有获取到任务ID')
                            }
                        }
                        break
                    }
                }
                break
            }
            case 2: {
                // 可领取
                console.log(`去领取 "${mainTitle}" 任务奖励`)
                await sendRequest('farm_task_receive_award')
                await $.wait(3000)
                break
            }
            default:
                console.log(`任务 "${task.mainTitle}" 状态未知：${task.taskStatus}`)
                break
        }
    }
    if (haveDoTask) {
        // 重新获取任务列表然后去领取奖励
        await sendRequest('farm_task_list')
        taskList = $.farm_task_list?.taskList || [] // 任务列表
        for (let task of taskList) {
            const mainTitle = task.mainTitle // 任务名字
            // $.subTitle = task.subTitle // 任务要求
            // $.waterCounts = task.waterCounts // 获得水滴
            $.taskId = task.taskId // 任务ID
            $.taskSourceUrl = task.taskSourceUrl // 任务相关
            $.taskType = task.taskType // 任务类型
            $.taskInsert = task.taskInsert // 任务状态
            const taskStatus = task.taskStatus // 任务状态
            if (task.taskStatus === 2) {
                // 可领取
                console.log(`去领取 "${mainTitle}" 任务奖励`)
                await sendRequest('farm_task_receive_award')
                await $.wait(3000)
            }
        }
    }
    console.log('')
}

// 领取助力奖励
async function getAssistRewards() {
    $.farm_assist_init_info_hot = true
    await sendRequest('farm_assist_init_info') // 获取助力详情
    if ($.farm_assist_init_info_hot) {
        const assistStageList = $.farm_assist_init_info?.result?.assistStageList || [] // 助力阶段列表
        const assistFriendList = $.farm_assist_init_info?.result?.assistFriendList || [] // 助力详情
        let assistFriendname = ''
        for (let i = 0; i < assistFriendList.length; i++) {
            const nicknameItem = assistFriendList[i]
            const nickname = nicknameItem.nickname
            if (i != assistFriendList.length - 1) {
                assistFriendname += `${nickname}，`
            } else {
                assistFriendname += `${nickname}`
            }
        }
        if(assistFriendList.length > 0 ){
            // console.log(`🌳 已有${assistFriendList.length}人为你助力:[${assistFriendname}]\n`)
            $.showMsg += `🌳 已有${assistFriendList.length}人为你助力:[${assistFriendname}]\n`
            for (let item of assistStageList) {
                $.assistNum = item?.assistNum
                $.stage = item?.stage
                $.waterEnergy = item?.waterEnergy
                switch (item?.stageStaus) {
                    case 1: // 未完成
                        console.log(`助力人数未满 [${$.assistNum}人助力],请继续邀请吧！`)
                        break
                    case 2: // 可领取
                        console.log(`助力人数已满 [${$.assistNum}人助力],现在去领取 [${$.waterEnergy}水滴] 奖励！`)
                        await $.wait(1500)
                        await sendRequest('farm_assist_receive_award')
                        await $.wait(1500)
                        break
                    case 3: // 已领取
                        console.log(`助力人数已满 [${$.assistNum}人助力],奖励 [${$.waterEnergy}水滴] 已经领取！`)
                        // $.message.insert(`助力人数已满 [${$.assistNum}人助力],奖励 [${$.waterEnergy}水滴] 已经领取！`)
                        break
                    default: {
                        console.log(`[未知状态]:${item?.stageStaus}`)
                        break
                    }
                }
            }
        } else {
            console.log(`🌳 还没有人为您助力，快去邀请吧~\n`)
            $.showMsg += `🌳 还没有人为您助力，快去邀请吧~\n`
        }
        // const assistFriendList = $.farm_assist_init_info?.result?.assistFriendList || [] // 助力好友列表
        // 打印助力详情
        // for (let i = 0; i < assistStageList.length; i++) {
        // const stage = assistStageList[i].stage // 阶段等级
        // const assistNum = assistStageList[i].assistNum // 需要的助力人数
        // const percentage = assistStageList[i].percentage // 完成进度
        // const waterEnergy = assistStageList[i].waterEnergy // 奖励水滴数量
        // const stageStaus = assistStageList[i].stageStaus // 领取状态，1：未完成，2：可领取，3：已领取
        // console.log(`助力人数：${assistNum}，完成进度：${percentage}：水滴奖励：${waterEnergy}：领取状态：${stageStaus}`)
        // }
        
    }
}

function getGrowthWord(currentStage, currentProcess) {
    if (currentProcess === '100' || currentProcess === 100) {
        switch (currentStage) {
            case 1:
                return '果树发芽了'
            case 2:
                return '果树长大了'
            case 3:
                return '果树开花了'
            case 4:
                return '果树结果了'
            case 5:
                return '果树成熟了，快去收获吧~'
        }
    } else {
        const remainingPercentage = `${(100 - currentProcess).toFixed(2)}%`
        switch (currentStage) {
            case 1:
                return `距离长大还有${remainingPercentage}`
            case 2:
                return `距离开花还有${remainingPercentage}`
            case 3:
                return `距离结果还有${remainingPercentage}`
            case 4:
                return `距离收获还有${remainingPercentage}`
        }
    }
}

// 浇水
async function goWatering() {
    $.farm_home = ''
    await sendRequest('farm_home') //农场主页
    $.bottleWater = $.farm_home?.result?.bottleWater // 水滴
    $.canFastWater = $.farm_home?.result?.canFastWater || false // 是否可以快速浇水
    $.canWaterhot = 0
    console.log(`\n当前剩余水滴：${$.bottleWater || 0}g💧`)
    $.showMsg += `🌳 当前水滴：${$.bottleWater || 0}g💧\n`
    let count = parseInt($.bottleWater / 10);
    let num = Math.min(waternum, count);
    console.log(`已设置浇水${waternum || 0}次，去浇水${num || 0}次`)
    for (let b = 0; b < num; b++) {
        await sendRequest('farm_water')
        await $.wait(3000)
        if($.canWaterstop) {
            console.log($.lastErrorMsg)
            break
        }
    }
    // while ($.canWatering || $.bottleWater >= 10) {
    //     if ($.canFastWater && $.bottleWater >= 100) {
    //         console.log(`可以快速浇水了`)
    //         break
    //     } else {
    //         await sendRequest('farm_water')
    //         await $.wait(3000)
    //     }
    // }
}

async function handleResponse(type, res) {
    try {
        switch (type) {
            case 'farm_home':
                if (res.code === 0 && res.data?.bizCode === 0) {
                    // console.log(res)
                    $.farm_home = res.data
                } else if (res.data?.bizMsg) {
                    $.farm_home = res.data
                    // console.log(`${$.dongDongFarm?.bizMsg}（状态码${$.dongDongFarm?.bizCode}）`)
                } else if (res.errMsg) {
                    console.log(`${res.errMsg}`)
                } else if (res.msg) {
                    console.log(`${res.msg}`)
                } else {
                    console.log(`❓${type} ${JSON.stringify(res)}`)
                }
                break
            case 'farm_tree_board':
                if (res.code === 0 && res.data?.bizCode === 0) {
                    // console.log(res)
                    $.farm_tree_board = res.data?.result
                } else if (res.data?.bizMsg) {
                    console.log(`${res.data?.bizMsg}`)
                } else if (res.errMsg) {
                    console.log(`${res.errMsg}`)
                } else if (res.msg) {
                    console.log(`${res.msg}`)
                } else {
                    console.log(`❓${type} ${JSON.stringify(res)}`)
                }
                break
            case 'farm_plant_tree':
                if (res.code === 0 && res.data?.bizCode === 0) {
                    // console.log(res)
                    $.plantSuccess = true
                    console.log('种植成功\n')
                } else if (res.data?.bizMsg) {
                    $.plantSuccess = false
                    console.log(`种植失败：${res.data?.bizMsg}`)
                } else if (res.message) {
                    $.plantSuccess = false
                    console.log(`种植失败：${res.message}`)
                } else {
                    $.plantSuccess = false
                    console.log(`❓${type} ${JSON.stringify(res)}`)
                }
                break
            case 'farm_water':
                if (res.code === 0 && res.data?.bizCode === 0) {
                    let data = res.data?.result
                    let { currentProcess, updateStage, treeFullStage, finished, waterNum, stagePrize, leftProcess} = data
                    $.bottleWater = data?.bottleWater
                    $.canFastWater = data?.canFastWater
                    let prize = stagePrize?.map((x) => `${x.value}水滴`) || []
                    if (updateStage) {
                        let update_str = `已浇水${waterNum}g，${getGrowthWord(treeFullStage, 100)}`
                        if (prize.length) update_str += `，奖励${prize.join(', ')}`
                        console.log(update_str)
                    } else {
                        console.log(`已浇水${waterNum}g，${getGrowthWord(treeFullStage, currentProcess)}`)
                    }
                    if (finished) {
                        $.canWatering = false
                        console.log(`已浇水${waterNum}g，${getGrowthWord(5, 100)}`)
                    }
                    if (['奖品到手', '兑换'].some((e) => leftProcess.includes(e))) {
                        $.canWaterstop = true
                        $.lastErrorMsg = `停止浇水，果树已经成熟了，快去收获吧~`
                    }
                    // console.log(`种树进度: ${res.data?.result?.currentProcess},当前水滴：${res.data?.result?.bottleWater},\n提示：${res.data?.result?.waterTips}`);
                } else if (res.message) {
                    $.canWatering = false
                    console.log(res.message)
                    if (['异常'].some((e) => res.message.includes(e))) {
                        $.canWaterhot += 1
                        if ($.canWaterhot === 5) {
                            $.canWaterstop = true
                            $.lastErrorMsg = `浇水异常，已连续5次无法浇水，请等待一段时间后再来浇水`
                        }
                    }
                } else if (res.data?.bizMsg) {
                    $.canWatering = false
                    console.log(res.data?.bizMsg)
                    if (['火爆'].some((e) => res.data.bizMsg.includes(e))) {
                        $.canWaterhot += 1
                        if ($.canWaterhot === 5) {
                            $.canWaterstop = true
                            $.lastErrorMsg = `浇水异常，已连续5次无法浇水，请等待一段时间后再来浇水`
                        }
                    }
                } else {
                    console.log(`❓${type} ${JSON.stringify(res)}`)
                }
                break
            case 'farm_task_list':
                if (res.code === 0 && res.data?.bizCode === 0) {
                    // console.log(res)
                    $.farm_task_list = res.data?.result
                } else if (res.data?.bizMsg) {
                    console.log(`${res.data?.bizMsg}`)
                } else if (res.errMsg) {
                    console.log(`${res.errMsg}`)
                } else if (res.msg) {
                    console.log(`${res.msg}`)
                } else {
                    console.log(`❓${type} ${JSON.stringify(res)}`)
                }
                break
            case 'farm_task_detail':
                if (res.code === 0 && res.data?.bizCode === 0) {
                    // console.log(res)
                    $.farm_task_detail = res.data?.result
                } else if (res.data?.bizCode === 6004) {
                    $.XinFarm_hot = true
                    console.log(`${res.data.bizMsg}`)
                } else if (res.data?.bizMsg) {
                    console.log(`${res.data?.bizMsg}`)
                } else if (res.errMsg) {
                    console.log(`${res.errMsg}`)
                } else if (res.msg) {
                    
                    console.log(`${res.msg}`)
                } else {
                    console.log(`❓${type} ${JSON.stringify(res)}`)
                }
                break
            case 'farm_assist_init_info':
                if (res.code === 0 && res.data?.bizCode === 0) {
                    // console.log(res)
                    $.farm_assist_init_info = res.data
                } else if (res.data?.bizMsg) {
                    $.farm_assist_init_info_hot = false
                    // console.log(`${res.data?.bizMsg}}`)
                } else if (res.errMsg) {
                    console.log(`${res.errMsg}`)
                } else if (res.msg) {
                    console.log(`${res.msg}`)
                } else {
                    console.log(`❓${type} ${JSON.stringify(res)}`)
                }
                break
            case 'farm_assist_receive_award':
                if (res.code === 0 && res.data?.bizCode === 0) {
                    console.log(`领取[${$.assistNum}人助力]奖励: ${res.data?.result?.amount || 0}水滴`)
                } else if (res.data?.bizMsg) {
                    console.log(`${res.data?.bizMsg}`)
                } else if (res.errMsg) {
                    console.log(`${res.errMsg}`)
                } else if (res.msg) {
                    console.log(`${res.msg}`)
                } else {
                    console.log(`❓${type} ${JSON.stringify(res)}`)
                }
                break
            case 'farm_do_task':
                if (res.code === 0 && res.data?.bizCode === 0) {
                    console.log('> 任务完成')
                } else if (res.data?.bizCode === 6004) {
                    $.XinFarm_hot = true
                    console.log(`> 任务失败 ${res.data.bizMsg}`)
                } else if (res.data?.bizMsg) {
                    console.log(`> 任务失败 ${res.data.bizMsg}`)
                } else if (res.errMsg) {
                    console.log(`> 任务失败 ${res.errMsg}`)
                } else {
                    console.log(`> 任务失败 ${type} ${JSON.stringify(res)}`)
                }
                break
            case 'farm_task_receive_award':
                if (res.code === 0 && res.data?.bizCode === 0) {
                    let prize = res.data?.result?.taskAward?.map((x) => `${x.awardValue}${award_map[x.awardType] || `[type=${awardType}]`}`)
                    console.log(`> 领取成功，获得 - ${prize.join(', ')}`)
                } else if (res.errMsg) {
                    console.log(`> 领取失败 ${res.errMsg}`)
                } else if (res.data?.bizMsg) {
                    console.log(`> 领取失败 ${res.data?.bizMsg}`)
                } else {
                    console.log(`> 领取失败 ${type} ${JSON.stringify(res)}`)
                }
                break
            case 'dongDongFarmSignHome':
                if (res.code === 0 && res.data) {
                    // console.log(res)
                    $.dongDongFarmSignHome = res.data
                } else if (res.errMsg) {
                    console.log(res.errMsg)
                } else if (res.data?.bizMsg) {
                    console.log(res.data?.bizMsg)
                } else {
                    console.log(`❓${type} ${JSON.stringify(res)}`)
                }
                break
            case 'dongDongFarmSignIn':
                if (res.code === 0 && res.data) {
                    console.log(`> 签到成功，获得奖励 - ${res.data?.prizeConfigName}`)
                } else if (res.errMsg) {
                    $.XinFarm_hot = true
                    $.message.fix(`${res.errMsg}`)
                    console.log(`> 签到失败 ${res.errMsg}`)
                } else if (res.data?.bizMsg) {
                    console.log(`> 签到失败 ${res.data?.bizMsg}`)
                } else {
                    console.log(`> 签到失败 ${type} ${JSON.stringify(res)}`)
                }
                break
            case 'wheelsHome':
                if (res.code === 0 && res.data) {
                    $.lotteryChances = res?.data?.lotteryChances; //抽奖次数
                } else if (res.errMsg) {
                    console.log(res.errMsg)
                } else if (res.data?.bizMsg) {
                    console.log(res.data?.bizMsg)
                } else {
                    console.log(`❓${type} ${JSON.stringify(res)}`)
                }
                break
            case 'apTaskList':
                // console.log(`❓${type} ${JSON.stringify(res)}`)
                if (res.code === 0 && res.data) {
                    $.apTaskList = res?.data; //任务
                } else if (res.errMsg) {
                    console.log(res.errMsg)
                } else if (res.data?.bizMsg) {
                    console.log(res.data?.bizMsg)
                } else {
                    console.log(`❓${type} ${JSON.stringify(res)}`)
                }
                break
            case 'apsDoTask':
                if (res.code === 0 && res.data) {
                    console.log(`> 完成任务`);
                } else if (res.errMsg) {
                    console.log(res.errMsg)
                } else if (res.data?.bizMsg) {
                    console.log(res.data?.bizMsg)
                } else {
                    console.log(`❓${type} ${JSON.stringify(res)}`)
                }
                break
            case 'wheelsLottery':
                if (res.code === 0 && res.data) {
                    let rewardType = res.data?.rewardType
                    switch (rewardType) {
                        case 0:
                            console.log(`空气-${res.data?.lotteryChances}次机会`);
                            break;
                        case 1:
                        case 2:
                            console.log(`获得优惠券,${res.data?.prizeName}-${res.data?.lotteryChances}次机会`);
                            break;
                        case 18:
                            console.log(`获得水滴,${res.data?.prizeName}-${res.data?.lotteryChances}次机会`);
                            break;
                        case null:
                            console.log(`运气不太好，什么都没有抽到...`);
                            break;
                        default:
                            console.log(`${rewardType}-${res.data?.prizeName}-${res.data?.lotteryChances}次机会`);
                            return;
                    }
                } else if (res.errMsg) {
                    console.log(res.errMsg)
                } else if (res.data?.bizMsg) {
                    console.log(res.data?.bizMsg)
                } else {
                    console.log(`❓${type} ${JSON.stringify(res)}`)
                }
                break
        }
    } catch (e) {
        console.log(`❌ 未能正确处理 ${type} 请求响应 ${e.message || e}`)
    }
}

async function sendRequest(type) {
    if ($.runEnd) return
    let url = '',
        body = null,
        params = null,
        method = 'POST',
        h5st = {},
        h5stOptions = {}
    switch (type) {
        case 'farm_home':
            h5stOptions = {
                appId: 'c57f6',
                functionId: 'farm_home',
                appid: 'signed_wh5',
                clientVersion: '12.3.1',
                client: 'apple',
                body: { version: 1 },
                version: '4.2',
                pin: $.UserName,
                ua: $.UA,
                t: true,
            }
            h5st = await H5st.getH5st(h5stOptions)
            url = 'https://api.m.jd.com/client.action'
            body = h5st.paramsData
            break
        case 'farm_tree_board':
            h5stOptions = {
                appId: 'c57f6',
                functionId: 'farm_tree_board',
                appid: 'signed_wh5',
                clientVersion: '12.3.1',
                client: 'apple',
                body: { version: 1 },
                version: '4.2',
                pin: $.UserName,
                ua: $.UA,
                t: true,
            }
            h5st = await H5st.getH5st(h5stOptions)
            url = 'https://api.m.jd.com/client.action'
            body = h5st.paramsData
            break
        case 'farm_plant_tree':
            h5stOptions = {
                appId: 'c57f6',
                functionId: 'farm_plant_tree',
                appid: 'signed_wh5',
                clientVersion: '12.3.1',
                client: 'apple',
                body: { version: 1, uid: $.plantSkuId },
                version: '4.2',
                pin: $.UserName,
                ua: $.UA,
                t: true,
            }
            h5st = await H5st.getH5st(h5stOptions)
            url = 'https://api.m.jd.com/client.action'
            body = h5st.paramsData
            break
        case 'farm_water':
            h5stOptions = {
                appId: '28981',
                functionId: 'farm_water',
                appid: 'signed_wh5',
                clientVersion: '12.3.1',
                client: 'apple',
                body: { version: 1, waterType: 1 },
                version: '4.2',
                pin: $.UserName,
                ua: $.UA,
                t: true,
            }
            h5st = await H5st.getH5st(h5stOptions)
            url = 'https://api.m.jd.com/client.action'
            body = h5st.paramsData
            break
        case 'farm_assist_init_info':
            h5stOptions = {
                appId: 'c57f6',
                functionId: 'farm_assist_init_info',
                appid: 'signed_wh5',
                clientVersion: '12.3.1',
                client: 'apple',
                body: { version: 1, channel: 0 },
                version: '4.2',
                pin: $.UserName,
                ua: $.UA,
                t: true,
            }
            h5st = await H5st.getH5st(h5stOptions)
            url = 'https://api.m.jd.com/client.action'
            body = h5st.paramsData
            break
        case 'farm_task_list':
            h5stOptions = {
                appId: 'c57f6',
                functionId: 'farm_task_list',
                appid: 'signed_wh5',
                clientVersion: '12.3.1',
                client: 'apple',
                body: { version: 1, channel: 0 },
                version: '4.2',
                pin: $.UserName,
                ua: $.UA,
                t: true,
            }
            h5st = await H5st.getH5st(h5stOptions)
            url = 'https://api.m.jd.com/client.action'
            body = h5st.paramsData
            break
        case 'farm_task_detail':
            h5stOptions = {
                appId: 'c57f6',
                functionId: 'farm_task_detail',
                appid: 'signed_wh5',
                clientVersion: '12.3.1',
                client: 'apple',
                body: { version: 1, taskType: $.taskType, taskId: $.taskId, channel: 0 },
                version: '4.2',
                pin: $.UserName,
                ua: $.UA,
                t: true,
            }
            h5st = await H5st.getH5st(h5stOptions)
            url = 'https://api.m.jd.com/client.action'
            body = h5st.paramsData
            break
        case 'farm_do_task':
            h5stOptions = {
                appId: '28981',
                functionId: 'farm_do_task',
                appid: 'signed_wh5',
                clientVersion: '12.3.1',
                client: 'apple',
                body: { version: 1, taskType: $.taskType, taskId: $.taskId, taskInsert: $.taskInsert, itemId: Buffer.from($.taskSourceUrl, 'utf-8').toString('base64'), channel: 0 },
                version: '4.2',
                pin: $.UserName,
                ua: $.UA,
                t: true,
            }
            h5st = await H5st.getH5st(h5stOptions)
            url = 'https://api.m.jd.com/client.action'
            body = h5st.paramsData
            break
        case 'farm_task_receive_award':
            h5stOptions = {
                appId: '33e0f',
                functionId: 'farm_task_receive_award',
                appid: 'signed_wh5',
                clientVersion: '12.3.1',
                client: 'apple',
                body: { version: 1, taskType: $.taskType, taskId: $.taskId, channel: 0 },
                version: '4.2',
                pin: $.UserName,
                ua: $.UA,
                t: true,
            }
            h5st = await H5st.getH5st(h5stOptions)
            url = 'https://api.m.jd.com/client.action'
            body = h5st.paramsData
            break
        case 'farm_assist_receive_award':
            h5stOptions = {
                appId: 'c4332',
                functionId: 'farm_assist_receive_award',
                appid: 'signed_wh5',
                clientVersion: '12.3.1',
                client: 'apple',
                body: { version: 1 },
                version: '4.2',
                pin: $.UserName,
                ua: $.UA,
                t: true,
            }
            h5st = await H5st.getH5st(h5stOptions)
            url = 'https://api.m.jd.com/client.action'
            body = h5st.paramsData
            break
        case 'dongDongFarmSignHome':
            h5stOptions = {
                appId: 'deba1',
                functionId: 'dongDongFarmSignHome',
                appid: 'activities_platform',
                clientVersion: '12.3.1',
                client: 'apple',
                body: { linkId: sign_linkId },
                version: '4.2',
                pin: $.UserName,
                ua: $.UA,
                t: true,
            }
            h5st = await H5st.getH5st(h5stOptions)
            url = 'https://api.m.jd.com/api'
            body = h5st.paramsData
            break
        case 'dongDongFarmSignIn':
            h5stOptions = {
                appId: '65f9d',
                functionId: 'dongDongFarmSignIn',
                appid: 'activities_platform',
                clientVersion: '12.3.1',
                client: 'apple',
                body: { linkId: sign_linkId },
                version: '4.2',
                pin: $.UserName,
                ua: $.UA,
                t: true,
            }
            h5st = await H5st.getH5st(h5stOptions)
            url = 'https://api.m.jd.com/api'
            body = h5st.paramsData
            break
        case 'wheelsHome':
            h5stOptions = {
                appId: 'c06b7',
                functionId: 'wheelsHome',
                appid: 'activities_platform',
                clientVersion: '12.3.1',
                client: 'ios',
                body: { linkId: draw_linkId },
                version: '4.4',
                pin: $.UserName,
                ua: $.UA,
                t: true,
            }
            h5st = await H5st.getH5st(h5stOptions)
            url = 'https://api.m.jd.com/api'
            body = h5st.paramsData
            break
        case 'apsDoTask':
            h5stOptions = {
                appId: '54ed7',
                functionId: 'apsDoTask',
                appid: 'activities_platform',
                clientVersion: '12.3.1',
                client: 'ios',
                body: { taskType: $.taskType, taskId: $.apTaskListid, channel: 4, checkVersion: true, linkId: draw_linkId, itemId: $.taskSourceUrl },
                version: '4.4',
                pin: $.UserName,
                ua: $.UA,
                t: true,
            }
            h5st = await H5st.getH5st(h5stOptions)
            url = 'https://api.m.jd.com/api'
            body = h5st.paramsData
            break
        case 'wheelsLottery':
            h5stOptions = {
                appId: 'bd6c8',
                functionId: 'wheelsLottery',
                appid: 'activities_platform',
                clientVersion: '12.3.1',
                client: 'ios',
                body: { linkId: draw_linkId },
                version: '4.4',
                pin: $.UserName,
                ua: $.UA,
                t: true,
            }
            h5st = await H5st.getH5st(h5stOptions)
            url = 'https://api.m.jd.com/api'
            body = h5st.paramsData
            break
        case 'apTaskList':
            method = 'GET',
            bodystr = { linkId: draw_linkId },
            url = `https://api.m.jd.com/api?functionId=apTaskList&body=${encodeURIComponent(JSON.stringify(bodystr))}&t=${time}&appid=activities_platform&client=ios&clientVersion=12.3.1`
            break
        default:
            console.log(`❌ 未知请求 ${type}`)
            return
    }
    // 通用参数
    const commonParams = {
        cthr: 1,
    }
    if (body) {
        body = { ...body, ...commonParams }
    }
    if (params) {
        params = { ...params, ...commonParams }
    }
    const requestOptions = {
        url: url,
        method: method,
        headers: {
            Accept: 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'zh-cn',
            Connection: 'keep-alive',
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: cookie,
            Host: 'api.m.jd.com',
            Referer: 'https://h5.m.jd.com/',
            'X-Referer-Page': 'https://h5.m.jd.com/pb/015686010/Bc9WX7MpCW7nW9QjZ5N3fFeJXMH/index.html',
            Origin: 'https://h5.m.jd.com',
            'x-rp-client': 'h5_1.0.0',
            'User-Agent': $.UA,
        },
        params: params,
        data: body,
        timeout: 30000,
    }
    if (method === 'GET') {
        delete requestOptions.data
        delete requestOptions.headers['Content-Type']
    }
    if (['wheelsHome', 'apsDoTask', 'wheelsLottery', 'apTaskList'].includes(type)) {
        requestOptions.headers['Referer'] = 'https://lotterydraw-new.jd.com/?id=VssYBUKJOen7HZXpC8dRFA'
        requestOptions.headers['Origin'] = 'https://lotterydraw-new.jd.com'
        requestOptions.headers['X-Referer-Page'] = 'https://lotterydraw-new.jd.com/'
    }
    if (!params) {
        delete requestOptions.params
    }
    // console.log(requestOptions);
    const maxRequestTimes = 1 // 请求尝试次数
    let requestFailedTimes = 0 // 连续请求失败次数
    let lastErrorMsg = null // 请求失败的信息
    let ipBlack = false // IP是否被限制
    while (requestFailedTimes < maxRequestTimes) {
        // 增加请求间隔，防止频繁请求被服务器拒绝
        if (requestFailedTimes > 0) {
            await $.wait(1000)
        }
        const res = await common.request(requestOptions)
        // 请求失败
        if (!res.success) {
            lastErrorMsg = `🚫 ${type} 请求失败 ➜ ${res.error}`
            requestFailedTimes++
            continue
        }
        // 请求成功，但响应数据为空
        if (!res?.data) {
            lastErrorMsg = `🚫 ${type} 请求失败 ➜ 无响应数据`
            requestFailedTimes++
            continue
        }
        // 处理接口响应body
        handleResponse(type, res.data)
        ipBlack = false
        break
    }
    // 达到最大重试次数仍失败后的处理
    if (requestFailedTimes >= maxRequestTimes) {
        console.log(lastErrorMsg)
        if (ipBlack) {
            $.outFlag = true
            if ($.message) {
                $.message.fix(lastErrorMsg)
            }
        }
    }
}
// prettier-ignore
function Env(t, e) { "undefined" != typeof process && JSON.stringify(process.env).indexOf("GITHUB") > -1 && process.exit(0); class s { constructor(t) { this.env = t } send(t, e = "GET") { t = "string" == typeof t ? { url: t } : t; let s = this.get; return "POST" === e && (s = this.post), new Promise((e, i) => { s.call(this, t, (t, s, r) => { t ? i(t) : e(s) }) }) } get(t) { return this.send.call(this.env, t) } post(t) { return this.send.call(this.env, t, "POST") } } return new class { constructor(t, e) { this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.startTime = (new Date).getTime(), Object.assign(this, e), this.log("", `🔔${this.name}, 开始!`) } isNode() { return "undefined" != typeof module && !!module.exports } isQuanX() { return "undefined" != typeof $task } isSurge() { return "undefined" != typeof $httpClient && "undefined" == typeof $loon } isLoon() { return "undefined" != typeof $loon } toObj(t, e = null) { try { return JSON.parse(t) } catch { return e } } toStr(t, e = null) { try { return JSON.stringify(t) } catch { return e } } getjson(t, e) { let s = e; const i = this.getdata(t); if (i) try { s = JSON.parse(this.getdata(t)) } catch { } return s } setjson(t, e) { try { return this.setdata(JSON.stringify(t), e) } catch { return !1 } } getScript(t) { return new Promise(e => { this.get({ url: t }, (t, s, i) => e(i)) }) } runScript(t, e) { return new Promise(s => { let i = this.getdata("@chavy_boxjs_userCfgs.httpapi"); i = i ? i.replace(/\n/g, "").trim() : i; let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout"); r = r ? 1 * r : 20, r = e && e.timeout ? e.timeout : r; const [o, h] = i.split("@"), n = { url: `http://${h}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: r }, headers: { "X-Key": o, Accept: "*/*" } }; this.post(n, (t, e, i) => s(i)) }).catch(t => this.logErr(t)) } loaddata() { if (!this.isNode()) return {}; { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e); if (!s && !i) return {}; { const i = s ? t : e; try { return JSON.parse(this.fs.readFileSync(i)) } catch (t) { return {} } } } } writedata() { if (this.isNode()) { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e), r = JSON.stringify(this.data); s ? this.fs.writeFileSync(t, r) : i ? this.fs.writeFileSync(e, r) : this.fs.writeFileSync(t, r) } } lodash_get(t, e, s) { const i = e.replace(/\[(\d+)\]/g, ".$1").split("."); let r = t; for (const t of i) if (r = Object(r)[t], void 0 === r) return s; return r } lodash_set(t, e, s) { return Object(t) !== t ? t : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce((t, s, i) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[i + 1]) >> 0 == +e[i + 1] ? [] : {}, t)[e[e.length - 1]] = s, t) } getdata(t) { let e = this.getval(t); if (/^@/.test(t)) { const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t), r = s ? this.getval(s) : ""; if (r) try { const t = JSON.parse(r); e = t ? this.lodash_get(t, i, "") : e } catch (t) { e = "" } } return e } setdata(t, e) { let s = !1; if (/^@/.test(e)) { const [, i, r] = /^@(.*?)\.(.*?)$/.exec(e), o = this.getval(i), h = i ? "null" === o ? null : o || "{}" : "{}"; try { const e = JSON.parse(h); this.lodash_set(e, r, t), s = this.setval(JSON.stringify(e), i) } catch (e) { const o = {}; this.lodash_set(o, r, t), s = this.setval(JSON.stringify(o), i) } } else s = this.setval(t, e); return s } getval(t) { return this.isSurge() || this.isLoon() ? $persistentStore.read(t) : this.isQuanX() ? $prefs.valueForKey(t) : this.isNode() ? (this.data = this.loaddata(), this.data[t]) : this.data && this.data[t] || null } setval(t, e) { return this.isSurge() || this.isLoon() ? $persistentStore.write(t, e) : this.isQuanX() ? $prefs.setValueForKey(t, e) : this.isNode() ? (this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0) : this.data && this.data[e] || null } initGotEnv(t) { this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar)) } get(t, e = (() => { })) { t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"]), this.isSurge() || this.isLoon() ? (this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.get(t, (t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i) })) : this.isQuanX() ? (this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => e(t))) : this.isNode() && (this.initGotEnv(t), this.got(t).on("redirect", (t, e) => { try { if (t.headers["set-cookie"]) { const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar } } catch (t) { this.logErr(t) } }).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => { const { message: s, response: i } = t; e(s, i, i && i.body) })) } post(t, e = (() => { })) { if (t.body && t.headers && !t.headers["Content-Type"] && (t.headers["Content-Type"] = "application/x-www-form-urlencoded"), t.headers && delete t.headers["Content-Length"], this.isSurge() || this.isLoon()) this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.post(t, (t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i) }); else if (this.isQuanX()) t.method = "POST", this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => e(t)); else if (this.isNode()) { this.initGotEnv(t); const { url: s, ...i } = t; this.got.post(s, i).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => { const { message: s, response: i } = t; e(s, i, i && i.body) }) } } time(t, e = null) { const s = e ? new Date(e) : new Date; let i = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds() }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let e in i) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? i[e] : ("00" + i[e]).substr(("" + i[e]).length))); return t } msg(e = t, s = "", i = "", r) { const o = t => { if (!t) return t; if ("string" == typeof t) return this.isLoon() ? t : this.isQuanX() ? { "open-url": t } : this.isSurge() ? { url: t } : void 0; if ("object" == typeof t) { if (this.isLoon()) { let e = t.openUrl || t.url || t["open-url"], s = t.mediaUrl || t["media-url"]; return { openUrl: e, mediaUrl: s } } if (this.isQuanX()) { let e = t["open-url"] || t.url || t.openUrl, s = t["media-url"] || t.mediaUrl; return { "open-url": e, "media-url": s } } if (this.isSurge()) { let e = t.url || t.openUrl || t["open-url"]; return { url: e } } } }; if (this.isMute || (this.isSurge() || this.isLoon() ? $notification.post(e, s, i, o(r)) : this.isQuanX() && $notify(e, s, i, o(r))), !this.isMuteLog) { let t = ["", "==============📣系统通知📣=============="]; t.push(e), s && t.push(s), i && t.push(i), console.log(t.join("\n")), this.logs = this.logs.concat(t) } } log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator)) } logErr(t, e) { const s = !this.isSurge() && !this.isQuanX() && !this.isLoon(); s ? this.log("", `❗️${this.name}, 错误!`, t.stack) : this.log("", `❗️${this.name}, 错误!`, t) } wait(t) { return new Promise(e => setTimeout(e, t)) } done(t = {}) { const e = (new Date).getTime(), s = (e - this.startTime) / 1e3; this.log("", `🔔${this.name}, 结束! 🕛 ${s} 秒`), this.log(), (this.isSurge() || this.isQuanX() || this.isLoon()) && $done(t) } }(t, e) }
