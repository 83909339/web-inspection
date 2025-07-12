// Web系统巡检助手 - 后台脚本
class InspectionService {
    constructor() {
        this.isRunning = false;
        this.inspectionInterval = 30; // 默认30分钟
        this.alarmName = 'inspection-alarm';
        this.maxResults = 100; // 最大保存结果数
        this.init();
    }

    // 初始化服务
    async init() {
        // 监听消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });

        // 监听定时器
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === this.alarmName) {
                this.runInspection();
            }
        });

        // 监听扩展图标点击事件，打开管理界面
        chrome.action.onClicked.addListener(() => {
            chrome.tabs.create({
                url: chrome.runtime.getURL('inspection-panel.html')
            });
        });

        // 监听插件启动
        chrome.runtime.onStartup.addListener(() => {
            this.loadSettings();
        });

        // 监听插件安装
        chrome.runtime.onInstalled.addListener(() => {
            this.loadSettings();
        });

        // 加载设置
        await this.loadSettings();
    }

    // 加载设置
    async loadSettings() {
        try {
            const syncResult = await chrome.storage.sync.get(['interval', 'autoStart']);
            const localResult = await chrome.storage.local.get(['inspectionActive']);
            
            this.inspectionInterval = syncResult.interval || 30;
            this.isRunning = localResult.inspectionActive || false;
            
            // 如果之前是运行状态，恢复运行
            if (this.isRunning) {
                console.log('恢复巡检状态...');
                // 重新创建定时器
                chrome.alarms.create(this.alarmName, {
                    delayInMinutes: this.inspectionInterval,
                    periodInMinutes: this.inspectionInterval
                });
            }
            
            // 如果设置了自动启动，则启动巡检
            if (syncResult.autoStart && !this.isRunning) {
                this.startInspection();
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    // 处理消息
    handleMessage(message, sender, sendResponse) {
        // 兼容两种消息格式：type 和 action
        const messageType = message.type || message.action;
        
        console.log(`[消息处理] 收到消息:`, messageType, message);
        
        switch (messageType) {
            case 'startInspection':
                console.log(`[消息处理] 开始处理 startInspection 消息`);
                // 立即发送响应，不等待异步操作
                sendResponse({ success: true });
                console.log(`[消息处理] startInspection 响应已发送`);
                
                // 异步执行启动操作
                this.startInspection().then(() => {
                    console.log(`[消息处理] startInspection 异步操作完成`);
                }).catch(error => {
                    console.error(`[消息处理] startInspection 异步操作失败:`, error);
                });
                break;
            
            case 'stopInspection':
                console.log(`[消息处理] 开始处理 stopInspection 消息`);
                // 立即发送响应，不等待异步操作
                sendResponse({ success: true });
                console.log(`[消息处理] stopInspection 响应已发送`);
                
                // 异步执行停止操作
                this.stopInspection().then(() => {
                    console.log(`[消息处理] stopInspection 异步操作完成`);
                }).catch(error => {
                    console.error(`[消息处理] stopInspection 异步操作失败:`, error);
                });
                break;
            
            case 'getStatus':
                console.log(`[消息处理] 获取状态:`, this.isRunning);
                sendResponse({ isRunning: this.isRunning });
                break;
            
            case 'updateInterval':
                console.log(`[消息处理] 更新间隔:`, message.interval);
                this.updateInterval(message.interval);
                sendResponse({ success: true });
                break;
            
            case 'runOnce':
                console.log(`[消息处理] 手动执行一次巡检`);
                this.runInspection().then(() => {
                    console.log(`[消息处理] 手动巡检完成`);
                }).catch(error => {
                    console.error(`[消息处理] 手动巡检失败:`, error);
                });
                sendResponse({ success: true });
                break;
            
            case 'pageInspectionResult':
                console.log(`[消息处理] 收到页面巡检结果:`, message.data);
                this.handlePageResult(message.data);
                sendResponse({ success: true });
                break;
            
            case 'pageError':
                console.log(`[消息处理] 收到页面错误:`, message.data);
                // 处理页面错误但不影响主流程
                sendResponse({ success: true });
                break;
            
            default:
                console.warn('[消息处理] 未知消息类型:', messageType);
                sendResponse({ error: '未知消息类型' });
        }
    }

    // 启动巡检
    async startInspection() {
        try {
            console.log('[启动巡检] 开始启动巡检...');
            
            if (this.isRunning) {
                console.log('[启动巡检] 巡检已经在运行中，直接返回');
                return Promise.resolve(); // 返回resolved Promise
            }

            console.log('[启动巡检] 设置运行状态为 true');
            this.isRunning = true;
            
            // 保存状态到存储
            console.log('[启动巡检] 保存状态到存储...');
            await chrome.storage.local.set({ inspectionActive: true });
            console.log('[启动巡检] 状态已保存到存储');
            
            // 创建定时器
            console.log('[启动巡检] 创建定时器，间隔:', this.inspectionInterval, '分钟');
            chrome.alarms.create(this.alarmName, {
                delayInMinutes: this.inspectionInterval,
                periodInMinutes: this.inspectionInterval
            });
            console.log('[启动巡检] 定时器已创建');

            // 立即执行一次巡检
            console.log('[启动巡检] 立即执行一次巡检...');
            this.runInspection().then(() => {
                console.log('[启动巡检] 首次巡检执行完成');
            }).catch(error => {
                console.error('[启动巡检] 首次巡检执行失败:', error);
                // 不阻塞启动流程，只记录错误
            });
            
            // 通知popup更新状态
            console.log('[启动巡检] 通知popup更新状态...');
            this.notifyPopup('statusUpdate');
            
            console.log('[启动巡检] 巡检启动成功, 间隔:', this.inspectionInterval, '分钟');
            return Promise.resolve(); // 明确返回resolved Promise
            
        } catch (error) {
            console.error('[启动巡检] 启动巡检失败:', error);
            this.isRunning = false;
            try {
                await chrome.storage.local.set({ inspectionActive: false });
            } catch (storageError) {
                console.error('[启动巡检] 恢复状态失败:', storageError);
            }
            throw error; // 重新抛出错误供调用者处理
        }
    }

    // 停止巡检
    async stopInspection() {
        try {
            console.log('[停止巡检] 开始停止巡检...');
            
            if (!this.isRunning) {
                console.log('[停止巡检] 巡检已经停止，直接返回');
                return Promise.resolve(); // 返回resolved Promise
            }

            console.log('[停止巡检] 设置运行状态为 false');
            this.isRunning = false;
            
            // 保存状态到存储
            console.log('[停止巡检] 保存状态到存储...');
            await chrome.storage.local.set({ inspectionActive: false });
            console.log('[停止巡检] 状态已保存到存储');
            
            // 清除定时器
            console.log('[停止巡检] 清除定时器...');
            chrome.alarms.clear(this.alarmName);
            console.log('[停止巡检] 定时器已清除');
            
            // 通知popup更新状态
            console.log('[停止巡检] 通知popup更新状态...');
            this.notifyPopup('statusUpdate');
            
            console.log('[停止巡检] 巡检停止成功');
            return Promise.resolve(); // 明确返回resolved Promise
            
        } catch (error) {
            console.error('[停止巡检] 停止巡检失败:', error);
            throw error; // 重新抛出错误供调用者处理
        }
    }

    // 更新间隔
    async updateInterval(interval) {
        console.log('[更新间隔] 更新间隔为:', interval, '分钟');
        this.inspectionInterval = interval;
        
        // 如果正在运行，重新创建定时器
        if (this.isRunning) {
            console.log('[更新间隔] 重新创建定时器...');
            chrome.alarms.clear(this.alarmName);
            chrome.alarms.create(this.alarmName, {
                delayInMinutes: interval,
                periodInMinutes: interval
            });
            console.log('[更新间隔] 定时器已重新创建');
        }
        
        console.log('[更新间隔] 巡检间隔更新完成');
    }

    // 执行巡检
    async runInspection() {
        console.log('[执行巡检] 开始执行巡检...');
        
        try {
            // 获取配置
            console.log('[执行巡检] 获取配置...');
            const config = await chrome.storage.sync.get(['apis', 'pages']);
            const apis = config.apis || [];
            const pages = config.pages || [];
            
            console.log('[执行巡检] 巡检配置:', { apis: apis.length, pages: pages.length });
            
            if (apis.length === 0 && pages.length === 0) {
                console.log('[执行巡检] 没有配置巡检项，跳过巡检');
                return Promise.resolve(); // 明确返回resolved Promise
            }

            // 并发执行接口和页面巡检
            const results = [];
            
            // 接口巡检
            console.log('[执行巡检] 开始接口巡检，共', apis.length, '个接口');
            for (let i = 0; i < apis.length; i++) {
                const api = apis[i];
                try {
                    console.log(`[执行巡检] 巡检接口 ${i + 1}/${apis.length}:`, api.name);
                    const result = await this.inspectApi(api);
                    console.log(`[执行巡检] 接口巡检完成:`, api.name, result.status);
                    results.push(result);
                } catch (error) {
                    console.error('[执行巡检] 接口巡检失败:', api.name, error);
                    results.push({
                        id: api.id,
                        name: api.name,
                        url: api.url,
                        type: 'api',
                        status: 'error',
                        error: error.message,
                        timestamp: Date.now()
                    });
                }
            }

            // 页面巡检（串行执行，避免同时创建太多标签页）
            console.log('[执行巡检] 开始页面巡检，共', pages.length, '个页面');
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                try {
                    console.log(`[执行巡检] 巡检页面 ${i + 1}/${pages.length}:`, page.name);
                    const result = await this.inspectPage(page);
                    console.log(`[执行巡检] 页面巡检完成:`, page.name, result.status);
                    results.push(result);
                } catch (error) {
                    console.error('[执行巡检] 页面巡检失败:', page.name, error);
                    results.push({
                        id: page.id,
                        name: page.name,
                        url: page.url,
                        type: 'page',
                        status: 'error',
                        error: error.message,
                        timestamp: Date.now()
                    });
                }
            }

            // 保存结果
            console.log('[执行巡检] 保存结果，共', results.length, '个结果');
            await this.saveResults(results);
            
            // 检查告警
            console.log('[执行巡检] 检查告警...');
            this.checkAlerts(results);
            
            // 通知popup更新
            console.log('[执行巡检] 通知popup更新结果...');
            this.notifyPopup('resultsUpdate');
            
            const successCount = results.filter(r => r.status === 'success').length;
            const errorCount = results.filter(r => r.status === 'error').length;
            console.log(`[执行巡检] 巡检完成，总计${results.length}个项目，成功${successCount}个，失败${errorCount}个`);
            
        } catch (error) {
            console.error('[执行巡检] 巡检执行失败:', error);
            throw error; // 重新抛出错误供调用者处理
        }
    }

    // 巡检接口
    async inspectApi(api) {
        const startTime = Date.now();
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
            
            const response = await fetch(api.url, {
                method: api.method || 'GET',
                credentials: 'include', // 携带Cookie
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            let responseData;
            try {
                responseData = await response.json();
            } catch (e) {
                responseData = await response.text();
            }
            
            // 应用告警规则
            let alertTriggered = false;
            if (api.alertRule) {
                try {
                    // 创建安全的执行环境
                    const alertFunction = new Function('response', `return ${api.alertRule}`);
                    alertTriggered = alertFunction(responseData);
                } catch (e) {
                    console.error('告警规则执行失败:', e);
                }
            }
            
            return {
                id: api.id,
                name: api.name,
                url: api.url,
                type: 'api',
                status: alertTriggered ? 'error' : 'success',
                duration,
                responseData,
                error: alertTriggered ? '触发告警规则' : null,
                timestamp: Date.now()
            };
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            return {
                id: api.id,
                name: api.name,
                url: api.url,
                type: 'api',
                status: 'error',
                duration,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    // 巡检页面
    async inspectPage(page) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            // 创建隐藏标签页进行巡检
            chrome.tabs.create({
                url: page.url,
                active: false // 隐藏标签页，避免干扰用户
            }, async (tab) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                const tabId = tab.id;
                let resolved = false;
                
                // 设置超时
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        chrome.tabs.remove(tabId).catch(() => {});
                        reject(new Error('页面加载超时'));
                    }
                }, 30000); // 减少到30秒超时
                
                // 监听标签页更新
                const onUpdated = (updatedTabId, changeInfo, updatedTab) => {
                    if (updatedTabId !== tabId) return;
                    
                    console.log(`[页面巡检] 标签页 ${tabId} 状态更新:`, changeInfo.status);
                    
                    if (changeInfo.status === 'complete' && !resolved) {
                        console.log(`[页面巡检] 页面加载完成，等待3秒后收集信息...`);
                        
                        // 页面加载完成后等待一段时间再收集信息
                        setTimeout(() => {
                            if (!resolved) {
                                resolved = true;
                                clearTimeout(timeout);
                                chrome.tabs.onUpdated.removeListener(onUpdated);
                                
                                console.log(`[页面巡检] 开始收集页面信息...`);
                                
                                // 页面加载完成，开始收集信息
                                this.collectPageInfo(tabId, page, startTime)
                                    .then(resolve)
                                    .catch(reject);
                            }
                        }, 3000); // 等待3秒让页面完全加载
                    }
                };
                
                chrome.tabs.onUpdated.addListener(onUpdated);
            });
        });
    }

    // 收集页面信息
    async collectPageInfo(tabId, page, startTime) {
        try {
            console.log(`[页面信息收集] 开始收集页面信息，标签页ID: ${tabId}, 页面: ${page.name}`);
            const duration = Date.now() - startTime;
            let pageInfo = null;
            let errorMessage = null;
            
            try {
                console.log(`[页面信息收集] 向标签页 ${tabId} 注入脚本...`);
                console.log(`[页面信息收集] 页面URL: ${page.url}`);
                
                // 先检查标签页是否存在
                let tab;
                try {
                    tab = await chrome.tabs.get(tabId);
                    console.log(`[页面信息收集] 标签页状态: ${tab.status}, URL: ${tab.url}`);
                } catch (tabError) {
                    console.error(`[页面信息收集] 标签页 ${tabId} 不存在:`, tabError);
                    throw new Error(`标签页不存在: ${tabError.message}`);
                }
                
                // 检查标签页是否已经完成加载
                if (tab.status !== 'complete') {
                    console.log(`[页面信息收集] 标签页未完成加载，当前状态: ${tab.status}`);
                    // 等待额外时间让页面完成加载
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // 重新检查标签页状态
                    tab = await chrome.tabs.get(tabId);
                    console.log(`[页面信息收集] 重新检查标签页状态: ${tab.status}`);
                }
                
                // 注入脚本收集页面信息
                console.log(`[页面信息收集] 开始执行脚本注入...`);
                const results = await chrome.scripting.executeScript({
                    target: { tabId },
                    function: this.getPageInfo
                });
                
                console.log(`[页面信息收集] 脚本执行完成，结果数量: ${results ? results.length : 0}`);
                console.log(`[页面信息收集] 脚本执行原始结果:`, results);
                
                if (results && results.length > 0) {
                    console.log(`[页面信息收集] 检查结果[0]:`, results[0]);
                    if (results[0] && results[0].result !== undefined && results[0].result !== null) {
                        pageInfo = results[0].result;
                        console.log(`[页面信息收集] 成功收集到页面信息:`, pageInfo);
                    } else {
                        console.warn(`[页面信息收集] 脚本执行返回null或undefined:`, results[0]);
                        
                        // 尝试获取页面基本信息
                        const basicInfo = await this.getBasicPageInfo(tabId);
                        if (basicInfo) {
                            pageInfo = basicInfo;
                            console.log(`[页面信息收集] 使用基本页面信息:`, pageInfo);
                        } else {
                            throw new Error('脚本执行返回null，且无法获取基本页面信息');
                        }
                    }
                } else {
                    console.warn(`[页面信息收集] 脚本执行结果为空或未定义`);
                    throw new Error('脚本执行失败：无返回结果');
                }
            } catch (scriptError) {
                console.error('[页面信息收集] 脚本执行失败:', scriptError);
                errorMessage = `脚本执行失败: ${scriptError.message}`;
                
                // 尝试获取页面基本信息作为备用
                try {
                    const basicInfo = await this.getBasicPageInfo(tabId);
                    if (basicInfo) {
                        pageInfo = basicInfo;
                        pageInfo.errors = [errorMessage];
                        console.log(`[页面信息收集] 使用基本页面信息作为备用:`, pageInfo);
                    } else {
                        throw new Error('无法获取任何页面信息');
                    }
                } catch (basicError) {
                    console.error('[页面信息收集] 获取基本页面信息也失败:', basicError);
                    pageInfo = {
                        errors: [errorMessage, `获取基本信息失败: ${basicError.message}`],
                        performance: {},
                        url: page.url,
                        title: '无法获取',
                        timestamp: Date.now()
                    };
                }
            }
            
            // 截图（如果需要）
            let screenshot = null;
            if (page.screenshot) {
                console.log(`[页面信息收集] 开始截图...`);
                try {
                    // 临时激活标签页进行截图
                    await chrome.tabs.update(tabId, { active: true });
                    console.log(`[页面信息收集] 标签页已激活，等待截图...`);
                    
                    // 等待标签页切换完成
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // 尝试截图，如果失败就跳过
                    try {
                        screenshot = await chrome.tabs.captureVisibleTab(null, {
                            format: 'jpeg',
                            quality: 70
                        });
                        console.log(`[页面信息收集] 截图成功，数据长度: ${screenshot ? screenshot.length : 0}`);
                    } catch (captureError) {
                        console.log(`[页面信息收集] 截图失败:`, captureError.message);
                        // 截图失败不影响整个巡检流程
                    }
                } catch (error) {
                    console.log('[页面信息收集] 截图处理失败:', error.message);
                    // 截图相关错误不记录到巡检错误中，因为这不是页面本身的问题
                }
            }
            
            // 关闭标签页
            console.log(`[页面信息收集] 关闭标签页 ${tabId}...`);
            chrome.tabs.remove(tabId).catch((error) => {
                console.warn(`[页面信息收集] 关闭标签页失败:`, error);
            });
            
            // 确保pageInfo和errors存在
            if (!pageInfo) {
                console.warn(`[页面信息收集] pageInfo为空，使用默认值`);
                pageInfo = {
                    errors: ['页面信息收集失败'],
                    performance: {},
                    url: page.url,
                    title: '无法获取',
                    timestamp: Date.now()
                };
            }
            
            if (!pageInfo.errors || !Array.isArray(pageInfo.errors)) {
                console.log(`[页面信息收集] 修正errors字段`);
                pageInfo.errors = [];
            }
            
            const result = {
                id: page.id,
                name: page.name,
                url: page.url,
                type: 'page',
                status: pageInfo.errors.length > 0 ? 'error' : 'success',
                duration,
                pageInfo,
                screenshot,
                error: pageInfo.errors.length > 0 ? pageInfo.errors.join('; ') : null,
                timestamp: Date.now()
            };
            
            console.log(`[页面信息收集] 页面信息收集完成，状态: ${result.status}, 错误数量: ${pageInfo.errors.length}`);
            return result;
            
        } catch (error) {
            console.error(`[页面信息收集] 页面信息收集失败:`, error);
            
            // 确保关闭标签页
            chrome.tabs.remove(tabId).catch(() => {});
            
            // 返回错误结果而不是抛出异常
            const errorResult = {
                id: page.id,
                name: page.name,
                url: page.url,
                type: 'page',
                status: 'error',
                duration: Date.now() - startTime,
                pageInfo: {
                    errors: [error.message],
                    performance: {},
                    url: page.url,
                    title: '无法获取',
                    timestamp: Date.now()
                },
                screenshot: null,
                error: error.message,
                timestamp: Date.now()
            };
            
            console.log(`[页面信息收集] 返回错误结果:`, errorResult);
            return errorResult;
        }
    }

    // 获取基本页面信息（备用方法）
    async getBasicPageInfo(tabId) {
        try {
            console.log(`[基本页面信息] 获取标签页 ${tabId} 基本信息...`);
            
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                function: () => {
                    return {
                        url: window.location.href,
                        title: document.title,
                        timestamp: Date.now(),
                        errors: [],
                        performance: {},
                        basic: true
                    };
                }
            });
            
            if (results && results[0] && results[0].result) {
                console.log(`[基本页面信息] 成功获取基本信息:`, results[0].result);
                return results[0].result;
            } else {
                console.warn(`[基本页面信息] 获取基本信息失败`);
                return null;
            }
        } catch (error) {
            console.error(`[基本页面信息] 获取基本信息异常:`, error);
            return null;
        }
    }

    // 在页面中执行的信息收集函数
    getPageInfo() {
        console.log('[页面脚本] 开始执行页面信息收集...');
        
        try {
            const errors = [];
            const performance = {};
            
            console.log('[页面脚本] 收集性能信息...');
            // 收集性能信息
            try {
                if (window.performance && window.performance.timing) {
                    const timing = window.performance.timing;
                    if (timing.loadEventEnd && timing.navigationStart) {
                        performance.loadTime = timing.loadEventEnd - timing.navigationStart;
                    }
                    if (timing.domContentLoadedEventEnd && timing.navigationStart) {
                        performance.domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
                    }
                    if (timing.responseEnd && timing.requestStart) {
                        performance.networkTime = timing.responseEnd - timing.requestStart;
                    }
                }
                console.log('[页面脚本] 性能信息收集完成:', performance);
            } catch (perfError) {
                console.error('[页面脚本] 性能信息收集失败:', perfError);
            }
            
            console.log('[页面脚本] 检查资源加载错误...');
            // 检查资源加载错误
            try {
                const images = document.querySelectorAll('img');
                console.log(`[页面脚本] 检查 ${images.length} 个图片...`);
                images.forEach((img, index) => {
                    try {
                        if (img.complete && img.naturalWidth === 0 && img.src) {
                            errors.push(`图片加载失败: ${img.src}`);
                        }
                    } catch (imgError) {
                        console.warn(`[页面脚本] 图片 ${index} 检查失败:`, imgError);
                    }
                });
            } catch (imgCheckError) {
                console.error('[页面脚本] 图片检查失败:', imgCheckError);
            }
            
            console.log('[页面脚本] 基本页面检查...');
            // 基本页面检查
            try {
                if (!document.title || document.title.trim() === '') {
                    errors.push('页面标题为空');
                }
                
                if (document.body && document.body.children.length === 0) {
                    errors.push('页面内容为空');
                }
                
                console.log(`[页面脚本] 页面标题: ${document.title}`);
                console.log(`[页面脚本] 页面子元素数量: ${document.body ? document.body.children.length : 0}`);
            } catch (basicCheckError) {
                console.error('[页面脚本] 基本检查失败:', basicCheckError);
            }
            
            console.log('[页面脚本] 检查错误元素...');
            // 检查是否有明显的错误指示
            try {
                const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"], [id*="error"], [id*="Error"]');
                if (errorElements.length > 0) {
                    errors.push(`发现${errorElements.length}个可能的错误元素`);
                }
                console.log(`[页面脚本] 找到 ${errorElements.length} 个错误元素`);
            } catch (errorCheckError) {
                console.error('[页面脚本] 错误元素检查失败:', errorCheckError);
            }
            
            const result = {
                errors: errors,
                performance: performance,
                url: window.location.href,
                title: document.title || '无标题',
                timestamp: Date.now()
            };
            
            console.log('[页面脚本] 页面信息收集完成，结果:', result);
            return result;
            
        } catch (error) {
            console.error('[页面脚本] 页面信息收集整体失败:', error);
            
            // 如果整个函数执行失败，返回基本信息
            const errorResult = {
                errors: [`页面信息收集失败: ${error.message}`],
                performance: {},
                url: window.location.href,
                title: document.title || '无标题',
                timestamp: Date.now()
            };
            
            console.log('[页面脚本] 返回错误结果:', errorResult);
            return errorResult;
        }
    }

    // 保存结果
    async saveResults(newResults) {
        try {
            const result = await chrome.storage.local.get(['inspectionResults']);
            const existingResults = result.inspectionResults || [];
            
            // 合并新结果
            const allResults = [...existingResults, ...newResults];
            
            // 保持最新的结果，移除过旧的
            const maxResults = this.maxResults;
            const trimmedResults = allResults.slice(-maxResults);
            
            // 按时间戳排序
            trimmedResults.sort((a, b) => b.timestamp - a.timestamp);
            
            await chrome.storage.local.set({ inspectionResults: trimmedResults });
            
        } catch (error) {
            console.error('保存结果失败:', error);
        }
    }

    // 检查告警
    checkAlerts(results) {
        const errorResults = results.filter(r => r.status === 'error');
        
        if (errorResults.length > 0) {
            errorResults.forEach(result => {
                this.sendNotification(result);
            });
        }
    }

    // 发送通知
    sendNotification(result) {
        const title = result.type === 'api' ? '接口告警' : '页面告警';
        const message = `${result.name}: ${result.error || '检查失败'}`;
        
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: title,
            message: message,
            contextMessage: result.url,
            priority: 2
        });
        
        console.log('发送告警通知:', title, message);
    }

    // 通知popup
    notifyPopup(type) {
        try {
            chrome.runtime.sendMessage({ type });
        } catch (error) {
            // popup可能没有打开，忽略错误
        }
    }

    // 处理页面巡检结果
    handlePageResult(data) {
        // 由content script发送的页面信息
        console.log('收到页面巡检结果:', data);
    }
}

// 创建服务实例
const inspectionService = new InspectionService();

// 导出服务（用于调试）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InspectionService;
} 